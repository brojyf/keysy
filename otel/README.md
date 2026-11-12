# OpenTelemetry Collector

api and auth send OTLP/HTTP to this collector on port 4318. The collector
forwards traces, metrics, and logs to Grafana Cloud.

## Configuration

Copy `.env.example` to ignored `.env.local` and fill in the Grafana Cloud OTLP
endpoint and `GRAFANA_CLOUD_OTLP_AUTH`, which is Base64 of
`<instance ID>:<access policy token>`:

```sh
printf '%s:%s' "$INSTANCE_ID" "$TOKEN" | base64
```

The token needs write scopes for metrics, logs, and traces. Never commit it.

## Run locally

```sh
docker build -t keysy-otel .
docker run --rm --env-file .env.local -p 127.0.0.1:4318:4318 keysy-otel
```

Then set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` in
`api/.env.local` and `auth/.env.local`.

## Alerts

`alerts/` holds Grafana-managed alert rules: one warning per service when more
than 1% of its requests return 5xx over 5 minutes. They notify the `discord`
contact point, which holds the Discord webhook URL and lives only in Grafana.
Its title and message use the `keysy.discord.title` and `keysy.discord.message`
templates from `alerts/discord-template.yaml`.

```sh
gcx --context earnestsalad2096 resources push -p alerts
```
