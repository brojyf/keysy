package login

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// logoutTimeout bounds all upstream calls of one logout. A logout makes up to
// three calls, so it must stay below the 20s server write timeout.
const logoutTimeout = 15 * time.Second

func (h *Handler) logout(c *gin.Context) {
	sensitiveResponse(c)
	origins := c.Request.Header.Values("Origin")
	if len(origins) != 1 || origins[0] != h.webOrigin {
		respondError(c, http.StatusForbidden, "INVALID_ORIGIN", "This request is not allowed from this website.")
		return
	}
	if _, err := loginQuery(c.Request, false); err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your logout request and try again.")
		return
	}
	cookies := c.Request.CookiesNamed(h.cookieName(accessCookieName))
	if len(cookies) > 1 {
		respondError(c, http.StatusBadRequest, "INVALID_REQUEST", "Your logout request contains duplicate session cookies.")
		return
	}
	accessToken := ""
	if len(cookies) == 1 {
		accessToken, _ = h.openTokenCookie(accessCookieName, cookies[0].Value)
	}
	refreshToken, err := h.readRefreshToken(c.Request)
	if errors.Is(err, errDuplicateCookie) {
		respondError(c, http.StatusBadRequest, "INVALID_REQUEST", "Your logout request contains duplicate session cookies.")
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), logoutTimeout)
	defer cancel()
	unavailable := func() {
		respondError(c, http.StatusServiceUnavailable, "LOGOUT_UNAVAILABLE", "Sign-out is temporarily unavailable. Try again later.")
	}
	signedOut := func() {
		h.clearSessionCookies(c.Writer)
		c.Status(http.StatusNoContent)
	}

	// Step 1: revoke the session with the access token.
	if accessToken != "" {
		status, err := h.revokeSession(ctx, accessToken)
		rejected := status == http.StatusUnauthorized || status == http.StatusForbidden
		if err != nil || (status != http.StatusNoContent && !rejected) {
			unavailable()
			return
		}
		if status == http.StatusNoContent || refreshToken == "" {
			signedOut()
			return
		}
		// Supabase rejected the access token. Refresh it and try again.
	}

	// Step 2: get a new access token with the refresh token.
	if refreshToken == "" {
		signedOut()
		return
	}
	refreshed, status := h.refreshSession(ctx, refreshToken, c.Request.UserAgent())
	if status == http.StatusBadRequest {
		// Supabase rejected the refresh token, so the session has already ended.
		signedOut()
		return
	}
	if status != 0 {
		unavailable()
		return
	}

	// Step 3: revoke the session with the new access token.
	if status, err := h.revokeSession(ctx, refreshed.AccessToken); err != nil || status != http.StatusNoContent {
		// The refresh rotated the tokens. Keep the new pair so the browser can try again.
		h.setSessionCookies(c.Writer, refreshed)
		unavailable()
		return
	}
	signedOut()
}

// revokeSession ends the Supabase session of the access token and returns the upstream status.
func (h *Handler) revokeSession(ctx context.Context, accessToken string) (int, error) {
	r, err := http.NewRequestWithContext(ctx, http.MethodPost, h.supabaseURL+"/auth/v1/logout?scope=local", nil)
	if err != nil {
		return 0, err
	}
	r.Header.Set("apikey", h.supabaseKey)
	r.Header.Set("Authorization", "Bearer "+accessToken)
	response, err := h.httpClient.Do(r)
	if err != nil {
		return 0, err
	}
	response.Body.Close()
	return response.StatusCode, nil
}
