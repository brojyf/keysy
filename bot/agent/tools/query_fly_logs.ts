import { defineTool } from "eve/tools";
import { z } from "zod";

// Not officially supported for external use, but flyctl depends on it. It keeps about 7 days.
const flyLogsUrl = "https://api.fly.io/api/v1/apps/keysy/logs";
const pageSize = 100;
const maxPages = 100;
const sinceUnitMs = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
// Older lines are gone, so a longer since would read 7 days and still report complete.
const maxSinceMs = 7 * sinceUnitMs.d;

function sinceToMs(since: string) {
  return Number(since.slice(0, -1)) * sinceUnitMs[since.at(-1) as keyof typeof sinceUnitMs];
}

type FlyLogsResponse = {
  data: { attributes: { timestamp: string; message: string; meta: { event: { provider: string } } } }[];
  meta: { next_token: string };
};

// api and auth write one JSON "request" line per HTTP request. Loki has them, and they hide everything else.
function isRequestLine(message: string) {
  if (!message.startsWith("{")) return false;
  try {
    return JSON.parse(message).msg === "request";
  } catch {
    return false;
  }
}

export default defineTool({
  description: `Read the Fly.io logs of the Keysy app machine and return the newest matching lines.
Use it for what happens on the machine itself, which Loki does not show:
- Kernel OOM kills ("Out of memory: Killed process"). An OOM-killed process cannot log to Loki.
- s6 and Fly init output: process exits, restarts, "Main child exited", "reboot".
- nginx and otelcol output. When otelcol stops, Loki gets nothing.
- provider "runner": machine created, started, stopped, image pulled (deploys).

How to query:
- HTTP request lines of api and auth are left out. Use query_grafana_logs for requests, errors of a request, and request IDs.
- since is how far back to look, such as 1h, 24h, or 7d. Fly keeps about 7 days, so 7d is the maximum.
- contains keeps only lines that include this text, ignoring case. Use it for long periods, such as "out of memory" or "exited".
- Lines come oldest first. Each line has time (UTC), provider (app or runner), and message.
- complete is false when the period had too many lines to read, and the newest lines are missing. Then use a shorter since.`,
  inputSchema: z.object({
    since: z
      .string()
      .regex(/^\d+[mhd]$/)
      .refine((since) => sinceToMs(since) > 0 && sinceToMs(since) <= maxSinceMs, "since must be between 1m and 7d")
      .default("1h")
      .describe("How far back to look, such as 1h, 24h, or 7d."),
    contains: z.string().optional().describe("Keep only lines that include this text, ignoring case."),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum number of lines, newest kept."),
  }),
  label: { start: () => "Query Fly logs" },
  async execute({ since, contains, limit }, ctx) {
    const token = process.env.FLY_API_TOKEN;
    if (!token) throw new Error("FLY_API_TOKEN is not set");

    const sinceMs = sinceToMs(since);
    // The API pages forward from next_token, a start time in nanoseconds.
    let nextToken = String(BigInt(Date.now() - sinceMs) * 1_000_000n);
    const needle = contains?.toLowerCase();
    const lines: { time: string; provider: string; message: string }[] = [];

    for (let page = 0; page < maxPages; page++) {
      const url = new URL(flyLogsUrl);
      url.searchParams.set("next_token", nextToken);
      const response = await fetch(url, { headers: { Authorization: token }, signal: ctx.abortSignal });
      if (!response.ok) throw new Error(`Fly logs returned HTTP ${response.status}`);
      const body = (await response.json()) as FlyLogsResponse;

      for (const { attributes } of body.data) {
        // Strip ANSI color codes from Fly init output.
        const message = attributes.message.replace(/\x1b\[[0-9;]*m/g, "");
        if (isRequestLine(message)) continue;
        if (needle && !message.toLowerCase().includes(needle)) continue;
        lines.push({ time: attributes.timestamp, provider: attributes.meta.event.provider, message });
      }
      if (body.data.length < pageSize) return { complete: true, lines: lines.slice(-limit) };
      nextToken = body.meta.next_token;
    }
    return { complete: false, lines: lines.slice(-limit) };
  },
});
