# AGENTS.md

`notify` consumes email requests from Kafka and sends them through Resend. It
has no HTTP server because it only consumes Kafka messages.

Required environment variables are `KAFKA_BROKERS`,
`NOTIFY_KAFKA_USERNAME`, `NOTIFY_KAFKA_PASSWORD`, `KAFKA_CA_FILE`, and
`RESEND_API_KEY`. `OTEL_EXPORTER_OTLP_ENDPOINT` is optional.

The service retries network errors, 5xx, 429 `rate_limit_exceeded`, and 409
`concurrent_idempotent_requests` up to three times with 1s, 2s, and 4s delays.
It drops other failures, messages older than 24 hours, and malformed messages,
then commits the offset. There is no dead-letter topic. The
"notify email dropped" log line is what the Grafana alert matches. Never log
email addresses or Resend error messages.

Run `gofmt -l .`, `go vet ./...`, `go test -race ./...`, and `go build ./...`.
Tests must not call live services.
