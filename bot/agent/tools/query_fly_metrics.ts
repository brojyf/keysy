import { defineTool } from "eve/tools";
import { z } from "zod";

const prometheusQueryUrl = "https://api.fly.io/prometheus/personal/api/v1/query";

type PrometheusResponse =
  | { status: "success"; data: { resultType: string; result: unknown } }
  | { status: "error"; errorType: string; error: string };

export default defineTool({
  description: `Run one instant PromQL query against Fly.io's managed Prometheus and return the result.
Use it for live health questions about the Keysy Fly app: memory, CPU, load, uptime.

Target:
- App "keysy": one shared-cpu-1x machine (256 MB) in sjc that runs api, auth, and the OTel collector.
- Always filter with {app="keysy"}. Series also carry the labels instance (machine ID) and region.

Metrics:
- fly_instance_memory_mem_total, fly_instance_memory_mem_available: gauges, bytes.
- fly_instance_cpu: counter, CPU time in centiseconds, labels cpu and mode (idle, user, system, iowait, steal, ...). Always wrap it in rate().
- fly_instance_load_average: gauge, label minutes (1, 5, 15).
- fly_instance_uptime_seconds: gauge, seconds since the machine started.
- fly_instance_up: 1 while the machine reports metrics.

How to query:
- The query is evaluated at the current time and returns one value per series.
- The machine auto-stops when idle. Then a plain query returns an empty result. This is not an error. Retry with last_over_time(<metric>[1d]) to get the last known value.
- For a peak or low over a period, use max_over_time / min_over_time. For an expression, use a subquery such as (<expr>)[1d:5m].
- Each result value is [unix_timestamp, "string number"]. Convert bytes to MB and ratios to percent. Report the timestamp when the value is not current.

Examples:
- Memory used, as a ratio: 1 - last_over_time(fly_instance_memory_mem_available{app="keysy"}[1d]) / last_over_time(fly_instance_memory_mem_total{app="keysy"}[1d])
- Lowest available memory in the last day: min_over_time(fly_instance_memory_mem_available{app="keysy"}[1d])
- CPU busy percent now: 100 * sum by (instance) (rate(fly_instance_cpu{app="keysy",mode!="idle"}[5m])) / sum by (instance) (rate(fly_instance_cpu{app="keysy"}[5m]))
- Peak CPU busy percent in the last day: max_over_time((100 * sum by (instance) (rate(fly_instance_cpu{app="keysy",mode!="idle"}[5m])) / sum by (instance) (rate(fly_instance_cpu{app="keysy"}[5m])))[1d:5m])
- Load average: last_over_time(fly_instance_load_average{app="keysy"}[1d])
- Uptime: last_over_time(fly_instance_uptime_seconds{app="keysy"}[1d])

On a query error, read the message, fix the PromQL, and call the tool again.`,
  inputSchema: z.object({
    query: z.string().min(1).describe("A PromQL expression."),
  }),
  label: { start: ({ query }) => `Query Fly metrics: ${query}` },
  async execute({ query }, ctx) {
    // The value is the full output of `fly tokens create readonly`, including the "FlyV1 " scheme.
    const token = process.env.FLY_API_TOKEN;
    if (!token) throw new Error("FLY_API_TOKEN is not set");

    const url = new URL(prometheusQueryUrl);
    url.searchParams.set("query", query);
    const response = await fetch(url, {
      headers: { Authorization: token },
      signal: ctx.abortSignal,
    });
    const body = (await response.json().catch(() => null)) as PrometheusResponse | null;
    if (!body) throw new Error(`Fly Prometheus returned HTTP ${response.status}`);
    if (body.status === "error") throw new Error(`${body.errorType}: ${body.error}`);
    return body.data;
  },
});
