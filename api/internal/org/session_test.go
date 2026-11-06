package org

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestOrganizationSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	cookieKey := []byte(strings.Repeat("k", 32))
	block, err := aes.NewCipher(cookieKey)
	if err != nil {
		t.Fatal(err)
	}
	aead, err := cipher.NewGCMWithRandomNonce(block)
	if err != nil {
		t.Fatal(err)
	}
	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodDelete} {
		for _, scenario := range []string{"valid", "another user", "missing cookie", "bearer only", "expired", "invalid seal", "invalid origin", "keys unavailable"} {
			t.Run(method+"/"+scenario, func(t *testing.T) {
				userID := "user-123"
				if scenario == "another user" {
					userID = "user-456"
				}
				expires := time.Now().Add(time.Hour)
				if scenario == "expired" {
					expires = time.Now().Add(-time.Hour)
				}
				token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
					"sub": userID, "iss": "https://auth.example.test/auth/v1", "aud": "authenticated", "exp": expires.Unix(),
				})
				signed, err := token.SignedString(private)
				if err != nil {
					t.Fatal(err)
				}
				cookie := base64.RawURLEncoding.EncodeToString(aead.Seal(nil, nil, []byte(signed), []byte("__Secure-keysy-access")))
				if scenario == "invalid seal" {
					cookie = "invalid"
				}
				called := false
				store := organizationStore{
					delete: func(_ context.Context, gotUserID, orgID string) (bool, error) {
						called = true
						if gotUserID != userID || orgID != "20000000-0000-0000-0000-000000000001" {
							t.Fatal("delete did not use authenticated user or target org")
						}
						return true, nil
					},
					create: func(_ context.Context, gotUserID, name string) (Organization, error) {
						called = true
						if gotUserID != userID {
							t.Fatal("create did not use authenticated user")
						}
						return Organization{ID: "org-123", Name: name}, nil
					},
					list: func(_ context.Context, gotUserID string) ([]Membership, error) {
						called = true
						if gotUserID != userID {
							t.Fatal("list did not use authenticated user")
						}
						return []Membership{}, nil
					},
				}
				r := gin.New()
				r.Use(middleware.RequestID(), middleware.CORS("https://dashboard.keysy.net"))
				session := middleware.Session(cookieKey, false, "https://auth.example.test/auth/v1", func(context.Context) jwt.Keyfunc {
					return func(*jwt.Token) (any, error) {
						if scenario == "keys unavailable" {
							return nil, errors.New("private JWKS failure")
						}
						return &private.PublicKey, nil
					}
				}, func() bool { return scenario != "keys unavailable" })
				r.GET("/v0/orgs", session, List(store))
				r.POST("/v0/orgs", session, Create(store))
				r.DELETE("/v0/orgs/:orgId", session, Delete(store))
				var req *http.Request
				if method == http.MethodGet {
					req = httptest.NewRequest(method, "/v0/orgs", nil)
				} else if method == http.MethodDelete {
					req = httptest.NewRequest(method, "/v0/orgs/20000000-0000-0000-0000-000000000001", nil)
				} else {
					req = httptest.NewRequest(method, "/v0/orgs", strings.NewReader(`{"name":"Platform"}`))
					req.Header.Set("Content-Type", "application/json")
				}
				origin := "https://dashboard.keysy.net"
				if scenario == "invalid origin" {
					origin = "https://other.example.test"
				}
				req.Header.Set("Origin", origin)
				if scenario != "missing cookie" && scenario != "bearer only" {
					req.AddCookie(&http.Cookie{Name: "__Secure-keysy-access", Value: cookie})
				}
				if scenario == "bearer only" {
					req.Header.Set("Authorization", "Bearer "+signed)
				}
				w := httptest.NewRecorder()
				r.ServeHTTP(w, req)
				wantStatus := http.StatusUnauthorized
				wantCalled := scenario == "valid" || scenario == "another user"
				if wantCalled {
					wantStatus = http.StatusOK
					if method == http.MethodPost {
						wantStatus = http.StatusCreated
					} else if method == http.MethodDelete {
						wantStatus = http.StatusNoContent
					}
				} else if scenario == "invalid origin" {
					wantStatus = http.StatusForbidden
				} else if scenario == "keys unavailable" {
					wantStatus = http.StatusServiceUnavailable
				}
				if w.Code != wantStatus || called != wantCalled || strings.Contains(w.Body.String(), "private") {
					t.Fatalf("status=%d called=%v body=%s", w.Code, called, w.Body.String())
				}
				if w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("X-Request-ID") == "" {
					t.Fatal("missing no-store or request ID")
				}
				if scenario != "invalid origin" && (w.Header().Get("Access-Control-Allow-Origin") != origin || w.Header().Get("Access-Control-Allow-Credentials") != "true") {
					t.Fatal("missing credentialed CORS headers")
				}
			})
		}
	}
}
