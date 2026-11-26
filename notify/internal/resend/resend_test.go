package resend

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSendRequest(t *testing.T) {
	var got *http.Request
	var body string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r
		raw, _ := io.ReadAll(r.Body)
		body = string(raw)
		w.Write([]byte(`{"id":"49a3999c-0ce1-4ea6-ab68-afcd6dc2e794"}`))
	}))
	defer server.Close()
	email := Email{To: "alice@example.com", Template: Template{ID: "deletion-scheduled", Variables: json.RawMessage(`{"DISPLAY_NAME":"Alice","PURGE_DATE":"December 25, 2026"}`)}}
	err := Client{BaseURL: server.URL, APIKey: "re_test", HTTP: server.Client()}.Send(context.Background(), "event-1", email)
	if err != nil {
		t.Fatal(err)
	}
	if got.Method != http.MethodPost || got.URL.Path != "/emails" {
		t.Fatalf("request = %s %s", got.Method, got.URL.Path)
	}
	for header, want := range map[string]string{"Authorization": "Bearer re_test", "Content-Type": "application/json", "Idempotency-Key": "event-1"} {
		if got.Header.Get(header) != want {
			t.Fatalf("%s = %q, want %q", header, got.Header.Get(header), want)
		}
	}
	want := `{"to":"alice@example.com","template":{"id":"deletion-scheduled","variables":{"DISPLAY_NAME":"Alice","PURGE_DATE":"December 25, 2026"}}}`
	if body != want {
		t.Fatalf("body = %s, want %s", body, want)
	}
}

func TestSendErrors(t *testing.T) {
	for _, tc := range []struct {
		status    int
		body      string
		retryable bool
		reason    string
	}{
		{500, `{"statusCode":500,"name":"application_error"}`, true, "application_error"},
		{503, `{"statusCode":503,"name":"service_unavailable"}`, true, "service_unavailable"},
		{502, `bad gateway`, true, "http_502"},
		{429, `{"statusCode":429,"name":"rate_limit_exceeded"}`, true, "rate_limit_exceeded"},
		{429, `{"statusCode":429,"name":"daily_quota_exceeded"}`, false, "daily_quota_exceeded"},
		{429, `{"statusCode":429,"name":"monthly_quota_exceeded"}`, false, "monthly_quota_exceeded"},
		{409, `{"statusCode":409,"name":"concurrent_idempotent_requests"}`, true, "concurrent_idempotent_requests"},
		{409, `{"statusCode":409,"name":"invalid_idempotent_request"}`, false, "invalid_idempotent_request"},
		{422, `{"statusCode":422,"name":"validation_error"}`, false, "validation_error"},
		{401, `{"statusCode":401,"name":"validation_error"}`, false, "validation_error"},
		{403, `{"statusCode":403,"name":"validation_error"}`, false, "validation_error"},
	} {
		t.Run(tc.reason, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.status)
				w.Write([]byte(tc.body))
			}))
			defer server.Close()
			err := Client{BaseURL: server.URL, APIKey: "re_test", HTTP: server.Client()}.Send(context.Background(), "event-1", Email{To: "alice@example.com", Template: Template{ID: "account-deleted"}})
			if err == nil || Retryable(err) != tc.retryable || Reason(err) != tc.reason {
				t.Fatalf("err = %v, retryable = %v, reason = %q", err, Retryable(err), Reason(err))
			}
		})
	}
}

func TestSendNetworkError(t *testing.T) {
	server := httptest.NewServer(http.NotFoundHandler())
	server.Close()
	err := Client{BaseURL: server.URL, APIKey: "re_test", HTTP: http.DefaultClient}.Send(context.Background(), "event-1", Email{To: "alice@example.com", Template: Template{ID: "account-deleted"}})
	if err == nil || !Retryable(err) || Reason(err) != "network" {
		t.Fatalf("err = %v, retryable = %v, reason = %q", err, Retryable(err), Reason(err))
	}
}
