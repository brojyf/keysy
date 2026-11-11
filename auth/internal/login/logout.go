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
	var refreshed session
	for {
		if accessToken == "" && refreshToken != "" {
			var status int
			refreshed, status = h.refreshSession(ctx, refreshToken, c.Request.UserAgent())
			refreshToken = ""
			if status != 0 && status != http.StatusBadRequest {
				respondError(c, http.StatusServiceUnavailable, "LOGOUT_UNAVAILABLE", "Sign-out is temporarily unavailable. Try again later.")
				return
			}
			accessToken = refreshed.AccessToken
		}
		if accessToken == "" {
			break
		}
		r, err := http.NewRequestWithContext(ctx, http.MethodPost, h.supabaseURL+"/auth/v1/logout?scope=local", nil)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Sign-out could not be completed. Try again later.")
			return
		}
		r.Header.Set("apikey", h.supabaseKey)
		r.Header.Set("Authorization", "Bearer "+accessToken)
		response, err := h.httpClient.Do(r)
		if err != nil {
			if refreshed.RefreshToken != "" {
				h.setSessionCookies(c.Writer, refreshed)
			}
			respondError(c, http.StatusServiceUnavailable, "LOGOUT_UNAVAILABLE", "Sign-out is temporarily unavailable. Try again later.")
			return
		}
		response.Body.Close()
		if (response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden) && refreshToken != "" {
			accessToken = ""
			continue
		}
		if response.StatusCode != http.StatusNoContent && (refreshed.RefreshToken != "" || (response.StatusCode != http.StatusUnauthorized && response.StatusCode != http.StatusForbidden)) {
			if refreshed.RefreshToken != "" {
				h.setSessionCookies(c.Writer, refreshed)
			}
			respondError(c, http.StatusServiceUnavailable, "LOGOUT_UNAVAILABLE", "Sign-out is temporarily unavailable. Try again later.")
			return
		}
		break
	}
	h.clearSessionCookies(c.Writer)
	c.Status(http.StatusNoContent)
}
