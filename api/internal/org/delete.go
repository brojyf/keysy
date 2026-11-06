package org

import (
	"net/http"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func Delete(organizations Organizations) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		orgID, err := uuid.Parse(c.Param("orgId"))
		if err != nil || c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Use a valid organization ID without a query string or request body.")
			return
		}
		deleted, err := organizations.Delete(c.Request.Context(), c.GetString("user_id"), orgID.String())
		if c.Request.Context().Err() != nil {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Your organization could not be deleted. Try again later.")
			return
		}
		if !deleted {
			middleware.Error(c, http.StatusNotFound, "ORG_NOT_FOUND", "The organization was not found.")
			return
		}
		c.Status(http.StatusNoContent)
	}
}
