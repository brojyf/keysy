import { afterEach, expect, mock, setSystemTime, test } from "bun:test";

const { default: queryFlyLogs } = await import("../agent/tools/query_fly_logs");

const execute = queryFlyLogs.execute as (
  input: { since: string; contains?: string; limit: number },
  ctx: { abortSignal: AbortSignal },
) => Promise<unknown>;
const ctx = { abortSignal: new AbortController().signal };
const originalFetch = globalThis.fetch;

function logLine(timestamp: string, message: string, provider = "app") {
  return { attributes: { timestamp, message, meta: { event: { provider } } } };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  setSystemTime();
  delete process.env.FLY_API_TOKEN;
});

test("pages forward from since and drops HTTP request lines and ANSI codes", async () => {
  process.env.FLY_API_TOKEN = "FlyV1 fm2_token";
  setSystemTime(new Date("2026-11-27T08:00:00Z"));
  const fullPage = Array.from({ length: 99 }, (_, i) =>
    logLine(`2026-11-27T07:01:${String(i % 60).padStart(2, "0")}Z`, '{"time":"x","level":"INFO","msg":"request","status":200}'),
  );
  fullPage.push(logLine("2026-11-27T07:30:00Z", "Machine created and started in 3.241s", "runner"));
  const lastPage = [logLine("2026-11-27T07:40:00Z", "\x1b[32m INFO\x1b[0m Main child exited normally with code: 0")];
  const fetchMock = mock(async (url: string | URL | Request, _init?: RequestInit) =>
    Response.json(
      new URL(String(url)).searchParams.get("next_token") === "page2"
        ? { data: lastPage, meta: { next_token: "page3" } }
        : { data: fullPage, meta: { next_token: "page2" } },
    ),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const output = await execute({ since: "1h", limit: 50 }, ctx);

  const [firstUrl, init] = fetchMock.mock.calls[0]!;
  const sent = new URL(String(firstUrl));
  expect(sent.origin + sent.pathname).toBe("https://api.fly.io/api/v1/apps/keysy/logs");
  expect(sent.searchParams.get("next_token")).toBe(String(BigInt(Date.parse("2026-11-27T07:00:00Z")) * 1_000_000n));
  expect(new Headers(init?.headers).get("Authorization")).toBe("FlyV1 fm2_token");
  expect(new URL(String(fetchMock.mock.calls[1]![0])).searchParams.get("next_token")).toBe("page2");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(output).toEqual({
    complete: true,
    lines: [
      { time: "2026-11-27T07:30:00Z", provider: "runner", message: "Machine created and started in 3.241s" },
      { time: "2026-11-27T07:40:00Z", provider: "app", message: " INFO Main child exited normally with code: 0" },
    ],
  });
});

test("keeps only lines that contain the text, ignoring case, and the newest up to limit", async () => {
  process.env.FLY_API_TOKEN = "FlyV1 fm2_token";
  const data = [
    logLine("2026-11-27T07:00:00Z", "Out of memory: Killed process 610 (otelcol)"),
    logLine("2026-11-27T07:10:00Z", "nginx started"),
    logLine("2026-11-27T07:20:00Z", "Out of memory: Killed process 720 (api)"),
  ];
  globalThis.fetch = (async () => Response.json({ data, meta: { next_token: "" } })) as unknown as typeof fetch;

  const output = await execute({ since: "24h", contains: "OUT OF MEMORY", limit: 1 }, ctx);

  expect(output).toEqual({
    complete: true,
    lines: [{ time: "2026-11-27T07:20:00Z", provider: "app", message: "Out of memory: Killed process 720 (api)" }],
  });
});

test("stops after 100 pages and reports the result as incomplete", async () => {
  process.env.FLY_API_TOKEN = "FlyV1 fm2_token";
  const fullPage = Array.from({ length: 100 }, () => logLine("2026-11-27T07:00:00Z", "otelcol info"));
  const fetchMock = mock(async () => Response.json({ data: fullPage, meta: { next_token: "next" } }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const output = (await execute({ since: "7d", limit: 1 }, ctx)) as { complete: boolean };

  expect(fetchMock).toHaveBeenCalledTimes(100);
  expect(output.complete).toBe(false);
});

test("accepts since only within the 7 days Fly keeps", () => {
  const inputSchema = queryFlyLogs.inputSchema as unknown as { safeParse(input: unknown): { success: boolean } };
  const accepts = (since: string) => inputSchema.safeParse({ since }).success;

  expect(accepts("1m")).toBe(true);
  expect(accepts("7d")).toBe(true);
  expect(accepts("168h")).toBe(true);
  expect(accepts("0m")).toBe(false);
  expect(accepts("169h")).toBe(false);
  expect(accepts("30d")).toBe(false);
  expect(accepts(`${"9".repeat(400)}d`)).toBe(false);
});

test("reports the HTTP status when the token is rejected", async () => {
  process.env.FLY_API_TOKEN = "FlyV1 fm2_wrong";
  globalThis.fetch = (async () => new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;

  await expect(execute({ since: "1h", limit: 50 }, ctx)).rejects.toThrow("Fly logs returned HTTP 401");
});

test("fails without FLY_API_TOKEN", async () => {
  await expect(execute({ since: "1h", limit: 50 }, ctx)).rejects.toThrow("FLY_API_TOKEN is not set");
});
