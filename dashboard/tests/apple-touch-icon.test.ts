import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('layout links a 180x180 PNG apple touch icon', async () => {
  const layout = await readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8')
  assert.match(layout, /apple: '\/apple-touch-icon\.png'/)

  const icon = await readFile(new URL('../public/apple-touch-icon.png', import.meta.url))
  assert.equal(icon.subarray(1, 4).toString('ascii'), 'PNG')
  assert.equal(icon.readUInt32BE(16), 180)
  assert.equal(icon.readUInt32BE(20), 180)
})
