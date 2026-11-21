import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { HtmlTagDescriptor } from 'vite'
import { sessionPreload } from '../vite.config.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const preloadTags = (env: Record<string, string>) => (sessionPreload(env).transformIndexHtml as () => HtmlTagDescriptor[])()

// The browser reuses a preload only when URL and credentials mode match the app's fetch.
test('the session preload matches the request that SessionGate sends', () => {
  assert.ok(read('../src/components/session-gate.tsx').includes("apiFetch('/v0/me'"))
  assert.ok(read('../src/lib/session-refresh.ts').includes("fetchWithTimeout(url, { ...init, credentials: 'include' })"))
  for (const [env, href] of [
    [{ VITE_API_URL: 'https://api.keysy.net/' }, 'https://api.keysy.net/v0/me'],
    [{ VITE_API_URL: 'https://api.keysy.net' }, 'https://api.keysy.net/v0/me'],
    [{}, 'http://localhost:8081/v0/me'],
  ] as const) {
    assert.deepEqual(preloadTags(env), [{ tag: 'link', attrs: { rel: 'preload', as: 'fetch', crossorigin: 'use-credentials', href }, injectTo: 'head' }])
  }
})
