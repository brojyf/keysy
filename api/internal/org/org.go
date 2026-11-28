package org

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/brojyf/keysy/api/internal/naming"
	"github.com/gin-gonic/gin"
)

type Organizations interface {
	Create(context.Context, string, string) (Organization, error)
	List(context.Context, string) ([]Membership, error)
	Delete(context.Context, string, string) (bool, error)
	Rename(context.Context, string, string, string) (bool, error)
}

// readName validates the request and returns the trimmed org name. It writes the error response itself.
func readName(c *gin.Context) (string, bool) {
	if c.Request.URL.RawQuery != "" {
		middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Remove the query string and try again.")
		return "", false
	}
	fields, ok := middleware.ReadJSONFields(c, 1)
	if !ok {
		return "", false
	}
	raw, ok := fields["name"]
	var name string
	if !ok || bytes.Equal(raw, []byte("null")) || json.Unmarshal(raw, &name) != nil {
		middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
		return "", false
	}
	name = strings.TrimSpace(name)
	if !naming.Valid(name) {
		middleware.Error(c, http.StatusBadRequest, "INVALID_ORG_NAME", "Enter a valid name with 1 to 32 characters.")
		return "", false
	}
	return name, true
}

func Create(organizations Organizations) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		name, ok := readName(c)
		if !ok {
			return
		}
		organization, err := organizations.Create(c.Request.Context(), c.GetString("user_id"), name)
		if c.Request.Context().Err() != nil {
			return
		}
		if errors.Is(err, ErrAccountDeleting) {
			middleware.Error(c, http.StatusForbidden, "ACCOUNT_DELETING", "Your account is being deleted. Cancel the deletion to create an organization.")
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
