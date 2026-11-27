import { defineTool } from "eve/tools";
import { z } from "zod";

const graphqlUrl = "https://api.cloudflare.com/client/v4/graphql";

const unitMs: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };
// No dataset accepts a longer query window, so a longer since can only fail.
const maxSinceMs = 93 * unitMs.d!;
const sinceToMs = (since: string) => Number(since.slice(0, -1)) * unitMs[since.slice(-1)]!;
// RFC3339 UTC without milliseconds, such as 2026-11-27T10:00:00Z.
const toRfc3339 = (time: Date) => time.toISOString().replace(/\.\d{3}Z$/, "Z");

type GraphqlResponse = { data?: unknown; errors?: { message: string }[] | null };

export default defineTool({
  description: `Run one GraphQL query against the Cloudflare GraphQL Analytics API and return its data.
Use it to see what users see at the Cloudflare edge, which the Fly tools and Grafana cannot see:
- Status codes and errors of HTTP requests, per host. A 521 or 522 means Cloudflare could not connect to the origin, so the request never reached Fly. A 524 means Cloudflare connected, but the origin did not respond in time, so the request reached Fly: check the Fly and app logs.
- Page views per host and per path, from Cloudflare Web Analytics.

Hosts of keysy.net: keysy.net (the web site), dashboard.keysy.net, wiki.keysy.net, api.keysy.net, auth.keysy.net.

Scopes (fixed values, not secrets):
- Zone keysy.net: zoneTag "f293f4e988347da58cfaa9fd3a782280", Free plan. Query it as viewer { zones(filter: {zoneTag: "..."}) { ... } }.
- Account: accountTag "0f6bb93052fe9383f322cdb99ca0421f". Query it as viewer { accounts(filter: {accountTag: "..."}) { ... } }.

Datasets:
- httpRequestsAdaptiveGroups (zone): every HTTP request to the zone, including assets and bots. Use it for status codes and errors of all hosts: 5xx, 52x, 404 spikes, and requests that drop to 0.
  - Fields: count (estimated requests, adjusted for sampling), sum { visits }, dimensions { date datetimeHour clientRequestHTTPHost edgeResponseStatus }.
  - Filter fields: datetime_geq, datetime_lt, requestSource: "eyeball" (real client requests), clientRequestHTTPHost (or clientRequestHTTPHost_in: [...]), edgeResponseStatus (or edgeResponseStatus_geq and edgeResponseStatus_lt).
  - One query covers up to 30 days, and data goes back 31 days.
- rumPageloadEventsAdaptiveGroups (account): page loads measured in the browser by Web Analytics. Use it for "how much traffic does a site get". It has no JS or CSS assets and few bots.
  - Fields: count (page loads), sum { visits }, dimensions { date requestHost requestPath }.
  - Filter fields: datetime_geq, datetime_lt, requestHost.
  - One query covers up to 93 days, and data goes back 184 days.
- Always set limit and orderBy: [count_DESC] or [date_ASC].
- count vs visits: count is page loads or requests. visits counts only those whose referer is another host, so it is the entries from outside. Neither is a unique visitor count. Unique visitors are not available.

How to query:
- The tool sets $start and $end for you from since (UTC, end = now). Declare them as ($start: Time, $end: Time) and use them in datetime_geq and datetime_lt. Do not write datetimes yourself.
- since is how far back to look, such as 1h, 24h, or 7d. Start with the shortest window that answers the question.
- Traffic is low. An empty list means no matching requests in the window, such as no 52x responses. It is not an error.
- Datetimes in the result are already ISO UTC strings.
- A list with as many items as limit may be cut, and the rest is missing. Then raise limit or use a shorter since, or say in the answer that the result is incomplete.

Examples:
- Requests per host and status code:
  query($start: Time, $end: Time) { viewer { zones(filter: {zoneTag: "f293f4e988347da58cfaa9fd3a782280"}) { httpRequestsAdaptiveGroups(limit: 100, orderBy: [count_DESC], filter: {datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball"}) { count dimensions { clientRequestHTTPHost edgeResponseStatus } } } } }
- 52x responses per hour and host (origin down or timeout):
  query($start: Time, $end: Time) { viewer { zones(filter: {zoneTag: "f293f4e988347da58cfaa9fd3a782280"}) { httpRequestsAdaptiveGroups(limit: 100, orderBy: [count_DESC], filter: {datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball", edgeResponseStatus_geq: 520, edgeResponseStatus_lt: 530}) { count dimensions { datetimeHour clientRequestHTTPHost edgeResponseStatus } } } } }
- Page loads and visits per day and host:
  query($start: Time, $end: Time) { viewer { accounts(filter: {accountTag: "0f6bb93052fe9383f322cdb99ca0421f"}) { rumPageloadEventsAdaptiveGroups(limit: 1000, orderBy: [date_ASC], filter: {datetime_geq: $start, datetime_lt: $end}) { count sum { visits } dimensions { date requestHost } } } } }
- Top paths by page loads for one host:
  query($start: Time, $end: Time) { viewer { accounts(filter: {accountTag: "0f6bb93052fe9383f322cdb99ca0421f"}) { rumPageloadEventsAdaptiveGroups(limit: 20, orderBy: [count_DESC], filter: {datetime_geq: $start, datetime_lt: $end, requestHost: "dashboard.keysy.net"}) { count sum { visits } dimensions { requestPath } } } } }

On an error, read the message, fix the GraphQL, and call the tool again. A time range error means since is too long: use a shorter one.`,
  inputSchema: z.object({
    query: z.string().min(1).describe("A GraphQL query that declares ($start: Time, $end: Time)."),
    since: z
      .string()
      .regex(/^\d+[mhd]$/)
      .refine((since) => sinceToMs(since) > 0 && sinceToMs(since) <= maxSinceMs, "since must be between 1m and 93d")
      .default("24h")
      .describe("How far back to look, such as 1h, 24h, or 7d."),
  }),
  label: { start: () => "Query Cloudflare analytics" },
  async execute({ query, since }, ctx) {
    const token = process.env.CLOUDFLARE_TOKEN;
    if (!token) throw new Error("CLOUDFLARE_TOKEN is not set");

    const end = new Date();
    const start = new Date(end.getTime() - sinceToMs(since));
    const variables = { start: toRfc3339(start), end: toRfc3339(end) };
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
