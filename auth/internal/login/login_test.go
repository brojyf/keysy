package login

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

const browserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"

type loginFixture struct {
	handler        *Handler
	router         http.Handler
	googleCalls    int
	supabaseCalls  int
	googleStatus   int
	supabaseStatus int
	googleBody     string
	supabaseBody   string
	googleForm     url.Values
	supabaseGrant  map[string]string
	supabaseAgent  string
}

func newFixture(t *testing.T) *loginFixture {
	t.Helper()
	gin.SetMode(gin.TestMode)
	f := &loginFixture{
		googleStatus: 200, supabaseStatus: 200,
		googleBody:   `{"access_token":"google-access","token_type":"Bearer","id_token":"google-id"}`,
		supabaseBody: `{"access_token":"keysy-access","refresh_token":"keysy-refresh","token_type":"bearer","expires_in":3600}`,
	}
	google := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.googleCalls++
		if r.Method != http.MethodPost {
			t.Errorf("Google method = %s", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Error(err)
		}
		f.googleForm = r.PostForm
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(f.googleStatus)
		io.WriteString(w, f.googleBody)
	}))
	t.Cleanup(google.Close)
	supabase := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.supabaseCalls++
		if r.Method != http.MethodPost || r.URL.Path != "/auth/v1/token" || r.URL.Query().Get("grant_type") != "id_token" {
			t.Errorf("unexpected Supabase request: %s %s", r.Method, r.URL)
		}
		if r.Header.Get("apikey") != "publishable-key" {
			t.Error("missing Supabase API key")
		}
		if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("X-Forwarded-For") != "" {
			t.Error("forwarded untrusted authentication or proxy headers to Supabase")
		}
		if err := json.NewDecoder(r.Body).Decode(&f.supabaseGrant); err != nil {
			t.Error(err)
		}
		f.supabaseAgent = r.UserAgent()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(f.supabaseStatus)
		io.WriteString(w, f.supabaseBody)
	}))
	t.Cleanup(supabase.Close)
	var err error
	f.handler, err = New(Options{
		OAuth: oauth2.Config{
			ClientID: "google-client", ClientSecret: "google-secret",
			RedirectURL: "https://auth.keysy.test/v0/auth/callback",
			Scopes:      []string{"openid", "email", "profile"},
			Endpoint:    oauth2.Endpoint{AuthURL: "https://accounts.google.com/o/oauth2/v2/auth", TokenURL: google.URL, AuthStyle: oauth2.AuthStyleInParams},
		},
		SupabaseURL: supabase.URL, SupabaseKey: "publishable-key",
		WebAppURL: "https://app.keysy.test/", CookieKey: []byte(strings.Repeat("k", 32)),
		HTTPClient: NewHTTPClient(),
	})
	if err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	r.HandleMethodNotAllowed = true
	f.handler.Register(r)
	f.router = r
	return f
}

func (f *loginFixture) start(t *testing.T) (*http.Cookie, url.Values) {
	t.Helper()
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "https://auth.keysy.test/v0/auth/google", nil))
	if w.Code != http.StatusFound {
		t.Fatalf("start status = %d: %s", w.Code, w.Body.String())
	}
	location, err := url.Parse(w.Header().Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	for _, cookie := range w.Result().Cookies() {
		if cookie.Name == oauthCookieName {
			return cookie, location.Query()
		}
	}
	t.Fatal("missing OAuth transaction cookie")
	return nil, nil
}

func (f *loginFixture) callback(cookie *http.Cookie, query url.Values) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodGet, "https://auth.keysy.test/v0/auth/callback?"+query.Encode(), nil)
	r.Header.Set("User-Agent", browserAgent)
	if cookie != nil {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, r)
	return w
}

func TestGoogleLoginSetsCookiesWithoutExposingTokens(t *testing.T) {
	f := newFixture(t)
	cookie, authorization := f.start(t)
	if !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode || cookie.Path != "/" || cookie.Domain != "" || cookie.MaxAge != 600 {
		t.Fatalf("unsafe transaction cookie: %+v", cookie)
	}
	if authorization.Get("client_id") != "google-client" || authorization.Get("redirect_uri") != f.handler.oauth.RedirectURL || authorization.Get("response_type") != "code" || authorization.Get("code_challenge_method") != "S256" {
		t.Fatalf("invalid Google authorization parameters: %v", authorization)
	}
	if authorization.Get("state") == "" || authorization.Get("nonce") == "" {
		t.Fatal("missing state or nonce")
	}
	w := f.callback(cookie, url.Values{"code": {"google-code"}, "state": {authorization.Get("state")}})
	if w.Code != http.StatusSeeOther || w.Header().Get("Location") != "https://app.keysy.test/" {
		t.Fatalf("callback = %d %s: %s", w.Code, w.Header().Get("Location"), w.Body.String())
	}
	if f.googleCalls != 1 || f.supabaseCalls != 1 {
		t.Fatalf("upstream calls: Google %d, Supabase %d", f.googleCalls, f.supabaseCalls)
	}
	if f.googleForm.Get("code") != "google-code" || f.googleForm.Get("client_secret") != "google-secret" || f.googleForm.Get("redirect_uri") != f.handler.oauth.RedirectURL {
		t.Fatalf("invalid Google token request: %v", f.googleForm)
	}
	challenge := sha256.Sum256([]byte(f.googleForm.Get("code_verifier")))
	if base64.RawURLEncoding.EncodeToString(challenge[:]) != authorization.Get("code_challenge") {
		t.Error("PKCE verifier does not match the challenge")
	}
	if f.supabaseGrant["provider"] != "google" || f.supabaseGrant["id_token"] != "google-id" || f.supabaseGrant["access_token"] != "google-access" {
		t.Errorf("invalid Supabase grant: %v", f.supabaseGrant)
	}
	nonce := sha256.Sum256([]byte(f.supabaseGrant["nonce"]))
	if hex.EncodeToString(nonce[:]) != authorization.Get("nonce") {
		t.Error("Supabase nonce does not match the Google nonce")
	}
	if f.supabaseAgent != browserAgent {
		t.Error("browser User-Agent was not forwarded to Supabase session creation")
	}
	seen := map[string]bool{}
	for _, c := range w.Result().Cookies() {
		if !c.HttpOnly || !c.Secure || c.Path != "/" || c.Domain != "" || c.SameSite != http.SameSiteLaxMode {
			t.Errorf("unsafe callback cookie: %+v", c)
		}
		seen[c.Name] = true
		switch c.Name {
		case accessCookieName:
			if c.Value != "keysy-access" || c.MaxAge != 3600 {
				t.Errorf("invalid access cookie: %+v", c)
			}
		case refreshCookieName:
			if c.Value != "keysy-refresh" {
				t.Errorf("invalid refresh cookie: %+v", c)
			}
		case oauthCookieName:
			if c.MaxAge >= 0 {
				t.Error("transaction cookie was not cleared")
			}
		default:
			t.Errorf("unexpected cookie %s", c.Name)
		}
	}
	if !seen[accessCookieName] || !seen[refreshCookieName] || !seen[oauthCookieName] {
		t.Fatalf("missing cookies: %v", seen)
	}
	if w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("Referrer-Policy") != "no-referrer" {
		t.Error("missing sensitive-response headers")
	}
	if strings.Contains(w.Body.String(), "keysy-access") || strings.Contains(w.Body.String(), "keysy-refresh") || strings.Contains(w.Header().Get("Location"), "token") {
		t.Error("token exposed outside HttpOnly cookies")
	}
}

func TestCallbackRejectsInvalidLoginTransactions(t *testing.T) {
	for _, name := range []string{"missing-cookie", "tampered-cookie", "wrong-state", "expired-cookie", "missing-code", "duplicate-code", "provider-error", "provider-denied", "wrong-key"} {
		t.Run(name, func(t *testing.T) {
			f := newFixture(t)
			cookie, authorization := f.start(t)
			query := url.Values{"code": {"google-code"}, "state": {authorization.Get("state")}}
			switch name {
			case "missing-cookie":
				cookie = nil
			case "tampered-cookie":
				cookie.Value = "tampered" + cookie.Value
			case "wrong-state":
				query.Set("state", "attacker-state")
			case "expired-cookie":
				f.handler.now = func() time.Time { return time.Now().Add(11 * time.Minute) }
			case "missing-code":
				query.Del("code")
			case "duplicate-code":
				query.Add("code", "another-code")
			case "provider-error":
				query.Set("error", "access_denied")
				query.Set("error_description", "secret-provider-details")
			case "provider-denied":
				query.Del("code")
				query.Set("error", "access_denied")
			case "wrong-key":
				other, err := New(Options{CookieKey: []byte(strings.Repeat("x", 32))})
				if err != nil {
					t.Fatal(err)
				}
				f.handler.cipher = other.cipher
			}
			w := f.callback(cookie, query)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("callback status = %d: %s", w.Code, w.Body.String())
			}
			if f.googleCalls != 0 || f.supabaseCalls != 0 {
				t.Error("invalid transaction reached an upstream")
			}
			for _, c := range w.Result().Cookies() {
				if c.Name != oauthCookieName || c.MaxAge >= 0 {
					t.Errorf("unexpected cookie: %+v", c)
				}
			}
			if w.Header().Get("Cache-Control") != "no-store" || strings.Contains(w.Body.String(), "secret-provider-details") {
				t.Error("unsafe error response")
			}
		})
	}
}

func TestRejectsDuplicateCookiesAndInvalidUserAgents(t *testing.T) {
	for _, name := range []string{"duplicate-cookie", "long-user-agent", "user-agent-control-character"} {
		t.Run(name, func(t *testing.T) {
			f := newFixture(t)
			cookie, authorization := f.start(t)
			query := url.Values{"code": {"google-code"}, "state": {authorization.Get("state")}}
			r := httptest.NewRequest(http.MethodGet, "/v0/auth/callback?"+query.Encode(), nil)
			r.AddCookie(cookie)
			switch name {
			case "duplicate-cookie":
				r.AddCookie(cookie)
			case "long-user-agent":
				r.Header.Set("User-Agent", strings.Repeat("x", 2049))
			case "user-agent-control-character":
				r.Header.Set("User-Agent", "browser\ninvalid")
			}
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, r)
			if w.Code != 400 || f.googleCalls != 0 || f.supabaseCalls != 0 {
				t.Fatalf("accepted invalid request: %d", w.Code)
			}
		})
	}
}

func TestLoginRejectsUnsupportedHTTPMethods(t *testing.T) {
	f := newFixture(t)
	for _, path := range []string{"/v0/auth/google", "/v0/auth/callback"} {
		for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete} {
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, httptest.NewRequest(method, path, nil))
			if w.Code != http.StatusMethodNotAllowed {
				t.Errorf("%s %s = %d", method, path, w.Code)
			}
		}
	}
}

func TestUpstreamRedirectsAreNotFollowed(t *testing.T) {
	for _, upstream := range []string{"google", "supabase"} {
		t.Run(upstream, func(t *testing.T) {
			followed := false
			target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { followed = true; w.WriteHeader(500) }))
			defer target.Close()
			redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				http.Redirect(w, r, target.URL, http.StatusTemporaryRedirect)
			}))
			defer redirect.Close()
			f := newFixture(t)
			if upstream == "google" {
				f.handler.oauth.Endpoint.TokenURL = redirect.URL
			} else {
				f.handler.supabaseURL = redirect.URL
			}
			cookie, authorization := f.start(t)
			w := f.callback(cookie, url.Values{"code": {"google-code"}, "state": {authorization.Get("state")}})
			if followed || w.Code != http.StatusServiceUnavailable {
				t.Fatalf("followed credential-bearing redirect: %v, status %d", followed, w.Code)
			}
		})
	}
}

func TestCallbackHandlesUpstreamFailuresWithoutLeakingSecrets(t *testing.T) {
	for _, name := range []string{"google-rejects-code", "google-unavailable", "google-missing-id-token", "supabase-rejects-token", "supabase-unavailable", "supabase-malformed-session", "oversized-access-token"} {
		t.Run(name, func(t *testing.T) {
			f := newFixture(t)
			want := http.StatusBadGateway
			switch name {
			case "google-rejects-code":
				f.googleStatus = 400
				f.googleBody = `{"error":"invalid_grant","error_description":"secret-provider-details"}`
				want = 400
			case "google-unavailable":
				f.googleStatus = 503
				want = 503
			case "google-missing-id-token":
				f.googleBody = `{"access_token":"google-access","token_type":"Bearer"}`
			case "supabase-rejects-token":
				f.supabaseStatus = 401
				want = 400
			case "supabase-unavailable":
				f.supabaseStatus = 503
				want = 503
			case "supabase-malformed-session":
				f.supabaseBody = `{"access_token":"keysy-access"}`
			case "oversized-access-token":
				f.supabaseBody = `{"access_token":"` + strings.Repeat("x", 4096) + `","refresh_token":"keysy-refresh","token_type":"bearer","expires_in":3600}`
			}
			cookie, authorization := f.start(t)
			w := f.callback(cookie, url.Values{"code": {"google-code"}, "state": {authorization.Get("state")}})
			if w.Code != want {
				t.Fatalf("status = %d, want %d: %s", w.Code, want, w.Body.String())
			}
			for _, c := range w.Result().Cookies() {
				if c.Name != oauthCookieName {
					t.Errorf("issued session cookie on failure: %s", c.Name)
				}
			}
			for _, secret := range []string{"google-secret", "google-id", "keysy-access", "keysy-refresh", "secret-provider-details"} {
				if strings.Contains(w.Body.String(), secret) {
					t.Errorf("error leaked %s", secret)
				}
			}
		})
	}
}

func TestLoginIgnoresCallerRedirectTargetsAndUsesUniqueTransactions(t *testing.T) {
	f := newFixture(t)
	firstCookie, first := f.start(t)
	secondCookie, second := f.start(t)
	if firstCookie.Value == secondCookie.Value || first.Get("state") == second.Get("state") || first.Get("code_challenge") == second.Get("code_challenge") || first.Get("nonce") == second.Get("nonce") {
		t.Error("login transaction secrets were reused")
	}
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/v0/auth/google?redirect_uri=https://attacker.test&returnTo=https://attacker.test", nil))
	if w.Code != 400 || w.Header().Get("Location") != "" {
		t.Error("login accepted caller-supplied redirect parameters")
	}
	w = f.callback(firstCookie, url.Values{"code": {"google-code"}, "state": {second.Get("state")}})
	if w.Code != 400 {
		t.Error("callback accepted another browser transaction")
	}
}

func TestHTTPInputValidation(t *testing.T) {
	for _, item := range []struct{ name, path, body string }{
		{"unexpected-login-parameter", "/v0/auth/google?client=cli", ""},
		{"malformed-login-encoding", "/v0/auth/google?bad=%zz", ""},
		{"login-body", "/v0/auth/google", `{}`},
		{"missing-state", "/v0/auth/callback?code=valid", ""},
		{"duplicate-state", "/v0/auth/callback?code=valid&state=" + strings.Repeat("s", 26) + "&state=" + strings.Repeat("s", 26), ""},
		{"short-state", "/v0/auth/callback?code=valid&state=short", ""},
		{"invalid-state-characters", "/v0/auth/callback?code=valid&state=" + strings.Repeat("!", 26), ""},
		{"long-state", "/v0/auth/callback?code=valid&state=" + strings.Repeat("s", 129), ""},
		{"empty-code", "/v0/auth/callback?code=&state=" + strings.Repeat("s", 26), ""},
		{"duplicate-code", "/v0/auth/callback?code=one&code=two&state=" + strings.Repeat("s", 26), ""},
		{"long-code", "/v0/auth/callback?code=" + strings.Repeat("c", 4097) + "&state=" + strings.Repeat("s", 26), ""},
		{"control-character", "/v0/auth/callback?code=valid%0A&state=" + strings.Repeat("s", 26), ""},
		{"code-whitespace", "/v0/auth/callback?code=invalid+code&state=" + strings.Repeat("s", 26), ""},
		{"malformed-callback-encoding", "/v0/auth/callback?code=%zz&state=" + strings.Repeat("s", 26), ""},
		{"unknown-callback-parameter", "/v0/auth/callback?code=valid&state=" + strings.Repeat("s", 26) + "&client=cli", ""},
		{"oversized-query", "/v0/auth/callback?code=" + strings.Repeat("c", 8192), ""},
		{"callback-body", "/v0/auth/callback?code=valid&state=" + strings.Repeat("s", 26), `{}`},
	} {
		t.Run(item.name, func(t *testing.T) {
			f := newFixture(t)
			cookie, _ := f.start(t)
			r := httptest.NewRequest(http.MethodGet, item.path, strings.NewReader(item.body))
			r.AddCookie(cookie)
			w := httptest.NewRecorder()
			f.router.ServeHTTP(w, r)
			if w.Code != 400 || !strings.Contains(w.Body.String(), "INVALID_REQUEST") {
				t.Fatalf("response = %d %s", w.Code, w.Body.String())
			}
			if f.googleCalls != 0 || f.supabaseCalls != 0 {
				t.Error("invalid input reached upstream")
			}
		})
	}
}

func TestOnlyTwoLoginRoutesAreRegistered(t *testing.T) {
	f := newFixture(t)
	for _, path := range []string{"/v0/auth/token", "/v0/auth/refresh", "/v0/auth/logout", "/v0/auth/github"} {
		w := httptest.NewRecorder()
		f.router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if w.Code != 404 {
			t.Errorf("unexpected route %s: %d", path, w.Code)
		}
	}
}
