# Bot tools TODO

Fly metrics (`query_fly_metrics`) show how busy the machine is. They do not show why a request failed, or what happens outside the Fly machine. These tools close that gap.

## Rules for every tool

- Run `eve registry search <product> --json` first. Use an existing integration when one fits.
- One tool answers one kind of question from one source. Do not merge sources behind a mode parameter.
- Use a read-only credential. The bot must never hold a credential that can read secret values.
- Add a test like `test/query_fly_metrics.test.ts`, the env var to `README.md`, and the capability to `agent/instructions.md`.

## Tools

Order: most useful first.

- [x] **`query_grafana_logs`**: LogQL against Grafana Cloud Loki.
  - Answers: errors in the last hour, and the logs of one request ID (the save failure dialog shows it).
  - Source: Loki `query_range`. Credential: Grafana Cloud access policy token with `logs:read`.
  - Open: confirm that production api and auth logs reach Loki through the collector on Fly.
- [x] **`query_fly_logs`**: Fly.io app logs.
  - Answers: what happened on the machine that Loki does not show: kernel OOM kills, s6 and init output, nginx and otelcol output, machine start and stop. An OOM-killed process cannot log, and when otelcol stops, Grafana gets nothing. Fly logs still show what happened.
  - Source: `GET https://api.fly.io/api/v1/apps/keysy/logs` (about 7 days of history; flyctl uses it, but it is not officially supported). Credential: the existing `FLY_API_TOKEN` (a read-only token can read it).
  - Not Machines API events: they show only machine lifecycle. A process that s6 restarts never creates an event.
- [x] **`query_grafana_metrics`**: PromQL against Grafana Cloud Prometheus.
  - Answers: request rate, latency, and 5xx ratio of api and auth.
  - Source: Prometheus `query`. Credential: `GRAFANA_TOKEN`.
  - Token: one `keysy-bot` access policy token with `logs:read` and `metrics:read`, in `GRAFANA_TOKEN`, shared with `query_grafana_logs`.
- [x] **`query_cloudflare_analytics`**: Cloudflare GraphQL Analytics.
  - Answers: requests and 5xx/52x per host. api.keysy.net and auth.keysy.net are proxied, so this shows errors that never reach Fly (machine down or stopped). Also page views per host and path from Web Analytics.
  - Source: GraphQL API (`httpRequestsAdaptiveGroups`, `rumPageloadEventsAdaptiveGroups`). Credential: `CLOUDFLARE_TOKEN`, an API token with only Zone Analytics Read and Account Analytics Read.
  - Not Worker errors: web, wiki, and dashboard are assets-only Workers, so `workersInvocationsAdaptive` is empty for them.
- [x] **`query_kafka_lag`**: Aiven Kafka consumer lag.
  - Answers: consumer lag of notify on `keysy.email` (are emails stuck?).
  - Source: Kafka admin requests (Metadata, ListOffsets, OffsetFetch) over SASL. Credential: `KAFKA_PASSWORD` of the Kafka user `keysy-bot`, with only the Kafka-native ACLs Describe on topic `keysy.email` and Describe on group `notify`. It can read offsets, not records.
  - Not the Aiven API: a read-only Aiven token gets 403 on topic offsets (`ServiceKafkaTopicGet`). The Aiven docs give topic access only with `service:data:write`, which can also create and delete topics.
- [ ] **`query_aiven_services`**: Aiven service state and metrics of `keysy-kafka` and `keysy-audit`.
  - Answers: service and node state, CPU, disk, load, and memory.
  - Source: Aiven API (`GET /project/keysy/service/{service}` and `POST .../metrics`). Not SQL: the bot does not connect to the database.
  - Credential: token of the Aiven application user `keysy-bot`, with only `project:services:read` and `service:metrics:read` on the `keysy` project. Tested: service and metrics reads return 200, topic reads and writes return 403, and service user passwords and keys are redacted.
  - Not connections: the metrics API returns only CPU, disk, load, memory, and network.
- [ ] **`query_supabase_status`**: Supabase production project.
  - Answers: project health, database CPU, memory, disk, and connections.
  - Source: Supabase Management API or the project metrics endpoint.
  - Open: the metrics endpoint uses the service role key, which can read the vault. Find a scoped read-only token that cannot read data before building this tool.
