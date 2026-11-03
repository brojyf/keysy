package middleware

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestTimeout(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, written := range []bool{false, true} {
		r := gin.New()
		r.Use(Timeout())
		r.GET("/slow", func(c *gin.Context) {
			if written {
				c.String(202, "accepted")
			}
			<-c.Request.Context().Done()
		})
		// An earlier parent deadline exercises the fixed timeout without a 10s wait.
		ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
		defer cancel()
		req := httptest.NewRequest("GET", "/slow", nil).WithContext(ctx)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if written {
			if w.Code != 202 || w.Body.String() != "accepted" {
				t.Fatal("changed written response")
			}
		} else if w.Code != 503 || !strings.Contains(w.Body.String(), "REQUEST_TIMEOUT") || !strings.Contains(w.Body.String(), `"message":"The request took too long. Try again."`) {
			t.Fatalf("%d %s", w.Code, w.Body.String())
		}
	}
	r := gin.New()
	r.Use(Timeout())
	r.GET("/fast", func(c *gin.Context) {
		deadline, ok := c.Request.Context().Deadline()
		if !ok || time.Until(deadline) > 10*time.Second || time.Until(deadline) < 9*time.Second {
			t.Error("wrong timeout")
		}
		c.Status(204)
	})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/fast", nil))
	if w.Code != 204 {
		t.Fatal(w.Code)
	}
}
