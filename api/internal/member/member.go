package member

import (
	"context"
	"errors"
	"net/http"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Members interface {
	List(context.Context, string, string) ([]Member, error)
	Remove(context.Context, string, string, string) error
	Leave(context.Context, string, string) error
}

func List(members Members) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		orgID, err := uuid.Parse(c.Param("orgId"))
		if err != nil || c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Use a valid organization ID without a query string or request body.")
			return
		}
		list, err := members.List(c.Request.Context(), c.GetString("user_id"), orgID.String())
		if c.Request.Context().Err() != nil {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "The members could not be loaded. Try again later.")
			return
		}
		// The caller is always a member, so an empty list means the org is not visible.
		if len(list) == 0 {
			middleware.Error(c, http.StatusNotFound, "ORG_NOT_FOUND", "The organization was not found.")
			return
		}
		c.JSON(http.StatusOK, list)
	}
}

func Remove(members Members) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		orgID, orgErr := uuid.Parse(c.Param("orgId"))
		userID, userErr := uuid.Parse(c.Param("userId"))
		if orgErr != nil || userErr != nil || c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Use valid organization and user IDs without a query string or request body.")
			return
		}
		err := members.Remove(c.Request.Context(), c.GetString("user_id"), orgID.String(), userID.String())
		if c.Request.Context().Err() != nil {
			return
		}
		switch {
		case errors.Is(err, ErrRemoveForbidden):
			middleware.Error(c, http.StatusForbidden, "MEMBER_REMOVE_FORBIDDEN", "You cannot remove this member.")
		case errors.Is(err, ErrOrgNotFound):
			middleware.Error(c, http.StatusNotFound, "ORG_NOT_FOUND", "The organization was not found.")
		case errors.Is(err, ErrMemberNotFound):
			middleware.Error(c, http.StatusNotFound, "MEMBER_NOT_FOUND", "The member was not found.")
		case err != nil:
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "The member could not be removed. Try again later.")
		default:
			c.Status(http.StatusNoContent)
		}
	}
}

func Leave(members Members) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		orgID, err := uuid.Parse(c.Param("orgId"))
		if err != nil || c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Use a valid organization ID without a query string or request body.")
			return
		}
		err = members.Leave(c.Request.Context(), c.GetString("user_id"), orgID.String())
		if c.Request.Context().Err() != nil {
			return
		}
		switch {
		case errors.Is(err, ErrOrgNotFound):
			middleware.Error(c, http.StatusNotFound, "ORG_NOT_FOUND", "The organization was not found.")
		case errors.Is(err, ErrOwnerCannotLeave):
			middleware.Error(c, http.StatusConflict, "ORG_OWNER", "Transfer the Owner role or delete the organization, then try again.")
		case err != nil:
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "You could not leave the organization. Try again later.")
		default:
			c.Status(http.StatusNoContent)
		}
	}
}
