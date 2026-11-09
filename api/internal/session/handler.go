package session

import (
	"context"
	"net/http"
	"time"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Sessions interface {
	List(context.Context, string) ([]Session, error)
	Revoke(context.Context, string, string) (bool, error)
}

type sessionResponse struct {
	ID         string `json:"id"`
	Client     string `json:"client"`
	Device     string `json:"device"`
	LastUsedAt string `json:"lastUsedAt"`
	Current    bool   `json:"current"`
}

func List(sessions Sessions) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		if c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Remove the query string and request body, then try again.")
			return
		}
		found, err := sessions.List(c.Request.Context(), c.GetString("user_id"))
		if c.Request.Context().Err() != nil {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Your sessions could not be loaded. Try again later.")
			return
		}
		response := make([]sessionResponse, 0, len(found))
		for _, s := range found {
			response = append(response, sessionResponse{
				ID:         s.ID,
				Client:     "web", // Only web sessions exist today.
				Device:     deviceName(s.UserAgent),
				LastUsedAt: s.LastUsedAt.UTC().Format(time.RFC3339Nano),
				Current:    s.ID == c.GetString("session_id"),
			})
		}
		c.JSON(http.StatusOK, response)
	}
}

func Revoke(sessions Sessions) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		sessionID, err := uuid.Parse(c.Param("sessionId"))
		if err != nil || c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Use a valid session ID without a query string or request body.")
			return
		}
		if sessionID.String() == c.GetString("session_id") {
			middleware.Error(c, http.StatusConflict, "CURRENT_SESSION", "You cannot revoke the session you are using. Sign out instead.")
			return
		}
		revoked, err := sessions.Revoke(c.Request.Context(), c.GetString("user_id"), sessionID.String())
		if c.Request.Context().Err() != nil {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "The session could not be revoked. Try again later.")
			return
		}
		if !revoked {
			middleware.Error(c, http.StatusNotFound, "SESSION_NOT_FOUND", "This session was not found. Refresh the page and try again.")
			return
		}
		c.Status(http.StatusNoContent)
	}
}
