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
		c.Writer.Header().Add("Vary", "Origin")
		origins := c.Request.Header.Values("Origin")
		if len(origins) == 0 && c.Request.Method != http.MethodOptions {
			c.Next()
			return
		}
		if len(origins) != 1 || origins[0] != origin {
			Error(c, http.StatusForbidden, "INVALID_ORIGIN")
			return
		}
		if c.Request.Method == http.MethodOptions {
			c.Writer.Header().Add("Vary", "Access-Control-Request-Method, Access-Control-Request-Headers")
			methods := c.Request.Header.Values("Access-Control-Request-Method")
			if len(methods) != 1 || methods[0] != http.MethodGet || len(c.Request.Header.Values("Access-Control-Request-Headers")) != 0 {
				Error(c, http.StatusForbidden, "INVALID_REQUEST")
				return
			}
			c.Header("Access-Control-Allow-Methods", http.MethodGet)
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
