package invitation

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type invitationStore func(context.Context, string, string) ([]Invitation, bool, error)

func (list invitationStore) List(ctx context.Context, userID, orgID string) ([]Invitation, bool, error) {
	return list(ctx, userID, orgID)
}

func TestList(t *testing.T) {
	const orgID = "20000000-0000-0000-0000-000000000001"
	for _, tc := range []struct {
		name, id, query, body, code, want string
		invitations                       []Invitation
		visible, cancel, chunked          bool
		storeErr                          error
		status                            int
	}{
		{name: "pending and expired", id: orgID, visible: true, invitations: []Invitation{
			{ID: "invite-1", Email: "pending@example.com", Role: "developer", Status: "pending"},
			{ID: "invite-2", Email: "expired@example.com", Role: "admin", Status: "expired"},
		}, status: 200, want: `[{"id":"invite-1","email":"pending@example.com","role":"developer","status":"pending"},{"id":"invite-2","email":"expired@example.com","role":"admin","status":"expired"}]`},
		{name: "empty org", id: orgID, visible: true, invitations: []Invitation{}, status: 200, want: `[]`},
		{name: "not a member, deleted caller, or missing org", id: orgID, status: 404, code: "ORG_NOT_FOUND"},
		{name: "invalid ID", id: "not-a-uuid", status: 400, code: "INVALID_REQUEST"},
		{name: "query", id: orgID, query: "?status=pending", status: 400, code: "INVALID_REQUEST"},
		{name: "body", id: orgID, body: `{}`, status: 400, code: "INVALID_REQUEST"},
		{name: "chunked", id: orgID, chunked: true, status: 400, code: "INVALID_REQUEST"},
		{name: "database error", id: orgID, storeErr: errors.New("private database details"), status: 500, code: "INTERNAL_ERROR"},
		{name: "canceled", id: orgID, cancel: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			called := false
			store := invitationStore(func(got context.Context, userID, gotOrgID string) ([]Invitation, bool, error) {
				called = true
				if got != ctx || userID != "user-123" || gotOrgID != orgID {
					t.Fatal("lost request context, authenticated user, or target org")
				}
				if tc.cancel {
					cancel()
					return nil, false, ctx.Err()
				}
				return tc.invitations, tc.visible, tc.storeErr
			})
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.GET("/v0/orgs/:orgId/invitations", List(store))
			req := httptest.NewRequest(http.MethodGet, "/v0/orgs/"+tc.id+"/invitations"+tc.query, strings.NewReader(tc.body)).WithContext(ctx)
			if tc.chunked {
				req.ContentLength = -1
				req.TransferEncoding = []string{"chunked"}
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("missing no-store")
			}
			if tc.cancel {
				if !called || w.Body.Len() != 0 || w.Flushed {
					t.Fatal("handler wrote a canceled response")
				}
				return
			}
			if w.Code != tc.status || called != (tc.status != 400) || strings.Contains(w.Body.String(), "private") {
				t.Fatalf("status=%d called=%v body=%s", w.Code, called, w.Body.String())
			}
			if tc.code != "" && !strings.Contains(w.Body.String(), `"code":"`+tc.code+`"`) {
				t.Fatal(w.Body.String())
			}
			if tc.want != "" && w.Body.String() != tc.want {
				t.Fatal(w.Body.String())
			}
		})
	}
}
