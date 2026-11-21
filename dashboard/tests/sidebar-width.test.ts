import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const fluidSidebarWidth = 'clamp(180px, 22vw, 240px)'

function widthOf(cssPath: string, selector: string) {
  const css = readFileSync(new URL(cssPath, import.meta.url), 'utf8')
  const rule = css.match(new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')} \\{([^}]*)\\}`))
  assert.ok(rule, `${selector} rule exists`)
  return rule[1].match(/(?:^|[;\s])width:\s*([^;]+);/)?.[1].trim()
}

test('the second-column sidebar shrinks with the window, between 180px and 240px', () => {
  const globals = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8')
  assert.equal(globals.match(/--sidebar-width:\s*([^;]+);/)?.[1].trim(), fluidSidebarWidth)
})

test('the real sidebar and the loading skeleton sidebar share one width', () => {
  assert.equal(widthOf('../src/components/account.css', '.account-sidebar'), 'var(--sidebar-width)')
  assert.equal(widthOf('../src/components/loading-skeleton.css', '.skeleton-sidebar'), 'var(--sidebar-width)')
})
