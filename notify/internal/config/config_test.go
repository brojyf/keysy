package config

import "testing"

func TestLoad(t *testing.T) {
	settings := map[string]string{
		"KAFKA_BROKERS":         "kafka-a.test:12345, kafka-b.test:12345,",
		"NOTIFY_KAFKA_USERNAME": "keysy-notify",
		"NOTIFY_KAFKA_PASSWORD": "secret",
		"KAFKA_CA_FILE":         "/etc/keysy/aiven-ca.pem",
		"RESEND_API_KEY":        "re_test",
	}
	for name, value := range settings {
		t.Setenv(name, value)
	}
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(c.KafkaBrokers) != 2 || c.KafkaBrokers[1] != "kafka-b.test:12345" || c.KafkaUsername != "keysy-notify" || c.KafkaPassword != "secret" || c.KafkaCAFile != "/etc/keysy/aiven-ca.pem" || c.ResendAPIKey != "re_test" {
		t.Fatalf("unexpected config: %+v", c)
	}
	for name := range settings {
		t.Run("missing "+name, func(t *testing.T) {
			t.Setenv(name, " ")
			if _, err := Load(); err == nil {
				t.Fatalf("accepted a blank %s", name)
			}
		})
	}
}
