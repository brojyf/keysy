import { afterEach, expect, mock, test } from "bun:test";

const { default: queryCloudflareAnalytics } = await import("../agent/tools/query_cloudflare_analytics");

const execute = queryCloudflareAnalytics.execute as (
  input: { query: string; variables?: Record<string, unknown> },
  ctx: { abortSignal: AbortSignal },
) => Promise<unknown>;
const ctx = { abortSignal: new AbortController().signal };
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.CLOUDFLARE_TOKEN;
});

test("sends the GraphQL query to Cloudflare with a bearer token and returns the data", async () => {
  process.env.CLOUDFLARE_TOKEN = "cf_token";
  const data = {
    viewer: {
      zones: [
        {
          httpRequestsAdaptiveGroups: [
            { count: 7, dimensions: { clientRequestHTTPHost: "api.keysy.net", edgeResponseStatus: 522 } },
          ],
        },
      ],
    },
  };
  const fetchMock = mock(async (_url: string | URL | Request, _init?: RequestInit) =>
    Response.json({ data, errors: null }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  const query = "query($start: Time) { viewer { zones { httpRequestsAdaptiveGroups(limit: 1) { count } } } }";
  const variables = { start: "2026-11-27T00:00:00Z" };

  const output = await execute({ query, variables }, ctx);

  const [url, init] = fetchMock.mock.calls[0]!;
  expect(String(url)).toBe("https://api.cloudflare.com/client/v4/graphql");
  expect(init?.method).toBe("POST");
  expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer cf_token");
  expect(JSON.parse(String(init?.body))).toEqual({ query, variables });
  expect(output).toEqual(data);
});

test("passes GraphQL errors to the model so it can fix the query", async () => {
  process.env.CLOUDFLARE_TOKEN = "cf_token";
  globalThis.fetch = (async () =>
    Response.json({
      data: null,
      errors: [{ message: 'unknown field "edgeStatus"' }, { message: "query time range is too large" }],
    })) as unknown as typeof fetch;

  await expect(execute({ query: "{ viewer { zones { x } } }" }, ctx)).rejects.toThrow(
    'unknown field "edgeStatus"; query time range is too large',
  );
});

test("reports the HTTP status when the token is rejected", async () => {
  process.env.CLOUDFLARE_TOKEN = "cf_wrong";
  globalThis.fetch = (async () => new Response("Forbidden", { status: 403 })) as unknown as typeof fetch;

  await expect(execute({ query: "{ viewer { zones { x } } }" }, ctx)).rejects.toThrow(
    "Cloudflare GraphQL returned HTTP 403",
  );
});

test("fails when the response has no data", async () => {
  process.env.CLOUDFLARE_TOKEN = "cf_token";
  globalThis.fetch = (async () => Response.json({ data: null, errors: null })) as unknown as typeof fetch;

  await expect(execute({ query: "{ viewer { zones { x } } }" }, ctx)).rejects.toThrow(
    "Cloudflare GraphQL returned no data",
  );
});

test("fails without CLOUDFLARE_TOKEN", async () => {
  await expect(execute({ query: "{ viewer { zones { x } } }" }, ctx)).rejects.toThrow(
    "CLOUDFLARE_TOKEN is not set",
  );
});
