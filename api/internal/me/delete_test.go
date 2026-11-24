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

type deletionProfiles struct {
	profileLookup
	err    error
	calls  int
	cancel context.CancelFunc
}

func (p *deletionProfiles) ScheduleDeletion(_ context.Context, id string) error {
	if id != "user-123" {
		panic("wrong user ID")
	}
	p.calls++
	if p.cancel != nil {
		p.cancel()
	}
	return p.err
}
func (p *deletionProfiles) CancelDeletion(context.Context, string) error {
	panic("unexpected cancellation")
}

func TestDeleteMe(t *testing.T) {
	for _, tc := range []struct {
		name, query, body, code, message, want string
		err                                    error
		status, calls                          int
		cancel                                 bool
	}{
		{name: "success", status: 204, calls: 2},
		{name: "owner", status: 409, calls: 1, err: &profile.OrgOwnerError{Orgs: []profile.OwnedOrg{{ID: "org-1", Name: "platform"}, {ID: "org-2", Name: "web"}}}, want: `{"error":{"code":"ORG_OWNER","message":"Transfer or delete the organizations you own, then try again.","organizations":[{"id":"org-1","name":"platform"},{"id":"org-2","name":"web"}]}}`},
		{name: "store error", status: 500, calls: 1, err: errors.New("private"), code: "INTERNAL_ERROR", message: "Your account could not be deleted. Try again later."},
		{name: "purged account", status: 401, calls: 1, err: gorm.ErrRecordNotFound, code: "UNAUTHENTICATED", message: "Your session is invalid or has expired. Sign in again."},
		{name: "query", query: "?x=1", status: 400, code: "INVALID_REQUEST"},
		{name: "body", body: "x", status: 400, code: "INVALID_REQUEST"},
		{name: "canceled", calls: 1, cancel: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			store := &deletionProfiles{err: tc.err}
			if tc.cancel {
				store.cancel = cancel
			}
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.DELETE("/v0/me", Delete(store))
			for i := 0; i < max(1, tc.calls); i++ {
				w := httptest.NewRecorder()
				r.ServeHTTP(w, httptest.NewRequest("DELETE", "/v0/me"+tc.query, strings.NewReader(tc.body)).WithContext(ctx))
				if w.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("missing no-store")
				}
				if tc.cancel {
					if w.Body.Len() != 0 || w.Flushed {
						t.Fatal("wrote canceled response")
					}
					break
				}
				if w.Code != tc.status || (tc.code != "" && !strings.Contains(w.Body.String(), `"code":"`+tc.code+`"`)) || (tc.message != "" && !strings.Contains(w.Body.String(), tc.message)) || (tc.want != "" && w.Body.String() != tc.want) || (tc.status == 204 && w.Body.Len() != 0) {
					t.Fatalf("%d %s", w.Code, w.Body.String())
				}
			}
			if store.calls != tc.calls {
				t.Fatalf("calls=%d", store.calls)
			}
		})
	}
}
