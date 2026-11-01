package config

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port               string
	AuthURL            string
	WebAppURL          string
	SupabaseURL        string
	SupabaseKey        string
	GoogleClientID     string
	GoogleClientSecret string
	CookieKey          []byte
}

func Load() (Config, error) {
	c := Config{
		Port: os.Getenv("PORT"), AuthURL: os.Getenv("AUTH_URL"), WebAppURL: os.Getenv("WEB_APP_URL"),
		SupabaseURL: os.Getenv("SUPABASE_URL"), SupabaseKey: os.Getenv("SUPABASE_PUBLISHABLE_KEY"),
		GoogleClientID: os.Getenv("GOOGLE_CLIENT_ID"), GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
	}
	for name, value := range map[string]string{
		"AUTH_URL": c.AuthURL, "WEB_APP_URL": c.WebAppURL, "SUPABASE_URL": c.SupabaseURL,
		"SUPABASE_PUBLISHABLE_KEY": c.SupabaseKey, "GOOGLE_CLIENT_ID": c.GoogleClientID, "GOOGLE_CLIENT_SECRET": c.GoogleClientSecret,
	} {
		if strings.TrimSpace(value) == "" {
			return c, fmt.Errorf("%s is required", name)
		}
	}
	for name, value := range map[string]string{"AUTH_URL": c.AuthURL, "WEB_APP_URL": c.WebAppURL, "SUPABASE_URL": c.SupabaseURL} {
		u, err := url.Parse(value)
		if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (name != "WEB_APP_URL" && u.Path != "" && u.Path != "/") {
			return c, fmt.Errorf("%s must be an HTTPS URL without credentials, query, or fragment; service URLs must not have a path", name)
		}
	}
	if c.Port == "" {
		c.Port = "8080"
	}
	port, err := strconv.Atoi(c.Port)
	if err != nil || port < 1 || port > 65535 {
		return c, fmt.Errorf("PORT must be between 1 and 65535")
	}
	c.CookieKey, err = base64.StdEncoding.DecodeString(os.Getenv("OAUTH_COOKIE_KEY"))
	if err != nil || len(c.CookieKey) != 32 {
		return c, fmt.Errorf("OAUTH_COOKIE_KEY must be a base64-encoded 32-byte key")
	}
	c.AuthURL = strings.TrimRight(c.AuthURL, "/")
	c.SupabaseURL = strings.TrimRight(c.SupabaseURL, "/")
	return c, nil
}
