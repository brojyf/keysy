package org

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
)

type organizationStore struct {
	create  func(context.Context, string, string) (Organization, error)
	list    func(context.Context, string) ([]Membership, error)
	delete  func(context.Context, string, string) (bool, error)
	rename  func(context.Context, string, string, string) (bool, error)
	members func(context.Context, string, string) ([]Member, error)
}

func (s organizationStore) Create(ctx context.Context, userID, name string) (Organization, error) {
	return s.create(ctx, userID, name)
}

func (s organizationStore) List(ctx context.Context, userID string) ([]Membership, error) {
	return s.list(ctx, userID)
}

func (s organizationStore) Delete(ctx context.Context, userID, orgID string) (bool, error) {
	return s.delete(ctx, userID, orgID)
}

func TestCreate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		name, body, contentType, query, wantName, code string
		status                                         int
		storeErr                                       error
		cancel                                         bool
	}{
		{name: "trim", body: `{"name":"  Platform  "}`, contentType: "application/json", wantName: "Platform", status: 201},
		{name: "charset", body: `{"name":"Platform"}`, contentType: "application/json; charset=utf-8", wantName: "Platform", status: 201},
		{name: "32 Unicode characters", body: `{"name":"` + strings.Repeat("界", 32) + `"}`, contentType: "application/json", wantName: strings.Repeat("界", 32), status: 201},
		{name: "33 Unicode characters", body: `{"name":"` + strings.Repeat("界", 33) + `"}`, contentType: "application/json", status: 400, code: "INVALID_ORG_NAME"},
		{name: "empty name", body: `{"name":""}`, contentType: "application/json", status: 400, code: "INVALID_ORG_NAME"},
		{name: "whitespace name", body: `{"name":" \t\n\u2003 "}`, contentType: "application/json", status: 400, code: "INVALID_ORG_NAME"},
		{name: "null character", body: `{"name":"Plat\u0000form"}`, contentType: "application/json", status: 400, code: "INVALID_ORG_NAME"},
		{name: "missing name", body: `{}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "null name", body: `{"name":null}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "number name", body: `{"name":1}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "wrong case", body: `{"Name":"Platform"}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "unknown field", body: `{"name":"Platform","role":"owner"}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "user injection", body: `{"name":"Platform","userId":"someone-else"}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "invalid UTF-8", body: "{\"name\":\"" + string([]byte{0xff}) + "\"}", contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "null object", body: `null`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "array", body: `[]`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "empty body", contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "two objects", body: `{"name":"Platform"}{}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "trailing data", body: `{"name":"Platform"}x`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "1024 bytes", body: `{"name":"Platform"}` + strings.Repeat(" ", 1005), contentType: "application/json", wantName: "Platform", status: 201},
		{name: "oversized body", body: `{"name":"Platform"}` + strings.Repeat(" ", 1024), contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "wrong content type", body: `{}`, contentType: "text/plain", status: 415, code: "UNSUPPORTED_MEDIA_TYPE"},
		{name: "missing content type", body: `{}`, status: 415, code: "UNSUPPORTED_MEDIA_TYPE"},
		{name: "query", body: `{"name":"Platform"}`, contentType: "application/json", query: "?userId=someone-else", status: 400, code: "INVALID_REQUEST"},
		{name: "store error", body: `{"name":"Platform"}`, contentType: "application/json", status: 500, code: "INTERNAL_ERROR", storeErr: errors.New("private database details")},
		{name: "canceled", body: `{"name":"Platform"}`, contentType: "application/json", cancel: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			called := false
			store := organizationStore{create: func(got context.Context, userID, name string) (Organization, error) {
				called = true
				if got != ctx || userID != "user-123" {
					t.Fatal("lost request context or authenticated user ID")
				}
				if tc.wantName != "" && name != tc.wantName {
					t.Fatalf("name = %q, want %q", name, tc.wantName)
				}
				if tc.cancel {
					cancel()
					return Organization{}, ctx.Err()
				}
				return Organization{ID: "org-123", Name: name}, tc.storeErr
			}}
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.POST("/v0/orgs", Create(store))
			req := httptest.NewRequest(http.MethodPost, "/v0/orgs"+tc.query, strings.NewReader(tc.body)).WithContext(ctx)
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
			if w.Code != tc.status {
				t.Fatalf("status %d: %s", w.Code, w.Body.String())
			}
			if tc.code != "" {
				if !strings.Contains(w.Body.String(), `"code":"`+tc.code+`"`) || strings.Contains(w.Body.String(), "private") {
					t.Fatal(w.Body.String())
				}
				if called != (tc.status == 500) {
					t.Fatalf("store called = %v", called)
				}
				return
			}
			var body map[string]any
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if !called || !reflect.DeepEqual(body, map[string]any{"id": "org-123", "name": tc.wantName}) {
				t.Fatalf("called=%v body=%v", called, body)
			}
		})
	}
}

func TestList(t *testing.T) {
	gin.SetMode(gin.TestMode)
	memberships := []Membership{
		{ID: "org-1", Name: "Alpha", Role: "owner", MemberCount: 1},
		{ID: "org-2", Name: "Beta", Role: "developer", MemberCount: 3},
		{ID: "org-3", Name: "Gamma", Role: "admin", MemberCount: 8},
	}
	for _, scenario := range []string{"memberships", "empty", "store error", "canceled"} {
		t.Run(scenario, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.GET("/v0/orgs", List(organizationStore{list: func(got context.Context, userID string) ([]Membership, error) {
				if got != ctx || userID != "user-123" {
					t.Fatal("lost request context or authenticated user ID")
				}
				switch scenario {
				case "empty":
					return nil, nil
				case "store error":
					return nil, errors.New("private database details")
				case "canceled":
					cancel()
					return nil, ctx.Err()
				default:
					return memberships, nil
				}
			}}))
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/v0/orgs", nil).WithContext(ctx))
			if w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("missing no-store")
			}
			switch scenario {
			case "canceled":
				if w.Body.Len() != 0 || w.Flushed {
					t.Fatal("handler wrote a canceled response")
				}
			case "store error":
				if w.Code != 500 || !strings.Contains(w.Body.String(), `"code":"INTERNAL_ERROR"`) || strings.Contains(w.Body.String(), "private") {
					t.Fatalf("%d %s", w.Code, w.Body.String())
				}
			case "empty":
				if w.Code != 200 || w.Body.String() != "[]" {
					t.Fatalf("%d %s", w.Code, w.Body.String())
				}
			default:
				if !strings.Contains(w.Body.String(), `"memberCount":`) {
					t.Fatalf("missing memberCount: %s", w.Body.String())
				}
				var body []Membership
				if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
					t.Fatal(err)
				}
				if w.Code != 200 || !reflect.DeepEqual(body, memberships) {
					t.Fatalf("%d %+v", w.Code, body)
				}
			}
		})
	}
}

func TestListRejectsUnexpectedInput(t *testing.T) {
	for _, tc := range []struct {
		name, query, body string
		chunked           bool
	}{
		{"query", "?userId=someone-else", "", false},
		{"malformed query", "?bad=%zz", "", false},
		{"body", "", "private", false},
		{"chunked body", "", "private", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.GET("/v0/orgs", List(organizationStore{list: func(context.Context, string) ([]Membership, error) {
				t.Fatal("invalid request reached store")
				return nil, nil
			}}))
			req := httptest.NewRequest(http.MethodGet, "/v0/orgs"+tc.query, strings.NewReader(tc.body))
			if tc.chunked {
				req.ContentLength = -1
				req.TransferEncoding = []string{"chunked"}
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != 400 || !strings.Contains(w.Body.String(), `"code":"INVALID_REQUEST"`) || strings.Contains(w.Body.String(), "private") {
				t.Fatalf("%d %s", w.Code, w.Body.String())
			}
		})
	}
}

func TestHandlersRespectTimeout(t *testing.T) {
	for _, method := range []string{http.MethodGet, http.MethodPost} {
		t.Run(method, func(t *testing.T) {
			r := gin.New()
			r.Use(middleware.Timeout())
			store := organizationStore{
				create: func(ctx context.Context, _, _ string) (Organization, error) {
					<-ctx.Done()
					return Organization{}, ctx.Err()
				},
				list: func(ctx context.Context, _ string) ([]Membership, error) {
					<-ctx.Done()
					return nil, ctx.Err()
				},
			}
			r.GET("/v0/orgs", List(store))
			r.POST("/v0/orgs", Create(store))
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			req := httptest.NewRequest(method, "/v0/orgs", strings.NewReader(`{"name":"Platform"}`)).WithContext(ctx)
			if method == http.MethodGet {
				req = httptest.NewRequest(method, "/v0/orgs", nil).WithContext(ctx)
			}
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Body.Len() != 0 || w.Flushed {
				t.Fatal("handler wrote a canceled response")
			}
		})
	}
}

func (s organizationStore) Rename(ctx context.Context, userID, orgID, name string) (bool, error) {
	return s.rename(ctx, userID, orgID, name)
}

func (s organizationStore) Members(ctx context.Context, userID, orgID string) ([]Member, error) {
	return s.members(ctx, userID, orgID)
}
