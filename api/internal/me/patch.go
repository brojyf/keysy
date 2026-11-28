package me

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/brojyf/keysy/api/internal/naming"
	"github.com/gin-gonic/gin"
)

func Patch(profiles Profiles) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		if c.Request.URL.RawQuery != "" {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Remove the query string and try again.")
			return
		}
		fields, ok := middleware.ReadJSONFields(c, 1)
		if !ok {
			return
		}
		var err error
		var name string
		var autoApply bool
		if raw, ok := fields["displayName"]; ok {
			if bytes.Equal(raw, []byte("null")) || json.Unmarshal(raw, &name) != nil {
				middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
				return
			}
			name = strings.TrimSpace(name)
			if !naming.Valid(name) {
				middleware.Error(c, http.StatusBadRequest, "INVALID_DISPLAY_NAME", "Enter a valid name with 1 to 32 characters.")
				return
			}
			err = profiles.UpdateDisplayName(c.Request.Context(), c.GetString("user_id"), name)
		} else if raw, ok := fields["agentAutoApply"]; ok {
			if bytes.Equal(raw, []byte("null")) || json.Unmarshal(raw, &autoApply) != nil {
				middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
				return
			}
			err = profiles.UpdateAgentAutoApply(c.Request.Context(), c.GetString("user_id"), autoApply)
		} else {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
			return
		}

		if c.Request.Context().Err() != nil {
			return
		}
		if rejectPurgedAccount(c, err) {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Your profile could not be updated. Try again later.")
			return
		}
		result, err := profiles.Profile(c.Request.Context(), c.GetString("user_id"))
		if c.Request.Context().Err() != nil {
			return
		}
		if rejectPurgedAccount(c, err) {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Your profile could not be loaded. Try again later.")
			return
		}
		c.JSON(http.StatusOK, profileResponse(c, result))
	}
}
