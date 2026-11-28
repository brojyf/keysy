package invitation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"net/mail"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Invitations interface {
	List(context.Context, string, string) ([]Invitation, bool, error)
}

type Creator interface {
	Create(ctx context.Context, callerID, orgID, email, role string) (Invitation, error)
}

func List(invitations Invitations) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		orgID, err := uuid.Parse(c.Param("orgId"))
		if err != nil || c.Request.URL.RawQuery != "" || c.Request.ContentLength != 0 || len(c.Request.TransferEncoding) != 0 {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Use a valid organization ID without a query string or request body.")
			return
		}
		list, visible, err := invitations.List(c.Request.Context(), c.GetString("user_id"), orgID.String())
		if c.Request.Context().Err() != nil {
			return
		}
		if err != nil {
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "The invitations could not be loaded. Try again later.")
			return
		}
		if !visible {
			middleware.Error(c, http.StatusNotFound, "ORG_NOT_FOUND", "The organization was not found.")
			return
		}
		c.JSON(http.StatusOK, list)
	}
}

// readInvitation validates the request and returns the lowercase email and the role. It writes the error response itself.
func readInvitation(c *gin.Context) (string, string, bool) {
	if c.Request.URL.RawQuery != "" {
		middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Remove the query string and try again.")
		return "", "", false
	}
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || mediaType != "application/json" {
		middleware.Error(c, http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as JSON.")
		return "", "", false
	}
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 1<<10))
	var fields map[string]json.RawMessage
	if err != nil || !utf8.Valid(body) || json.Unmarshal(body, &fields) != nil || len(fields) != 2 {
		middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
		return "", "", false
	}
	var email, role string
	rawEmail, hasEmail := fields["email"]
	rawRole, hasRole := fields["role"]
	if !hasEmail || !hasRole || bytes.Equal(rawEmail, []byte("null")) || bytes.Equal(rawRole, []byte("null")) ||
		json.Unmarshal(rawEmail, &email) != nil || json.Unmarshal(rawRole, &role) != nil || role != "admin" && role != "developer" {
		middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Check your request body and try again.")
		return "", "", false
	}
	email = strings.TrimSpace(email)
	// Only ASCII is allowed, checked before lowercasing: Go and Postgres lowercase some other letters
	// differently, and Go lowercases İ to the ASCII i.
	nonASCII := strings.ContainsFunc(email, func(r rune) bool { return r > unicode.MaxASCII })
	email = strings.ToLower(email)
	// ParseAddress also accepts display names and comments, so the parsed address must equal the input.
	address, err := mail.ParseAddress(email)
	if len(email) > 254 || nonASCII || err != nil || address.Address != email {
		middleware.Error(c, http.StatusBadRequest, "INVALID_EMAIL", "Enter a valid email address.")
		return "", "", false
	}
	return email, role, true
}

func Create(invitations Creator) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		orgID, err := uuid.Parse(c.Param("orgId"))
		if err != nil {
			middleware.Error(c, http.StatusBadRequest, "INVALID_REQUEST", "Use a valid organization ID.")
			return
		}
		email, role, ok := readInvitation(c)
		if !ok {
			return
		}
		created, err := invitations.Create(c.Request.Context(), c.GetString("user_id"), orgID.String(), email, role)
		if c.Request.Context().Err() != nil {
			return
		}
		switch {
		case errors.Is(err, ErrOrgNotFound):
			middleware.Error(c, http.StatusNotFound, "ORG_NOT_FOUND", "The organization was not found.")
		case errors.Is(err, ErrForbidden):
			middleware.Error(c, http.StatusForbidden, "INVITATION_FORBIDDEN", "You cannot send this invitation.")
		case errors.Is(err, ErrAlreadyMember):
			middleware.Error(c, http.StatusConflict, "ALREADY_MEMBER", "This email address already belongs to a member.")
		case errors.Is(err, ErrInvitationExists):
			middleware.Error(c, http.StatusConflict, "INVITATION_EXISTS", "This email address already has a pending invitation.")
		case errors.Is(err, ErrLimitReached):
			middleware.Error(c, http.StatusTooManyRequests, "INVITATION_LIMIT_REACHED", "Your organization reached its limit of 50 invitation emails per 24 hours. Try again later.")
		case err != nil:
			middleware.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "The invitation could not be sent. Try again later.")
		default:
			c.JSON(http.StatusCreated, created)
		}
	}
}
