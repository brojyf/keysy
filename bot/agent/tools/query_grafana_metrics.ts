import { defineTool } from "eve/tools";
import { z } from "zod";
import { withUtcTimes } from "../lib/utc_times";

// Grafana Cloud stack earnestsalad2096. The user is the Prometheus instance ID, not a secret.
const prometheusQueryUrl = "https://prometheus-prod-67-prod-us-west-0.grafana.net/api/prom/api/v1/query";
const prometheusUser = "3678847";

type PrometheusResponse =
  | { status: "success"; data: { resultType: string; result: unknown } }
  | { status: "error"; errorType: string; error: string };

export default defineTool({
  description: `Run one instant PromQL query against Grafana Cloud Prometheus and return the result.
Use it for HTTP traffic of keysy-api and keysy-auth: request rate, latency, and error ratio.

Metrics:
- http_server_request_duration_seconds: histogram of HTTP request durations, in seconds. Use its _count, _sum, and _bucket series.
- Labels: job (keysy-api or keysy-auth), http_route, http_request_method, http_response_status_code.
- Always filter with job, such as {job="keysy-api"} or {job=~"keysy-api|keysy-auth"}.
- Always aggregate with sum by (...). Never return raw series: one raw _bucket query returns hundreds of series.
- Requests that match no route, such as 404s for unknown paths, have no http_route.

How to query:
- The query is evaluated at the current time and returns one value per series.
- Traffic is low and the Fly machine auto-stops when idle. Use windows of 1h or longer, such as [1h] or [1d]. An empty result means no matching requests in the window, such as no 5xx responses. It is not an error.
- For counts over a window, use increase(). Values can be fractional because of extrapolation. Round them.
- For a value over time, use a subquery such as (<expr>)[1d:1h].
- Each result value is [UTC time, "string number"]. Convert seconds to ms and ratios to percent.

Examples:
- Requests per service in the last day: sum by (job) (increase(http_server_request_duration_seconds_count{job=~"keysy-api|keysy-auth"}[1d]))
- 5xx responses per route in the last day: sum by (job, http_route) (increase(http_server_request_duration_seconds_count{job=~"keysy-api|keysy-auth",http_response_status_code=~"5.."}[1d]))
- 5xx ratio per service in the last day: sum by (job) (increase(http_server_request_duration_seconds_count{job=~"keysy-api|keysy-auth",http_response_status_code=~"5.."}[1d])) / sum by (job) (increase(http_server_request_duration_seconds_count{job=~"keysy-api|keysy-auth"}[1d]))
- p95 latency per service in the last day: histogram_quantile(0.95, sum by (job, le) (rate(http_server_request_duration_seconds_bucket{job=~"keysy-api|keysy-auth"}[1d])))
- Average latency per route in the last day: sum by (job, http_route) (rate(http_server_request_duration_seconds_sum{job=~"keysy-api|keysy-auth"}[1d])) / sum by (job, http_route) (rate(http_server_request_duration_seconds_count{job=~"keysy-api|keysy-auth"}[1d]))

On a query error, read the message, fix the PromQL, and call the tool again.`,
  inputSchema: z.object({
    query: z.string().min(1).describe("A PromQL expression."),
  }),
  label: { start: () => "Query Grafana metrics" },
  async execute({ query }, ctx) {
    const token = process.env.GRAFANA_TOKEN;
    if (!token) throw new Error("GRAFANA_TOKEN is not set");

    const url = new URL(prometheusQueryUrl);
    url.searchParams.set("query", query);
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${btoa(`${prometheusUser}:${token}`)}` },
      signal: ctx.abortSignal,
    });
    const body = (await response.json().catch(() => null)) as PrometheusResponse | null;
    if (body?.status === "error") throw new Error(`${body.errorType}: ${body.error}`);
    if (body?.status !== "success") throw new Error(`Grafana Prometheus returned HTTP ${response.status}`);
    const { resultType, result } = body.data;
    return { resultType, result: withUtcTimes(resultType, result) };
  },
});
