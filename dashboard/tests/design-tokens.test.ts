import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const paths = ['src/app/globals.css', 'src/components/dashboard.css', 'src/components/account.css', 'src/components/sign-in.css', 'src/components/dialog.css']
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

test('stylesheets contain no hex color literals', () => {
  for (const [index, css] of files.entries()) {
    assert.doesNotMatch(css, /(?:\{|;)\s*[\w-]+\s*:[^;{}]*#[\da-f]{3,8}\b/i, paths[index])
  }
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
  assert.equal(value(rule(files[1], '.account-menu-divider'), 'margin'), '2px 0 0')
})

test('account menu sign out uses the danger color', () => {
  assert.equal(value(rule(files[1], '.account-menu-sign-out'), 'color'), 'var(--color-danger)')
})

test('the sign out dialog follows the Figma Dialog component', () => {
  const dialog = rule(files[4], '.dialog')
  assert.equal(value(dialog, 'width'), 'min(440px, calc(100vw - 32px))')
  assert.equal(value(dialog, 'border-radius'), 'var(--radius-lg)')
  assert.equal(value(dialog, 'background'), 'var(--color-raised)')
  assert.equal(value(dialog, 'box-shadow'), 'var(--shadow-dialog)')
  assert.equal(value(rule(files[4], '.dialog::backdrop'), 'background'), 'color-mix(in srgb, var(--color-text) 24%, transparent)')
  assert.equal(value(rule(files[4], ':root.dark .dialog::backdrop'), 'background'), 'color-mix(in srgb, var(--color-bg) 72%, transparent)')
})

test('auth cards and dialogs share one visual center at 42% of the viewport', () => {
  assert.equal(value(rule(files[0], ':root'), '--visual-center-offset'), '8dvh')
  assert.equal(value(rule(files[4], '.dialog'), 'inset'), 'calc(50% - var(--visual-center-offset)) auto auto 50%')
  const page = rule(files[3], '.auth-page')
  assert.equal(value(page, 'min-height'), '100dvh')
  assert.equal(value(page, 'padding'), '80px 20px calc(80px + 2 * var(--visual-center-offset))')
  assert.match(page, /ellipse at 50% calc\(50% - var\(--visual-center-offset\)\)/)
})

test('the auth glow stays 40px below the card center', () => {
  const glow = rule(files[3], '.auth-page::before')
  assert.equal(value(glow, 'top'), 'calc(50% - var(--visual-center-offset) - 60px)')
  assert.equal(value(glow, 'height'), '200px')
})

test('the session status uses text at 50% in light mode and muted in dark mode', () => {
  const light = rule(files[2], '.account-sessions .account-session-status')
  assert.doesNotMatch(light, /\bcolor:/)
  assert.equal(value(light, 'opacity'), '0.5')
  const dark = rule(files[2], ':root.dark .account-sessions .account-session-status')
  assert.equal(value(dark, 'color'), 'var(--color-muted)')
  assert.equal(value(dark, 'opacity'), '1')
})

test('account rows and the save bar keep the Figma spacing', () => {
  assert.equal(value(rule(files[2], '.account-rows > div:not(:last-child)'), 'border-bottom'), '1px solid var(--color-line)')
  assert.equal(value(rule(files[2], ".account-save-bar [role='status']"), 'margin-right'), '24px')
})

test('save buttons use the compact Figma size and keep their label space while saving', () => {
  const css = files[2]
  const button = rule(css, '.account-save-bar button')
  assert.equal(value(button, 'height'), '28px')
  assert.equal(value(button, 'padding'), '0 10px')
  assert.equal(value(rule(css, '.account-save-bar button[data-feedback] .account-save-label'), 'visibility'), 'hidden')
  assert.equal(value(rule(css, '.account-save-bar button[data-feedback]'), 'opacity'), '1')
  const spinner = rule(css, '.account-save-icon')
  assert.equal(value(spinner, 'position'), 'absolute')
  assert.equal(value(rule(css, ".account-save-bar [role='status'] > span"), 'grid-area'), '1 / 1')
  assert.equal(value(rule(css, '.account-save-bar[data-saved] .account-save-count'), 'visibility'), 'hidden')
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.account-save-spinner,\s*\.account-save-check\s*\{\s*animation: none;/)
})

test('the save bar enters on the shared spring and exits below the viewport', () => {
  const enter = value(rule(files[2], '.account-save-bar'), 'transition')
  assert.match(enter, /transform var\(--duration-spring\) var\(--ease-spring\)/)
  assert.equal(value(rule(files[2], '.account-save-bar-leaving'), 'transform'), 'translateY(calc(100% + 24px))')
  assert.equal(value(rule(files[2], '.account-save-bar-leaving'), 'opacity'), '0')
})

test('the sign out dialog keeps its centering transform through the exit', () => {
  assert.equal(value(rule(files[4], '.dialog[data-closing]'), 'transform'), 'translate(-50%, -50%) scale(0.95)')
  assert.equal(value(rule(files[4], '.dialog[data-closing]::backdrop'), 'opacity'), '0')
})

test('Safari credential autofill button stays hidden in the name input', () => {
  assert.equal(value(rule(files[2], '.account-name::-webkit-credentials-auto-fill-button'), 'visibility'), 'hidden')
})

test('table rows use the hover token', () => {
  assert.equal(value(rule(files[2], '.account-table tbody tr:hover td:not(.account-table-empty)'), 'background'), 'var(--color-hover)')
})


test('agent switch uses the shared spring and respects reduced motion', () => {
  const css = files[2]
  assert.equal(value(rule(css, '.account-switch::after'), 'background'), 'var(--color-surface)')
  assert.equal(value(rule(css, ':root.dark .account-switch::after'), 'background'), 'var(--color-muted)')
  assert.equal(value(rule(css, '.account-switch::after'), 'transition'), 'transform 200ms var(--ease-spring)')
  assert.match(value(rule(css, '.account-switch[aria-checked="true"]::after'), 'transform'), /translateX\(14px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.account-switch,\s*\.account-switch::after\s*\{\s*transition: none;/)
})


test('rail avatar stays at the bottom and create errors use body text', () => {
  assert.equal(value(rule(files[1], '.rail > .rail-item'), 'margin-top'), 'auto')
  assert.equal(value(rule(files[3], '.create-organization-card [role="alert"]'), 'font'), 'var(--text-body--font-weight) var(--text-body)/var(--text-body--line-height) var(--font-sans)')
})
