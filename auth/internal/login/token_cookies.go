package login

import (
	"encoding/base64"
	"net/http"
)

func (h *Handler) newTokenCookie(name, token string, maxAge int) *http.Cookie {
	sealed := h.cipher.Seal(nil, nil, []byte(token), []byte(name))
	return h.newCookie(name, base64.RawURLEncoding.EncodeToString(sealed), maxAge)
}

func (h *Handler) openTokenCookie(name, value string) (string, error) {
	sealed, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}
	token, err := h.cipher.Open(nil, nil, sealed, []byte(name))
	if err != nil {
		return "", err
	}
	return string(token), nil
}
