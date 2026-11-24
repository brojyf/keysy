package me

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/brojyf/keysy/api/internal/profile"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (f profileLookup) ScheduleDeletion(context.Context, string) error  { panic("unexpected deletion") }
func (p *profileUpdate) ScheduleDeletion(context.Context, string) error { panic("unexpected deletion") }
func (f profileLookup) CancelDeletion(context.Context, string) error {
	panic("unexpected cancellation")
}
func (p *profileUpdate) CancelDeletion(context.Context, string) error {
	panic("unexpected cancellation")
}

type profileLookup func(context.Context, string) (profile.Profile, error)

func (f profileLookup) Profile(ctx context.Context, id string) (profile.Profile, error) {
	return f(ctx, id)
}
func (f profileLookup) UpdateDisplayName(context.Context, string, string) error {
	panic("unexpected update")
}

func (f profileLookup) UpdateAgentAutoApply(context.Context, string, bool) error {
	panic("unexpected update")
}

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
			r.GET("/v0/me", Get(profileLookup(func(got context.Context, id string) (profile.Profile, error) {
				if got != ctx || id != "user-123" {
					t.Error("lost request context or user ID")
				}
				if scenario == "timeout" {
					cancel()
					return profile.Profile{}, context.DeadlineExceeded
				}
				if scenario == "missing-profile" {
					return profile.Profile{}, gorm.ErrRecordNotFound
				}
				if scenario == "database-error" {
					return profile.Profile{}, errors.New("private database details")
				}
				return profile.Profile{DisplayName: "Member", AgentAutoApply: true}, nil
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
				if w.Code != 500 || w.Body.String() != `{"error":{"code":"INTERNAL_ERROR","message":"Your profile could not be loaded. Try again later."}}` {
					t.Fatal(w.Body.String())
				}
				return
			}
			var body map[string]any
			json.Unmarshal(w.Body.Bytes(), &body)
			if w.Code != 200 || body["id"] != "user-123" || body["email"] != "member@example.test" || body["displayName"] != "Member" || w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal(body)
			}
			if _, ok := body["memberships"]; ok {
				t.Fatal("profile response must not include memberships")
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
	r.GET("/v0/me", Get(profileLookup(func(ctx context.Context, _ string) (profile.Profile, error) {
		<-ctx.Done()
		return profile.Profile{}, ctx.Err()
	})))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/v0/me", nil).WithContext(ctx))
	if w.Body.Len() != 0 {
		t.Fatal("cancelled request wrote a response")
	}
}

func TestMeRejectsUnexpectedInput(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, scenario := range []struct {
		name, query, body string
		chunked           bool
	}{
		{"query", "?unexpected=secret", "", false},
		{"malformed-query", "?bad=%zz", "", false},
		{"body", "", "secret", false},
		{"chunked-body", "", "secret", true},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			r := gin.New()
			r.GET("/v0/me", Get(profileLookup(func(context.Context, string) (profile.Profile, error) {
				t.Error("looked up a profile for invalid input")
				return profile.Profile{}, nil
			})))
			req := httptest.NewRequest("GET", "/v0/me"+scenario.query, strings.NewReader(scenario.body))
			if scenario.chunked {
				req.ContentLength = -1
				req.TransferEncoding = []string{"chunked"}
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != 400 || !strings.Contains(w.Body.String(), `"code":"INVALID_REQUEST"`) || !strings.Contains(w.Body.String(), `"message":"Remove the query string and request body, then try again."`) || strings.Contains(w.Body.String(), "secret") {
				t.Fatalf("%d %s", w.Code, w.Body.String())
			}
		})
	}
}

type profileUpdate struct {
	called    bool
	name      string
	err       error
	cancel    context.CancelFunc
	reads     int
	autoApply bool
	purgeAt   *time.Time
	readErr   error
}

func (p *profileUpdate) Profile(_ context.Context, id string) (profile.Profile, error) {
	p.reads++
	if id != "user-123" {
		panic("wrong user ID")
	}
	return profile.Profile{DisplayName: p.name, AgentAutoApply: p.autoApply, PurgeAt: p.purgeAt}, p.readErr
}
func (p *profileUpdate) UpdateDisplayName(ctx context.Context, id, name string) error {
	p.called = true
	p.name = name
	if id != "user-123" {
		panic("wrong user ID")
	}
	if p.cancel != nil {
		p.cancel()
	}
	return p.err
}

func (p *profileUpdate) UpdateAgentAutoApply(_ context.Context, id string, enabled bool) error {
	p.called = true
	p.autoApply = enabled
	if id != "user-123" {
		panic("wrong user ID")
	}
	return p.err
}

func TestPatchMe(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		name, body, contentType, query, wantName, code string
		status                                         int
		storeErr                                       error
		cancel                                         bool
	}{
		{name: "trim", body: `{"displayName":"  Ada  "}`, contentType: "application/json", wantName: "Ada", status: 200},
		{name: "charset", body: `{"displayName":"Ada"}`, contentType: "application/json; charset=utf-8", wantName: "Ada", status: 200},
		{name: "32 runes", body: `{"displayName":"` + strings.Repeat("é", 32) + `"}`, contentType: "application/json", wantName: strings.Repeat("é", 32), status: 200},
		{name: "33 runes", body: `{"displayName":"` + strings.Repeat("é", 33) + `"}`, contentType: "application/json", status: 400, code: "INVALID_DISPLAY_NAME"},
		{name: "empty", body: `{"displayName":""}`, contentType: "application/json", status: 400, code: "INVALID_DISPLAY_NAME"},
		{name: "whitespace", body: `{"displayName":"  "}`, contentType: "application/json", status: 400, code: "INVALID_DISPLAY_NAME"},
		{name: "NUL", body: `{"displayName":"a\u0000b"}`, contentType: "application/json", status: 400, code: "INVALID_DISPLAY_NAME"},
		{name: "missing", body: `{}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "null", body: `{"displayName":null}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "number", body: `{"displayName":1}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "wrong field case", body: `{"DisplayName":"Ada"}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "invalid UTF-8", body: "{\"displayName\":\"" + string([]byte{0xff}) + "\"}", contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "unknown", body: `{"displayName":"Ada","extra":1}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "two objects", body: `{"displayName":"Ada"}{}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "trailing data", body: `{"displayName":"Ada"}x`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "oversize", body: `{"displayName":"` + strings.Repeat("a", 1024) + `"}`, contentType: "application/json", status: 400, code: "INVALID_REQUEST"},
		{name: "wrong type", body: `{}`, contentType: "text/plain", status: 415, code: "UNSUPPORTED_MEDIA_TYPE"},
		{name: "missing type", body: `{}`, status: 415, code: "UNSUPPORTED_MEDIA_TYPE"},
		{name: "query", body: `{"displayName":"Ada"}`, contentType: "application/json", query: "?x=1", status: 400, code: "INVALID_REQUEST"},
		{name: "store error", body: `{"displayName":"Ada"}`, contentType: "application/json", status: 500, code: "INTERNAL_ERROR", storeErr: errors.New("private")},
		{name: "not found", body: `{"displayName":"Ada"}`, contentType: "application/json", status: 500, code: "INTERNAL_ERROR", storeErr: gorm.ErrRecordNotFound},
		{name: "canceled", body: `{"displayName":"Ada"}`, contentType: "application/json", cancel: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			store := &profileUpdate{err: tc.storeErr}
			if tc.cancel {
				store.cancel = cancel
			}
			r := gin.New()
			r.Use(func(c *gin.Context) {
				c.Set("user_id", "user-123")
				c.Set("email", "member@example.test")
				c.Set("avatar_url", "https://google.test/photo")
			})
			r.PATCH("/v0/me", Patch(store))
			req := httptest.NewRequest("PATCH", "/v0/me"+tc.query, strings.NewReader(tc.body)).WithContext(ctx)
			if tc.contentType != "" {
				req.Header.Set("Content-Type", tc.contentType)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("missing no-store")
			}
			if tc.cancel {
				if !store.called || w.Body.Len() != 0 || w.Flushed {
					t.Fatal("handler wrote canceled response")
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
				if tc.status != 500 && store.called {
					t.Fatal("invalid request reached store")
				}
				if tc.status == 500 && !store.called {
					t.Fatal("store was not called")
				}
				return
			}
			var body response
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			var fields map[string]json.RawMessage
			if err := json.Unmarshal(w.Body.Bytes(), &fields); err != nil {
				t.Fatal(err)
			}
			if _, ok := fields["memberships"]; ok {
				t.Fatal("profile response must not include memberships")
			}
			if !store.called || store.name != tc.wantName || body.ID != "user-123" || body.Email != "member@example.test" || body.AvatarURL != "https://google.test/photo" || body.DisplayName != tc.wantName {
				t.Fatalf("store=%+v body=%+v", store, body)
			}
		})
	}
}

func TestPatchAgentAutoApply(t *testing.T) {
	for _, tc := range []struct {
		body   string
		status int
		called bool
	}{
		{`{"agentAutoApply":true}`, 200, true}, {`{"agentAutoApply":false}`, 200, true},
		{`{"agentAutoApply":null}`, 400, false}, {`{"agentAutoApply":"true"}`, 400, false},
	} {
		t.Run(tc.body, func(t *testing.T) {
			store := &profileUpdate{}
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
			r.PATCH("/v0/me", Patch(store))
			req := httptest.NewRequest("PATCH", "/v0/me", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.status || store.called != tc.called {
				t.Fatalf("status %d, called %v: %s", w.Code, store.called, w.Body.String())
			}
			if tc.called && !strings.Contains(w.Body.String(), tc.body[1:len(tc.body)-1]) {
				t.Fatal(w.Body.String())
			}
		})
	}
}

func TestProfilePurgeAtResponses(t *testing.T) {
	purge := time.Date(2026, 12, 16, 0, 30, 0, 0, time.FixedZone("west", -8*60*60))
	for _, tc := range []struct {
		name, method, body string
		pending            bool
	}{
		{"get pending", "GET", "", true}, {"get active", "GET", "", false},
		{"patch name", "PATCH", `{"displayName":"Ada"}`, true}, {"patch preference", "PATCH", `{"agentAutoApply":true}`, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &profileUpdate{name: "Ada", autoApply: true}
			if tc.pending {
				store.purgeAt = &purge
			}
			r := gin.New()
			r.Use(func(c *gin.Context) { c.Set("user_id", "user-123"); c.Set("email", "member@example.test") })
			r.GET("/v0/me", Get(store))
			r.PATCH("/v0/me", Patch(store))
			req := httptest.NewRequest(tc.method, "/v0/me", strings.NewReader(tc.body))
			if tc.method == "PATCH" {
				req.Header.Set("Content-Type", "application/json")
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			var body map[string]any
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if w.Code != 200 || store.reads != 1 || body["id"] != "user-123" || body["email"] != "member@example.test" || body["displayName"] != "Ada" || body["agentAutoApply"] != true {
				t.Fatalf("status=%d reads=%d body=%v", w.Code, store.reads, body)
			}
			value, ok := body["purgeAt"]
			if tc.pending && (!ok || value != "2026-12-16T08:30:00Z") {
				t.Fatal(body)
			}
			if !tc.pending && ok {
				t.Fatal(body)
			}
		})
	}
}

func TestPatchProfileReadError(t *testing.T) {
	for _, body := range []string{`{"displayName":"Ada"}`, `{"agentAutoApply":true}`} {
		store := &profileUpdate{readErr: errors.New("private")}
		r := gin.New()
		r.Use(func(c *gin.Context) { c.Set("user_id", "user-123") })
		r.PATCH("/v0/me", Patch(store))
		req := httptest.NewRequest("PATCH", "/v0/me", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if !store.called || store.reads != 1 || w.Code != 500 || w.Body.String() != `{"error":{"code":"INTERNAL_ERROR","message":"Your profile could not be loaded. Try again later."}}` {
			t.Fatalf("%d %s", w.Code, w.Body.String())
		}
	}
}
