import { afterEach, expect, mock, test } from "bun:test";

const { default: queryFlyMetrics } = await import("../agent/tools/query_fly_metrics");

const execute = queryFlyMetrics.execute as (
  input: { query: string },
  ctx: { abortSignal: AbortSignal },
) => Promise<unknown>;
const ctx = { abortSignal: new AbortController().signal };
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.FLY_API_TOKEN;
});

test("sends the PromQL query to Fly's Prometheus API with the token as is", async () => {
  process.env.FLY_API_TOKEN = "FlyV1 fm2_token";
  const result = [{ metric: { app: "keysy" }, value: [1795673789, "0.57"] }];
  const fetchMock = mock(async (_url: string | URL | Request, _init?: RequestInit) =>
    Response.json({ status: "success", data: { resultType: "vector", result } }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const output = await execute({ query: 'fly_instance_memory_mem_total{app="keysy"}' }, ctx);

  const [url, init] = fetchMock.mock.calls[0]!;
  expect(String(url)).toBe(
    "https://api.fly.io/prometheus/personal/api/v1/query?query=fly_instance_memory_mem_total%7Bapp%3D%22keysy%22%7D",
  );
  expect(new Headers(init?.headers).get("Authorization")).toBe("FlyV1 fm2_token");
  expect(output).toEqual({ resultType: "vector", result });
});

test("passes Prometheus errors to the model so it can fix the query", async () => {
  process.env.FLY_API_TOKEN = "FlyV1 fm2_token";
  globalThis.fetch = (async () =>
    Response.json(
      { status: "error", errorType: "bad_data", error: "parse error at char 5" },
      { status: 400 },
    )) as unknown as typeof fetch;

  expect(execute({ query: "bad{" }, ctx)).rejects.toThrow("bad_data: parse error at char 5");
});

test("fails without FLY_API_TOKEN", async () => {
  expect(execute({ query: "up" }, ctx)).rejects.toThrow("FLY_API_TOKEN is not set");
});
