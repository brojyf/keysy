package login

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

const (
	oauthCookieName     = "__Host-keysy-oauth"
	accessCookieName    = "__Host-keysy-access"
	refreshCookieName   = "__Host-keysy-refresh"
	transactionLifetime = 10 * time.Minute
)

type Options struct {
	OAuth       oauth2.Config
	SupabaseURL string
	SupabaseKey string
	WebAppURL   string
	CookieKey   []byte
	HTTPClient  *http.Client
}

type Handler struct {
	oauth       oauth2.Config
	supabaseURL string
	supabaseKey string
	webAppURL   string
	cipher      cipher.AEAD
	httpClient  *http.Client
	localHTTP   bool
	now         func() time.Time
}

type transaction struct {
	State    string `json:"state"`
	Verifier string `json:"verifier"`
	Nonce    string `json:"nonce"`
	IssuedAt int64  `json:"issuedAt"`
}

func New(options Options) (*Handler, error) {
	if len(options.CookieKey) != 32 {
		return nil, errors.New("OAuth cookie key must contain 32 bytes")
	}
	block, err := aes.NewCipher(options.CookieKey)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCMWithRandomNonce(block)
	if err != nil {
		return nil, err
	}
	redirectURL, err := url.Parse(options.OAuth.RedirectURL)
	if err != nil {
		return nil, err
	}
	return &Handler{
		localHTTP: redirectURL.Scheme == "http" && redirectURL.Hostname() == "localhost",
		oauth:     options.OAuth, supabaseURL: options.SupabaseURL,
		supabaseKey: options.SupabaseKey, webAppURL: options.WebAppURL,
		cipher: aead, httpClient: options.HTTPClient, now: time.Now,
	}, nil
}

func (h *Handler) Register(router *gin.Engine) {
	router.GET("/v0/auth/google", h.start)
	router.GET("/v0/auth/callback", h.callback)
	router.GET("/v0/auth/session", h.dashboardCORS(http.MethodGet), h.currentSession)
	router.OPTIONS("/v0/auth/session", h.dashboardCORS(http.MethodGet))
	router.POST("/v0/auth/logout", h.dashboardCORS(http.MethodPost), h.logout)
	router.OPTIONS("/v0/auth/logout", h.dashboardCORS(http.MethodPost))
}

func sensitiveResponse(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.Header("Referrer-Policy", "no-referrer")
}

func (h *Handler) start(c *gin.Context) {
	sensitiveResponse(c)
	if _, err := loginQuery(c.Request, false); err != nil {
		respondError(c, 400, "INVALID_REQUEST")
		return
	}
	tx := transaction{
		State: randomToken(), Verifier: oauth2.GenerateVerifier(),
		Nonce: randomToken(), IssuedAt: h.now().Unix(),
	}
	plaintext, err := json.Marshal(tx)
	if err != nil {
		respondError(c, 500, "INTERNAL_ERROR")
		return
	}
	sealed := h.cipher.Seal(nil, nil, plaintext, []byte(oauthCookieName))
	http.SetCookie(c.Writer, h.newCookie(oauthCookieName, base64.RawURLEncoding.EncodeToString(sealed), int(transactionLifetime.Seconds())))
	nonce := sha256.Sum256([]byte(tx.Nonce))
	location := h.oauth.AuthCodeURL(tx.State,
		oauth2.S256ChallengeOption(tx.Verifier),
		oauth2.SetAuthURLParam("nonce", hex.EncodeToString(nonce[:])),
	)
	c.Redirect(http.StatusFound, location)
}

func (h *Handler) callback(c *gin.Context) {
	sensitiveResponse(c)
	http.SetCookie(c.Writer, h.newCookie(oauthCookieName, "", -1))
	query, err := loginQuery(c.Request, true)
	if err != nil {
		respondError(c, 400, "INVALID_REQUEST")
		return
	}
	tx, err := h.readTransaction(c.Request)
	if err != nil || subtle.ConstantTimeCompare([]byte(query.Get("state")), []byte(tx.State)) != 1 {
		respondError(c, http.StatusBadRequest, "INVALID_LOGIN_TRANSACTION")
		return
	}
	if query.Has("error") {
		respondError(c, 400, "SIGN_IN_FAILED")
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	ctx = context.WithValue(ctx, oauth2.HTTPClient, h.httpClient)
	googleToken, err := h.oauth.Exchange(ctx, query.Get("code"), oauth2.VerifierOption(tx.Verifier))
	if err != nil {
		var rejection *oauth2.RetrieveError
		status := http.StatusServiceUnavailable
		if errors.As(err, &rejection) && rejection.Response.StatusCode >= 400 && rejection.Response.StatusCode < 500 && rejection.Response.StatusCode != 429 {
			status = http.StatusBadRequest
		}
		respondError(c, status, "SIGN_IN_FAILED")
		return
	}
	idToken, _ := googleToken.Extra("id_token").(string)
	if idToken == "" {
		respondError(c, http.StatusBadGateway, "INVALID_PROVIDER_RESPONSE")
		return
	}
	session, status := h.exchangeIDToken(ctx, idToken, googleToken.AccessToken, tx.Nonce, c.Request.UserAgent())
	if status != 0 {
		respondError(c, status, "SIGN_IN_FAILED")
		return
	}
	cookies := []*http.Cookie{
		h.newTokenCookie(accessCookieName, session.AccessToken, session.ExpiresIn),
		h.newTokenCookie(refreshCookieName, session.RefreshToken, 0),
	}
	for _, cookie := range cookies {
		if cookie.Valid() != nil || len(cookie.String()) > 4096 {
			respondError(c, http.StatusBadGateway, "INVALID_PROVIDER_RESPONSE")
			return
		}
	}
	for _, cookie := range cookies {
		http.SetCookie(c.Writer, cookie)
	}
	c.Redirect(http.StatusSeeOther, h.webAppURL)
}

func (h *Handler) readTransaction(r *http.Request) (transaction, error) {
	var tx transaction
	cookies := r.CookiesNamed(h.cookieName(oauthCookieName))
	if len(cookies) != 1 {
		return tx, errors.New("expected one OAuth transaction cookie")
	}
	sealed, err := base64.RawURLEncoding.DecodeString(cookies[0].Value)
	if err != nil {
		return tx, err
	}
	plaintext, err := h.cipher.Open(nil, nil, sealed, []byte(oauthCookieName))
	if err != nil {
		return tx, err
	}
	if err := json.Unmarshal(plaintext, &tx); err != nil {
		return tx, err
	}
	age := h.now().Unix() - tx.IssuedAt
	if tx.State == "" || tx.Verifier == "" || tx.Nonce == "" || age < 0 || age >= int64(transactionLifetime.Seconds()) {
		return tx, errors.New("invalid or expired OAuth transaction")
	}
	return tx, nil
}

func randomToken() string {
	return rand.Text()
}

func (h *Handler) cookieName(name string) string {
	if h.localHTTP {
		return strings.TrimPrefix(name, "__Host-")
	}
	return name
}

func (h *Handler) newCookie(name, value string, maxAge int) *http.Cookie {
	return &http.Cookie{Name: h.cookieName(name), Value: value, Path: "/", Secure: !h.localHTTP, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: maxAge}
}

func respondError(c *gin.Context, status int, code string) {
	c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"code": code, "message": "Sign-in could not be completed."}})
}
