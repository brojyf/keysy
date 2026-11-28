package middleware

import (
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

// ReadJSONFields reads a JSON object of at most 1 KiB with exactly count fields.
// It writes the error response itself. Unmarshal also rejects data after the object.
func ReadJSONFields(c *gin.Context, count int) (map[string]json.RawMessage, bool) {
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || mediaType != "application/json" {
		Error(c, http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as JSON.")
		return nil, false
	}
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 1<<10))
	var fields map[string]json.RawMessage
	if err != nil || !utf8.Valid(body) || json.Unmarshal(body, &fields) != nil || len(fields) != count {
		Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
		return nil, false
	}
	return fields, true
}
