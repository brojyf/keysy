// Package consumer consumes email requests from Kafka and sends them through Resend.
package consumer

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/brojyf/keysy/notify/internal/resend"
	"github.com/twmb/franz-go/pkg/kgo"
)

// MaxAge limits message age because Resend keeps idempotency keys for 24 hours; older messages could send duplicates.
const MaxAge = 24 * time.Hour

type Sender interface {
	Send(context.Context, string, resend.Email) error
}
type Consumer struct {
	Client  *kgo.Client
	Sender  Sender
	Logger  *slog.Logger
	Backoff []time.Duration
	Now     func() time.Time
}

func (c Consumer) Run(ctx context.Context) {
	for {
		fetches := c.Client.PollFetches(ctx)
		if ctx.Err() != nil || fetches.IsClientClosed() {
			return
		}
		for _, e := range fetches.Errors() {
			c.Logger.Warn("notify fetch failed", "topic", e.Topic, "partition", e.Partition, "error", e.Err)
		}
		iter := fetches.RecordIter()
		for !iter.Done() {
			r := iter.Next()
			if !c.handle(ctx, r) {
				return
			}
			if err := c.Client.CommitRecords(ctx, r); err != nil {
				c.Logger.Warn("notify commit failed", "topic", r.Topic, "partition", r.Partition, "offset", r.Offset, "error", err)
			}
		}
	}
}

func (c Consumer) handle(ctx context.Context, r *kgo.Record) bool {
	var id string
	for _, h := range r.Headers {
		if h.Key == "id" {
			id = string(h.Value)
			break
		}
	}
	attrs := []any{"event_id", id, "partition", r.Partition, "offset", r.Offset}
	drop := func(reason string) bool {
		c.Logger.Error("notify email dropped", append(attrs, "reason", reason)...)
		return true
	}
	if id == "" {
		return drop("missing_event_id")
	}
	if c.Now().Sub(r.Timestamp) > MaxAge {
		return drop("expired")
	}
	var email resend.Email
	if json.Unmarshal(r.Value, &email) != nil || email.To == "" || email.Template.ID == "" {
		return drop("invalid_payload")
	}
	attrs = append(attrs, "template", email.Template.ID)
	for attempt := 1; ; attempt++ {
		if ctx.Err() != nil {
			return false
		}
		err := c.Sender.Send(ctx, id, email)
		if ctx.Err() != nil {
			return false
		}
		if err == nil {
			c.Logger.Info("notify email sent", append(attrs, "attempts", attempt)...)
			return true
		}
		if !resend.Retryable(err) || attempt > len(c.Backoff) {
			attrs = append(attrs, "attempts", attempt)
			return drop(resend.Reason(err))
		}
		timer := time.NewTimer(c.Backoff[attempt-1])
		select {
		case <-ctx.Done():
			timer.Stop()
			return false
		case <-timer.C:
		}
	}
}
