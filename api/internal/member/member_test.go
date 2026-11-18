package member

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type memberStore func(context.Context, string, string) ([]Member, error)

func (list memberStore) List(ctx context.Context, userID, orgID string) ([]Member, error) {
	return list(ctx, userID, orgID)
}

func (list memberStore) Remove(context.Context, string, string, string) error { return nil }
func (list memberStore) Leave(context.Context, string, string) error          { return nil }

func TestList(t *testing.T) {
	const orgID = "20000000-0000-0000-0000-000000000001"
	ada := Member{UserID: "user-123", Name: "Ada", Email: "ada@example.com", Role: "owner"}
	deleting := Member{UserID: "user-456", Name: "Grace", Email: "grace@example.com", Role: "admin", Deleting: true}
	for _, tc := range []struct {
		name, id, query, body, code, want string
		members                           []Member
		cancel, chunked                   bool
		storeErr                          error
		status                            int
	}{
		{name: "member", id: orgID, members: []Member{ada}, status: 200, want: `[{"userId":"user-123","name":"Ada","email":"ada@example.com","role":"owner","deleting":false}]`},
		{name: "member scheduled for deletion", id: orgID, members: []Member{deleting}, status: 200, want: `[{"userId":"user-456","name":"Grace","email":"grace@example.com","role":"admin","deleting":true}]`},
		{name: "not a member, missing, or deleted", id: orgID, status: 404, code: "ORG_NOT_FOUND"},
		{name: "invalid ID", id: "not-a-uuid", status: 400, code: "INVALID_REQUEST"},
		{name: "query", id: orgID, query: "?role=admin", status: 400, code: "INVALID_REQUEST"},
		{name: "body", id: orgID, body: `{}`, status: 400, code: "INVALID_REQUEST"},
		{name: "chunked", id: orgID, chunked: true, status: 400, code: "INVALID_REQUEST"},
		{name: "database error", id: orgID, storeErr: errors.New("private database details"), status: 500, code: "INTERNAL_ERROR"},
		{name: "canceled", id: orgID, cancel: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			called := false
			store := memberStore(func(got context.Context, userID, gotOrgID string) ([]Member, error) {
				called = true
				if got != ctx || userID != "user-123" || gotOrgID != orgID {
					t.Fatal("lost request context, authenticated user, or target org")
				}
				if tc.cancel {
					cancel()
					return nil, ctx.Err()
				}
				return tc.members, tc.storeErr
			})
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.GET("/v0/orgs/:orgId/members", List(store))
			req := httptest.NewRequest(http.MethodGet, "/v0/orgs/"+tc.id+"/members"+tc.query, strings.NewReader(tc.body)).WithContext(ctx)
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

type removeStore func(context.Context, string, string, string) error

func (remove removeStore) List(context.Context, string, string) ([]Member, error) { return nil, nil }
func (remove removeStore) Leave(context.Context, string, string) error            { return nil }
func (remove removeStore) Remove(ctx context.Context, callerID, orgID, targetID string) error {
	return remove(ctx, callerID, orgID, targetID)
}

func TestRemove(t *testing.T) {
	const orgID = "20000000-0000-0000-0000-000000000001"
	const targetID = "30000000-0000-0000-0000-000000000001"
	for _, tc := range []struct {
		name, org, target, query, body, code string
		storeErr                             error
		status                               int
		cancel, chunked                      bool
	}{
		{name: "success", org: orgID, target: targetID, status: 204},
		{name: "forbidden", org: orgID, target: targetID, storeErr: ErrRemoveForbidden, status: 403, code: "MEMBER_REMOVE_FORBIDDEN"},
		{name: "missing org", org: orgID, target: targetID, storeErr: ErrOrgNotFound, status: 404, code: "ORG_NOT_FOUND"},
		{name: "missing member", org: orgID, target: targetID, storeErr: ErrMemberNotFound, status: 404, code: "MEMBER_NOT_FOUND"},
		{name: "invalid org", org: "invalid", target: targetID, status: 400, code: "INVALID_REQUEST"},
		{name: "invalid user", org: orgID, target: "invalid", status: 400, code: "INVALID_REQUEST"},
		{name: "query", org: orgID, target: targetID, query: "?x=1", status: 400, code: "INVALID_REQUEST"},
		{name: "body", org: orgID, target: targetID, body: "{}", status: 400, code: "INVALID_REQUEST"},
		{name: "chunked", org: orgID, target: targetID, chunked: true, status: 400, code: "INVALID_REQUEST"},
		{name: "database error", org: orgID, target: targetID, storeErr: errors.New("private database details"), status: 500, code: "INTERNAL_ERROR"},
		{name: "canceled", org: orgID, target: targetID, cancel: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			called := false
			store := removeStore(func(got context.Context, caller, org, target string) error {
				called = true
				if got != ctx || caller != "user-123" || org != orgID || target != targetID {
					t.Fatal("lost request context or IDs")
				}
				if tc.cancel {
					cancel()
					return ctx.Err()
				}
				return tc.storeErr
			})
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.DELETE("/v0/orgs/:orgId/members/:userId", Remove(store))
			req := httptest.NewRequest(http.MethodDelete, "/v0/orgs/"+tc.org+"/members/"+tc.target+tc.query, strings.NewReader(tc.body)).WithContext(ctx)
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
			if tc.status == 204 && w.Body.Len() != 0 {
				t.Fatal(w.Body.String())
			}
		})
	}
}

func TestCanRemove(t *testing.T) {
	roles := []string{"owner", "admin", "developer"}
	want := [3][3]bool{{false, true, true}, {false, false, true}, {false, false, false}}
	for i, caller := range roles {
		for j, target := range roles {
			if got := canRemove(caller, target); got != want[i][j] {
				t.Errorf("%s -> %s: got %v", caller, target, got)
			}
		}
	}
}

type leaveStore func(context.Context, string, string) error

func (leave leaveStore) List(context.Context, string, string) ([]Member, error) { return nil, nil }
func (leave leaveStore) Remove(context.Context, string, string, string) error   { return nil }
func (leave leaveStore) Leave(ctx context.Context, callerID, orgID string) error {
	return leave(ctx, callerID, orgID)
}

func TestLeave(t *testing.T) {
	const orgID = "20000000-0000-0000-0000-000000000001"
	for _, tc := range []struct {
		name, org, query, body, code string
		storeErr                     error
		status                       int
		cancel, chunked              bool
	}{
		{name: "success", org: orgID, status: 204},
		{name: "missing org", org: orgID, storeErr: ErrOrgNotFound, status: 404, code: "ORG_NOT_FOUND"},
		{name: "owner", org: orgID, storeErr: ErrOwnerCannotLeave, status: 409, code: "ORG_OWNER"},
		{name: "invalid org", org: "invalid", status: 400, code: "INVALID_REQUEST"},
		{name: "query", org: orgID, query: "?x=1", status: 400, code: "INVALID_REQUEST"},
		{name: "body", org: orgID, body: "{}", status: 400, code: "INVALID_REQUEST"},
		{name: "chunked", org: orgID, chunked: true, status: 400, code: "INVALID_REQUEST"},
		{name: "database error", org: orgID, storeErr: errors.New("private database details"), status: 500, code: "INTERNAL_ERROR"},
		{name: "canceled", org: orgID, cancel: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			called := false
			store := leaveStore(func(got context.Context, caller, org string) error {
				called = true
				if got != ctx || caller != "user-123" || org != orgID {
					t.Fatal("lost request context or IDs")
				}
				if tc.cancel {
					cancel()
					return ctx.Err()
				}
				return tc.storeErr
			})
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.POST("/v0/orgs/:orgId/leave", Leave(store))
			req := httptest.NewRequest(http.MethodPost, "/v0/orgs/"+tc.org+"/leave"+tc.query, strings.NewReader(tc.body)).WithContext(ctx)
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
			if tc.status == 204 && w.Body.Len() != 0 {
				t.Fatal(w.Body.String())
			}
			if tc.status == 409 && strings.Contains(w.Body.String(), `"organizations"`) {
				t.Fatal(w.Body.String())
			}
		})
	}
}
