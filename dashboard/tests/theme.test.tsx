import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CurrentUserContext } from '../src/components/current-user'
import GeneralPage from '../src/app/account/page'
import AccountMenu from '../src/components/account-menu'
import { applyTheme, readTheme, setTheme } from '../src/lib/theme'

const stylesheet = await Bun.file(new URL('../src/app/globals.css', import.meta.url)).text()

let browser: Window
let cookie: string
let written: string
let dark: boolean
let reduced: boolean
let change: (() => void) | undefined
let root: Root

beforeEach(() => {
  browser = new Window({ url: 'https://dashboard.keysy.net' })
  cookie = ''
  written = ''
  dark = false
  reduced = false
  change = undefined
  Object.assign(globalThis, { window: browser, document: browser.document, IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(document, 'cookie', { configurable: true, get: () => cookie, set: (value: string) => { written = value; cookie = value.split(';')[0]! } })
  window.matchMedia = ((query: string) => ({ matches: query.includes('reduced-motion') ? reduced : dark, addEventListener: (_: string, fn: () => void) => { change = fn }, removeEventListener: () => {} })) as typeof window.matchMedia
  setTheme('system')
  cookie = ''
  written = ''
})

afterEach(async () => {
  if (root) { await act(() => root.unmount()); root = undefined as unknown as Root }
  await browser.happyDOM.close()
})

async function renderThemeControls() {
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  const user = { id: 'id', email: 'test@example.com', displayName: 'Test', memberships: [] }
  await act(() => root.render(<CurrentUserContext.Provider value={{ user, onUserChange: () => {}, onSignedOut: () => {}, onSignOutRequest: () => {} }}><GeneralPage /><AccountMenu displayName="Test" email="test@example.com" onSignOutRequest={() => {}} selected={false} /></CurrentUserContext.Provider>))
  return container
}

test('stores choices with domain and secure attributes, and removes system preference', () => {
  for (const choice of ['light', 'dark'] as const) {
    setTheme(choice)
    expect(written).toBe(`keysy-theme=${choice}; Path=/; SameSite=Lax; Max-Age=31536000; Domain=keysy.net; Secure`)
  }
  setTheme('system')
  expect(written).toBe('keysy-theme=; Path=/; SameSite=Lax; Max-Age=0; Domain=keysy.net; Secure')
  cookie = 'keysy-theme=unknown'
  expect(readTheme()).toBe('system')
})

test('localhost cookies are host-only and not secure', () => {
  browser.location.href = 'http://localhost:5173'
  setTheme('dark')
  expect(written).toBe('keysy-theme=dark; Path=/; SameSite=Lax; Max-Age=31536000')
  setTheme('system')
  expect(written).toBe('keysy-theme=; Path=/; SameSite=Lax; Max-Age=0')
})

test('applies dark and follows the system', () => {
  applyTheme('dark')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(document.documentElement.style.colorScheme).toBe('dark')
  dark = false
  applyTheme('system')
  expect(document.documentElement.classList.contains('dark')).toBe(false)
  expect(document.documentElement.style.colorScheme).toBe('light')
  dark = true
  applyTheme('system')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
})

test('transitions when supported and clears the class after finishing', async () => {
  let finish!: () => void
  const finished = new Promise<void>((resolve) => { finish = resolve })
  const start = mock((update: () => void) => { update(); return { finished, skipTransition() {} } })
  Object.assign(document, { startViewTransition: start })
  setTheme('dark')
  expect(start).toHaveBeenCalledTimes(1)
  expect(document.documentElement.classList.contains('keysy-theme-transition')).toBe(true)
  finish()
  await finished
  await Promise.resolve()
  expect(document.documentElement.classList.contains('keysy-theme-transition')).toBe(false)
})

test('applies instantly when motion is reduced or transitions are unsupported', () => {
  const start = mock(() => { throw new Error('Unexpected transition') })
  Object.assign(document, { startViewTransition: start })
  reduced = true
  setTheme('dark')
  expect(start).not.toHaveBeenCalled()
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  Object.assign(document, { startViewTransition: undefined })
  reduced = false
  setTheme('light')
  expect(document.documentElement.style.colorScheme).toBe('light')
})

test('keeps both old selections until the transition update and commits both new selections synchronously', async () => {
  const container = await renderThemeControls()
  const pressed = () => [...container.querySelectorAll('[aria-label="Theme"] button[aria-pressed="true"]')].map((button) => button.getAttribute('aria-label'))
  let update!: () => void
  let finish!: () => void
  const finished = new Promise<void>((resolve) => { finish = resolve })
  Object.assign(document, { startViewTransition: (callback: () => void) => { update = callback; return { finished, skipTransition() {} } } })

  await act(() => container.querySelector<HTMLButtonElement>('.account-theme button[aria-label="Light"]')!.click())
  expect(pressed()).toEqual(['System', 'System'])
  await act(() => {
    update()
    expect(pressed()).toEqual(['Light', 'Light'])
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
  await act(() => container.querySelector<HTMLButtonElement>('.theme-switch button[aria-label="Dark"]')!.click())
  expect(pressed()).toEqual(['Light', 'Light'])
  await act(() => {
    update()
    expect(pressed()).toEqual(['Dark', 'Dark'])
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
  finish()
  await finished
})

test('both controls share their selection and system changes update the page', async () => {
  const container = await renderThemeControls()
  const buttons = (label: string) => [...container.querySelectorAll<HTMLButtonElement>(`[aria-label="Theme"] button[aria-label="${label}"]`)]
  expect(buttons('System').map((button) => [button.disabled, button.getAttribute('aria-pressed')])).toEqual([[false, 'true'], [false, 'true']])
  await act(() => buttons('Dark')[0]!.click())
  expect(buttons('Dark').map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'true'])
  await act(() => buttons('Light')[1]!.click())
  expect(buttons('Light').map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'true'])
  await act(() => buttons('System')[1]!.click())
  dark = true
  change?.()
  expect(document.documentElement.classList.contains('dark')).toBe(true)
})

for (const updateFirst of [false, true]) {
  test(`rapid choices keep the latest selection and transition cleanup with the first update ${updateFirst ? 'completed' : 'pending'}`, async () => {
    const container = await renderThemeControls()
    const updates: (() => void)[] = []
    const finishes: (() => void)[] = []
    const skips: ReturnType<typeof mock>[] = []
    Object.assign(document, { startViewTransition: (update: () => void) => {
      updates.push(update)
      const finished = new Promise<void>((resolve) => { finishes.push(resolve) })
      const skipTransition = mock(() => {})
      skips.push(skipTransition)
      return { finished, skipTransition }
    } })
    await act(() => container.querySelector<HTMLButtonElement>('.account-theme button[aria-label="Light"]')!.click())
    if (updateFirst) await act(() => updates[0]!())
    await act(() => container.querySelector<HTMLButtonElement>('.theme-switch button[aria-label="Dark"]')!.click())
    expect(skips[0]).toHaveBeenCalledTimes(1)
    expect(readTheme()).toBe('dark')
    await act(() => {
      updates[1]!()
      // A skipped transition can still run its pending update callback.
      if (!updateFirst) updates[0]!()
      expect([...container.querySelectorAll('[aria-pressed="true"]')].map((button) => button.getAttribute('aria-label'))).toEqual(['Dark', 'Dark'])
    })
    finishes[0]!()
    await Promise.resolve()
    expect(document.documentElement.classList.contains('keysy-theme-transition')).toBe(true)
    finishes[1]!()
    await Promise.resolve()
    expect(document.documentElement.classList.contains('keysy-theme-transition')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
}

test('reduced motion updates both controls without starting a transition', async () => {
  const container = await renderThemeControls()
  const start = mock(() => { throw new Error('Unexpected transition') })
  Object.assign(document, { startViewTransition: start })
  reduced = true
  await act(() => container.querySelector<HTMLButtonElement>('.theme-switch button[aria-label="Dark"]')!.click())
  expect(start).not.toHaveBeenCalled()
  expect([...container.querySelectorAll('[aria-pressed="true"]')].map((button) => button.getAttribute('aria-label'))).toEqual(['Dark', 'Dark'])
  expect(document.documentElement.classList.contains('keysy-theme-transition')).toBe(false)
})

test('both thumb groups use the shared spring without animating their images', () => {
  for (const name of ['keysy-menu-theme-thumb', 'keysy-account-theme-thumb']) {
    const group = stylesheet.match(new RegExp(`::view-transition-group\\(${name}\\)[^{]*\\{([^}]+)\\}`))![1]!
    expect(group).toContain('animation-duration: var(--duration-spring);')
    expect(group).toContain('animation-timing-function: var(--ease-spring);')
    expect(group).toContain('z-index: 1;')
    for (const state of ['old', 'new']) {
      expect(stylesheet).toMatch(new RegExp(`::view-transition-${state}\\(${name}\\)[^{]*\\{\\s*animation: none;`))
    }
    expect(stylesheet).toMatch(new RegExp(`::view-transition-old\\(${name}\\)[^{]*\\{\\s*display: none;`))
  }
})

test('only decorative thumbs and icons are captured so theme buttons remain interactive', async () => {
  await renderThemeControls()
  document.documentElement.classList.add('keysy-theme-transition')
  expect(document.querySelector('#account-menu')?.getAttribute('popover')).toBe('auto')
  const namedRules = [...stylesheet.matchAll(/(html\.keysy-theme-transition \.(?:theme-switch|account-theme)[^{]+)\{\s*view-transition-name: ([\w-]+) !important;\s*\}/g)]
  expect(namedRules).toHaveLength(8)
  expect(new Set(namedRules.map((rule) => rule[2])).size).toBe(8)
  for (const [, selector, name] of namedRules) {
    const captured = document.querySelectorAll(selector!.trim())
    expect(captured).toHaveLength(1)
    expect(captured[0]!.matches('button')).toBe(false)
    expect(captured[0]!.querySelector('button')).toBeNull()
    if (name!.endsWith('-thumb')) {
      expect(captured[0]!.tagName).toBe('SPAN')
      expect(captured[0]!.getAttribute('aria-hidden')).toBe('true')
      expect(captured[0]!.parentElement!.getAttribute('aria-pressed')).toBe('true')
    } else {
      expect(selector!.trim().endsWith(' svg')).toBe(true)
      const group = stylesheet.match(new RegExp(`::view-transition-group\\(${name}\\)[^{]*\\{([^}]+)\\}`))![1]!
      expect(group).toContain('z-index: 2;')
      expect(group).toContain('animation-duration: 0s;')
    }
  }
  expect(stylesheet).toMatch(/::view-transition-group\(root\)\s*\{ z-index: 0; \}/)
})

test('every view transition overlay layer lets pointer input reach the theme buttons', () => {
  for (const pseudo of ['view-transition', 'view-transition-group(*)', 'view-transition-image-pair(*)', 'view-transition-old(*)', 'view-transition-new(*)']) {
    const escaped = pseudo.replace(/[()*]/g, '\\$&')
    expect(stylesheet).toMatch(new RegExp(`html\\.keysy-theme-transition::${escaped}[^{}]*\\{\\s*pointer-events: none;`))
  }
})

test('all view transition motion stays inside the no-preference media query and preserves the page crossfade', () => {
  const gate = '@media (prefers-reduced-motion: no-preference) {'
  const [before, motion] = stylesheet.split(gate)
  expect(motion).toBeDefined()
  expect(before).not.toMatch(/view-transition|animation:|transition:/)
  // The media query must enclose every remaining rule in the stylesheet.
  let depth = 1
  let minimumDepth = 1
  for (const character of motion!.trim().slice(0, -1)) {
    if (character === '{') depth++
    if (character === '}') depth--
    minimumDepth = Math.min(minimumDepth, depth)
  }
  expect(minimumDepth).toBeGreaterThan(0)
  expect(depth).toBe(1)
  expect(motion!.trim().endsWith('}')).toBe(true)
  expect(motion).toContain('animation: keysy-theme-fade-out 300ms ease-in-out both;')
  expect(motion).toContain('animation: keysy-theme-fade-in 300ms ease-in-out both;')
  expect(motion).toContain('mix-blend-mode: plus-lighter;')
  expect(motion).toContain('pointer-events: none;')
})
