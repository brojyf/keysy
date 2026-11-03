package middleware

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var cookieKey = []byte(strings.Repeat("k", 32))

func sealedCookie(t *testing.T, token, aad string) string {
	t.Helper()
	block, err := aes.NewCipher(cookieKey)
	if err != nil {
		t.Fatal(err)
	}
	aead, err := cipher.NewGCMWithRandomNonce(block)
	if err != nil {
		t.Fatal(err)
	}
	return base64.RawURLEncoding.EncodeToString(aead.Seal(nil, nil, []byte(token), []byte(aad)))
}

func TestOpenCookie(t *testing.T) {
	value := sealedCookie(t, "token", accessCookieName)
	got, err := OpenCookie(cookieKey, value)
	if err != nil || got != "token" {
		t.Fatal("roundtrip failed")
	}
	for _, value := range []string{"bad-base64!", "", sealedCookie(t, "token", "keysy-access"), sealedCookie(t, "token", "__Host-keysy-refresh")} {
		if _, err := OpenCookie(cookieKey, value); err == nil {
			t.Fatal("accepted invalid seal or AAD")
		}
	}
	wrong := []byte(strings.Repeat("x", 32))
	if _, err := OpenCookie(wrong, value); err == nil {
		t.Fatal("accepted wrong key")
	}
}

func TestSessionJWKS(t *testing.T) {
	gin.SetMode(gin.TestMode)
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	encode := func(value []byte) string { return base64.RawURLEncoding.EncodeToString(value) }
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/v1/.well-known/jwks.json" {
			t.Error("wrong JWKS path")
		}
		json.NewEncoder(w).Encode(map[string]any{"keys": []any{map[string]any{"kty": "EC", "crv": "P-256", "kid": "test", "alg": "ES256", "use": "sig", "x": encode(private.X.FillBytes(make([]byte, 32))), "y": encode(private.Y.FillBytes(make([]byte, 32)))}}})
	}))
	defer server.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	keys, err := keyfunc.NewDefaultCtx(ctx, []string{server.URL + "/auth/v1/.well-known/jwks.json"})
	if err != nil {
		t.Fatal(err)
	}
	for _, local := range []bool{false, true} {
		for _, scenario := range []string{"valid", "expired", "missing-exp", "wrong-alg", "wrong-iss", "wrong-aud", "missing-sub", "bad-avatar", "relative-avatar", "no-host-avatar", "missing-cookie", "duplicate", "bad-seal", "bearer", "wrong-signature"} {
			t.Run(scenario+map[bool]string{true: "/local", false: "/prod"}[local], func(t *testing.T) {
				claims := jwt.MapClaims{"sub": "user-123", "email": "user@example.test", "iss": server.URL + "/auth/v1", "aud": "authenticated", "exp": time.Now().Add(time.Hour).Unix(), "user_metadata": map[string]any{"avatar_url": "https://google.test/photo"}}
				method := jwt.SigningMethodES256
				var signingKey any = private
				switch scenario {
				case "expired":
					claims["exp"] = time.Now().Add(-time.Hour).Unix()
				case "missing-exp":
					delete(claims, "exp")
				case "wrong-iss":
					claims["iss"] = "https://evil.test"
				case "wrong-aud":
					claims["aud"] = "anon"
				case "missing-sub":
					delete(claims, "sub")
				case "bad-avatar":
					claims["user_metadata"] = map[string]any{"avatar_url": "http://google.test/photo"}
				case "relative-avatar":
					claims["user_metadata"] = map[string]any{"avatar_url": "/photo"}
				case "no-host-avatar":
					claims["user_metadata"] = map[string]any{"avatar_url": "https:///photo"}
				case "wrong-signature":
					signingKey, err = ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
					if err != nil {
						t.Fatal(err)
					}
				}
				var token *jwt.Token
				if scenario == "wrong-alg" {
					token = jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
					signingKey = []byte("secret")
				} else {
					token = jwt.NewWithClaims(method, claims)
				}
				token.Header["kid"] = "test"
				signed, err := token.SignedString(signingKey)
				if err != nil {
					t.Fatal(err)
				}
				name := accessCookieName
				if local {
					name = "keysy-access"
				}
				value := sealedCookie(t, signed, accessCookieName)
				if scenario == "bad-seal" {
					value = "invalid"
				}
				r := gin.New()
				r.Use(Session(cookieKey, local, server.URL+"/auth/v1", keys.KeyfuncCtx))
				r.GET("/v0/me", func(c *gin.Context) {
					c.JSON(200, gin.H{"id": c.GetString("user_id"), "email": c.GetString("email"), "avatar": c.GetString("avatar_url")})
				})
				req := httptest.NewRequest("GET", "/v0/me", nil)
				if scenario != "missing-cookie" && scenario != "bearer" {
					req.AddCookie(&http.Cookie{Name: name, Value: value})
				}
				if scenario == "duplicate" {
					req.AddCookie(&http.Cookie{Name: name, Value: value})
				}
				if scenario == "bearer" {
					req.Header.Set("Authorization", "Bearer "+signed)
				}
				w := httptest.NewRecorder()
				r.ServeHTTP(w, req)
				valid := scenario == "valid" || strings.Contains(scenario, "avatar")
				if valid {
					if w.Code != 200 {
						t.Fatalf("status %d", w.Code)
					}
					var body map[string]string
					json.Unmarshal(w.Body.Bytes(), &body)
					if body["id"] != "user-123" || body["email"] != "user@example.test" {
						t.Fatal(body)
					}
					if scenario == "valid" && body["avatar"] != "https://google.test/photo" || scenario != "valid" && body["avatar"] != "" {
						t.Fatal(body)
					}
				} else if w.Code != 401 || !strings.Contains(w.Body.String(), `"code":"UNAUTHENTICATED"`) || strings.Contains(w.Body.String(), signed) {
					t.Fatalf("unexpected rejection: %d %s", w.Code, w.Body.String())
				}
				if w.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("missing no-store")
				}
			})
		}
	}
}

func TestSessionJWKSRefreshHonorsRequestDeadline(t *testing.T) {
	gin.SetMode(gin.TestMode)
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	encode := func(value []byte) string { return base64.RawURLEncoding.EncodeToString(value) }
	release := make(chan struct{})
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) > 1 {
			// A key rotation refresh that hangs until the test ends or 2s pass.
			select {
			case <-release:
			case <-time.After(2 * time.Second):
			}
		}
		json.NewEncoder(w).Encode(map[string]any{"keys": []any{map[string]any{"kty": "EC", "crv": "P-256", "kid": "old", "alg": "ES256", "use": "sig", "x": encode(private.X.FillBytes(make([]byte, 32))), "y": encode(private.Y.FillBytes(make([]byte, 32)))}}})
	}))
	defer server.Close()
	defer close(release) // Runs first, so Close does not wait for the hung refresh.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	keys, err := keyfunc.NewDefaultCtx(ctx, []string{server.URL + "/auth/v1/.well-known/jwks.json"})
	if err != nil {
		t.Fatal(err)
	}
	token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{"sub": "user-123", "iss": server.URL + "/auth/v1", "aud": "authenticated", "exp": time.Now().Add(time.Hour).Unix()})
	token.Header["kid"] = "rotated"
	signed, err := token.SignedString(private)
	if err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	r.Use(Timeout(), Session(cookieKey, false, server.URL+"/auth/v1", keys.KeyfuncCtx))
	r.GET("/v0/me", func(c *gin.Context) { c.Status(204) })
	// An earlier parent deadline stands in for the fixed 10s request timeout.
	reqCtx, reqCancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer reqCancel()
	req := httptest.NewRequest("GET", "/v0/me", nil).WithContext(reqCtx)
	req.AddCookie(&http.Cookie{Name: accessCookieName, Value: sealedCookie(t, signed, accessCookieName)})
	w := httptest.NewRecorder()
	start := time.Now()
	r.ServeHTTP(w, req)
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("JWKS refresh ignored the request deadline: %s", elapsed)
	}
	if w.Code != 503 || !strings.Contains(w.Body.String(), `"code":"REQUEST_TIMEOUT"`) {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
}
