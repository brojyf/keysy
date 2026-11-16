package me

import (
	"errors"
	"net/http"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/brojyf/keysy/api/internal/profile"
	"github.com/gin-gonic/gin"
)

func Delete(profiles Profiles) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		if c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Remove the query string and request body, then try again.")
			return
		}
		err := profiles.ScheduleDeletion(c.Request.Context(), c.GetString("user_id"))
		if c.Request.Context().Err() != nil {
			return
		}
		if errors.Is(err, profile.ErrOrgOwner) {
			middleware.Error(c, http.StatusConflict, "ORG_OWNER", "Transfer or delete the organizations you own, then try again.")
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Your account could not be deleted. Try again later.")
			return
		}
		c.Status(http.StatusNoContent)
	}
}
