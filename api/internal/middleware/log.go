package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

func Log(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		logger.Info("request", "request_id", c.GetString("request_id"), "user_id", c.GetString("user_id"), "method", c.Request.Method, "route", c.FullPath(), "status", c.Writer.Status(), "duration_ms", float64(time.Since(start))/float64(time.Millisecond))
	}
}
