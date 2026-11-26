// Package resend sends template emails through the Resend API.
package resend

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

const BaseURL = "https://api.resend.com"

// Email is the whole request body. The template supplies from and subject as defaults.
type Email struct {
	To       string   `json:"to"`
	Template Template `json:"template"`
}

// Template ID is the template's ID or alias. Variables pass through unchanged.
type Template struct {
	ID        string          `json:"id"`
	Variables json.RawMessage `json:"variables,omitempty"`
}

type Client struct {
	BaseURL, APIKey string
	HTTP            *http.Client
}

// Error is a response other than 2xx. Name is Resend's error name, empty when the body has none.
type Error struct {
	Status int
	Name   string
}

func (e *Error) Error() string { return fmt.Sprintf("resend returned %d %s", e.Status, e.Name) }

// Send posts one email. Resend returns the first response for a repeated
// idempotency key within 24 hours instead of sending again.
func (c Client) Send(ctx context.Context, idempotencyKey string, email Email) error {
	body, err := json.Marshal(email)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+c.APIKey)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Idempotency-Key", idempotencyKey)
	response, err := c.HTTP.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return nil
	}
	var failure struct {
		Name string `json:"name"`
	}
	// A body that is not JSON still leaves the status to classify the error.
	_ = json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&failure)
	return &Error{Status: response.StatusCode, Name: failure.Name}
}

// Retryable reports whether sending the same request again may succeed:
// network errors, 5xx, the per-second rate limit, and a concurrent request with the same key.
// Quota errors and other 4xx fail again until someone changes the account or the request.
func Retryable(err error) bool {
	var failure *Error
	if !errors.As(err, &failure) {
		return true
	}
	switch {
	case failure.Status >= 500:
		return true
	case failure.Status == http.StatusTooManyRequests:
		return failure.Name == "rate_limit_exceeded"
	case failure.Status == http.StatusConflict:
		return failure.Name == "concurrent_idempotent_requests"
	}
	return false
}

// Reason names a failure for logs without the response message, which may contain the address.
func Reason(err error) string {
	var failure *Error
	if !errors.As(err, &failure) {
		return "network"
	}
	if failure.Name != "" {
		return failure.Name
	}
	return fmt.Sprintf("http_%d", failure.Status)
}
