// Run on Linux with the nginx package from deploy/Dockerfile: default buffers follow the page size.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, get } from "node:http";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const authHost = "auth.keysy.net";
const authCode = "review-secret-code";
const callbackPath = `/v0/auth/callback?code=${authCode}&state=review-state`;
// auth rejects a cookie over 4096 bytes, and a callback response clears a third one.
const largestAuthCookies = [
  "__Host-oauth=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
  `access=${"a".repeat(4096 - "access=".length)}`,
  `refresh=${"r".repeat(4096 - "refresh=".length)}`,
];

const authUpstream = createServer((_, response) => {
  response.writeHead(303, { Location: "https://dashboard.keysy.net/", "Set-Cookie": largestAuthCookies });
  response.end();
});
let nginx;
let nginxLog = "";

function requestAuth(path) {
  return new Promise((resolve, reject) => {
    get({ port: 8000, path, headers: { Host: authHost } }, (response) => {
      response.resume();
      response.on("end", () => resolve(response));
    }).on("error", reject);
  });
}

async function waitFor(condition) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out. nginx log:\n${nginxLog}`);
}

before(async () => {
  await new Promise((resolve) => authUpstream.listen(8080, "127.0.0.1", resolve));
  nginx = spawn("nginx", ["-c", fileURLToPath(new URL("nginx.conf", import.meta.url)), "-g", "daemon off;"]);
  nginx.stderr.on("data", (chunk) => (nginxLog += chunk));
  await waitFor(() => requestAuth("/").then(() => true, () => false));
});

after(() => {
  nginx.kill();
  authUpstream.close();
});

test("passes the largest auth response headers", async () => {
  const response = await requestAuth(callbackPath);
  assert.equal(response.statusCode, 303, nginxLog);
  assert.equal(response.headers["set-cookie"].length, 3);
});

test("keeps authorization codes out of the error log", async () => {
  authUpstream.closeAllConnections();
  await new Promise((resolve) => authUpstream.close(resolve));

  assert.equal((await requestAuth(callbackPath)).statusCode, 502);
  assert.equal((await requestAuth("/v0/auth/google")).statusCode, 502);

  // The second request proves that nginx still logs upstream errors for other auth paths.
  await waitFor(() => nginxLog.includes("/v0/auth/google"));
  assert.ok(!nginxLog.includes(authCode), nginxLog);
});
