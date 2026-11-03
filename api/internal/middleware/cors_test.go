package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORS(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, item := range []struct {
		origin, method, preflight, headers string
		status                             int
	}{
		{"https://dashboard.keysy.net", "GET", "", "", 200}, {"", "GET", "", "", 200},
		{"https://other.keysy.net", "GET", "", "", 403}, {"null", "GET", "", "", 403},
		{"https://dashboard.keysy.net", "OPTIONS", "GET", "", 204},
		{"https://dashboard.keysy.net", "OPTIONS", "POST", "", 403},
		{"https://dashboard.keysy.net", "OPTIONS", "PATCH", " content-TYPE ", 204},
		{"https://dashboard.keysy.net", "OPTIONS", "DELETE", "", 403},
		{"https://dashboard.keysy.net", "OPTIONS", "PUT", "", 403},
		{"https://dashboard.keysy.net", "OPTIONS", "PATCH", "content-type, x-foo", 403},
		{"https://dashboard.keysy.net", "OPTIONS", "GET", "Authorization", 403}, {"", "OPTIONS", "GET", "", 403},
	} {
		r := gin.New()
		r.Use(CORS("https://DASHBOARD.keysy.net:443/"))
		r.GET("/v0/me", func(c *gin.Context) { c.Status(200) })
		r.OPTIONS("/v0/me")
		req := httptest.NewRequest(item.method, "/v0/me", nil)
		if item.origin != "" {
			req.Header.Set("Origin", item.origin)
		}
		if item.preflight != "" {
			req.Header.Set("Access-Control-Request-Method", item.preflight)
		}
		if item.headers != "" {
			req.Header.Set("Access-Control-Request-Headers", item.headers)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != item.status || len(w.Header().Values("Vary")) != 0 || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("%+v: %d", item, w.Code)
		}
		if item.method == "OPTIONS" && item.status == 204 && (w.Header().Get("Access-Control-Allow-Methods") != "GET, PATCH" || w.Header().Get("Access-Control-Allow-Headers") != "Content-Type") {
			t.Fatal("missing preflight headers")
		}
		if item.origin == "https://dashboard.keysy.net" && item.status < 400 && (w.Header().Get("Access-Control-Allow-Origin") != item.origin || w.Header().Get("Access-Control-Allow-Credentials") != "true") {
			t.Fatal("missing credentialed CORS")
		}
	}
}
