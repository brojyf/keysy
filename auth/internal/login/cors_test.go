package login

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDashboardRequestsAllowCredentialsOnSuccessAndErrors(t *testing.T) {
	for _, item := range []struct {
		name, method, path   string
		upstreamStatus, want int
	}{
		{"session", http.MethodGet, "/v0/auth/session", 200, 200},
		{"expired-session", http.MethodGet, "/v0/auth/session", 401, 401},
		{"unavailable-session", http.MethodGet, "/v0/auth/session", 503, 503},
		{"logout", http.MethodPost, "/v0/auth/logout", 204, 204},
		{"expired-logout", http.MethodPost, "/v0/auth/logout", 401, 204},
		{"unavailable-logout", http.MethodPost, "/v0/auth/logout", 503, 503},
		{"invalid-logout", http.MethodPost, "/v0/auth/logout?scope=global", 204, 400},
	} {
		t.Run(item.name, func(t *testing.T) {
			f := newFixture(t)
			if item.method == http.MethodPost {
				f.logoutStatus = item.upstreamStatus
			} else {
				f.userStatus = item.upstreamStatus
			}
			r := httptest.NewRequest(item.method, item.path, nil)
			r.Header.Set("Origin", "https://app.keysy.test")
			r.AddCookie(f.handler.newTokenCookie(accessCookieName, "keysy-access", 3600))
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, r)
			if w.Code != item.want {
				t.Fatalf("status = %d, want %d", w.Code, item.want)
			}
			assertDashboardCORS(t, w, "https://app.keysy.test")
		})
	}
}

func assertDashboardCORS(t *testing.T, w *httptest.ResponseRecorder, origin string) {
	t.Helper()
	if w.Header().Get("Access-Control-Allow-Origin") != origin || w.Header().Get("Access-Control-Allow-Credentials") != "true" || !strings.Contains(strings.Join(w.Header().Values("Vary"), ","), "Origin") {
		t.Fatalf("missing credentialed CORS headers: %v", w.Header())
	}
	if w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("Referrer-Policy") != "no-referrer" {
		t.Fatal("missing sensitive-response headers")
	}
}

func TestBrowserRoutesRejectUnapprovedOriginsBeforeCallingSupabase(t *testing.T) {
	for _, path := range []string{"/v0/auth/session", "/v0/auth/logout"} {
		for _, origin := range []string{"https://attacker.test", "https://attacker.keysy.test", "https://app.keysy.test.attacker.test", "http://app.keysy.test", "https://app.keysy.test:444", "null", "duplicate-origin"} {
			t.Run(path+"/"+origin, func(t *testing.T) {
				f := newFixture(t)
				method := http.MethodGet
				if path == "/v0/auth/logout" {
					method = http.MethodPost
				}
				r := httptest.NewRequest(method, path, nil)
				r.Header.Set("Origin", origin)
				if origin == "duplicate-origin" {
					r.Header.Set("Origin", "https://app.keysy.test")
					r.Header.Add("Origin", "https://app.keysy.test")
				}
				r.AddCookie(f.handler.newTokenCookie(accessCookieName, "keysy-access", 3600))
				w := httptest.NewRecorder()
				f.router.ServeHTTP(w, r)
				if w.Code != http.StatusForbidden || f.userCalls != 0 || f.logoutCalls != 0 || len(w.Result().Cookies()) != 0 || w.Header().Get("Access-Control-Allow-Origin") != "" || w.Header().Get("Access-Control-Allow-Credentials") != "" {
					t.Fatalf("unapproved browser origin accepted: status=%d headers=%v", w.Code, w.Header())
				}
			})
		}
	}
}

func TestDashboardPreflightIsLimitedToSupportedRoutesAndMethods(t *testing.T) {
	for _, item := range []struct {
		name, path, origin, method, headers string
		want                                int
	}{
		{"session", "/v0/auth/session", "https://app.keysy.test", "GET", "", 204},
		{"logout", "/v0/auth/logout", "https://app.keysy.test", "POST", "", 204},
		{"wrong-origin", "/v0/auth/logout", "https://attacker.test", "POST", "", 403},
		{"missing-origin", "/v0/auth/logout", "", "POST", "", 403},
		{"missing-method", "/v0/auth/logout", "https://app.keysy.test", "", "", 403},
		{"wrong-session-method", "/v0/auth/session", "https://app.keysy.test", "POST", "", 403},
		{"wrong-logout-method", "/v0/auth/logout", "https://app.keysy.test", "DELETE", "", 403},
		{"custom-header", "/v0/auth/logout", "https://app.keysy.test", "POST", "authorization", 403},
		{"login-is-navigation-only", "/v0/auth/google", "https://app.keysy.test", "GET", "", 405},
		{"callback-is-navigation-only", "/v0/auth/callback", "https://app.keysy.test", "GET", "", 405},
	} {
		t.Run(item.name, func(t *testing.T) {
			f := newFixture(t)
			r := httptest.NewRequest(http.MethodOptions, item.path, nil)
			if item.origin != "" {
				r.Header.Set("Origin", item.origin)
			}
			if item.method != "" {
				r.Header.Set("Access-Control-Request-Method", item.method)
			}
			if item.headers != "" {
				r.Header.Set("Access-Control-Request-Headers", item.headers)
			}
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, r)
			if w.Code != item.want || f.userCalls != 0 || f.logoutCalls != 0 || len(w.Result().Cookies()) != 0 {
				t.Fatalf("preflight status = %d, want %d", w.Code, item.want)
			}
			if item.want == http.StatusNoContent {
				assertDashboardCORS(t, w, item.origin)
				if w.Header().Get("Access-Control-Allow-Methods") != item.method || w.Header().Get("Access-Control-Allow-Headers") != "" || w.Body.Len() != 0 {
					t.Fatalf("invalid preflight response: %v", w.Header())
				}
			} else if w.Header().Get("Access-Control-Allow-Origin") != "" {
				t.Fatal("rejected preflight allows a browser origin")
			}
		})
	}
}
