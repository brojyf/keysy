package middleware

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

func CORS(webAppURL string) gin.HandlerFunc {
	u, _ := url.Parse(webAppURL)
	host := strings.ToLower(u.Host)
	if (u.Scheme == "https" && u.Port() == "443") || (u.Scheme == "http" && u.Port() == "80") {
		host = strings.TrimSuffix(host, ":"+u.Port())
	}
	origin := u.Scheme + "://" + host
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		origins := c.Request.Header.Values("Origin")
		if len(origins) == 0 && c.Request.Method != http.MethodOptions {
			c.Next()
			return
		}
		if len(origins) != 1 || origins[0] != origin {
			Error(c, http.StatusForbidden, "INVALID_ORIGIN", "This request is not allowed from this website.")
			return
		}
		if c.Request.Method == http.MethodOptions {
			methods := c.Request.Header.Values("Access-Control-Request-Method")
			headers := c.Request.Header.Values("Access-Control-Request-Headers")
			allowedMethod := len(methods) == 1 && (methods[0] == http.MethodGet ||
				(methods[0] == http.MethodPatch && c.FullPath() == "/v0/me") ||
				(methods[0] == http.MethodPost && c.FullPath() == "/v0/orgs"))
			if !allowedMethod || len(headers) > 1 || (len(headers) == 1 && !strings.EqualFold(strings.TrimSpace(headers[0]), "content-type")) {
				Error(c, http.StatusForbidden, "INVALID_REQUEST", "This request uses an unsupported method or header.")
				return
			}
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH")
			c.Header("Access-Control-Allow-Headers", "Content-Type")
		}
		c.Header("Access-Control-Allow-Origin", origins[0])
		c.Header("Access-Control-Allow-Credentials", "true")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
