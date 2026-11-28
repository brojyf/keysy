package middleware

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestReadJSONFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		name, contentType, body, code string
		status                        int
	}{
		{name: "two fields", contentType: "application/json", body: `{"a":1,"b":"x"}`, status: 204},
		{name: "charset", contentType: "application/json; charset=utf-8", body: `{"a":1,"b":2}`, status: 204},
		{name: "not JSON", contentType: "text/plain", body: `{"a":1,"b":2}`, status: 415, code: "UNSUPPORTED_MEDIA_TYPE"},
		{name: "no content type", body: `{"a":1,"b":2}`, status: 415, code: "UNSUPPORTED_MEDIA_TYPE"},
		{name: "too large", contentType: "application/json", body: `{"a":"` + strings.Repeat("x", 1100) + `","b":2}`, status: 400, code: "INVALID_REQUEST"},
		{name: "invalid UTF-8", contentType: "application/json", body: "{\"a\":\"\xff\",\"b\":2}", status: 400, code: "INVALID_REQUEST"},
		{name: "not an object", contentType: "application/json", body: `["a","b"]`, status: 400, code: "INVALID_REQUEST"},
		{name: "null", contentType: "application/json", body: `null`, status: 400, code: "INVALID_REQUEST"},
		{name: "too few fields", contentType: "application/json", body: `{"a":1}`, status: 400, code: "INVALID_REQUEST"},
		{name: "too many fields", contentType: "application/json", body: `{"a":1,"b":2,"c":3}`, status: 400, code: "INVALID_REQUEST"},
		{name: "trailing data", contentType: "application/json", body: `{"a":1,"b":2} {}`, status: 400, code: "INVALID_REQUEST"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.POST("/", func(c *gin.Context) {
				if fields, ok := ReadJSONFields(c, 2); ok && fields["a"] != nil && fields["b"] != nil {
					c.Status(204)
				}
			})
			req := httptest.NewRequest("POST", "/", strings.NewReader(tc.body))
			if tc.contentType != "" {
				req.Header.Set("Content-Type", tc.contentType)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.status || !strings.Contains(w.Body.String(), tc.code) {
				t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
			}
		})
	}
}
