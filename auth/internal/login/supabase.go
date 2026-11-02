package login

import (
	"bytes"
	"context"
	"encoding/json"
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
		Transport: transport, Timeout: 10 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}

func (h *Handler) exchangeIDToken(ctx context.Context, idToken, accessToken, nonce, userAgent string) (session, int) {
	body, _ := json.Marshal(map[string]string{
		"provider": "google", "id_token": idToken,
		"access_token": accessToken, "nonce": nonce,
	})
	r, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(h.supabaseURL, "/")+"/auth/v1/token?grant_type=id_token", bytes.NewReader(body))
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
		if response.StatusCode >= 400 && response.StatusCode < 500 && response.StatusCode != 429 {
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
