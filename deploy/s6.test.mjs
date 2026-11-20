// Run on Linux with the s6 package from deploy/Dockerfile.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("keeps restarting the api while it exits during startup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "s6-test-"));
  const attemptsFile = join(directory, "attempts");
  const failingApi = join(directory, "failing-api");
  await writeFile(failingApi, `#!/bin/sh\necho attempt >> ${attemptsFile}\nexit 1\n`, { mode: 0o755 });

  const serviceDirectory = join(directory, "api");
  await mkdir(serviceDirectory);
  const run = await readFile(new URL("s6/api/run", import.meta.url), "utf8");
  await writeFile(join(serviceDirectory, "run"), run.replace("/usr/local/bin/keysy-api", failingApi), { mode: 0o755 });

  const supervise = spawn("s6-supervise", [serviceDirectory], { stdio: "ignore" });
  try {
    // s6 waits one second between restarts. Five attempts prove it does not give up after the first few.
    const deadline = Date.now() + 20_000;
    let attempts = 0;
    while (attempts < 5 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts = (await readFile(attemptsFile, "utf8").catch(() => "")).split("\n").length - 1;
    }
    assert.ok(attempts >= 5, `expected at least 5 attempts, got ${attempts}`);
  } finally {
    supervise.kill("SIGKILL");
    await rm(directory, { recursive: true, force: true });
  }
});

test("clears the route cache before Next starts and passes SIGTERM to Next", async () => {
  const directory = await mkdtemp(join(tmpdir(), "s6-test-"));
  const routeCache = join(directory, ".next/server/route-cache");
  const buildManifest = join(directory, ".next/build-manifest.json");
  const startupFile = join(directory, "startup");
  const stoppedFile = join(directory, "stopped");
  const fakeNext = join(directory, "next");
  await mkdir(join(routeCache, "APP_PAGE"), { recursive: true });
  await writeFile(buildManifest, "{}");
  await writeFile(
    fakeNext,
    `#!/bin/sh
trap 'echo stopped > ${stoppedFile}; exit 0' TERM
{ test -e ${routeCache} && echo route-cache-kept || echo route-cache-cleared; test -e ${buildManifest} && echo build-kept; } > ${startupFile}
while :; do sleep 0.1; done
`,
    { mode: 0o755 },
  );

  const run = (await readFile(new URL("s6/dashboard/run", import.meta.url), "utf8"))
    .replace("/app/dashboard/node_modules/.bin/next", fakeNext)
    .replace("cd /app/dashboard", `cd ${directory}`);
  const runFile = join(directory, "run");
  await writeFile(runFile, run, { mode: 0o755 });

  const dashboard = spawn(runFile, [], { stdio: "ignore" });
  const exited = new Promise((resolve) => dashboard.once("exit", resolve));
  try {
    const deadline = Date.now() + 10_000;
    let startup = "";
    while (!startup.includes("build-kept") && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      startup = await readFile(startupFile, "utf8").catch(() => "");
    }
    assert.equal(startup, "route-cache-cleared\nbuild-kept\n");

    // s6-supervise signals the process it started, so the run script must exec into Next.
    dashboard.kill("SIGTERM");
    await exited;
    assert.equal(await readFile(stoppedFile, "utf8"), "stopped\n");
  } finally {
    dashboard.kill("SIGKILL");
    await rm(directory, { recursive: true, force: true });
  }
});
