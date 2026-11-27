import { afterEach, expect, mock, test } from "bun:test";

const { default: queryGrafanaMetrics } = await import("../agent/tools/query_grafana_metrics");

const execute = queryGrafanaMetrics.execute as (
  input: { query: string },
  ctx: { abortSignal: AbortSignal },
) => Promise<unknown>;
const ctx = { abortSignal: new AbortController().signal };
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.GRAFANA_TOKEN;
});

test("sends the PromQL query to Grafana Cloud Prometheus with basic auth and returns UTC times", async () => {
  process.env.GRAFANA_TOKEN = "glc_token";
  const result = [{ metric: { job: "keysy-api" }, value: [1795817848.471, "131"] }];
  const fetchMock = mock(async (_url: string | URL | Request, _init?: RequestInit) =>
    Response.json({ status: "success", data: { resultType: "vector", result } }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  const query = 'sum by (job) (increase(http_server_request_duration_seconds_count{job="keysy-api"}[1d]))';

  const output = await execute({ query }, ctx);

  const [url, init] = fetchMock.mock.calls[0]!;
  const sent = new URL(String(url));
  expect(sent.origin + sent.pathname).toBe(
    "https://prometheus-prod-67-prod-us-west-0.grafana.net/api/prom/api/v1/query",
  );
  expect(Object.fromEntries(sent.searchParams)).toEqual({ query });
  expect(new Headers(init?.headers).get("Authorization")).toBe(`Basic ${btoa("3678847:glc_token")}`);
  expect(output).toEqual({
    resultType: "vector",
    result: [{ metric: { job: "keysy-api" }, value: ["2026-11-27T22:17:28.471Z", "131"] }],
  });
});

test("passes PromQL errors to the model so it can fix the query", async () => {
  process.env.GRAFANA_TOKEN = "glc_token";
  globalThis.fetch = (async () =>
    Response.json(
      { status: "error", errorType: "bad_data", error: "1:5: parse error: unexpected end of input inside braces" },
      { status: 400 },
    )) as unknown as typeof fetch;

  await expect(execute({ query: "bad{" }, ctx)).rejects.toThrow(
    "bad_data: 1:5: parse error: unexpected end of input inside braces",
  );
});

test("reports the HTTP status when the token is rejected", async () => {
  process.env.GRAFANA_TOKEN = "glc_wrong";
  globalThis.fetch = (async () =>
    new Response("authentication error: invalid token", { status: 401 })) as unknown as typeof fetch;

  await expect(execute({ query: "up" }, ctx)).rejects.toThrow("Grafana Prometheus returned HTTP 401");
});

test("fails without GRAFANA_TOKEN", async () => {
  await expect(execute({ query: "up" }, ctx)).rejects.toThrow("GRAFANA_TOKEN is not set");
});
