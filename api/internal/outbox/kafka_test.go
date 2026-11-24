package outbox

import (
	"testing"

	"github.com/brojyf/keysy/api/internal/config"
)

func TestNewKafkaClientRejectsInvalidCA(t *testing.T) {
	if _, err := NewKafkaClient(config.Kafka{Brokers: []string{"kafka.test:12345"}, Username: "relay", Password: "secret", CACert: []byte("not a certificate")}); err == nil {
		t.Fatal("accepted a CA without a PEM certificate")
	}
}
