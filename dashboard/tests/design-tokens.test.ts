import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const paths = ['src/app/globals.css', 'src/components/dashboard.css', 'src/components/account.css', 'src/components/sign-in.css']
const files = paths.map(path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
const rule = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`)
  assert.notEqual(start, -1, `Missing ${selector}`)
  return css.slice(start + selector.length + 2, css.indexOf('}', start))
}
const value = (block: string, name: string) => {
  const match = block.match(new RegExp(`(?:^|\\n)\\s*${name}:\\s*([^;]+);`))
  assert.ok(match, `Missing ${name}`)
  return match[1].trim()
}

test('globals imports shared tokens without declaring them', () => {
  assert.match(files[0], /@import\s+['"]\.\.\/\.\.\/\.\.\/design\/tokens\/tokens\.css['"]\s*;/)
  assert.doesNotMatch(files[0], /--(?:color|font|text|radius|shadow|ease|duration)-[\w-]+\s*:/)
  assert.doesNotMatch(files[0], /:root\.dark\s*\{/)
})

test('old text tokens are absent', () => {
  for (const css of files) assert.doesNotMatch(css, /--text-(?:callout|footnote|title-2|title-3)\b/)
})

test('all CSS variables used by the dashboard are defined', () => {
  const tokens = readFileSync(new URL('../../design/tokens/tokens.css', import.meta.url), 'utf8')
  const defined = new Set([tokens, ...files].flatMap(css => Array.from(css.matchAll(/(--[\w-]+)\s*:/g), match => match[1])))
  for (const [index, css] of files.entries()) {
    for (const match of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
      assert.ok(defined.has(match[1]), `${paths[index]} uses undefined ${match[1]}`)
    }
  }
})

test('theme switches have no track fill or selected shadow', () => {
  for (const [css, selector] of [[files[1], '.theme-switch'], [files[2], '.account-theme']]) {
    const track = rule(css, selector)
    for (const match of track.matchAll(/\bbackground(?:-color)?\s*:\s*([^;]+);/g)) assert.equal(match[1].trim(), 'none')
    assert.doesNotMatch(rule(css, `${selector} button[aria-pressed='true']`), /box-shadow\s*:/)
  }
})

test('account menu keeps its position and stack gaps', () => {
  assert.equal(value(rule(files[1], '.account-menu'), 'inset'), 'auto auto 10px 60px')
  for (const selector of ['.account-menu-divider', '.account-menu-error']) {
    assert.equal(value(rule(files[1], selector), 'margin'), '2px 0 0')
  }
})

test('the session status uses text in light mode and muted in dark mode', () => {
  assert.doesNotMatch(rule(files[2], '.account-sessions .account-session-status'), /\bcolor:/)
  assert.equal(value(rule(files[2], ':root.dark .account-sessions .account-session-status'), 'color'), 'var(--color-muted)')
})
