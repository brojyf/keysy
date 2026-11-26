package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/brojyf/keysy/notify/internal/config"
	"github.com/brojyf/keysy/notify/internal/consumer"
	"github.com/brojyf/keysy/notify/internal/resend"
	"github.com/brojyf/keysy/notify/internal/telemetry"
	"go.opentelemetry.io/contrib/bridges/otelslog"
)

func main() {
	c, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	shutdown, err := telemetry.Start(ctx, "keysy-notify")
	if err != nil {
		log.Fatal("telemetry initialization failed")
	}
	logger := slog.New(slog.NewMultiHandler(slog.NewJSONHandler(os.Stdout, nil), otelslog.NewHandler("github.com/brojyf/keysy/notify")))
	slog.SetDefault(logger)
	client, err := consumer.NewKafkaClient(c)
	if err != nil {
		log.Fatal("Kafka client initialization failed")
	}
	consumer.Consumer{Client: client, Sender: resend.Client{BaseURL: resend.BaseURL, APIKey: c.ResendAPIKey, HTTP: &http.Client{Timeout: 10 * time.Second}}, Logger: logger, Backoff: []time.Duration{time.Second, 2 * time.Second, 4 * time.Second}, Now: time.Now}.Run(ctx)
	client.Close()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := shutdown(shutdownCtx); err != nil {
		logger.Warn("telemetry shutdown failed", "error", err)
	}
}
