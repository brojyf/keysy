package login

import (
	"errors"
	"net/http"
	"net/url"
	"strings"
)

var errInvalidRequest = errors.New("invalid login request")

func loginQuery(r *http.Request, callback bool) (url.Values, error) {
	if r.ContentLength != 0 || len(r.URL.RawQuery) > 8192 {
		return nil, errInvalidRequest
	}
	if len(r.UserAgent()) > 2048 || !printableASCII(r.UserAgent()) {
		return nil, errInvalidRequest
	}
	query, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return nil, errInvalidRequest
	}
	if !callback {
		if len(query) != 0 {
			return nil, errInvalidRequest
		}
		return query, nil
	}
	for key, values := range query {
		switch key {
		case "code", "state", "error", "error_description", "error_uri", "scope", "authuser", "prompt", "hd", "iss":
		default:
			return nil, errInvalidRequest
		}
		if len(values) != 1 || len(values[0]) > 4096 || !printableASCII(values[0]) {
			return nil, errInvalidRequest
		}
	}
	state := query.Get("state")
	if len(state) < 22 || len(state) > 128 || strings.IndexFunc(state, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '-')
	}) >= 0 {
		return nil, errInvalidRequest
	}
	if (query.Get("code") == "") == (query.Get("error") == "") {
		return nil, errInvalidRequest
	}
	if strings.Contains(query.Get("code"), " ") || strings.Contains(query.Get("error"), " ") {
		return nil, errInvalidRequest
	}
	return query, nil
}

func printableASCII(value string) bool {
	for i := 0; i < len(value); i++ {
		if value[i] < 0x20 || value[i] > 0x7e {
			return false
		}
	}
	return true
}
