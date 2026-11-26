package outbox

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/brojyf/keysy/api/internal/config"
)

func TestNewKafkaClientLoadsCAFile(t *testing.T) {
	k := config.Kafka{Brokers: []string{"kafka.test:12345"}, Username: "relay", Password: "secret", CAFile: "../../../deploy/aiven-ca.pem"}
	client, err := NewKafkaClient(k)
	if err != nil {
		t.Fatal(err)
	}
	client.Close()

	k.CAFile = filepath.Join(t.TempDir(), "missing.pem")
	if _, err := NewKafkaClient(k); err == nil || !strings.Contains(err.Error(), "KAFKA_CA_FILE") {
		t.Fatalf("missing CA file error does not name KAFKA_CA_FILE: %v", err)
	}
	k.CAFile = filepath.Join(t.TempDir(), "invalid.pem")
	if err := os.WriteFile(k.CAFile, []byte("not a certificate"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := NewKafkaClient(k); err == nil {
		t.Fatal("accepted a CA file without a PEM certificate")
	}
}
