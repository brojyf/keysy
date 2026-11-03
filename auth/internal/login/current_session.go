package login

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

type sessionUser struct {
	ID    string `json:"id"`
	Email string `json:"email,omitempty"`
}

func (h *Handler) currentSession(c *gin.Context) {
	sensitiveResponse(c)
	if _, err := loginQuery(c.Request, false); err != nil {
		respondError(c, 400, "INVALID_REQUEST")
		return
	}
	cookies := c.Request.CookiesNamed(h.cookieName(accessCookieName))
	if len(cookies) > 1 {
		respondError(c, 400, "INVALID_REQUEST")
		return
	}
	if len(cookies) == 0 || cookies[0].Value == "" {
		respondError(c, 401, "UNAUTHENTICATED")
		return
	}
	accessToken, err := h.openTokenCookie(accessCookieName, cookies[0].Value)
	if err != nil || accessToken == "" {
		respondError(c, 401, "UNAUTHENTICATED")
		return
	}
	r, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, h.supabaseURL+"/auth/v1/user", nil)
	if err != nil {
		respondError(c, 500, "INTERNAL_ERROR")
		return
	}
	r.Header.Set("apikey", h.supabaseKey)
	r.Header.Set("Authorization", "Bearer "+accessToken)
	response, err := h.httpClient.Do(r)
	if err != nil {
		respondError(c, 503, "SESSION_UNAVAILABLE")
		return
	}
	defer response.Body.Close()
	if response.StatusCode == 401 || response.StatusCode == 403 {
		respondError(c, 401, "UNAUTHENTICATED")
		return
	}
	if response.StatusCode != 200 {
		respondError(c, 503, "SESSION_UNAVAILABLE")
		return
	}
	payload, err := io.ReadAll(io.LimitReader(response.Body, (1<<20)+1))
	var user sessionUser
	if err != nil || len(payload) > 1<<20 || json.Unmarshal(payload, &user) != nil || user.ID == "" {
		respondError(c, 502, "INVALID_PROVIDER_RESPONSE")
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}
