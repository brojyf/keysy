package me

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
)

type profileLookup func(context.Context, string) (string, error)

func (f profileLookup) DisplayName(ctx context.Context, id string) (string, error) { return f(ctx, id) }

func TestMe(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, scenario := range []string{"profile", "no-avatar", "missing-profile", "database-error", "timeout"} {
		t.Run(scenario, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			r := gin.New()
			r.Use(func(c *gin.Context) {
				c.Set("user_id", "user-123")
				c.Set("email", "member@example.test")
				if scenario != "no-avatar" {
					c.Set("avatar_url", "https://google.test/photo")
				}
			})
			r.GET("/v0/me", Get(profileLookup(func(got context.Context, id string) (string, error) {
				if got != ctx || id != "user-123" {
					t.Error("lost request context or user ID")
				}
				if scenario == "timeout" {
					cancel()
					return "", context.DeadlineExceeded
				}
				if scenario == "missing-profile" || scenario == "database-error" {
					return "", errors.New("private database details")
				}
				return "Member", nil
			})))
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest("GET", "/v0/me", nil).WithContext(ctx))
			if scenario == "timeout" {
				if w.Body.Len() != 0 {
					t.Fatal("handler wrote timeout response")
				}
				return
			}
			if scenario == "missing-profile" || scenario == "database-error" {
				if w.Code != 500 || w.Body.String() != `{"error":{"code":"INTERNAL_ERROR","message":"The request could not be completed."}}` {
					t.Fatal(w.Body.String())
				}
				return
			}
			var body map[string]any
			json.Unmarshal(w.Body.Bytes(), &body)
			if w.Code != 200 || body["id"] != "user-123" || body["email"] != "member@example.test" || body["displayName"] != "Member" || len(body["memberships"].([]any)) != 0 || w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal(body)
			}
			if scenario == "no-avatar" {
				if _, ok := body["avatarUrl"]; ok {
					t.Fatal("avatar should be omitted")
				}
			} else if body["avatarUrl"] != "https://google.test/photo" {
				t.Fatal(body)
			}
		})
	}
}

func TestMeTimeout(t *testing.T) {
	r := gin.New()
	r.Use(middleware.Timeout())
	r.GET("/v0/me", Get(profileLookup(func(ctx context.Context, _ string) (string, error) { <-ctx.Done(); return "", ctx.Err() })))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/v0/me", nil).WithContext(ctx))
	if w.Body.Len() != 0 {
		t.Fatal("cancelled request wrote a response")
	}
}
