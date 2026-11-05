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

const authUpstream = createServer((request, response) => {
  lastAuthPath = request.url;
  response.writeHead(303, { Location: "https://dashboard.keysy.net/", "Set-Cookie": largestAuthCookies });
  response.end();
});
// Each echo upstream answers with its name and the path nginx sent.
const echoUpstream = (name) => createServer((request, response) => response.end(`${name} ${request.url}`));
const apiUpstream = echoUpstream("api");
const dashboardUpstream = echoUpstream("dashboard");
let lastAuthPath;
let nginx;
let nginxLog = "";

function requestHost(host, path) {
  return new Promise((resolve, reject) => {
    get({ port: 8000, path, headers: { Host: host } }, (response) => {
      let body = "";
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => resolve({ statusCode: response.statusCode, headers: response.headers, body }));
    }).on("error", reject);
  });
}

const requestAuth = (path) => requestHost(authHost, path);

async function waitFor(condition) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out. nginx log:\n${nginxLog}`);
}

before(async () => {
  await new Promise((resolve) => authUpstream.listen(8080, "127.0.0.1", resolve));
  await new Promise((resolve) => apiUpstream.listen(8081, "127.0.0.1", resolve));
  await new Promise((resolve) => dashboardUpstream.listen(5173, "127.0.0.1", resolve));
  nginx = spawn("nginx", ["-c", fileURLToPath(new URL("nginx.conf", import.meta.url)), "-g", "daemon off;"]);
  nginx.stderr.on("data", (chunk) => (nginxLog += chunk));
  await waitFor(() => requestAuth("/").then(() => true, () => false));
});

after(() => {
  nginx.kill();
  authUpstream.close();
  apiUpstream.close();
  dashboardUpstream.close();
});

test("passes the largest auth response headers", async () => {
  const response = await requestAuth(callbackPath);
  assert.equal(response.statusCode, 303, nginxLog);
  assert.equal(response.headers["set-cookie"].length, 3);
});

test("routes each host to its service", async () => {
  assert.equal((await requestHost("api.keysy.net", "/v0/me")).body, "api /v0/me");
  assert.equal((await requestHost("dashboard.keysy.net", "/secrets")).body, "dashboard /secrets");
});

test("serves health paths on the default server", async () => {
  assert.equal((await requestHost("machine.internal", "/health/api")).body, "api /health");
  await requestHost("machine.internal", "/health/auth");
  assert.equal(lastAuthPath, "/health");
});

test("returns 404 for unknown hosts", async () => {
  assert.equal((await requestHost("unknown.example", "/")).statusCode, 404);
});

// This test stops the auth upstream, so it stays last.
test("keeps authorization codes out of the error log", async () => {
  authUpstream.closeAllConnections();
  await new Promise((resolve) => authUpstream.close(resolve));

  assert.equal((await requestAuth(callbackPath)).statusCode, 502);
  assert.equal((await requestAuth("/v0/auth/google")).statusCode, 502);

  // The second request proves that nginx still logs upstream errors for other auth paths.
  await waitFor(() => nginxLog.includes("/v0/auth/google"));
  assert.ok(!nginxLog.includes(authCode), nginxLog);
});
