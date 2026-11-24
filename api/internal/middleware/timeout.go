package middleware

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func Timeout() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
		defer cancel()
		c.Request = c.Request.WithContext(ctx)
		c.Next()
		// c.Status only records the code, so a non-default status means the handler already chose its response.
		if c.Writer.Written() || c.Writer.Status() != http.StatusOK {
			return
		}
		switch {
		case errors.Is(ctx.Err(), context.DeadlineExceeded):
			Error(c, http.StatusServiceUnavailable, "REQUEST_TIMEOUT", "The request took too long. Try again.")
		case errors.Is(ctx.Err(), context.Canceled):
			// The client closed the request. 499 is the nginx convention; it keeps logs and metrics from recording 200.
			c.Status(499)
		}
	}
}
