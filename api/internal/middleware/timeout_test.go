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

func TestTimeoutClientCanceled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Timeout())
	r.GET("/slow", func(c *gin.Context) { <-c.Request.Context().Done() })
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/slow", nil).WithContext(ctx))
	// Logs and metrics must not report a canceled request as 200.
	if w.Code != 499 || w.Body.Len() != 0 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
}

func TestTimeoutKeepsHandlerStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	expired, cancelExpired := context.WithDeadline(context.Background(), time.Now())
	defer cancelExpired()
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	for name, ctx := range map[string]context.Context{"deadline": expired, "canceled": canceled} {
		t.Run(name, func(t *testing.T) {
			r := gin.New()
			r.Use(Timeout())
			// c.Status sets the code without writing, so Written() stays false after a committed 204.
			r.DELETE("/member", func(c *gin.Context) { c.Status(204) })
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest("DELETE", "/member", nil).WithContext(ctx))
			if w.Code != 204 || w.Body.Len() != 0 {
				t.Fatalf("%d %s", w.Code, w.Body.String())
			}
		})
	}
}
