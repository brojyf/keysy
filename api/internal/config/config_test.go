package config

import (
	"encoding/base64"
	"strings"
	"testing"
)

func environment(t *testing.T) {
	t.Helper()
	for name, value := range map[string]string{"PORT": "", "DATABASE_URL": "postgres://user:password@localhost:5432/keysy", "SUPABASE_URL": "https://project.supabase.co/", "WEB_APP_URL": "https://dashboard.keysy.net/", "OAUTH_COOKIE_KEY": base64.StdEncoding.EncodeToString([]byte(strings.Repeat("k", 32)))} {
		t.Setenv(name, value)
	}
}

func TestConfig(t *testing.T) {
	environment(t)
	c, err := Load()
	if err != nil || c.Port != "8081" || c.LocalHTTP || c.SupabaseURL != "https://project.supabase.co" || len(c.CookieKey) != 32 {
		t.Fatalf("unexpected config: %v", err)
	}
	t.Setenv("WEB_APP_URL", "http://localhost:5173/")
	c, err = Load()
	if err != nil || !c.LocalHTTP {
		t.Fatal("local config rejected")
	}
	for _, item := range []struct{ name, value string }{
		{"DATABASE_URL", ""}, {"DATABASE_URL", "https://localhost/db"}, {"DATABASE_URL", "postgres:///db"},
		{"SUPABASE_URL", "http://localhost"}, {"SUPABASE_URL", "https://project.test/path"}, {"SUPABASE_URL", "https://project.test/?key=x"},
		{"WEB_APP_URL", ""}, {"WEB_APP_URL", "http://localhost.evil.test"}, {"WEB_APP_URL", "//dashboard.test"}, {"WEB_APP_URL", "https://user:password@dashboard.test"}, {"WEB_APP_URL", "https://dashboard.test/#x"},
		{"PORT", "0"}, {"PORT", "65536"}, {"PORT", "bad"}, {"OAUTH_COOKIE_KEY", "invalid"}, {"OAUTH_COOKIE_KEY", base64.StdEncoding.EncodeToString([]byte("short"))},
	} {
		t.Run(item.name+item.value, func(t *testing.T) {
			environment(t)
			t.Setenv(item.name, item.value)
			if _, err := Load(); err == nil {
				t.Fatal("accepted invalid configuration")
			}
		})
	}
}
