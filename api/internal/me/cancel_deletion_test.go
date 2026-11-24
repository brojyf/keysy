package me

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/brojyf/keysy/api/internal/profile"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type cancelDeletionProfiles struct {
	err    error
	calls  int
	userID string
	cancel context.CancelFunc
}

func (p *cancelDeletionProfiles) CancelDeletion(_ context.Context, userID string) error {
	p.calls++
	p.userID = userID
	if p.cancel != nil {
		p.cancel()
	}
	return p.err
}

func (p *cancelDeletionProfiles) ScheduleDeletion(context.Context, string) error {
	panic("unexpected deletion")
}
func (p *cancelDeletionProfiles) Profile(context.Context, string) (profile.Profile, error) {
	panic("unexpected profile lookup")
}
func (p *cancelDeletionProfiles) UpdateDisplayName(context.Context, string, string) error {
	panic("unexpected update")
}
func (p *cancelDeletionProfiles) UpdateAgentAutoApply(context.Context, string, bool) error {
	panic("unexpected auto-apply update")
}

func TestCancelDeletion(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		name, query, body string
		err               error
		cancel            bool
		status, calls     int
		code, message     string
	}{
		{name: "success", status: 204, calls: 1},
		{name: "query", query: "?x=1", status: 400, code: "INVALID_REQUEST", calls: 0},
		{name: "body", body: "x", status: 400, code: "INVALID_REQUEST", calls: 0},
		{name: "store error", err: errors.New("private"), status: 500, calls: 1, code: "INTERNAL_ERROR", message: "Your account deletion could not be cancelled. Try again later."},
		{name: "purged account", err: gorm.ErrRecordNotFound, status: 401, calls: 1, code: "UNAUTHENTICATED", message: "Your session is invalid or has expired. Sign in again."},
		{name: "canceled", cancel: true, calls: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			store := &cancelDeletionProfiles{err: tc.err}
			if tc.cancel {
				store.cancel = cancel
			}
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.POST("/v0/me/cancel-deletion", CancelDeletion(store))
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest("POST", "/v0/me/cancel-deletion"+tc.query, strings.NewReader(tc.body)).WithContext(ctx))
			if w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("missing no-store")
			}
			if tc.cancel {
				if w.Body.Len() != 0 || w.Flushed {
					t.Fatal("wrote canceled response")
				}
			} else if w.Code != tc.status || (tc.code != "" && !strings.Contains(w.Body.String(), `"code":"`+tc.code+`"`)) || (tc.message != "" && !strings.Contains(w.Body.String(), tc.message)) || (tc.status == 204 && w.Body.Len() != 0) {
				t.Fatalf("%d %s", w.Code, w.Body.String())
			}
			if store.calls != tc.calls {
				t.Fatalf("calls=%d", store.calls)
			}
			if store.calls != 0 && store.userID != "user-123" {
				t.Fatalf("userID=%q", store.userID)
			}
		})
	}
}
