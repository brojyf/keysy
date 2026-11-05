package login

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

var errDuplicateCookie = errors.New("duplicate session cookie")

func (h *Handler) refresh(c *gin.Context) {
	if _, err := loginQuery(c.Request, false); err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your session request and try again.")
		return
	}
	refreshToken, err := h.readRefreshToken(c.Request)
	if errors.Is(err, errDuplicateCookie) {
		respondError(c, http.StatusBadRequest, "INVALID_REQUEST", "Your session request contains duplicate session cookies.")
		return
	}
	if refreshToken == "" {
		h.clearSessionCookies(c.Writer)
		respondError(c, http.StatusUnauthorized, "SESSION_EXPIRED", "Your session has expired. Sign in again.")
		return
	}
	session, status := h.refreshSession(c.Request.Context(), refreshToken, c.Request.UserAgent())
	switch {
	case status == http.StatusBadRequest:
		h.clearSessionCookies(c.Writer)
		respondError(c, http.StatusUnauthorized, "SESSION_EXPIRED", "Your session has expired. Sign in again.")
	case status == http.StatusBadGateway || (status == 0 && !h.setSessionCookies(c.Writer, session)):
		respondError(c, http.StatusBadGateway, "INVALID_PROVIDER_RESPONSE", "Your session could not be renewed. Try again.")
	case status != 0:
		respondError(c, http.StatusServiceUnavailable, "REFRESH_UNAVAILABLE", "Your session cannot be renewed right now. Try again later.")
	default:
		c.Status(http.StatusNoContent)
	}
}

// readRefreshToken returns an empty token when the cookie is missing or cannot be opened.
func (h *Handler) readRefreshToken(r *http.Request) (string, error) {
	cookies := r.CookiesNamed(h.cookieName(refreshCookieName))
	if len(cookies) > 1 {
		return "", errDuplicateCookie
	}
	if len(cookies) == 0 {
		return "", nil
	}
	token, _ := h.openTokenCookie(refreshCookieName, cookies[0].Value)
	return token, nil
}
