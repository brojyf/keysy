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
		{"https://dashboard.keysy.net", "OPTIONS", "POST", "", 204},
		{"https://dashboard.keysy.net", "OPTIONS", "PATCH", " content-TYPE ", 204},
		{"https://dashboard.keysy.net", "OPTIONS", "DELETE", "", 204},
		{"https://dashboard.keysy.net", "OPTIONS", "PUT", "", 403},
		{"https://dashboard.keysy.net", "OPTIONS", "PATCH", "content-type, x-foo", 403},
		{"https://dashboard.keysy.net", "OPTIONS", "GET", "Authorization", 403}, {"", "OPTIONS", "GET", "", 403},
	} {
		r := gin.New()
		r.Use(CORS("https://DASHBOARD.keysy.net:443/"))
		r.GET("/v0/me", func(c *gin.Context) { c.Status(200) })
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
		if item.method == "OPTIONS" && item.status == 204 && (w.Header().Get("Access-Control-Allow-Methods") != "GET, POST, PATCH, DELETE" || w.Header().Get("Access-Control-Allow-Headers") != "Content-Type") {
			t.Fatal("missing preflight headers")
		}
		if item.origin == "https://dashboard.keysy.net" && item.status < 400 && (w.Header().Get("Access-Control-Allow-Origin") != item.origin || w.Header().Get("Access-Control-Allow-Credentials") != "true") {
			t.Fatal("missing credentialed CORS")
		}
		wantExpose := item.origin == "https://dashboard.keysy.net" && item.method != "OPTIONS" && item.status == 200
		if got := w.Header().Values("Access-Control-Expose-Headers"); wantExpose && (len(got) != 1 || got[0] != "X-Request-ID") || !wantExpose && len(got) != 0 {
			t.Fatalf("%+v: Access-Control-Expose-Headers = %q, want present %t", item, got, wantExpose)
		}
	}
}

func TestCORSExposesRequestIDOnHandlerError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestID(), CORS("https://dashboard.keysy.net"))
	r.GET("/v0/me", func(c *gin.Context) { Error(c, 500, "INTERNAL_ERROR", "The request failed.") })
	req := httptest.NewRequest("GET", "/v0/me", nil)
	req.Header.Set("Origin", "https://dashboard.keysy.net")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 500 || w.Header().Get("Access-Control-Expose-Headers") != "X-Request-ID" || w.Header().Get("X-Request-ID") == "" {
		t.Fatalf("handler error did not expose request ID: status=%d headers=%v", w.Code, w.Header())
	}
}

func TestPreflightAllowsSharedMethodsOnEveryPath(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, path := range []string{"/v0/me", "/v0/orgs/20000000-0000-0000-0000-000000000001"} {
		for method, status := range map[string]int{"GET": 204, "POST": 204, "PATCH": 204, "DELETE": 204, "PUT": 403, "HEAD": 403} {
			t.Run(path+" "+method, func(t *testing.T) {
				r := gin.New()
				r.Use(CORS("https://dashboard.keysy.net"))
				req := httptest.NewRequest("OPTIONS", path, nil)
				req.Header.Set("Origin", "https://dashboard.keysy.net")
				req.Header.Set("Access-Control-Request-Method", method)
				req.Header.Set("Access-Control-Request-Headers", "Content-Type")
				w := httptest.NewRecorder()
				r.ServeHTTP(w, req)
				if w.Code != status {
					t.Fatalf("%d %s", w.Code, w.Body.String())
				}
				if status == 204 && (w.Header().Get("Access-Control-Allow-Methods") != "GET, POST, PATCH, DELETE" || w.Header().Get("Access-Control-Allow-Credentials") != "true") {
					t.Fatal("missing credentialed preflight headers")
				}
			})
		}
	}
}
