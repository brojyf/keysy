import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('theme script runs in the body before the root element', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const body = html.indexOf('<body>')
  const script = html.indexOf('<script>(function()')
  const root = html.indexOf('<div id="root">')
  assert.ok(body !== -1 && script > body && root > script)
})
