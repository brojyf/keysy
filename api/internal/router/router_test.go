package router

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func newTestRouter(sessionCalls *int) *gin.Engine {
	gin.SetMode(gin.TestMode)
	session := func(c *gin.Context) {
		*sessionCalls++
		c.AbortWithStatus(http.StatusUnauthorized)
	}
	return New(Deps{Logger: slog.Default(), WebAppURL: "https://keysy.net", Session: session})
}

func TestNewRegistersEveryRoute(t *testing.T) {
	want := []string{
		"DELETE /v0/me/sessions/:sessionId",
		"DELETE /v0/orgs/:orgId",
		"GET /health",
		"GET /v0/me",
		"GET /v0/me/sessions",
		"GET /v0/orgs",
		"GET /v0/orgs/:orgId/members",
		"OPTIONS /v0/me",
		"OPTIONS /v0/me/sessions",
		"OPTIONS /v0/me/sessions/:sessionId",
		"OPTIONS /v0/orgs",
		"OPTIONS /v0/orgs/:orgId",
		"OPTIONS /v0/orgs/:orgId/members",
		"PATCH /v0/me",
		"PATCH /v0/orgs/:orgId",
		"POST /v0/orgs",
	}
	var got []string
	for _, route := range newTestRouter(new(int)).Routes() {
		got = append(got, route.Method+" "+route.Path)
	}
	slices.Sort(got)
	if !slices.Equal(got, want) {
		t.Fatalf("routes = %v, want %v", got, want)
	}
}

func TestHealthSkipsSessionAndMiddleware(t *testing.T) {
	calls := 0
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	request.Header.Set("Origin", "https://evil.example")
	newTestRouter(&calls).ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d because probes skip CORS", response.Code, http.StatusOK)
	}
	if calls != 0 {
		t.Fatalf("session calls = %d, want 0", calls)
	}
	if got := response.Header().Get("X-Request-Id"); got != "" {
		t.Fatalf("X-Request-Id = %q, want empty because probes skip middleware", got)
	}
}

func TestProtectedRoutesRunSession(t *testing.T) {
	router := newTestRouter(new(int))
	for _, route := range router.Routes() {
		if route.Method == http.MethodOptions || !strings.HasPrefix(route.Path, "/v0/") {
			continue
		}
		t.Run(route.Method+" "+route.Path, func(t *testing.T) {
			calls := 0
			response := httptest.NewRecorder()
			path := strings.NewReplacer(":orgId", "org", ":sessionId", "session").Replace(route.Path)
			newTestRouter(&calls).ServeHTTP(response, httptest.NewRequest(route.Method, path, nil))
			if response.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
			}
			if calls != 1 {
				t.Fatalf("session calls = %d, want 1", calls)
			}
		})
	}
}

func TestPreflightSkipsSession(t *testing.T) {
	calls := 0
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodOptions, "/v0/orgs/org", nil)
	request.Header.Set("Origin", "https://keysy.net")
	request.Header.Set("Access-Control-Request-Method", http.MethodPatch)
	newTestRouter(&calls).ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
	if calls != 0 {
		t.Fatalf("session calls = %d, want 0", calls)
	}
}
