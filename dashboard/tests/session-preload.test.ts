import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

// The browser reuses a preload only when URL and credentials mode match the app's fetch.
test('index.html preloads the session check that SessionGate sends', () => {
  const preload = read('../index.html').match(/<link rel="preload" as="fetch" crossorigin="use-credentials" href="%VITE_API_URL%(\/[^"]+)">/)
  assert.ok(preload, 'missing session preload')
  assert.ok(read('../src/components/session-gate.tsx').includes(`apiFetch('${preload[1]}'`))
  assert.ok(read('../src/lib/session-refresh.ts').includes("fetchWithTimeout(url, { ...init, credentials: 'include' })"))
})
