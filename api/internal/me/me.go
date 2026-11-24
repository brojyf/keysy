package me

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/brojyf/keysy/api/internal/profile"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// rejectPurgedAccount writes 401 when the profile row is gone. A purged account keeps
// a valid access JWT until it expires, and the dashboard signs out only on 401.
func rejectPurgedAccount(c *gin.Context, err error) bool {
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false
	}
	middleware.Error(c, http.StatusUnauthorized, "UNAUTHENTICATED", "Your session is invalid or has expired. Sign in again.")
	return true
}

type Profiles interface {
	ScheduleDeletion(context.Context, string) error
	CancelDeletion(context.Context, string) error
	Profile(context.Context, string) (profile.Profile, error)
	UpdateDisplayName(context.Context, string, string) error
	UpdateAgentAutoApply(context.Context, string, bool) error
}

type response struct {
	ID             string     `json:"id"`
	Email          string     `json:"email"`
	DisplayName    string     `json:"displayName"`
	AgentAutoApply bool       `json:"agentAutoApply"`
	AvatarURL      string     `json:"avatarUrl,omitempty"`
	PurgeAt        *time.Time `json:"purgeAt,omitempty"`
}

func Get(profiles Profiles) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		// This route takes no query parameters and no body.
		if c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Remove the query string and request body, then try again.")
			return
		}
		result, err := profiles.Profile(c.Request.Context(), c.GetString("user_id"))
		if c.Request.Context().Err() != nil {
			// The timeout middleware owns the response.
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

// profileResponse builds the GET and PATCH /v0/me body, so both return the same shape.
func profileResponse(c *gin.Context, p profile.Profile) response {
	if p.PurgeAt != nil {
		utc := p.PurgeAt.UTC()
		p.PurgeAt = &utc
	}
	return response{AgentAutoApply: p.AgentAutoApply, ID: c.GetString("user_id"), Email: c.GetString("email"), DisplayName: p.DisplayName, AvatarURL: c.GetString("avatar_url"), PurgeAt: p.PurgeAt}
}
