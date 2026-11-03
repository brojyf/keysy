package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/brojyf/keysy/api/internal/config"
	"github.com/brojyf/keysy/api/internal/me"
	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/brojyf/keysy/api/internal/profile"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	c, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(c.DatabaseURL), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		log.Fatal("database connection failed")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	keys, err := keyfunc.NewDefaultCtx(ctx, []string{c.SupabaseURL + "/auth/v1/.well-known/jwks.json"})
	if err != nil {
		log.Fatal("JWKS initialization failed")
	}
	gin.SetMode(gin.ReleaseMode)
	requestLogger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	router := gin.New()
	if err := router.SetTrustedProxies(nil); err != nil {
		log.Fatal(err)
	}
	router.Use(middleware.Recovery(requestLogger), middleware.RequestID(), middleware.Log(requestLogger), middleware.Timeout(), middleware.CORS(c.WebAppURL))
	router.OPTIONS("/v0/me")
	router.GET("/v0/me", middleware.Session(c.CookieKey, c.LocalHTTP, c.SupabaseURL+"/auth/v1", keys.KeyfuncCtx), me.Get(profile.Store{DB: db}))
	server := &http.Server{Addr: ":" + c.Port, Handler: router, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	log.Fatal(server.ListenAndServe())
}
