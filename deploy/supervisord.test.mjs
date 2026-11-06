// Run on Linux with the supervisor package from deploy/Dockerfile.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("keeps restarting the api while it exits during startup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "supervisord-test-"));
  const attemptsFile = join(directory, "attempts");
  const failingApi = join(directory, "failing-api");
  await writeFile(failingApi, `#!/bin/sh\necho attempt >> ${attemptsFile}\nexit 1\n`, { mode: 0o755 });

  const config = await readFile(new URL("supervisord.conf", import.meta.url), "utf8");
  const apiProgram = config.match(/\[program:api\][\s\S]*?(?=\n\[)/)[0].replace(/^command=.*$/m, `command=${failingApi}`);
  const testConfig = join(directory, "supervisord.conf");
  await writeFile(testConfig, `[supervisord]\nnodaemon=true\nlogfile=/dev/null\nlogfile_maxbytes=0\npidfile=${join(directory, "pid")}\n\n${apiProgram}\n`);

  const supervisord = spawn("supervisord", ["-c", testConfig], { stdio: "ignore" });
  try {
    // Supervisor's default startretries stops after four attempts.
    const deadline = Date.now() + 20_000;
    let attempts = 0;
    while (attempts < 5 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts = (await readFile(attemptsFile, "utf8").catch(() => "")).split("\n").length - 1;
    }
    assert.equal(attempts, 5);
  } finally {
    supervisord.kill();
    await rm(directory, { recursive: true, force: true });
  }
});

test("clears the route cache before Next starts and passes SIGTERM to Next", async () => {
  const directory = await mkdtemp(join(tmpdir(), "supervisord-test-"));
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

  const config = await readFile(new URL("supervisord.conf", import.meta.url), "utf8");
  const dashboardProgram = config
    .match(/\[program:dashboard\][\s\S]*?(?=\n\[)/)[0]
    .replace("/app/dashboard/node_modules/.bin/next", fakeNext)
    .replace("directory=/app/dashboard", `directory=${directory}`);
  const testConfig = join(directory, "supervisord.conf");
  await writeFile(testConfig, `[supervisord]\nnodaemon=true\nlogfile=/dev/null\nlogfile_maxbytes=0\npidfile=${join(directory, "pid")}\n\n${dashboardProgram}\n`);

  const supervisord = spawn("supervisord", ["-c", testConfig], { stdio: "ignore" });
  const exited = new Promise((resolve) => supervisord.once("exit", resolve));
  try {
    const deadline = Date.now() + 10_000;
    let startup = "";
    while (!startup.includes("build-kept") && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      startup = await readFile(startupFile, "utf8").catch(() => "");
    }
    assert.equal(startup, "route-cache-cleared\nbuild-kept\n");

    // Supervisor signals its direct child, so that child must be Next.
    supervisord.kill("SIGTERM");
    await exited;
    assert.equal(await readFile(stoppedFile, "utf8"), "stopped\n");
  } finally {
    supervisord.kill("SIGKILL");
    await rm(directory, { recursive: true, force: true });
  }
});
