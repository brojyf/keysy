# Bot tools TODO

The bot has one tool: `query_fly_metrics`. Fly metrics show how busy the machine is. They do not show why a request failed, or what happens outside the Fly machine. These tools close that gap.

## Rules for every tool

- Run `eve registry search <product> --json` first. Use an existing integration when one fits.
- One tool answers one kind of question from one source. Do not merge sources behind a mode parameter.
- Use a read-only credential. The bot must never hold a credential that can read secret values.
- Add a test like `test/query_fly_metrics.test.ts`, the env var to `README.md`, and the capability to `agent/instructions.md`.

## Tools

Order: most useful first.

- [ ] **`query_grafana_logs`**: LogQL against Grafana Cloud Loki.
  - Answers: errors in the last hour, and the logs of one request ID (the save failure dialog shows it).
  - Source: Loki `query_range`. Credential: Grafana Cloud access policy token with `logs:read`.
  - Open: confirm that production api and auth logs reach Loki through the collector on Fly.
- [ ] **`query_grafana_metrics`**: PromQL against Grafana Cloud Prometheus.
  - Answers: request rate, latency, and 5xx ratio of api and auth.
  - Source: Prometheus `query`. Credential: access policy token with `metrics:read`.
  - Open: use one token with both scopes, or one token per tool.
- [ ] **`query_cloudflare_analytics`**: Cloudflare GraphQL Analytics.
  - Answers: requests and 5xx/52x per host. api.keysy.net and auth.keysy.net are proxied, so this shows errors that never reach Fly (machine down or stopped). Also Worker errors of web, wiki, and dashboard.
  - Source: GraphQL API. Credential: API token with zone Analytics Read and account Analytics Read.
- [ ] **`query_kafka_status`**: Aiven Kafka.
  - Answers: service state, and consumer lag of notify on `keysy.email` (are emails stuck?).
  - Source: Aiven API. Credential: Aiven token.
  - Open: which API returns consumer lag, and whether an Aiven token can be read-only.
- [ ] **`query_audit_db_status`**: Aiven Postgres (audit database).
  - Answers: service state, disk use, and connections.
  - Source: Aiven service metrics API. Not SQL: the bot does not connect to the database.
  - Open: share one Aiven token with `query_kafka_status`.
- [ ] **`query_supabase_status`**: Supabase production project.
  - Answers: project health, database CPU, memory, disk, and connections.
  - Source: Supabase Management API or the project metrics endpoint.
  - Open: the metrics endpoint uses the service role key, which can read the vault. Find a scoped read-only token that cannot read data before building this tool.
