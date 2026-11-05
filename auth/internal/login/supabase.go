package login

import (
	"bytes"
	"context"
	"encoding/json"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

type session struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
}

func NewHTTPClient() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DialContext = (&net.Dialer{Timeout: 5 * time.Second}).DialContext
	return &http.Client{
		Transport: otelhttp.NewTransport(transport), Timeout: 10 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}

func (h *Handler) exchangeIDToken(ctx context.Context, idToken, accessToken, nonce, userAgent string) (session, int) {
	return h.requestSession(ctx, "id_token", map[string]string{
		"provider": "google", "id_token": idToken,
		"access_token": accessToken, "nonce": nonce,
	}, userAgent)
}

// refreshSession rotates the refresh token. Supabase accepts the old token
// again only within its reuse interval, so callers must store the new pair.
func (h *Handler) refreshSession(ctx context.Context, refreshToken, userAgent string) (session, int) {
	return h.requestSession(ctx, "refresh_token", map[string]string{"refresh_token": refreshToken}, userAgent)
}

// requestSession returns 400 when Supabase rejects the grant, 503 when it is
// unavailable, and 502 for an invalid session response.
func (h *Handler) requestSession(ctx context.Context, grantType string, grant map[string]string, userAgent string) (session, int) {
	body, _ := json.Marshal(grant)
	r, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(h.supabaseURL, "/")+"/auth/v1/token?grant_type="+grantType, bytes.NewReader(body))
	if err != nil {
		return session{}, http.StatusInternalServerError
	}
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("apikey", h.supabaseKey)
	// Supabase persists this browser context on auth.sessions. Never forward
	// the inbound Cookie, Authorization, or forwarding headers.
	r.Header.Set("User-Agent", userAgent)
	response, err := h.httpClient.Do(r)
	if err != nil {
		return session{}, http.StatusServiceUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		if response.StatusCode >= 400 && response.StatusCode < 500 && response.StatusCode != http.StatusConflict && response.StatusCode != http.StatusTooManyRequests {
			return session{}, http.StatusBadRequest
		}
		return session{}, http.StatusServiceUnavailable
	}
	var result session
	payload, err := io.ReadAll(io.LimitReader(response.Body, (1<<20)+1))
	if err != nil || len(payload) > 1<<20 {
		return session{}, http.StatusBadGateway
	}
	if err := json.Unmarshal(payload, &result); err != nil || result.AccessToken == "" || result.RefreshToken == "" || result.TokenType != "bearer" || result.ExpiresIn <= 0 {
		return session{}, http.StatusBadGateway
	}
	return result, 0
}
