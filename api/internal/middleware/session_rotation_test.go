package middleware

import (
	"context"
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

	"github.com/brojyf/keysy/api/internal/jwks"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestSessionConcurrentSigningKeyRotation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	encode := base64.RawURLEncoding.EncodeToString
	started, release := make(chan struct{}), make(chan struct{})
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		kid := "old"
		if calls.Add(1) > 1 {
			kid = "rotated"
			close(started)
			select {
			case <-release:
			case <-r.Context().Done():
				return
			}
		}
		json.NewEncoder(w).Encode(map[string]any{"keys": []any{map[string]any{"kty": "EC", "crv": "P-256", "kid": kid, "alg": "ES256", "use": "sig", "x": encode(private.X.FillBytes(make([]byte, 32))), "y": encode(private.Y.FillBytes(make([]byte, 32)))}}})
	}))
	defer server.Close()
	defer func() {
		select {
		case <-release:
		default:
			close(release)
		}
	}()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	keys, err := jwks.New(ctx, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{"sub": "user-123", "iss": "issuer", "aud": "authenticated", "exp": time.Now().Add(time.Hour).Unix()})
	token.Header["kid"] = "rotated"
	signed, err := token.SignedString(private)
	if err != nil {
		t.Fatal(err)
	}
	value := sealedCookie(t, signed, accessCookieName)
	router := gin.New()
	router.Use(Session(cookieKey, false, "issuer", keys.KeyfuncCtx, keys.Available))
	router.GET("/v0/me", func(c *gin.Context) { c.Status(http.StatusOK) })
	request := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", "/v0/me", nil)
		req.AddCookie(&http.Cookie{Name: accessCookieName, Value: value})
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}
	first := make(chan *httptest.ResponseRecorder, 1)
	go func() { first <- request() }()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("signing key refresh did not start")
	}
	concurrent := request()
	close(release)
	initial := <-first
	if initial.Code != http.StatusOK {
		t.Fatalf("refreshing request: %d %s", initial.Code, initial.Body.String())
	}
	if concurrent.Code != http.StatusServiceUnavailable || !strings.Contains(concurrent.Body.String(), `"code":"KEYS_UNAVAILABLE"`) {
		t.Fatalf("concurrent request: %d %s", concurrent.Code, concurrent.Body.String())
	}
	if retry := request(); retry.Code != http.StatusOK {
		t.Fatalf("retry after refresh: %d %s", retry.Code, retry.Body.String())
	}
	if calls.Load() != 2 {
		t.Fatalf("expected one startup fetch and one refresh, got %d", calls.Load())
	}
}
