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

test('color tokens match the light and dark palette', () => {
  const light = rule(files[0], ':root')
  const dark = rule(files[0], ':root.dark')
  assert.equal(value(light, '--color-line-strong'), '#e3e4e6')
  for (const [name, expected] of Object.entries({ bg: '#141414', soft: '#292929', muted: '#acadb1', raised: '#222222', danger: '#ef9a9a', 'line-strong': '#6c6c6c' })) {
    assert.equal(value(dark, `--color-${name}`), expected)
  }
})

test('old text tokens are absent and dark weights are 40 lower', () => {
  for (const css of files) assert.doesNotMatch(css, /--text-(?:callout|footnote|title-2|title-3)\b/)
  const light = rule(files[0], ':root')
  const dark = rule(files[0], ':root.dark')
  for (const name of ['title', 'section-heading', 'page-path', 'heading', 'body', 'label', 'caption', 'code-small']) {
    const token = `--text-${name}--font-weight`
    assert.equal(Number(value(dark, token)), Number(value(light, token)) - 40)
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
