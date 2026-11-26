import { defineTool } from "eve/tools";
import { z } from "zod";
import { withUtcTimes } from "../lib/utc_times";

// Grafana Cloud stack earnestsalad2096. The user is the Loki instance ID, not a secret.
const lokiQueryRangeUrl = "https://logs-prod-021.grafana.net/loki/api/v1/query_range";
const lokiInstantQueryUrl = "https://logs-prod-021.grafana.net/loki/api/v1/query";
const lokiUser = "1835088";

type LokiResponse = { data: { resultType: string; result: unknown } };

export default defineTool({
  description: `Run one LogQL query against Grafana Cloud Loki and return the newest matching entries.
Use it to find errors and to read the logs of one request.

Streams:
- The only indexed label is service_name: keysy-api, keysy-auth, keysy-notify. Every query must select at least one of them. Never use a catch-all selector such as {service_name=~".+"}.
- Other fields are structured metadata. Filter them after the selector with a label filter, such as | severity_text="ERROR".
- keysy-api and keysy-auth: one "request" line per HTTP request, with method, route, status, duration_ms, request_id, trace_id. keysy-api also has user_id.
- keysy-notify: event_id, template, attempts, reason, exception_type, exception_message.
- Every entry has severity_text: DEBUG, INFO, WARN, ERROR.

How to query:
- since is how far back to look, such as 15m, 1h, or 24h. Start short and widen only when the result is empty.
- Results come newest first. Each value is [UTC time, "line"].
- For counts, use a metric query such as count_over_time with instant: true instead of reading many lines. The range in brackets, such as [1h], sets the window, and since is ignored. Each result has one value: [UTC time, "number"].
- The skill "loki" has the full LogQL reference.

Examples:
- Errors and warnings in the last hour: {service_name=~"keysy-api|keysy-auth|keysy-notify"} | severity_text=~"ERROR|WARN"
- All logs of one request ID: {service_name=~"keysy-api|keysy-auth"} | request_id="68263ecb-0582-4645-bdc4-b3f37b5eb873"
- 5xx responses of the api: {service_name="keysy-api"} | status=~"5.."
- 5xx count per route in the last hour, with instant: true: sum by (route) (count_over_time({service_name="keysy-api"} | status=~"5.." [1h]))
- Dropped emails: {service_name="keysy-notify"} | severity_text="ERROR"

On a query error, read the message, fix the LogQL, and call the tool again.`,
  inputSchema: z.object({
    query: z.string().min(1).describe("A LogQL expression."),
    since: z
      .string()
      .regex(/^\d+[mhd]$/)
      .default("1h")
      .describe("How far back to look, such as 15m, 1h, or 24h."),
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of log entries."),
    instant: z
      .boolean()
      .default(false)
      .describe("Evaluate a metric query once, at the current time, instead of over since."),
  }),
  label: { start: () => "Query Grafana logs" },
  async execute({ query, since, limit, instant }, ctx) {
    const token = process.env.GRAFANA_LOGS_TOKEN;
    if (!token) throw new Error("GRAFANA_LOGS_TOKEN is not set");

    const url = new URL(instant ? lokiInstantQueryUrl : lokiQueryRangeUrl);
    url.searchParams.set("query", query);
    if (!instant) url.searchParams.set("since", since);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("direction", "backward");
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${btoa(`${lokiUser}:${token}`)}` },
      signal: ctx.abortSignal,
    });
    // Loki returns errors as plain text, such as a LogQL parse error.
    if (!response.ok) {
      const message = (await response.text().catch(() => "")).trim();
      throw new Error(`Loki returned HTTP ${response.status}: ${message}`);
    }
    // Drop data.stats: it is several KB of query engine statistics the model does not need.
    const { resultType, result } = ((await response.json()) as LokiResponse).data;
    return { resultType, result: withUtcTimes(resultType, result) };
  },
});
