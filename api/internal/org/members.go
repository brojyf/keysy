package org

import (
	"net/http"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func Members(organizations Organizations) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		orgID, err := uuid.Parse(c.Param("orgId"))
		if err != nil || c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Use a valid organization ID without a query string or request body.")
			return
		}
		members, err := organizations.Members(c.Request.Context(), c.GetString("user_id"), orgID.String())
		if c.Request.Context().Err() != nil {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "The members could not be loaded. Try again later.")
			return
		}
		// The caller is always a member, so an empty list means the org is not visible.
		if len(members) == 0 {
			middleware.Error(c, http.StatusNotFound, "ORG_NOT_FOUND", "The organization was not found.")
			return
		}
		c.JSON(http.StatusOK, members)
	}
}
