package login

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func refreshRequest(f *loginFixture, origin, refreshToken string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/v0/auth/refresh", nil)
	r.Header.Set("Origin", origin)
	r.Header.Set("User-Agent", browserAgent)
	r.AddCookie(&http.Cookie{Name: f.handler.cookieName(refreshCookieName), Value: sealTestCookie(f.handler, refreshCookieName, refreshToken)})
	return r
}

func TestRefreshRotatesTokenCookies(t *testing.T) {
	for _, browser := range []struct{ authURL, origin string }{
		{"https://auth.keysy.test", "https://app.keysy.test"},
		{"http://localhost:8080", "http://localhost:5173"},
	} {
		t.Run(browser.origin, func(t *testing.T) {
			f := newFixtureWithBrowserURLs(t, browser.authURL+"/v0/auth/callback", browser.origin+"/")
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, refreshRequest(f, browser.origin, "keysy-refresh"))
			if w.Code != http.StatusNoContent || w.Body.Len() != 0 || f.refreshCalls != 1 {
				t.Fatalf("refresh = %d, upstream calls = %d: %s", w.Code, f.refreshCalls, w.Body.String())
			}
			if len(f.refreshGrant) != 1 || f.refreshGrant["refresh_token"] != "keysy-refresh" || f.refreshAgent != browserAgent {
				t.Fatalf("unexpected refresh grant: %v", f.refreshGrant)
			}
			assertDashboardCORS(t, w, browser.origin)
			if w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("Referrer-Policy") != "no-referrer" {
				t.Error("missing sensitive-response headers")
			}
			cookies := w.Result().Cookies()
			if len(cookies) != 2 {
				t.Fatalf("set %d cookies, want 2", len(cookies))
			}
			for _, c := range cookies {
				name, want, maxAge, domain := accessCookieName, "keysy-access-2", 600, f.handler.cookieDomain
				if c.Name == f.handler.cookieName(refreshCookieName) {
					name, want, maxAge, domain = refreshCookieName, "keysy-refresh-2", 0, ""
				} else if c.Name != f.handler.cookieName(accessCookieName) {
					t.Fatalf("unexpected cookie %s", c.Name)
				}
				if f.handler.localHTTP {
					domain = ""
				}
				if openTestCookie(t, f.handler, name, c.Value) != want || c.MaxAge != maxAge || c.Domain != domain || c.Path != "/" || !c.HttpOnly || c.Secure == f.handler.localHTTP || c.SameSite != http.SameSiteLaxMode {
					t.Errorf("unsafe refreshed cookie %s", c.Name)
				}
			}
		})
	}
}

func TestRefreshRejectsInvalidRequests(t *testing.T) {
	for _, name := range []string{"unexpected-query", "request-body", "duplicate-cookie", "get-method"} {
		t.Run(name, func(t *testing.T) {
			f := newFixture(t)
			r := refreshRequest(f, "https://app.keysy.test", "keysy-refresh")
			want := http.StatusBadRequest
			switch name {
			case "unexpected-query":
				r.URL.RawQuery = "scope=global"
			case "request-body":
				r.Body, r.ContentLength = http.NoBody, 2
			case "duplicate-cookie":
				r.AddCookie(&http.Cookie{Name: refreshCookieName, Value: "duplicate"})
			case "get-method":
				r.Method, want = http.MethodGet, http.StatusMethodNotAllowed
			}
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, r)
			if w.Code != want || f.refreshCalls != 0 || len(w.Result().Cookies()) != 0 {
				t.Fatalf("refresh = %d, want %d; upstream calls = %d", w.Code, want, f.refreshCalls)
			}
		})
	}
}

func TestRefreshExpiredSessionClearsCookies(t *testing.T) {
	for _, name := range []string{"missing-cookie", "invalid-cookie", "empty-token", "rejected-token", "unauthorized-token"} {
		t.Run(name, func(t *testing.T) {
			f := newFixture(t)
			r := refreshRequest(f, "https://app.keysy.test", "keysy-refresh")
			calls := 0
			switch name {
			case "missing-cookie":
				r.Header.Del("Cookie")
			case "invalid-cookie":
				r.Header.Set("Cookie", refreshCookieName+"=invalid")
			case "empty-token":
				r = refreshRequest(f, "https://app.keysy.test", "")
			case "rejected-token":
				f.refreshStatus, f.refreshBody, calls = 400, `{"error_code":"refresh_token_already_used"}`, 1
			case "unauthorized-token":
				f.refreshStatus, calls = 401, 1
			}
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, r)
			if w.Code != http.StatusUnauthorized || f.refreshCalls != calls || !strings.Contains(w.Body.String(), `"code":"SESSION_EXPIRED"`) {
				t.Fatalf("refresh = %d, upstream calls = %d: %s", w.Code, f.refreshCalls, w.Body.String())
			}
			if strings.Contains(w.Body.String(), "refresh_token_already_used") {
				t.Fatal("leaked upstream error text")
			}
			assertClearedCookies(t, f.handler, w)
		})
	}
}

func TestRefreshUpstreamFailureKeepsCookies(t *testing.T) {
	for _, upstream := range []struct {
		name   string
		status int
		body   string
		want   int
	}{
		{"unavailable", 503, `{}`, http.StatusServiceUnavailable},
		{"rate-limited", 429, `{}`, http.StatusServiceUnavailable},
		{"conflict", 409, `{"code":"conflict"}`, http.StatusServiceUnavailable},
		{"invalid-response", 200, `{"access_token":"keysy-access-2"}`, http.StatusBadGateway},
	} {
		t.Run(upstream.name, func(t *testing.T) {
			f := newFixture(t)
			f.refreshStatus, f.refreshBody = upstream.status, upstream.body
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, refreshRequest(f, "https://app.keysy.test", "keysy-refresh"))
			if w.Code != upstream.want || f.refreshCalls != 1 || len(w.Result().Cookies()) != 0 {
				t.Fatalf("refresh = %d, want %d; cookies = %d", w.Code, upstream.want, len(w.Result().Cookies()))
			}
			assertDashboardCORS(t, w, "https://app.keysy.test")
		})
	}
}
