package outbox

import (
	"crypto/tls"
	"crypto/x509"
	_ "embed"
	"errors"

	"github.com/brojyf/keysy/api/internal/config"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl/scram"
)

// aivenCA is the public Aiven project CA, the same file as audit/aiven-ca.pem.
//
//go:embed aiven-ca.pem
var aivenCA []byte

// NewKafkaClient connects with TLS and SASL/SCRAM-SHA-512, as Aiven's Go example does.
// franz-go waits for acknowledgments from all in-sync replicas by default; keep that default.
func NewKafkaClient(k config.Kafka) (*kgo.Client, error) {
	ca := x509.NewCertPool()
	if !ca.AppendCertsFromPEM(aivenCA) {
		return nil, errors.New("aiven-ca.pem contains no PEM certificate")
	}
	return kgo.NewClient(
		kgo.SeedBrokers(k.Brokers...),
		kgo.DialTLSConfig(&tls.Config{RootCAs: ca, MinVersion: tls.VersionTLS12}),
		kgo.SASL(scram.Auth{User: k.Username, Pass: k.Password}.AsSha512Mechanism()),
	)
}
