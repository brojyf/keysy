package consumer

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"os"

	"github.com/brojyf/keysy/notify/internal/config"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl/scram"
)

func NewKafkaClient(c config.Config) (*kgo.Client, error) {
	pem, err := os.ReadFile(c.KafkaCAFile)
	if err != nil {
		return nil, err
	}
	ca := x509.NewCertPool()
	if !ca.AppendCertsFromPEM(pem) {
		return nil, errors.New("KAFKA_CA_FILE contains no PEM certificate")
	}
	return kgo.NewClient(kgo.SeedBrokers(c.KafkaBrokers...), kgo.DialTLSConfig(&tls.Config{RootCAs: ca, MinVersion: tls.VersionTLS12}), kgo.SASL(scram.Auth{User: c.KafkaUsername, Pass: c.KafkaPassword}.AsSha512Mechanism()), kgo.ConsumerGroup("notify"), kgo.ConsumeTopics("keysy.email"), kgo.DisableAutoCommit(), kgo.ConsumeResetOffset(kgo.NewOffset().AtStart()))
}
