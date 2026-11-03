package login

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) logout(c *gin.Context) {
	sensitiveResponse(c)
	origins := c.Request.Header.Values("Origin")
	if len(origins) != 1 || origins[0] != h.webOrigin {
		respondError(c, http.StatusForbidden, "INVALID_ORIGIN")
		return
	}
	if _, err := loginQuery(c.Request, false); err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_REQUEST")
		return
	}
	cookies := c.Request.CookiesNamed(h.cookieName(accessCookieName))
	if len(cookies) > 1 {
		respondError(c, http.StatusBadRequest, "INVALID_REQUEST")
		return
	}
	if len(cookies) == 1 {
		accessToken, err := h.openTokenCookie(accessCookieName, cookies[0].Value)
		if err == nil && accessToken != "" {
			r, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, h.supabaseURL+"/auth/v1/logout?scope=local", nil)
			if err != nil {
				respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR")
				return
			}
			r.Header.Set("apikey", h.supabaseKey)
			r.Header.Set("Authorization", "Bearer "+accessToken)
			response, err := h.httpClient.Do(r)
			if err != nil {
				respondError(c, http.StatusServiceUnavailable, "LOGOUT_UNAVAILABLE")
				return
			}
			response.Body.Close()
			if response.StatusCode != http.StatusNoContent && response.StatusCode != http.StatusUnauthorized && response.StatusCode != http.StatusForbidden {
				respondError(c, http.StatusServiceUnavailable, "LOGOUT_UNAVAILABLE")
				return
			}
		}
	}
	for _, name := range []string{oauthCookieName, accessCookieName, refreshCookieName} {
		http.SetCookie(c.Writer, h.newCookie(name, "", -1))
	}
	c.Status(http.StatusNoContent)
}
