package jwks

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestAvailableTracksJWKSFetches(t *testing.T) {
	var down atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if down.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"keys": []any{}})
	}))
	defer server.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	keys, err := newKeys(ctx, server.URL, 50*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}
	if !keys.Available() {
		t.Fatal("unavailable after a successful startup fetch")
	}
	// An unknown kid triggers a refresh, which reports the outcome.
	lookup := func() { keys.Storage().KeyRead(context.Background(), "unknown") }
	down.Store(true)
	lookup()
	if keys.Available() {
		t.Fatal("available after a failed refresh")
	}
	down.Store(false)
	lookup()
	if !keys.Available() {
		t.Fatal("unavailable after JWKS recovered")
	}
}

func TestUnavailableWhenStartupFetchFails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	keys, err := New(ctx, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	if keys.Available() {
		t.Fatal("available after a failed startup fetch")
	}
}
