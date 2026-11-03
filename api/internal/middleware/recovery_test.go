package middleware

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRecoveryReturnsSafeInternalError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var output bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&output, nil))
	r := gin.New()
	r.Use(Recovery(logger), RequestID(), Log(logger))
	r.GET("/callback", func(c *gin.Context) { panic("handler failed") })
	req := httptest.NewRequest("GET", "/callback?code=secret-code", nil)
	req.Header.Set("Cookie", "session=secret-cookie")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 500 || !strings.Contains(w.Body.String(), `"code":"INTERNAL_ERROR"`) {
		t.Fatalf("unexpected response: %d %s", w.Code, w.Body.String())
	}
	if strings.Contains(output.String(), "secret-code") || strings.Contains(output.String(), "?code=") || strings.Contains(output.String(), "secret-cookie") {
		t.Fatal("logged request secrets")
	}
	var entry map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(output.Bytes()), &entry); err != nil {
		t.Fatal(err)
	}
	if entry["level"] != "ERROR" || entry["request_id"] != w.Header().Get("X-Request-ID") || entry["request_id"] == "" || entry["method"] != "GET" || entry["route"] != "/callback" || entry["panic"] != "handler failed" || entry["stack"] == "" {
		t.Fatal("missing recovery log fields")
	}
}
