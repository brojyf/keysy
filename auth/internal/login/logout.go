package login

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

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
	if accessToken == "" {
		// The access cookie expires first; use the refresh token to revoke the session.
		refreshToken, err := h.readRefreshToken(c.Request)
		if errors.Is(err, errDuplicateCookie) {
			respondError(c, http.StatusBadRequest, "INVALID_REQUEST", "Your logout request contains duplicate session cookies.")
			return
		}
		if refreshToken != "" {
			session, status := h.refreshSession(c.Request.Context(), refreshToken, c.Request.UserAgent())
			if status != 0 && status != http.StatusBadRequest {
				respondError(c, http.StatusServiceUnavailable, "LOGOUT_UNAVAILABLE", "Sign-out is temporarily unavailable. Try again later.")
				return
			}
			accessToken = session.AccessToken
		}
	}
	if accessToken != "" {
		r, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, h.supabaseURL+"/auth/v1/logout?scope=local", nil)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Sign-out could not be completed. Try again later.")
			return
		}
		r.Header.Set("apikey", h.supabaseKey)
		r.Header.Set("Authorization", "Bearer "+accessToken)
		response, err := h.httpClient.Do(r)
		if err != nil {
			respondError(c, http.StatusServiceUnavailable, "LOGOUT_UNAVAILABLE", "Sign-out is temporarily unavailable. Try again later.")
			return
		}
		response.Body.Close()
		if response.StatusCode != http.StatusNoContent && response.StatusCode != http.StatusUnauthorized && response.StatusCode != http.StatusForbidden {
			respondError(c, http.StatusServiceUnavailable, "LOGOUT_UNAVAILABLE", "Sign-out is temporarily unavailable. Try again later.")
			return
		}
	}
	h.clearSessionCookies(c.Writer)
	c.Status(http.StatusNoContent)
}
