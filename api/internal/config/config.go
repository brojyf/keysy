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
	Port, DatabaseURL, SupabaseURL, WebAppURL string
	CookieKey                                 []byte
	LocalHTTP                                 bool
	// Kafka is empty until KAFKA_BROKERS is set; then api runs the outbox relay.
	Kafka Kafka
}

type Kafka struct {
	Brokers            []string
	Username, Password string
	CACert             []byte
}

func Load() (Config, error) {
	c := Config{Port: os.Getenv("PORT"), DatabaseURL: os.Getenv("DATABASE_URL"), SupabaseURL: os.Getenv("SUPABASE_URL"), WebAppURL: os.Getenv("WEB_APP_URL")}
	for name, value := range map[string]string{"DATABASE_URL": c.DatabaseURL, "SUPABASE_URL": c.SupabaseURL, "WEB_APP_URL": c.WebAppURL} {
		if strings.TrimSpace(value) == "" {
			return c, fmt.Errorf("%s is required", name)
		}
	}
	database, err := url.Parse(c.DatabaseURL)
	if err != nil || (database.Scheme != "postgres" && database.Scheme != "postgresql") || database.Hostname() == "" {
		return c, fmt.Errorf("DATABASE_URL must be a PostgreSQL URL")
	}
	for name, value := range map[string]string{"SUPABASE_URL": c.SupabaseURL, "WEB_APP_URL": c.WebAppURL} {
		u, err := url.Parse(value)
		if err != nil {
			return c, fmt.Errorf("%s must be a valid URL", name)
		}
		local := name == "WEB_APP_URL" && u.Scheme == "http" && u.Hostname() == "localhost"
		if (u.Scheme != "https" && !local) || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (name == "SUPABASE_URL" && u.Path != "" && u.Path != "/") {
			return c, fmt.Errorf("%s requires HTTPS except localhost browser URLs; credentials, query, and fragment are forbidden", name)
		}
		if name == "WEB_APP_URL" {
			c.LocalHTTP = local
		}
	}
	if c.Port == "" {
		c.Port = "8081"
	}
	port, err := strconv.Atoi(c.Port)
	if err != nil || port < 1 || port > 65535 {
		return c, fmt.Errorf("PORT must be between 1 and 65535")
	}
	c.CookieKey, err = base64.StdEncoding.DecodeString(os.Getenv("OAUTH_COOKIE_KEY"))
	if err != nil || len(c.CookieKey) != 32 {
		return c, fmt.Errorf("OAUTH_COOKIE_KEY must be a base64-encoded 32-byte key")
	}
	c.SupabaseURL = strings.TrimRight(c.SupabaseURL, "/")
	c.Kafka, err = loadKafka()
	return c, err
}

func loadKafka() (Kafka, error) {
	brokers := strings.TrimSpace(os.Getenv("KAFKA_BROKERS"))
	if brokers == "" {
		return Kafka{}, nil
	}
	k := Kafka{Brokers: strings.Split(brokers, ","), Username: os.Getenv("KAFKA_USERNAME"), Password: os.Getenv("KAFKA_PASSWORD"), CACert: []byte(os.Getenv("KAFKA_CA_CERT"))}
	if k.Username == "" || k.Password == "" || len(k.CACert) == 0 {
		return k, fmt.Errorf("KAFKA_USERNAME, KAFKA_PASSWORD, and KAFKA_CA_CERT are required when KAFKA_BROKERS is set")
	}
	return k, nil
}
