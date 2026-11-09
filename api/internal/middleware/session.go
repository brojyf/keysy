package middleware

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"

	"github.com/brojyf/keysy/api/internal/jwks"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const accessCookieName = "__Secure-keysy-access"

type sessionClaims struct {
	jwt.RegisteredClaims
	Email        string         `json:"email"`
	SessionID    string         `json:"session_id"`
	UserMetadata map[string]any `json:"user_metadata"`
}

func OpenCookie(key []byte, value string) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aead, err := cipher.NewGCMWithRandomNonce(block)
	if err != nil {
		return "", err
	}
	sealed, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}
	// Auth seals with the full name as AAD, including on HTTP localhost.
	token, err := aead.Open(nil, nil, sealed, []byte(accessCookieName))
	return string(token), err
}

func Session(key []byte, localHTTP bool, issuer string, keyfunc func(context.Context) jwt.Keyfunc, keysAvailable func() bool) gin.HandlerFunc {
	name := accessCookieName
	if localHTTP {
		name = "keysy-access"
	}
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		cookies := c.Request.CookiesNamed(name)
		if len(cookies) != 1 {
			Error(c, http.StatusUnauthorized, "UNAUTHENTICATED", "Your session is invalid or has expired. Sign in again.")
			return
		}
		token, err := OpenCookie(key, cookies[0].Value)
		if err != nil {
			Error(c, http.StatusUnauthorized, "UNAUTHENTICATED", "Your session is invalid or has expired. Sign in again.")
			return
		}
		claims := &sessionClaims{}
		parsed, err := jwt.ParseWithClaims(token, claims, keyfunc(c.Request.Context()), jwt.WithValidMethods([]string{"ES256"}), jwt.WithIssuer(issuer), jwt.WithAudience("authenticated"), jwt.WithExpirationRequired())
		if err != nil && c.Request.Context().Err() != nil {
			// A JWKS refresh hit the request deadline; Timeout writes the 503.
			c.Abort()
			return
		}
		if errors.Is(err, jwt.ErrTokenUnverifiable) && (!keysAvailable() || errors.Is(err, jwks.ErrUnavailable)) {
			// A failed or rate-limited JWKS lookup does not mean the session is invalid.
			Error(c, http.StatusServiceUnavailable, "KEYS_UNAVAILABLE", "Your session cannot be verified right now. Try again later.")
			return
		}
		if err != nil || !parsed.Valid || claims.Subject == "" || claims.SessionID == "" {
			Error(c, http.StatusUnauthorized, "UNAUTHENTICATED", "Your session is invalid or has expired. Sign in again.")
			return
		}
		avatar, _ := claims.UserMetadata["avatar_url"].(string)
		u, err := url.Parse(avatar)
		if err != nil || u.Scheme != "https" || u.Hostname() == "" {
			avatar = ""
		}
		c.Set("user_id", claims.Subject)
		c.Set("email", claims.Email)
		c.Set("session_id", claims.SessionID)
		c.Set("avatar_url", avatar)
		c.Next()
	}
}
