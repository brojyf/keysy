import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const sourceDirectory = fileURLToPath(new URL('../src/', import.meta.url))
const globalStylesheet = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : [path]
  })
}

test('dashboard defines one visually hidden utility and no component copies', () => {
  assert.match(globalStylesheet, /\.visually-hidden\s*\{[^}]*clip-path:\s*inset\(50%\);/s)

  for (const path of sourceFiles(sourceDirectory)) {
    const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, /\b(?:skeleton-status|organization-copy-status)\b/)
  }
})
