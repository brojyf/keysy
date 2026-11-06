// Package health serves the liveness probe that Fly and nginx call.
package health

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Get reports that the process accepts requests. It checks no dependency.
func Get(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.String(http.StatusOK, "ok")
}
