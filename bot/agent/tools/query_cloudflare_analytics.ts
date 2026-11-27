import { defineTool } from "eve/tools";
import { z } from "zod";

const graphqlUrl = "https://api.cloudflare.com/client/v4/graphql";

type GraphqlResponse = { data?: unknown; errors?: { message: string }[] | null };

export default defineTool({
  description: `Run one GraphQL query against the Cloudflare GraphQL Analytics API and return its data.
Use it to see what users see at the Cloudflare edge, which the Fly tools and Grafana cannot see:
- HTTP requests per host for the proxied hosts api.keysy.net and auth.keysy.net: request counts and status codes. A 521, 522, or 524 means the origin was down or too slow, and the request never reached Fly.
- Worker invocations, errors, and CPU time of the Worker scripts web, wiki, and dashboard.

Scopes (fixed values, not secrets):
- Zone keysy.net: zoneTag "f293f4e988347da58cfaa9fd3a782280", Free plan. Query it as viewer { zones(filter: {zoneTag: "..."}) { ... } }.
- Account: accountTag "0f6bb93052fe9383f322cdb99ca0421f". Query it as viewer { accounts(filter: {accountTag: "..."}) { ... } }.

Datasets:
- httpRequestsAdaptiveGroups (zone): HTTP requests, grouped.
  - Fields: count (estimated requests, adjusted for sampling), dimensions { datetimeHour datetimeMinute clientRequestHTTPHost edgeResponseStatus }.
  - Filter fields: datetime_geq, datetime_lt, requestSource: "eyeball" (real client requests), clientRequestHTTPHost (or clientRequestHTTPHost_in: [...]), edgeResponseStatus (or edgeResponseStatus_geq and edgeResponseStatus_lt).
  - Always set limit and orderBy: [count_DESC].
  - Requests are sampled, so counts are estimates.
- workersInvocationsAdaptive (account): Worker invocations.
  - Fields: sum { requests errors subrequests }, quantiles { cpuTimeP50 cpuTimeP99 }, dimensions { datetime scriptName status }.
  - Filter fields: datetime_geq, datetime_leq, scriptName.
  - Always set limit. Rows are grouped by second, so keep windows short or sum the rows yourself.

How to query:
- Every query needs an absolute UTC datetime range, such as "2026-11-27T00:00:00Z". GraphQL has no relative times. If you do not know the current UTC time, take it from another tool: query_grafana_metrics with the query time() returns it as UTC.
- Pass times as variables ($start: Time, $end: Time) in variables, or write them in the query.
- Start with a window of 1 day or less. Free-plan limits are not documented for these datasets. On a limit error, narrow the window. To read the limits, query zones(filter: {zoneTag: "..."}) { settings { httpRequestsAdaptiveGroups { enabled availableFields maxDuration maxPageSize notOlderThan } } }.
- Traffic is low. An empty list means no matching requests in the window, such as no 52x responses. It is not an error.
- Convert nothing: datetimes in the result are already ISO UTC strings.

Examples (send the query string, and the variables object when the query uses variables):
- Requests per host and status code in a window, variables {"start": "2026-11-27T00:00:00Z", "end": "2026-11-28T00:00:00Z"}:
  query($start: Time, $end: Time) { viewer { zones(filter: {zoneTag: "f293f4e988347da58cfaa9fd3a782280"}) { httpRequestsAdaptiveGroups(limit: 100, orderBy: [count_DESC], filter: {datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball", clientRequestHTTPHost_in: ["api.keysy.net", "auth.keysy.net"]}) { count dimensions { clientRequestHTTPHost edgeResponseStatus } } } } }
- 52x responses per hour and host (origin down or timeout), same variables:
  query($start: Time, $end: Time) { viewer { zones(filter: {zoneTag: "f293f4e988347da58cfaa9fd3a782280"}) { httpRequestsAdaptiveGroups(limit: 100, orderBy: [count_DESC], filter: {datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball", edgeResponseStatus_geq: 520, edgeResponseStatus_lt: 530}) { count dimensions { datetimeHour clientRequestHTTPHost edgeResponseStatus } } } } }
- Worker requests, errors, and CPU time of one script, variables {"start": "2026-11-27T00:00:00Z", "end": "2026-11-27T06:00:00Z"}:
  query($start: Time, $end: Time) { viewer { accounts(filter: {accountTag: "0f6bb93052fe9383f322cdb99ca0421f"}) { workersInvocationsAdaptive(limit: 1000, filter: {scriptName: "dashboard", datetime_geq: $start, datetime_leq: $end}) { sum { requests errors } quantiles { cpuTimeP50 cpuTimeP99 } dimensions { datetime scriptName status } } } } }

On an error, read the message, fix the GraphQL, and call the tool again.`,
  inputSchema: z.object({
    query: z.string().min(1).describe("A GraphQL query."),
    variables: z.record(z.string(), z.unknown()).optional().describe("Variables of the query, such as the datetime range."),
  }),
  label: { start: () => "Query Cloudflare analytics" },
  async execute({ query, variables }, ctx) {
    const token = process.env.CLOUDFLARE_TOKEN;
    if (!token) throw new Error("CLOUDFLARE_TOKEN is not set");

    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: ctx.abortSignal,
    });
    const body = (await response.json().catch(() => null)) as GraphqlResponse | null;
    // GraphQL reports query errors with HTTP 200, so read the errors before the status.
    if (body?.errors?.length) throw new Error(body.errors.map((error) => error.message).join("; "));
    if (!response.ok) throw new Error(`Cloudflare GraphQL returned HTTP ${response.status}`);
    if (!body?.data) throw new Error("Cloudflare GraphQL returned no data");
    return body.data;
  },
});
