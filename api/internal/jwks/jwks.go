// Package jwks loads Supabase's JWT signing keys and tracks whether the JWKS endpoint is reachable.
package jwks

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/MicahParks/jwkset"
	"github.com/MicahParks/keyfunc/v3"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"golang.org/x/time/rate"
)

// ErrUnavailable means a signing key lookup could not complete.
var ErrUnavailable = errors.New("signing key lookup unavailable")

type Keys struct {
	keyfunc.Keyfunc
	fetched *atomic.Bool
}

// New refreshes for an unknown kid at most every 10s, not the 5m default, so a JWKS outage clears quickly.
// A request waits at most 3s for that refresh; the same limit bounds the fetch itself.
func New(ctx context.Context, url string) (Keys, error) {
	return newKeys(ctx, url, 10*time.Second)
}

func newKeys(ctx context.Context, url string, unknownKIDInterval time.Duration) (Keys, error) {
	keys := Keys{fetched: &atomic.Bool{}}
	var err error
	keys.Keyfunc, err = keyfunc.NewDefaultOverrideCtx(ctx, []string{url}, keyfunc.Override{
		Client:            &http.Client{Transport: otelhttp.NewTransport(fetchTracker{keys.fetched})},
		RefreshUnknownKID: rate.NewLimiter(rate.Every(unknownKIDInterval), 1),
		RateLimitWaitMax:  3 * time.Second,
		RefreshErrorHandlerFunc: func(u string) func(context.Context, error) {
			return func(ctx context.Context, err error) {
				keys.fetched.Store(false)
				slog.ErrorContext(ctx, "JWKS refresh failed", "error", err, "url", u)
			}
		},
	})
	if err != nil {
		return keys, err
	}
	keys.Keyfunc, err = keyfunc.New(keyfunc.Options{Ctx: ctx, Storage: keyStorage{keys.Storage()}})
	return keys, err
}

type keyStorage struct {
	jwkset.Storage
}

func (s keyStorage) KeyRead(ctx context.Context, keyID string) (jwkset.JWK, error) {
	key, err := s.Storage.KeyRead(ctx, keyID)
	if err != nil && !errors.Is(err, jwkset.ErrKeyNotFound) {
		return key, errors.Join(err, ErrUnavailable)
	}
	return key, err
}

// Available reports whether the latest JWKS refresh succeeded.
func (k Keys) Available() bool {
	return k.fetched.Load()
}

// fetchTracker marks a 200 response as fetched; the refresh error handler clears it if the body is unusable.
type fetchTracker struct {
	fetched *atomic.Bool
}

func (t fetchTracker) RoundTrip(r *http.Request) (*http.Response, error) {
	response, err := http.DefaultTransport.RoundTrip(r)
	if err == nil && response.StatusCode == http.StatusOK {
		t.fetched.Store(true)
	}
	return response, err
}
