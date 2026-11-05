package login

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

func TestRoutesRejectUnexpectedInput(t *testing.T) {
	for _, method := range []string{"POST", "OPTIONS"} {
		for _, item := range []struct {
			name, query, body string
			chunked           bool
		}{
			{"unknown-query", "?unexpected=secret", "", false},
			{"duplicate-query", "?unexpected=a&unexpected=b", "", false},
			{"malformed-query", "?bad=%zz", "", false},
			{"body", "", "secret", false},
			{"chunked-body", "", "secret", true},
		} {
			t.Run(method+"/"+item.name, func(t *testing.T) {
				h, err := New(Options{CookieKey: make([]byte, 32), OAuth: oauth2.Config{RedirectURL: "https://auth.keysy.test/v0/auth/callback"}, WebAppURL: "https://app.keysy.test/"})
				if err != nil {
					t.Fatal(err)
				}
				gin.SetMode(gin.TestMode)
				router := gin.New()
				h.Register(router)
				req := httptest.NewRequest(method, "/v0/auth/logout"+item.query, strings.NewReader(item.body))
				if item.chunked {
					req.ContentLength = -1
					req.TransferEncoding = []string{"chunked"}
				}
				req.Header.Set("Origin", "https://app.keysy.test")
				req.Header.Set("Access-Control-Request-Method", "POST")
				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)
				if w.Code != 400 || !strings.Contains(w.Body.String(), `"code":"INVALID_REQUEST"`) {
					t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
				}
			})
		}
	}
}

func TestCallbackRejectsBothOutcomeParameters(t *testing.T) {
	for _, query := range []string{"code=valid&error=", "code=&error=access_denied"} {
		t.Run(query, func(t *testing.T) {
			h, err := New(Options{CookieKey: make([]byte, 32), OAuth: oauth2.Config{RedirectURL: "https://auth.keysy.test/v0/auth/callback"}, WebAppURL: "https://app.keysy.test/"})
			if err != nil {
				t.Fatal(err)
			}
			router := gin.New()
			h.Register(router)
			req := httptest.NewRequest("GET", "/v0/auth/callback?state=abcdefghijklmnopqrstuv&"+query, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			if w.Code != 400 || !strings.Contains(w.Body.String(), `"code":"INVALID_REQUEST"`) {
				t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
			}
		})
	}
}
