package me

import (
	"errors"
	"net/http"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/brojyf/keysy/api/internal/profile"
	"github.com/gin-gonic/gin"
)

type ownedOrganization struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

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
		var owner *profile.OrgOwnerError
		if errors.As(err, &owner) {
			organizations := make([]ownedOrganization, len(owner.Orgs))
			for i, org := range owner.Orgs {
				organizations[i] = ownedOrganization{ID: org.ID, Name: org.Name}
			}
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": gin.H{"code": "ORG_OWNER", "message": "Transfer or delete the organizations you own, then try again.", "organizations": organizations}})
			return
		}
		if rejectPurgedAccount(c, err) {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Your account could not be deleted. Try again later.")
			return
		}
		c.Status(http.StatusNoContent)
	}
}
