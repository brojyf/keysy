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

func TestRename(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const orgID = "20000000-0000-0000-0000-000000000001"
	for _, tc := range []struct {
		name, id, body, contentType, query, wantName, code string
		renamed, cancel                                    bool
		storeErr                                           error
		status                                             int
	}{
		{name: "owner trims", id: orgID, body: `{"name":"  Platform  "}`, contentType: "application/json", wantName: "Platform", renamed: true, status: 200},
		{name: "32 Unicode characters", id: orgID, body: `{"name":"` + strings.Repeat("界", 32) + `"}`, contentType: "application/json", wantName: strings.Repeat("界", 32), renamed: true, status: 200},
		{name: "33 Unicode characters", id: orgID, body: `{"name":"` + strings.Repeat("界", 33) + `"}`, contentType: "application/json", status: 400, code: "INVALID_ORG_NAME"},
		{name: "whitespace name", id: orgID, body: `{"name":" \t "}`, contentType: "application/json", status: 400, code: "INVALID_ORG_NAME"},
		{name: "unknown field", id: orgID, body: `{"name":"Platform","role":"owner"}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "missing name", id: orgID, body: `{}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "invalid ID", id: "not-a-uuid", body: `{"name":"Platform"}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "query", id: orgID, body: `{"name":"Platform"}`, contentType: "application/json", query: "?userId=other", status: 400, code: "INVALID_REQUEST"},
		{name: "wrong content type", id: orgID, body: `{"name":"Platform"}`, contentType: "text/plain", status: 415, code: "UNSUPPORTED_MEDIA_TYPE"},
		{name: "not owner, missing, or deleted", id: orgID, body: `{"name":"Platform"}`, contentType: "application/json", wantName: "Platform", status: 404, code: "ORG_NOT_FOUND"},
		{name: "store error", id: orgID, body: `{"name":"Platform"}`, contentType: "application/json", wantName: "Platform", storeErr: errors.New("private database details"), status: 500, code: "INTERNAL_ERROR"},
		{name: "canceled", id: orgID, body: `{"name":"Platform"}`, contentType: "application/json", cancel: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			called := false
			store := organizationStore{rename: func(got context.Context, userID, gotOrgID, name string) (bool, error) {
				called = true
				if got != ctx || userID != "user-123" || gotOrgID != orgID || (tc.wantName != "" && name != tc.wantName) {
					t.Fatal("lost request context, authenticated user, target org, or trimmed name")
				}
				if tc.cancel {
					cancel()
					return false, ctx.Err()
				}
				return tc.renamed, tc.storeErr
			}}
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.PATCH("/v0/orgs/:orgId", Rename(store))
			req := httptest.NewRequest(http.MethodPatch, "/v0/orgs/"+tc.id+tc.query, strings.NewReader(tc.body)).WithContext(ctx)
			if tc.contentType != "" {
				req.Header.Set("Content-Type", tc.contentType)
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
			serverSide := tc.status == 200 || tc.status == 404 || tc.status == 500
			if w.Code != tc.status || called != serverSide || strings.Contains(w.Body.String(), "private") {
				t.Fatalf("status=%d called=%v body=%s", w.Code, called, w.Body.String())
			}
			if tc.code != "" && !strings.Contains(w.Body.String(), `"code":"`+tc.code+`"`) {
				t.Fatal(w.Body.String())
			}
			if tc.status == 200 && w.Body.String() != `{"id":"`+orgID+`","name":"`+tc.wantName+`"}` {
				t.Fatal(w.Body.String())
			}
		})
	}
}
