import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const contentWidth = 'var(--content-width)'
// Loading skeletons that include the 32px page padding on both sides.
const paddedContentWidth = 'calc(var(--content-width) + 64px)'

function maxWidthOf(cssPath: string, selector: string) {
  const css = readFileSync(new URL(cssPath, import.meta.url), 'utf8')
  const rule = css.match(new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')} \\{([^}]*)\\}`))
  assert.ok(rule, `${selector} rule exists`)
  return rule[1].match(/max-width:\s*([^;]+);/)?.[1].trim()
}

// Account, People, and Settings content is 700px wide, so it fits beside the Agent panel in a 1440px window.
test('Account, People, and Settings content is 700px wide', () => {
  const globals = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8')
  assert.equal(globals.match(/--content-width:\s*([^;]+);/)?.[1].trim(), '700px')
})

test('content and loading skeletons share one content width', () => {
  for (const selector of ['.account-sections', '.account-table', '.account-toolbar', '.account-organizations-empty']) {
    assert.equal(maxWidthOf('../src/components/account.css', selector), contentWidth, selector)
  }
  const skeleton = '../src/components/loading-skeleton.css'
  assert.equal(maxWidthOf(skeleton, '.skeleton-member-table'), contentWidth)
  assert.equal(maxWidthOf(skeleton, '.skeleton-sessions'), contentWidth)
  assert.equal(maxWidthOf(skeleton, '.skeleton-form'), paddedContentWidth)
  assert.equal(maxWidthOf(skeleton, '.skeleton-account-table'), paddedContentWidth)
})
