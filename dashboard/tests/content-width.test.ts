import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Account, People, and Settings content is 700px wide, so it fits beside the Agent panel in a 1440px window.
const contentWidth = '700px'
// Loading skeletons that include the 32px page padding on both sides.
const paddedContentWidth = '764px'

function maxWidthOf(cssPath: string, selector: string) {
  const css = readFileSync(new URL(cssPath, import.meta.url), 'utf8')
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = css.match(new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`))
  assert.ok(rule, `${selector} rule exists`)
  return rule[1].match(/max-width:\s*([^;]+);/)?.[1].trim()
}

test('Account, People, and Settings content shares one 700px max width', () => {
  for (const selector of ['.account-sections', '.account-table', '.account-toolbar', '.account-organizations-empty']) {
    assert.equal(maxWidthOf('../src/components/account.css', selector), contentWidth, selector)
  }
  assert.equal(maxWidthOf('../src/components/member-list.css', '.member-page .account-table'), contentWidth)
})

test('loading skeletons match the 700px content width', () => {
  const skeleton = '../src/components/loading-skeleton.css'
  assert.equal(maxWidthOf(skeleton, '.skeleton-member-table'), contentWidth)
  assert.equal(maxWidthOf(skeleton, '.skeleton-sessions'), contentWidth)
  assert.equal(maxWidthOf(skeleton, '.skeleton-form'), paddedContentWidth)
  assert.equal(maxWidthOf(skeleton, '.skeleton-account-table'), paddedContentWidth)
})
