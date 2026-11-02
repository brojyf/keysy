package login

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCurrentSessionVerifiesCookieOnTheServer(t *testing.T) {
	f := newFixture(t)
	r := httptest.NewRequest(http.MethodGet, "/v0/auth/session", nil)
	r.AddCookie(&http.Cookie{Name: accessCookieName, Value: sealTestCookie(f.handler, accessCookieName, "keysy-access")})
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, r)
	if w.Code != 200 || f.userCalls != 1 {
		t.Fatalf("response = %d %s, calls = %d", w.Code, w.Body.String(), f.userCalls)
	}
	var result map[string]map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result) != 1 || len(result["user"]) != 2 || result["user"]["id"] != "user-id" || result["user"]["email"] != "member@example.com" {
		t.Errorf("unexpected public session: %v", result)
	}
	if w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("Referrer-Policy") != "no-referrer" {
		t.Error("session response could be cached or referred")
	}
	if len(w.Result().Cookies()) != 0 {
		t.Error("session lookup issued new credentials")
	}
}

func TestCurrentSessionRejectsMissingOrInvalidCredentials(t *testing.T) {
	for _, name := range []string{"missing-cookie", "duplicate-cookie", "expired-token", "upstream-unavailable", "invalid-user", "unexpected-query", "plaintext-token", "invalid-base64", "truncated-cookie", "tampered-cookie", "swapped-cookie", "oauth-cookie", "empty-token", "wrong-key"} {
		t.Run(name, func(t *testing.T) {
			f := newFixture(t)
			path := "/v0/auth/session"
			want := 401
			switch name {
			case "duplicate-cookie":
				want = 400
			case "expired-token":
				f.userStatus = 401
			case "upstream-unavailable":
				f.userStatus = 503
				want = 503
			case "invalid-user":
				f.userBody = `{"email":"member@example.com"}`
				want = 502
			case "unexpected-query":
				path += "?access_token=untrusted"
				want = 400
			}
			r := httptest.NewRequest(http.MethodGet, path, nil)
			value := sealTestCookie(f.handler, accessCookieName, "keysy-access")
			switch name {
			case "plaintext-token":
				value = "keysy-access"
			case "invalid-base64":
				value = "!invalid"
			case "truncated-cookie":
				value = value[:8]
			case "tampered-cookie":
				sealed, err := base64.RawURLEncoding.DecodeString(value)
				if err != nil {
					t.Fatal(err)
				}
				sealed[len(sealed)-1] ^= 1
				value = base64.RawURLEncoding.EncodeToString(sealed)
			case "swapped-cookie":
				value = sealTestCookie(f.handler, refreshCookieName, "keysy-refresh")
			case "oauth-cookie":
				value = sealTestCookie(f.handler, oauthCookieName, "keysy-access")
			case "empty-token":
				value = sealTestCookie(f.handler, accessCookieName, "")
			case "wrong-key":
				other, err := New(Options{CookieKey: make([]byte, 32)})
				if err != nil {
					t.Fatal(err)
				}
				value = sealTestCookie(other, accessCookieName, "keysy-access")
			}
			if name != "missing-cookie" {
				r.AddCookie(&http.Cookie{Name: accessCookieName, Value: value})
			}
			if name == "duplicate-cookie" {
				r.AddCookie(&http.Cookie{Name: accessCookieName, Value: "other-token"})
			}
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, r)
			if w.Code != want {
				t.Fatalf("response = %d %s, want %d", w.Code, w.Body.String(), want)
			}
			if name != "expired-token" && name != "upstream-unavailable" && name != "invalid-user" && f.userCalls != 0 {
				t.Error("invalid input reached Supabase")
			}
		})
	}
}
