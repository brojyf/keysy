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

type createStore func(context.Context, string, string, string, string) (Invitation, error)

func (create createStore) Create(ctx context.Context, callerID, orgID, email, role string) (Invitation, error) {
	return create(ctx, callerID, orgID, email, role)
}

func TestCreate(t *testing.T) {
	const orgID = "20000000-0000-0000-0000-000000000001"
	created := Invitation{ID: "30000000-0000-0000-0000-000000000001", Email: "sam@example.com", Role: "developer", Status: "pending"}
	for _, tc := range []struct {
		name, id, query, contentType, body, code, want, wantEmail string
		storeErr                                                  error
		cancel                                                    bool
		status                                                    int
	}{
		{name: "created", body: `{"email":"  Sam@Example.COM ","role":"developer"}`, wantEmail: "sam@example.com", status: 201,
			want: `{"id":"30000000-0000-0000-0000-000000000001","email":"sam@example.com","role":"developer","status":"pending"}`},
		{name: "admin role", body: `{"role":"admin","email":"sam@example.com"}`, wantEmail: "sam@example.com", status: 201},
		{name: "JSON with charset", contentType: "application/json; charset=utf-8", body: `{"email":"sam@example.com","role":"developer"}`, wantEmail: "sam@example.com", status: 201},
		{name: "invalid org ID", id: "not-a-uuid", body: `{"email":"sam@example.com","role":"developer"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "query", query: "?resend=true", body: `{"email":"sam@example.com","role":"developer"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "not JSON", contentType: "text/plain", body: `{"email":"sam@example.com","role":"developer"}`, status: 415, code: "UNSUPPORTED_MEDIA_TYPE"},
		{name: "malformed", body: `{"email":`, status: 400, code: "INVALID_REQUEST"},
		{name: "missing role", body: `{"email":"sam@example.com"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "extra field", body: `{"email":"sam@example.com","role":"developer","name":"Sam"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "wrong field", body: `{"email":"sam@example.com","roles":"developer"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "null email", body: `{"email":null,"role":"developer"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "number email", body: `{"email":1,"role":"developer"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "owner role", body: `{"email":"sam@example.com","role":"owner"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "uppercase role", body: `{"email":"sam@example.com","role":"Developer"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "too large", body: `{"email":"` + strings.Repeat("a", 1100) + `@example.com","role":"developer"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "empty email", body: `{"email":"  ","role":"developer"}`, status: 400, code: "INVALID_EMAIL"},
		{name: "no at sign", body: `{"email":"sam.example.com","role":"developer"}`, status: 400, code: "INVALID_EMAIL"},
		{name: "display name", body: `{"email":"Sam <sam@example.com>","role":"developer"}`, status: 400, code: "INVALID_EMAIL"},
		{name: "two addresses", body: `{"email":"sam@example.com, ada@example.com","role":"developer"}`, status: 400, code: "INVALID_EMAIL"},
		{name: "longer than 254", body: `{"email":"` + strings.Repeat("a", 64) + "@" + strings.Repeat("b", 190) + `.com","role":"developer"}`, status: 400, code: "INVALID_EMAIL"},
		{name: "not a member", body: `{"email":"sam@example.com","role":"developer"}`, wantEmail: "sam@example.com", storeErr: ErrOrgNotFound, status: 404, code: "ORG_NOT_FOUND"},
		{name: "forbidden", body: `{"email":"sam@example.com","role":"admin"}`, wantEmail: "sam@example.com", storeErr: ErrForbidden, status: 403, code: "INVITATION_FORBIDDEN"},
		{name: "already member", body: `{"email":"sam@example.com","role":"developer"}`, wantEmail: "sam@example.com", storeErr: ErrAlreadyMember, status: 409, code: "ALREADY_MEMBER"},
		{name: "pending invitation", body: `{"email":"sam@example.com","role":"developer"}`, wantEmail: "sam@example.com", storeErr: ErrInvitationExists, status: 409, code: "INVITATION_EXISTS"},
		{name: "limit", body: `{"email":"sam@example.com","role":"developer"}`, wantEmail: "sam@example.com", storeErr: ErrLimitReached, status: 429, code: "INVITATION_LIMIT_REACHED"},
		{name: "database error", body: `{"email":"sam@example.com","role":"developer"}`, wantEmail: "sam@example.com", storeErr: errors.New("private database details"), status: 500, code: "INTERNAL_ERROR"},
		{name: "canceled", body: `{"email":"sam@example.com","role":"developer"}`, wantEmail: "sam@example.com", cancel: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			called := false
			store := createStore(func(got context.Context, callerID, gotOrgID, email, role string) (Invitation, error) {
				called = true
				if got != ctx || callerID != "user-123" || gotOrgID != orgID || email != tc.wantEmail || (role != "developer" && role != "admin") {
					t.Fatalf("lost request context, caller, org, email, or role: %q %q %q %q", callerID, gotOrgID, email, role)
				}
				if tc.cancel {
					cancel()
					return Invitation{}, ctx.Err()
				}
				if tc.storeErr != nil {
					return Invitation{}, tc.storeErr
				}
				return created, nil
			})
			id := tc.id
			if id == "" {
				id = orgID
			}
			contentType := tc.contentType
			if contentType == "" {
				contentType = "application/json"
			}
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.POST("/v0/orgs/:orgId/invitations", Create(store))
			req := httptest.NewRequest(http.MethodPost, "/v0/orgs/"+id+"/invitations"+tc.query, strings.NewReader(tc.body)).WithContext(ctx)
			req.Header.Set("Content-Type", contentType)
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
			if w.Code != tc.status || called != (tc.wantEmail != "") || strings.Contains(w.Body.String(), "private") {
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
