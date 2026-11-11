package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/brojyf/keysy/api/internal/config"
	"github.com/brojyf/keysy/api/internal/jwks"
	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/brojyf/keysy/api/internal/router"
	"github.com/brojyf/keysy/api/internal/telemetry"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/bridges/otelslog"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/plugin/opentelemetry/tracing"
)

func main() {
	c, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	stopTelemetry, err := telemetry.Start(ctx, "keysy-api")
	if err != nil {
		log.Fatal("telemetry initialization failed")
	}
	requestLogger := slog.New(slog.NewMultiHandler(slog.NewJSONHandler(os.Stdout, nil), otelslog.NewHandler("github.com/brojyf/keysy/api")))
	slog.SetDefault(requestLogger)
	db, err := gorm.Open(postgres.Open(c.DatabaseURL), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		log.Fatal("database connection failed")
	}
	if err := db.Use(tracing.NewPlugin(tracing.WithoutQueryVariables())); err != nil {
		log.Fatal("database tracing failed")
	}
	keys, err := jwks.New(ctx, c.SupabaseURL+"/auth/v1/.well-known/jwks.json")
	if err != nil {
		log.Fatal("JWKS initialization failed")
	}
	gin.SetMode(gin.ReleaseMode)
	engine := router.New(router.Deps{
		DB:        db,
		Logger:    requestLogger,
		WebAppURL: c.WebAppURL,
		Session:   middleware.Session(c.CookieKey, c.LocalHTTP, c.SupabaseURL+"/auth/v1", keys.KeyfuncCtx, keys.Available),
	})
	if err := engine.SetTrustedProxies(nil); err != nil {
		log.Fatal(err)
	}
	server := &http.Server{Addr: ":" + c.Port, Handler: engine, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		log.Fatal(err)
	}
	if c.LocalHTTP {
		fmt.Printf("- Local:         http://localhost:%s\n", c.Port)
	}
	go func() {
		if err := server.Serve(listener); err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
	_ = stopTelemetry(shutdownCtx)
}
