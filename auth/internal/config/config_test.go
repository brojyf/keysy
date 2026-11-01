package config

import (
	"encoding/base64"
	"strings"
	"testing"
)

func setEnvironment(t *testing.T) {
	t.Helper()
	for name, value := range map[string]string{
		"PORT": "", "AUTH_URL": "https://auth.keysy.test/", "WEB_APP_URL": "https://app.keysy.test/",
		"SUPABASE_URL": "https://project.supabase.co/", "SUPABASE_PUBLISHABLE_KEY": "publishable-key",
		"GOOGLE_CLIENT_ID": "google-client", "GOOGLE_CLIENT_SECRET": "google-secret",
		"OAUTH_COOKIE_KEY": base64.StdEncoding.EncodeToString([]byte(strings.Repeat("k", 32))),
	} {
		t.Setenv(name, value)
	}
}

func TestLoadValidatesConfiguration(t *testing.T) {
	setEnvironment(t)
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if c.Port != "8080" || c.AuthURL != "https://auth.keysy.test" || len(c.CookieKey) != 32 {
		t.Fatalf("unexpected configuration: %+v", c)
	}
	for _, item := range []struct{ name, value string }{
		{"AUTH_URL", ""}, {"AUTH_URL", "http://auth.keysy.test"}, {"AUTH_URL", "https://auth.keysy.test/path"},
		{"AUTH_URL", "https://user:secret@auth.keysy.test"}, {"WEB_APP_URL", "//app.keysy.test"},
		{"WEB_APP_URL", "https://app.keysy.test/?token=secret"}, {"SUPABASE_URL", "https://project.supabase.co/#fragment"},
		{"SUPABASE_PUBLISHABLE_KEY", ""}, {"GOOGLE_CLIENT_ID", ""}, {"GOOGLE_CLIENT_SECRET", ""},
		{"OAUTH_COOKIE_KEY", "bad"}, {"OAUTH_COOKIE_KEY", base64.StdEncoding.EncodeToString([]byte("short"))},
		{"PORT", "-1"}, {"PORT", "65536"}, {"PORT", "invalid"},
	} {
		t.Run(item.name+"/"+item.value, func(t *testing.T) {
			setEnvironment(t)
			t.Setenv(item.name, item.value)
			if _, err := Load(); err == nil {
				t.Error("accepted invalid configuration")
			}
		})
	}
}

func TestAllowsHTTPOnlyForLocalBrowserDevelopment(t *testing.T) {
	for _, name := range []string{"AUTH_URL", "WEB_APP_URL", "SUPABASE_URL"} {
		for _, address := range []string{"http://localhost:5173", "http://localhost.attacker.test:5173", "http://auth.keysy.test"} {
			t.Run(name+"/"+address, func(t *testing.T) {
				setEnvironment(t)
				t.Setenv(name, address)
				_, err := Load()
				allowed := name != "SUPABASE_URL" && address == "http://localhost:5173"
				if (err == nil) != allowed {
					t.Fatalf("allowed = %v, error = %v", allowed, err)
				}
			})
		}
	}
}
