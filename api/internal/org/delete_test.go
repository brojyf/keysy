package org

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestDelete(t *testing.T) {
	const orgID = "20000000-0000-0000-0000-000000000001"
	for _, tc := range []struct {
		name, id, query, body, code string
		deleted, cancel, chunked    bool
		storeErr                    error
		status                      int
	}{
		{name: "owner", id: orgID, deleted: true, status: 204},
		{name: "owner retry after deletion", id: orgID, deleted: true, status: 204},
		{name: "not owner or missing", id: orgID, status: 404, code: "ORG_NOT_FOUND"},
		{name: "invalid ID", id: "not-a-uuid", status: 400, code: "INVALID_REQUEST"},
		{name: "query", id: orgID, query: "?userId=other", status: 400, code: "INVALID_REQUEST"},
		{name: "body", id: orgID, body: `{"role":"owner"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "chunked", id: orgID, chunked: true, status: 400, code: "INVALID_REQUEST"},
		{name: "database error", id: orgID, storeErr: errors.New("private database details"), status: 500, code: "INTERNAL_ERROR"},
		{name: "canceled", id: orgID, cancel: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			called := false
			store := organizationStore{delete: func(got context.Context, userID, gotOrgID string) (bool, error) {
				called = true
				if got != ctx || userID != "user-123" || gotOrgID != orgID {
					t.Fatal("lost request context, authenticated user, or target org")
				}
				if tc.cancel {
					cancel()
					return false, ctx.Err()
				}
				return tc.deleted, tc.storeErr
			}}
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.DELETE("/v0/orgs/:orgId", Delete(store))
			req := httptest.NewRequest(http.MethodDelete, "/v0/orgs/"+tc.id+tc.query, strings.NewReader(tc.body)).WithContext(ctx)
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
				t.Fatal("successful deletion must have no response body")
			}
		})
	}
}
