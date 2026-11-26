import { afterEach, expect, mock, test } from "bun:test";

const { default: queryGrafanaLogs } = await import("../agent/tools/query_grafana_logs");

const execute = queryGrafanaLogs.execute as (
  input: { query: string; since: string; limit: number; instant: boolean },
  ctx: { abortSignal: AbortSignal },
) => Promise<unknown>;
const ctx = { abortSignal: new AbortController().signal };
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.GRAFANA_LOGS_TOKEN;
});

test("sends the LogQL query to Loki query_range, newest first, with basic auth", async () => {
  process.env.GRAFANA_LOGS_TOKEN = "glc_token";
  const result = [{ stream: { service_name: "keysy-api" }, values: [["1795731668043607349", "request"]] }];
  const stats = { summary: { totalBytesProcessed: 1024 }, querier: {}, ingester: {}, cache: {} };
  const fetchMock = mock(async (_url: string | URL | Request, _init?: RequestInit) =>
    Response.json({ status: "success", data: { resultType: "streams", result, stats } }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const output = await execute({ query: '{service_name="keysy-api"}', since: "1h", limit: 20, instant: false }, ctx);

  const [url, init] = fetchMock.mock.calls[0]!;
  const sent = new URL(String(url));
  expect(sent.origin + sent.pathname).toBe("https://logs-prod-021.grafana.net/loki/api/v1/query_range");
  expect(Object.fromEntries(sent.searchParams)).toEqual({
    query: '{service_name="keysy-api"}',
    since: "1h",
    limit: "20",
    direction: "backward",
  });
  expect(new Headers(init?.headers).get("Authorization")).toBe(`Basic ${btoa("1835088:glc_token")}`);
  expect(output).toEqual({
    resultType: "streams",
    result: [{ stream: { service_name: "keysy-api" }, values: [["2026-11-26T22:21:08.043Z", "request"]] }],
  });
});

test("sends an instant query to Loki query, without since", async () => {
  process.env.GRAFANA_LOGS_TOKEN = "glc_token";
  const result = [{ metric: { route: "/v0/me" }, value: [1795731668.043, "3"] }];
  const fetchMock = mock(async (_url: string | URL | Request, _init?: RequestInit) =>
    Response.json({ status: "success", data: { resultType: "vector", result } }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  const query = 'sum by (route) (count_over_time({service_name="keysy-api"} | status=~"5.." [1h]))';

  const output = await execute({ query, since: "1h", limit: 20, instant: true }, ctx);

  const sent = new URL(String(fetchMock.mock.calls[0]![0]));
  expect(sent.origin + sent.pathname).toBe("https://logs-prod-021.grafana.net/loki/api/v1/query");
  expect(Object.fromEntries(sent.searchParams)).toEqual({ query, limit: "20", direction: "backward" });
  expect(output).toEqual({
    resultType: "vector",
    result: [{ metric: { route: "/v0/me" }, value: ["2026-11-26T22:21:08.043Z", "3"] }],
  });
});

test("returns matrix timestamps as UTC times", async () => {
  process.env.GRAFANA_LOGS_TOKEN = "glc_token";
  const result = [{ metric: {}, values: [[1795731668, "1"]] }];
  globalThis.fetch = (async () =>
    Response.json({ status: "success", data: { resultType: "matrix", result } })) as unknown as typeof fetch;

  const output = await execute({ query: "count_over_time({service_name=\"keysy-api\"} [5m])", since: "1h", limit: 20, instant: false }, ctx);

  expect(output).toEqual({ resultType: "matrix", result: [{ metric: {}, values: [["2026-11-26T22:21:08.000Z", "1"]] }] });
});

test("passes Loki query errors to the model so it can fix the query", async () => {
  process.env.GRAFANA_LOGS_TOKEN = "glc_token";
  globalThis.fetch = (async () =>
    new Response("parse error at line 1, col 2: syntax error: unexpected IDENTIFIER\n", {
      status: 400,
    })) as unknown as typeof fetch;

  await expect(execute({ query: "{bad", since: "1h", limit: 20, instant: false }, ctx)).rejects.toThrow(
    "Loki returned HTTP 400: parse error at line 1, col 2: syntax error: unexpected IDENTIFIER",
  );
});

test("reports the HTTP status when the token is rejected", async () => {
  process.env.GRAFANA_LOGS_TOKEN = "glc_wrong";
  globalThis.fetch = (async () =>
    new Response("authentication error: invalid token", { status: 401 })) as unknown as typeof fetch;

  await expect(
    execute({ query: '{service_name="keysy-api"}', since: "1h", limit: 20, instant: false }, ctx),
  ).rejects.toThrow("Loki returned HTTP 401: authentication error: invalid token");
});

test("fails without GRAFANA_LOGS_TOKEN", async () => {
  await expect(
    execute({ query: '{service_name="keysy-api"}', since: "1h", limit: 20, instant: false }, ctx),
  ).rejects.toThrow("GRAFANA_LOGS_TOKEN is not set");
});
