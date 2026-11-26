package consumer

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/brojyf/keysy/notify/internal/resend"
	"github.com/twmb/franz-go/pkg/kgo"
)

type call struct {
	key   string
	email resend.Email
}
type fakeSender struct {
	calls    []call
	failures []error
	signal   chan struct{}
}

func (s *fakeSender) Send(_ context.Context, key string, email resend.Email) error {
	s.calls = append(s.calls, call{key, email})
	if s.signal != nil {
		s.signal <- struct{}{}
	}
	i := len(s.calls) - 1
	if i < len(s.failures) {
		return s.failures[i]
	}
	return nil
}
func TestHandle(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	payload := `{"to":"alice@example.com","template":{"id":"welcome","variables":{"name":"Alice"}}}`
	network := errors.New("alice@example.com")
	tests := []struct {
		name, id, value, want string
		age                   time.Duration
		failures              []error
		calls                 int
	}{
		{"success", "event", payload, "notify email sent", 0, nil, 1},
		{"missing id", "", payload, "missing_event_id", 0, nil, 0},
		{"expired", "event", payload, "expired", 24*time.Hour + time.Second, nil, 0},
		{"recent", "event", payload, "notify email sent", 23 * time.Hour, nil, 1},
		{"invalid json", "event", "{", "invalid_payload", 0, nil, 0},
		{"missing to", "event", `{"template":{"id":"welcome"}}`, "invalid_payload", 0, nil, 0},
		{"missing template", "event", `{"to":"alice@example.com"}`, "invalid_payload", 0, nil, 0},
		{"retry", "event", payload, "notify email sent", 0, []error{network, network, nil}, 3},
		{"exhausted", "event", payload, "network", 0, []error{network, network, network, network}, 4},
		{"validation", "event", payload, "validation_error", 0, []error{&resend.Error{Status: 422, Name: "validation_error"}}, 1},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var logs bytes.Buffer
			sender := &fakeSender{failures: tc.failures}
			c := Consumer{Sender: sender, Logger: slog.New(slog.NewJSONHandler(&logs, nil)), Backoff: []time.Duration{0, 0, 0}, Now: func() time.Time { return now }}
			r := &kgo.Record{Headers: []kgo.RecordHeader{{Key: "id", Value: []byte(tc.id)}}, Timestamp: now.Add(-tc.age), Value: []byte(tc.value)}
			if !c.handle(context.Background(), r) || len(sender.calls) != tc.calls || !strings.Contains(logs.String(), tc.want) || strings.Contains(logs.String(), "alice@example.com") {
				t.Fatalf("calls=%d logs=%s", len(sender.calls), logs.String())
			}
			if tc.calls > 0 {
				var want resend.Email
				if err := json.Unmarshal([]byte(payload), &want); err != nil {
					t.Fatal(err)
				}
				for _, got := range sender.calls {
					if got.key != "event" || !reflect.DeepEqual(got.email, want) {
						t.Fatalf("call=%+v", got)
					}
				}
			}
		})
	}
}
func TestCancelBackoff(t *testing.T) {
	var logs bytes.Buffer
	signal := make(chan struct{}, 1)
	sender := &fakeSender{failures: []error{errors.New("failure")}, signal: signal}
	c := Consumer{Sender: sender, Logger: slog.New(slog.NewJSONHandler(&logs, nil)), Backoff: []time.Duration{time.Hour}, Now: time.Now}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan bool, 1)
	go func() {
		done <- c.handle(ctx, &kgo.Record{Timestamp: time.Now(), Headers: []kgo.RecordHeader{{Key: "id", Value: []byte("event")}}, Value: []byte(`{"to":"alice@example.com","template":{"id":"welcome"}}`)})
	}()
	<-signal
	cancel()
	if <-done || strings.Contains(logs.String(), "notify email dropped") || strings.Contains(logs.String(), "alice@example.com") {
		t.Fatalf("logs=%s", logs.String())
	}
}
