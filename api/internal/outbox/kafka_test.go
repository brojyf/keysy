package outbox

import (
	"os"
	"path/filepath"
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
	if _, err := NewKafkaClient(k); err == nil {
		t.Fatal("accepted a missing CA file")
	}
	k.CAFile = filepath.Join(t.TempDir(), "empty.pem")
	if err := os.WriteFile(k.CAFile, []byte("not a certificate"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := NewKafkaClient(k); err == nil {
		t.Fatal("accepted a CA file without a PEM certificate")
	}
}
