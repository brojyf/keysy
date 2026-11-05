package login

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) dashboardCORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		sensitiveResponse(c)
		origins := c.Request.Header.Values("Origin")
		if len(origins) != 1 || origins[0] != h.webOrigin {
			respondError(c, http.StatusForbidden, "INVALID_ORIGIN", "This request is not allowed from this website.")
			return
		}
		if c.Request.Method == http.MethodOptions {
			methods := c.Request.Header.Values("Access-Control-Request-Method")
			if len(methods) != 1 || methods[0] != http.MethodPost || len(c.Request.Header.Values("Access-Control-Request-Headers")) != 0 {
				respondError(c, http.StatusForbidden, "INVALID_REQUEST", "This request uses an unsupported method or header.")
				return
			}
			if _, err := loginQuery(c.Request, false); err != nil {
				respondError(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request and try again.")
				return
			}
			c.Header("Access-Control-Allow-Methods", http.MethodPost)
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
