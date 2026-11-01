package login

import (
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestBrowserCookieRoundTrip(t *testing.T) {
	for _, origin := range []string{"http://localhost:5173", "https://auth.keysy.test", "https://localhost:5173"} {
		t.Run(origin, func(t *testing.T) {
			f := newFixtureWithRedirectURL(t, origin+"/v0/auth/callback")
			f.handler.webAppURL = origin + "/"
			base, err := url.Parse(origin)
			if err != nil {
				t.Fatal(err)
			}
			jar, err := cookiejar.New(nil)
			if err != nil {
				t.Fatal(err)
			}
			request := func(method, path string) *httptest.ResponseRecorder {
				r := httptest.NewRequest(method, origin+path, nil)
				if method == http.MethodPost {
					r.Header.Set("Origin", origin)
				}
				for _, cookie := range jar.Cookies(base) {
					r.AddCookie(cookie)
				}
				w := httptest.NewRecorder()
				f.router.ServeHTTP(w, r)
				for _, cookie := range w.Result().Cookies() {
					secure := base.Scheme == "https"
					if cookie.Secure != secure || strings.HasPrefix(cookie.Name, "__Host-") != secure || !cookie.HttpOnly || cookie.Path != "/" || cookie.Domain != "" || cookie.SameSite != http.SameSiteLaxMode {
						t.Errorf("cookie policy does not match browser origin %s: %s", origin, cookie.Name)
					}
				}
				jar.SetCookies(base, w.Result().Cookies())
				return w
			}
			start := request(http.MethodGet, "/v0/auth/google")
			if start.Code != http.StatusFound {
				t.Fatalf("start status = %d", start.Code)
			}
			authorization, err := url.Parse(start.Header().Get("Location"))
			if err != nil {
				t.Fatal(err)
			}
			callback := request(http.MethodGet, "/v0/auth/callback?"+url.Values{"code": {"google-code"}, "state": {authorization.Query().Get("state")}}.Encode())
			if callback.Code != http.StatusSeeOther || callback.Header().Get("Location") != origin+"/" {
				t.Fatalf("callback status = %d: %s", callback.Code, callback.Body.String())
			}
			for _, cookie := range jar.Cookies(base) {
				if strings.HasSuffix(cookie.Name, "keysy-oauth") {
					t.Error("OAuth transaction cookie was not cleared")
				}
			}
			session := request(http.MethodGet, "/v0/auth/session")
			if session.Code != http.StatusOK || f.userCalls != 1 {
				t.Fatalf("session status = %d: %s", session.Code, session.Body.String())
			}
			logout := request(http.MethodPost, "/v0/auth/logout")
			if logout.Code != http.StatusNoContent || f.logoutCalls != 1 || len(jar.Cookies(base)) != 0 {
				t.Fatalf("logout status = %d; cookies or session were not cleared", logout.Code)
			}
			session = request(http.MethodGet, "/v0/auth/session")
			if session.Code != http.StatusUnauthorized || f.userCalls != 1 {
				t.Fatalf("session survived logout: %d", session.Code)
			}
		})
	}
}
