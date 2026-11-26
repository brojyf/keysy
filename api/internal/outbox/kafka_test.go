package outbox

import (
	"testing"

	"github.com/brojyf/keysy/api/internal/config"
)

func TestNewKafkaClientLoadsEmbeddedCA(t *testing.T) {
	client, err := NewKafkaClient(config.Kafka{Brokers: []string{"kafka.test:12345"}, Username: "relay", Password: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	client.Close()
}
