package org

import (
	"net/http"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func Rename(organizations Organizations) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		orgID, err := uuid.Parse(c.Param("orgId"))
		if err != nil {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Use a valid organization ID.")
			return
		}
		name, ok := readName(c)
		if !ok {
			return
		}
		renamed, err := organizations.Rename(c.Request.Context(), c.GetString("user_id"), orgID.String(), name)
		if c.Request.Context().Err() != nil {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Your organization could not be renamed. Try again later.")
			return
		}
		if !renamed {
			middleware.Error(c, http.StatusNotFound, "ORG_NOT_FOUND", "The organization was not found.")
			return
		}
		c.JSON(http.StatusOK, Organization{ID: orgID.String(), Name: name})
	}
}
