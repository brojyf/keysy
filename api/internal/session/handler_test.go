package session

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	currentSessionID = "30000000-0000-0000-0000-000000000001"
	otherSessionID   = "30000000-0000-0000-0000-000000000002"
)

type sessionStore struct {
	list   func(context.Context, string) ([]Session, error)
	revoke func(context.Context, string, string) (bool, error)
}

func (s sessionStore) List(ctx context.Context, userID string) ([]Session, error) {
	return s.list(ctx, userID)
}

func (s sessionStore) Revoke(ctx context.Context, userID, sessionID string) (bool, error) {
	return s.revoke(ctx, userID, sessionID)
}

func testRouter(store sessionStore) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "user-123")
		c.Set("session_id", currentSessionID)
	})
	r.GET("/v0/me/sessions", List(store))
	r.DELETE("/v0/me/sessions/:sessionId", Revoke(store))
	return r
}

func TestList(t *testing.T) {
	vancouver := time.FixedZone("PST", -8*60*60)
	for _, scenario := range []string{"sessions", "empty", "store error", "canceled"} {
		t.Run(scenario, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			r := testRouter(sessionStore{list: func(got context.Context, userID string) ([]Session, error) {
				if got != ctx || userID != "user-123" {
					t.Fatal("lost request context or authenticated user ID")
				}
				switch scenario {
				case "empty":
					return []Session{}, nil
				case "store error":
					return nil, errors.New("private database details")
				case "canceled":
					cancel()
					return nil, ctx.Err()
				}
				return []Session{
					{ID: otherSessionID, UserAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0", LastUsedAt: time.Date(2026, 11, 3, 4, 0, 0, 0, vancouver)},
					{ID: currentSessionID, LastUsedAt: time.Date(2026, 11, 2, 9, 30, 15, 123, time.UTC)},
				}, nil
			}})
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/v0/me/sessions", nil).WithContext(ctx))
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
				want := `[{"id":"` + otherSessionID + `","client":"web","device":"Firefox on Linux","lastUsedAt":"2026-11-03T12:00:00Z","current":false},` +
					`{"id":"` + currentSessionID + `","client":"web","device":"Unknown device","lastUsedAt":"2026-11-02T09:30:15.000000123Z","current":true}]`
				if w.Code != 200 || w.Body.String() != want {
					t.Fatalf("%d %s", w.Code, w.Body.String())
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
			r := testRouter(sessionStore{list: func(context.Context, string) ([]Session, error) {
				t.Fatal("invalid request reached store")
				return nil, nil
			}})
			req := httptest.NewRequest(http.MethodGet, "/v0/me/sessions"+tc.query, strings.NewReader(tc.body))
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

func TestRevoke(t *testing.T) {
	for _, tc := range []struct {
		name, id, query, body, code, message string
		revoked, cancel, chunked             bool
		storeErr                             error
		status                               int
	}{
		{name: "other session", id: otherSessionID, revoked: true, status: 204},
		{name: "uppercase ID", id: strings.ToUpper(otherSessionID), revoked: true, status: 204},
		{name: "missing or another user's", id: otherSessionID, status: 404, code: "SESSION_NOT_FOUND", message: "This session was not found. Refresh the page and try again."},
		{name: "current session", id: currentSessionID, status: 409, code: "CURRENT_SESSION", message: "You cannot revoke the session you are using. Sign out instead."},
		{name: "current session uppercase", id: strings.ToUpper(currentSessionID), status: 409, code: "CURRENT_SESSION"},
		{name: "invalid ID", id: "not-a-uuid", status: 400, code: "INVALID_REQUEST"},
		{name: "query", id: otherSessionID, query: "?userId=other", status: 400, code: "INVALID_REQUEST"},
		{name: "body", id: otherSessionID, body: `{"id":"x"}`, status: 400, code: "INVALID_REQUEST"},
		{name: "chunked", id: otherSessionID, chunked: true, status: 400, code: "INVALID_REQUEST"},
		{name: "database error", id: otherSessionID, storeErr: errors.New("private database details"), status: 500, code: "INTERNAL_ERROR"},
		{name: "canceled", id: otherSessionID, cancel: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			called := false
			r := testRouter(sessionStore{revoke: func(got context.Context, userID, sessionID string) (bool, error) {
				called = true
				if got != ctx || userID != "user-123" || sessionID != otherSessionID {
					t.Fatal("lost request context, authenticated user, or target session")
				}
				if tc.cancel {
					cancel()
					return false, ctx.Err()
				}
				return tc.revoked, tc.storeErr
			}})
			req := httptest.NewRequest(http.MethodDelete, "/v0/me/sessions/"+tc.id+tc.query, strings.NewReader(tc.body)).WithContext(ctx)
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
			wantCalled := tc.status != 400 && tc.status != 409
			if w.Code != tc.status || called != wantCalled || strings.Contains(w.Body.String(), "private") {
				t.Fatalf("status=%d called=%v body=%s", w.Code, called, w.Body.String())
			}
			if tc.code != "" && !strings.Contains(w.Body.String(), `"code":"`+tc.code+`"`) {
				t.Fatal(w.Body.String())
			}
			if tc.message != "" && !strings.Contains(w.Body.String(), `"message":"`+tc.message+`"`) {
				t.Fatal(w.Body.String())
			}
			if tc.status == 204 && w.Body.Len() != 0 {
				t.Fatal("successful revocation must have no response body")
			}
		})
	}
}
