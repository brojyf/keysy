// Run on Linux with the supervisor package from deploy/Dockerfile.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
