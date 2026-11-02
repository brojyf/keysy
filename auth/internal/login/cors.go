package login

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) dashboardCORS(method string) gin.HandlerFunc {
	return func(c *gin.Context) {
		sensitiveResponse(c)
		c.Writer.Header().Add("Vary", "Origin")
		origins := c.Request.Header.Values("Origin")
		if len(origins) == 0 && c.Request.Method != http.MethodOptions {
			c.Next()
			return
		}
		if len(origins) != 1 || origins[0] != h.webOrigin {
			respondError(c, http.StatusForbidden, "INVALID_ORIGIN")
			return
		}
		if c.Request.Method == http.MethodOptions {
			c.Writer.Header().Add("Vary", "Access-Control-Request-Method, Access-Control-Request-Headers")
			methods := c.Request.Header.Values("Access-Control-Request-Method")
			if len(methods) != 1 || methods[0] != method || len(c.Request.Header.Values("Access-Control-Request-Headers")) != 0 {
				respondError(c, http.StatusForbidden, "INVALID_REQUEST")
				return
			}
			c.Header("Access-Control-Allow-Methods", method)
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
