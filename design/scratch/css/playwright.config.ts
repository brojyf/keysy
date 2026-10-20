import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.browser.ts',
  outputDir: '../test-results',
  fullyParallel: true,
  workers: 2,
  timeout: 60_000,
  use: { actionTimeout: 10_000, baseURL: 'http://127.0.0.1:4189', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: {
    command: 'bun run build && bun run preview --host 127.0.0.1 --port 4189 --strictPort',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    url: 'http://127.0.0.1:4189',
    timeout: 120_000,
  },
});
