// Package config reads notify's settings from the environment.
package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	KafkaBrokers                              []string
	KafkaUsername, KafkaPassword, KafkaCAFile string
	ResendAPIKey                              string
}

// Load fails when any setting is missing, so notify never runs half-configured.
func Load() (Config, error) {
	c := Config{
		KafkaUsername: os.Getenv("NOTIFY_KAFKA_USERNAME"),
		KafkaPassword: os.Getenv("NOTIFY_KAFKA_PASSWORD"),
		KafkaCAFile:   os.Getenv("KAFKA_CA_FILE"),
		ResendAPIKey:  os.Getenv("RESEND_API_KEY"),
	}
	for _, address := range strings.Split(os.Getenv("KAFKA_BROKERS"), ",") {
		if address = strings.TrimSpace(address); address != "" {
			c.KafkaBrokers = append(c.KafkaBrokers, address)
		}
	}
	if c.KafkaBrokers == nil {
		return c, fmt.Errorf("KAFKA_BROKERS is required")
	}
	for name, value := range map[string]string{
		"NOTIFY_KAFKA_USERNAME": c.KafkaUsername,
		"NOTIFY_KAFKA_PASSWORD": c.KafkaPassword,
		"KAFKA_CA_FILE":         c.KafkaCAFile,
		"RESEND_API_KEY":        c.ResendAPIKey,
	} {
		if strings.TrimSpace(value) == "" {
			return c, fmt.Errorf("%s is required", name)
		}
	}
	return c, nil
}
