package org

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
)

type Organizations interface {
	Create(context.Context, string, string) (Organization, error)
	List(context.Context, string) ([]Membership, error)
	Delete(context.Context, string, string) (bool, error)
}

func Create(organizations Organizations) gin.HandlerFunc {
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
		var fields map[string]json.RawMessage
		if err != nil || !utf8.Valid(body) || json.Unmarshal(body, &fields) != nil || len(fields) != 1 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
			return
		}
		raw, ok := fields["name"]
		var name string
		if !ok || bytes.Equal(raw, []byte("null")) || json.Unmarshal(raw, &name) != nil {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
			return
		}
		name = strings.TrimSpace(name)
		if n := utf8.RuneCountInString(name); n < 1 || n > 32 || strings.ContainsRune(name, '\x00') {
			middleware.Error(c, http.StatusBadRequest, "INVALID_ORG_NAME", "Enter a valid name with 1 to 32 characters.")
			return
		}
		organization, err := organizations.Create(c.Request.Context(), c.GetString("user_id"), name)
		if c.Request.Context().Err() != nil {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Your organization could not be created. Try again later.")
			return
		}
		c.JSON(http.StatusCreated, organization)
	}
}

func List(organizations Organizations) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		if c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Remove the query string and request body, then try again.")
			return
		}
		memberships, err := organizations.List(c.Request.Context(), c.GetString("user_id"))
		if c.Request.Context().Err() != nil {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Your organizations could not be loaded. Try again later.")
			return
		}
		if memberships == nil {
			memberships = []Membership{}
		}
		c.JSON(http.StatusOK, memberships)
	}
}
