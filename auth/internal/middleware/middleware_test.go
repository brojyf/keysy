package middleware

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequestIDAndSafeLog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var output bytes.Buffer
	r := gin.New()
	r.Use(RequestID(), Log(slog.New(slog.NewJSONHandler(&output, nil))))
	r.GET("/callback", func(c *gin.Context) { c.Status(204) })
	var previous string
	for range 2 {
		req := httptest.NewRequest("GET", "/callback?code=secret-code", nil)
		req.Header.Set("X-Request-ID", "untrusted")
		req.Header.Set("Cookie", "secret-cookie")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		id := w.Header().Get("X-Request-ID")
		if !regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).MatchString(id) || id == previous {
			t.Fatal("invalid or reused UUID")
		}
		previous = id
	}
	for _, line := range strings.Split(strings.TrimSpace(output.String()), "\n") {
		var entry map[string]any
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			t.Fatal(err)
		}
		if entry["route"] != "/callback" || entry["method"] != "GET" || entry["status"] != float64(204) || entry["request_id"] == "" || entry["duration_ms"] == nil {
			t.Fatal(entry)
		}
	}
	if strings.Contains(output.String(), "secret") || strings.Contains(output.String(), "?code") || strings.Contains(output.String(), "untrusted") {
		t.Fatal("logged request secrets")
	}
}
