package middleware

import (
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"
)

func Recovery(logger *slog.Logger) gin.HandlerFunc {
	return gin.CustomRecoveryWithWriter(nil, func(c *gin.Context, rec any) {
		logger.ErrorContext(c.Request.Context(), "panic recovered", "request_id", c.GetString("request_id"), "method", c.Request.Method, "route", c.FullPath(), "panic", fmt.Sprint(rec), "stack", string(debug.Stack()))
		Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "The request failed. Try again later.")
	})
}
