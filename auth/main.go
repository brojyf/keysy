package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/brojyf/keysy/auth/internal/config"
	"github.com/brojyf/keysy/auth/internal/login"
	"github.com/brojyf/keysy/auth/internal/middleware"
	"github.com/brojyf/keysy/auth/internal/telemetry"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel"
	"golang.org/x/oauth2"
)

func main() {
	c, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	stopTelemetry, err := telemetry.Start(ctx, "keysy-auth")
	if err != nil {
		log.Fatal("telemetry initialization failed")
	}
	// Log route templates only: callback URLs carry short-lived authorization codes.
	requestLogger := slog.New(slog.NewMultiHandler(slog.NewJSONHandler(os.Stdout, nil), otelslog.NewHandler("github.com/brojyf/keysy/auth")))
	slog.SetDefault(requestLogger)
	handler, err := login.New(login.Options{
		OAuth: oauth2.Config{
			ClientID: c.GoogleClientID, ClientSecret: c.GoogleClientSecret,
			RedirectURL: c.AuthURL + "/v0/auth/callback", Scopes: []string{"openid", "email", "profile"},
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://accounts.google.com/o/oauth2/v2/auth",
				TokenURL: "https://oauth2.googleapis.com/token", AuthStyle: oauth2.AuthStyleInParams,
			},
		},
		SupabaseURL: c.SupabaseURL, SupabaseKey: c.SupabaseKey, WebAppURL: c.WebAppURL,
		CookieDomain: c.CookieDomain, CookieKey: c.CookieKey, HTTPClient: login.NewHTTPClient(),
	})
	if err != nil {
		log.Fatal(err)
	}
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(middleware.Telemetry(otel.GetTracerProvider(), otel.GetMeterProvider()), middleware.Recovery(requestLogger), middleware.RequestID(), middleware.Log(requestLogger))
	router.HandleMethodNotAllowed = true
	if err := router.SetTrustedProxies(nil); err != nil {
		log.Fatal(err)
	}
	handler.Register(router)
	server := &http.Server{
		Addr: ":" + c.Port, Handler: router, ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 10 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second,
		MaxHeaderBytes: 16 << 10,
	}
	fmt.Printf("- Local:         http://localhost:%s\n", c.Port)
	go func() {
		if err := server.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
	_ = stopTelemetry(shutdownCtx)
}
