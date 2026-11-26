package consumer

import (
	"github.com/brojyf/keysy/notify/internal/config"
	"os"
	"path/filepath"
	"testing"
)

func TestNewKafkaClient(t *testing.T) {
	path := filepath.Join(t.TempDir(), "invalid.pem")
	if err := os.WriteFile(path, []byte("not a certificate"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		path string
		ok   bool
	}{{"../../../deploy/aiven-ca.pem", true}, {filepath.Join(t.TempDir(), "missing"), false}, {path, false}} {
		client, err := NewKafkaClient(config.Config{KafkaCAFile: tc.path, KafkaBrokers: []string{"localhost:9092"}})
		if (err == nil) != tc.ok {
			t.Errorf("%s: %v", tc.path, err)
		}
		if client != nil {
			client.Close()
		}
	}
}
