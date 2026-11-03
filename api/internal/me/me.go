package me

import (
	"context"
	"net/http"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
)

type Profiles interface {
	DisplayName(context.Context, string) (string, error)
}

type response struct {
	ID          string     `json:"id"`
	Email       string     `json:"email"`
	DisplayName string     `json:"displayName"`
	AvatarURL   string     `json:"avatarUrl,omitempty"`
	Memberships []struct{} `json:"memberships"`
}

func Get(profiles Profiles) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		name, err := profiles.DisplayName(c.Request.Context(), c.GetString("user_id"))
		if c.Request.Context().Err() != nil {
			// The timeout middleware owns the response.
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR")
			return
		}
		c.JSON(http.StatusOK, response{ID: c.GetString("user_id"), Email: c.GetString("email"), DisplayName: name, AvatarURL: c.GetString("avatar_url"), Memberships: []struct{}{}})
	}
}
