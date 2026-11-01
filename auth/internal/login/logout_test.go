package login

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLogoutRevokesCurrentSessionAndClearsCookies(t *testing.T) {
	for _, origin := range []string{"https://auth.keysy.test", "http://localhost:5173"} {
		t.Run(origin, func(t *testing.T) {
			f := newFixtureWithBrowserURLs(t, origin+"/v0/auth/callback", origin+"/")
			r := httptest.NewRequest(http.MethodPost, origin+"/v0/auth/logout", nil)
			r.Header.Set("Origin", origin)
			r.AddCookie(f.handler.newTokenCookie(accessCookieName, "keysy-access", 3600))
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, r)
			if w.Code != http.StatusNoContent || f.logoutCalls != 1 || w.Body.Len() != 0 {
				t.Fatalf("logout = %d, upstream calls = %d", w.Code, f.logoutCalls)
			}
			assertClearedCookies(t, f.handler, w)
			if w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("Referrer-Policy") != "no-referrer" {
				t.Error("missing sensitive-response headers")
			}
		})
	}
}

func assertClearedCookies(t *testing.T, h *Handler, w *httptest.ResponseRecorder) {
	t.Helper()
	cookies := w.Result().Cookies()
	if len(cookies) != 3 {
		t.Fatalf("cleared %d cookies, want 3", len(cookies))
	}
	seen := map[string]bool{}
	for _, c := range cookies {
		seen[c.Name] = true
		if c.Value != "" || c.MaxAge >= 0 || c.Path != "/" || c.Domain != "" || !c.HttpOnly || c.Secure == h.localHTTP || c.SameSite != http.SameSiteLaxMode {
			t.Errorf("unsafe cleared cookie %s", c.Name)
		}
	}
	for _, name := range []string{oauthCookieName, accessCookieName, refreshCookieName} {
		if !seen[h.cookieName(name)] {
			t.Errorf("cookie %s was not cleared", name)
		}
	}
}

func TestLogoutRejectsCrossOriginAndInvalidRequests(t *testing.T) {
	for _, name := range []string{"missing-origin", "wrong-origin", "null-origin", "duplicate-origin", "unexpected-query", "request-body", "duplicate-cookie", "get-method"} {
		t.Run(name, func(t *testing.T) {
			f := newFixture(t)
			method, path, body := http.MethodPost, "/v0/auth/logout", ""
			want := http.StatusForbidden
			if name == "get-method" {
				method, want = http.MethodGet, http.StatusMethodNotAllowed
			}
			if name == "unexpected-query" {
				path += "?scope=global"
				want = http.StatusBadRequest
			}
			if name == "request-body" {
				body, want = `{}`, http.StatusBadRequest
			}
			r := httptest.NewRequest(method, path, strings.NewReader(body))
			r.Header.Set("Origin", "https://app.keysy.test")
			switch name {
			case "missing-origin":
				r.Header.Del("Origin")
			case "wrong-origin":
				r.Header.Set("Origin", "https://attacker.keysy.test")
			case "null-origin":
				r.Header.Set("Origin", "null")
			case "duplicate-origin":
				r.Header.Add("Origin", "https://attacker.test")
			case "duplicate-cookie":
				r.AddCookie(&http.Cookie{Name: accessCookieName, Value: "duplicate"})
				want = http.StatusBadRequest
			}
			r.AddCookie(&http.Cookie{Name: accessCookieName, Value: sealTestCookie(f.handler, accessCookieName, "keysy-access")})
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, r)
			if w.Code != want || f.logoutCalls != 0 || len(w.Result().Cookies()) != 0 {
				t.Fatalf("logout = %d, want %d; upstream calls = %d", w.Code, want, f.logoutCalls)
			}
		})
	}
}

func TestLogoutDoesNotFollowRedirectsOrClearCookiesOnNetworkFailure(t *testing.T) {
	for _, name := range []string{"redirect", "unreachable"} {
		t.Run(name, func(t *testing.T) {
			f := newFixture(t)
			followed := false
			target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				followed = true
				w.WriteHeader(http.StatusNoContent)
			}))
			t.Cleanup(target.Close)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				http.Redirect(w, r, target.URL, http.StatusTemporaryRedirect)
			}))
			t.Cleanup(upstream.Close)
			f.handler.supabaseURL = upstream.URL
			if name == "unreachable" {
				upstream.Close()
			}
			r := httptest.NewRequest(http.MethodPost, "/v0/auth/logout", nil)
			r.Header.Set("Origin", "https://app.keysy.test")
			r.AddCookie(&http.Cookie{Name: accessCookieName, Value: sealTestCookie(f.handler, accessCookieName, "keysy-access")})
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, r)
			if w.Code != http.StatusServiceUnavailable || followed || len(w.Result().Cookies()) != 0 {
				t.Fatalf("unsafe upstream failure handling: status %d, followed %v", w.Code, followed)
			}
		})
	}
}

func TestLogoutHandlesMissingCredentialsAndUpstreamFailures(t *testing.T) {
	for _, name := range []string{"missing-cookie", "invalid-cookie", "empty-token", "expired-token", "forbidden-token", "upstream-unavailable"} {
		t.Run(name, func(t *testing.T) {
			f := newFixture(t)
			r := httptest.NewRequest(http.MethodPost, "/v0/auth/logout", nil)
			r.Header.Set("Origin", "https://app.keysy.test")
			value, want, calls := sealTestCookie(f.handler, accessCookieName, "keysy-access"), http.StatusNoContent, 0
			switch name {
			case "invalid-cookie":
				value = "invalid"
			case "empty-token":
				value = sealTestCookie(f.handler, accessCookieName, "")
			case "expired-token":
				f.logoutStatus, calls = 401, 1
			case "forbidden-token":
				f.logoutStatus, calls = 403, 1
			case "upstream-unavailable":
				f.logoutStatus, want, calls = 503, 503, 1
			}
			if name != "missing-cookie" {
				r.AddCookie(&http.Cookie{Name: accessCookieName, Value: value})
			}
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, r)
			if w.Code != want || f.logoutCalls != calls {
				t.Fatalf("logout = %d, want %d; upstream calls = %d", w.Code, want, f.logoutCalls)
			}
			if want == http.StatusNoContent {
				assertClearedCookies(t, f.handler, w)
			} else if len(w.Result().Cookies()) != 0 {
				t.Error("cleared cookies without completing logout")
			}
		})
	}
}
