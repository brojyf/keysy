package login

import (
	"encoding/base64"
	"encoding/json"
	"golang.org/x/oauth2"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"testing"
)

func sealTestCookie(h *Handler, name, token string) string {
	return base64.RawURLEncoding.EncodeToString(h.cipher.Seal(nil, nil, []byte(token), []byte(name)))
}

func openTestCookie(t *testing.T, h *Handler, name, value string) string {
	t.Helper()
	sealed, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		t.Fatal("cookie is not base64 encoded")
	}
	plaintext, err := h.cipher.Open(nil, nil, sealed, []byte(name))
	if err != nil {
		t.Fatal("cookie is not sealed for its name")
	}
	return string(plaintext)
}

func TestTokenCookiesUseDistinctNoncesAndBindTheirNames(t *testing.T) {
	f := newFixture(t)
	previous := map[string]string{}
	for range 2 {
		cookie, authorization := f.start(t)
		w := f.callback(cookie, url.Values{"code": {"google-code"}, "state": {authorization.Get("state")}})
		if w.Code != http.StatusSeeOther {
			t.Fatalf("callback status = %d", w.Code)
		}
		for _, c := range w.Result().Cookies() {
			if c.Name == oauthCookieName {
				continue
			}
			want, otherName := "keysy-access", refreshCookieName
			if c.Name == refreshCookieName {
				want, otherName = "keysy-refresh", accessCookieName
			}
			if c.Value == want || openTestCookie(t, f.handler, c.Name, c.Value) != want {
				t.Fatal("token cookie does not protect the token")
			}
			token, err := f.handler.openTokenCookie(c.Name, c.Value)
			if err != nil || token != want {
				t.Fatal("token cookie could not be opened")
			}
			if _, err := f.handler.openTokenCookie(otherName, c.Value); err == nil {
				t.Fatal("token cookie opened under another name")
			}
			if previous[c.Name] == c.Value {
				t.Fatal("token cookie reused a nonce")
			}
			previous[c.Name] = c.Value
			sealed, err := base64.RawURLEncoding.DecodeString(c.Value)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := f.handler.cipher.Open(nil, nil, sealed, []byte(otherName)); err == nil {
				t.Fatal("token cookie accepted under another name")
			}
			sealed[len(sealed)-1] ^= 1
			if _, err := f.handler.cipher.Open(nil, nil, sealed, []byte(c.Name)); err == nil {
				t.Fatal("tampered token cookie was accepted")
			}
		}
	}
}

func TestCallbackChecksCookieSizeAfterSealing(t *testing.T) {
	for _, tokenName := range []string{"access", "refresh"} {
		for _, tokenLength := range []int{2800, 3050} {
			t.Run(tokenName+"/"+strconv.Itoa(tokenLength), func(t *testing.T) {
				f := newFixture(t)
				s := session{AccessToken: "keysy-access", RefreshToken: "keysy-refresh", TokenType: "bearer", ExpiresIn: 3600}
				if tokenName == "access" {
					s.AccessToken = strings.Repeat("a", tokenLength)
				} else {
					s.RefreshToken = strings.Repeat("r", tokenLength)
				}
				payload, err := json.Marshal(s)
				if err != nil {
					t.Fatal(err)
				}
				f.supabaseBody = string(payload)
				cookie, authorization := f.start(t)
				w := f.callback(cookie, url.Values{"code": {"google-code"}, "state": {authorization.Get("state")}})
				if tokenLength == 2800 {
					if w.Code != http.StatusSeeOther {
						t.Fatalf("valid sealed cookie rejected: %d", w.Code)
					}
					for _, c := range w.Result().Cookies() {
						if len(c.String()) > 4096 {
							t.Fatal("issued oversized cookie")
						}
					}
					return
				}
				if w.Code != http.StatusBadGateway {
					t.Fatalf("oversized sealed cookie accepted: %d", w.Code)
				}
				for _, c := range w.Result().Cookies() {
					if c.Name != oauthCookieName {
						t.Fatal("issued partial session on cookie size failure")
					}
				}
			})
		}
	}
}

func TestAccessCookiePolicyAndAAD(t *testing.T) {
	for _, local := range []bool{false, true} {
		redirect := "https://auth.keysy.net/v0/auth/callback"
		if local {
			redirect = "http://localhost:8080/v0/auth/callback"
		}
		h, err := New(Options{OAuth: oauth2.Config{RedirectURL: redirect}, WebAppURL: "https://dashboard.keysy.net/", CookieDomain: "keysy.net", CookieKey: []byte(strings.Repeat("k", 32))})
		if err != nil {
			t.Fatal(err)
		}
		cookie := h.newTokenCookie(accessCookieName, "access-token", 3600)
		wantName, wantDomain := accessCookieName, "keysy.net"
		if local {
			wantName, wantDomain = "keysy-access", ""
		}
		if cookie.Name != wantName || cookie.Domain != wantDomain || cookie.Secure == local {
			t.Fatal("wrong access cookie policy")
		}
		if got := openTestCookie(t, h, "__Secure-keysy-access", cookie.Value); got != "access-token" {
			t.Fatal("wrong AAD")
		}
		if _, err := h.openTokenCookie("keysy-access", cookie.Value); err == nil {
			t.Fatal("accepted stripped-name AAD")
		}
		cleared := h.newCookie(accessCookieName, "", -1)
		if cleared.Name != cookie.Name || cleared.Domain != cookie.Domain || cleared.MaxAge != -1 {
			t.Fatal("logout cookie scope differs")
		}
		for _, name := range []string{refreshCookieName, oauthCookieName} {
			cookie := h.newCookie(name, "", -1)
			if cookie.Domain != "" {
				t.Fatal("host-only cookie has a Domain")
			}
		}
	}
}
