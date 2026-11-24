package me

import (
	"net/http"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
)

func CancelDeletion(profiles Profiles) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		if c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Remove the query string and request body, then try again.")
			return
		}
		err := profiles.CancelDeletion(c.Request.Context(), c.GetString("user_id"))
		if c.Request.Context().Err() != nil {
			return
		}
		if rejectPurgedAccount(c, err) {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Your account deletion could not be cancelled. Try again later.")
			return
		}
		c.Status(http.StatusNoContent)
	}
}
