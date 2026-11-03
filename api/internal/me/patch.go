package me

import (
	"bytes"
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
)

func Patch(profiles Profiles) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		if c.Request.URL.RawQuery != "" {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Remove the query string and try again.")
			return
		}
		mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
		if err != nil || mediaType != "application/json" {
			middleware.Error(c, http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as JSON.")
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 1<<10))
		if err != nil || !utf8.Valid(body) {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
			return
		}
		decoder := json.NewDecoder(bytes.NewReader(body))
		var fields map[string]json.RawMessage
		if decoder.Decode(&fields) != nil || decoder.Decode(&struct{}{}) != io.EOF || len(fields) != 1 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
			return
		}
		raw, ok := fields["displayName"]
		var name string
		if !ok || bytes.Equal(raw, []byte("null")) || json.Unmarshal(raw, &name) != nil {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
			return
		}
		name = strings.TrimSpace(name)
		if n := utf8.RuneCountInString(name); n < 1 || n > 32 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_DISPLAY_NAME", "Enter a name with 1 to 32 characters.")
			return
		}
		err = profiles.UpdateDisplayName(c.Request.Context(), c.GetString("user_id"), name)
		if c.Request.Context().Err() != nil {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Your profile could not be updated. Try again later.")
			return
		}
		c.JSON(http.StatusOK, response{ID: c.GetString("user_id"), Email: c.GetString("email"), DisplayName: name, AvatarURL: c.GetString("avatar_url"), Memberships: []struct{}{}})
	}
}
