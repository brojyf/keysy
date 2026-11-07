import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CurrentUserContext } from '../src/components/current-user'
import GeneralPage from '../src/app/account/page'
import AccountMenu from '../src/components/account-menu'
import { applyTheme, readTheme, setTheme } from '../src/lib/theme'

const stylesheet = await Bun.file(new URL('../src/app/globals.css', import.meta.url)).text()
const controlsCSS = await Bun.file(new URL('../src/components/dashboard.css', import.meta.url)).text()
const tokensCSS = await Bun.file(new URL('../../design/tokens/tokens.css', import.meta.url)).text()
const layout = await Bun.file(new URL('../src/app/layout.tsx', import.meta.url)).text()

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
  const style = document.createElement('style')
  style.textContent = tokensCSS
  document.head.append(style)
  const themeColor = document.createElement('meta')
  themeColor.name = 'theme-color'
  document.head.append(themeColor)
  Object.defineProperty(document, 'cookie', { configurable: true, get: () => cookie, set: (value: string) => { written = value; cookie = value.split(';')[0]! } })
  window.matchMedia = ((query: string) => ({ matches: query.includes('reduced-motion') ? reduced : dark, addEventListener: (_: string, fn: () => void) => { change = fn }, removeEventListener: () => {} })) as typeof window.matchMedia
  setTheme('system')
  cookie = ''
  written = ''
})

afterEach(async () => {
  if (root) { await act(() => root.unmount()); root = undefined as unknown as Root }
  setTheme('system')
  await browser.happyDOM.close()
})

async function renderThemeControls() {
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  const user = { id: 'id', email: 'test@example.com', displayName: 'Test', agentAutoApply: false, memberships: [] }
  await act(() => root.render(<CurrentUserContext.Provider value={{ user, organizations: [{ id: '1', name: 'platform', role: 'owner', memberCount: 1 }], onOrganizationCreated: () => {}, onOrganizationDeleted: () => {}, onUserChange: () => {}, onSignedOut: () => {}, onSignOutRequest: () => {} }}><GeneralPage /><AccountMenu displayName="Test" email="test@example.com" onSignOutRequest={() => {}} selected={false} /></CurrentUserContext.Provider>))
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

for (const preference of ['light', 'dark', 'system', 'unknown'] as const) {
  for (const systemDark of [false, true]) {
    test(`initial browser theme color follows ${preference} with system dark ${systemDark}`, () => {
      document.querySelector('meta[name="theme-color"]')!.remove()
      cookie = preference === 'system' ? '' : `keysy-theme=${preference}`
      dark = systemDark
      const script = layout.match(/__html: `([^`]+)`/)![1]!
      const initialize = new Function('document', 'matchMedia', 'getComputedStyle', script)
      initialize(document, window.matchMedia, window.getComputedStyle.bind(window))
      const expectedDark = preference === 'dark' || (preference !== 'light' && systemDark)
      expect(document.documentElement.style.colorScheme).toBe(expectedDark ? 'dark' : 'light')
      expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(expectedDark ? '#141414' : '#fafafa')
    })
  }
}

test('browser theme color follows explicit choices instead of the system', () => {
  dark = false
  setTheme('dark')
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#141414')
  dark = true
  setTheme('light')
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#fafafa')
  expect(document.querySelectorAll('meta[name="theme-color"]').length).toBe(1)
})

test('browser theme color reads the background token', () => {
  document.documentElement.style.setProperty('--color-bg', '#123456')
  applyTheme('dark')
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#123456')
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
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#141414')
  dark = false
  change?.()
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#fafafa')
  await act(() => buttons('Dark')[0]!.click())
  change?.()
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#141414')
})

for (const reduceMotion of [false, true]) {
  test(`theme controls update immediately while page motion respects reduced motion ${reduceMotion}`, async () => {
    const container = await renderThemeControls()
    reduced = reduceMotion
    let update!: () => void
    const start = mock((callback: () => void) => { update = callback; return { finished: Promise.resolve(), skipTransition() {} } })
    Object.assign(document, { startViewTransition: start })
    await act(() => container.querySelector<HTMLButtonElement>('.account-theme button[aria-label="Dark"]')!.click())
    expect(start).toHaveBeenCalledTimes(reduceMotion ? 0 : 1)
    expect([...container.querySelectorAll('[aria-pressed="true"]')].map((button) => button.getAttribute('aria-label'))).toEqual(['Dark', 'Dark'])
    if (!reduceMotion) await act(() => update())
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#141414')
    expect(readTheme()).toBe('dark')
  })
}

test('rapid choices in either control reuse the moving thumbs and keep the latest theme', async () => {
  const container = await renderThemeControls()
  const controls = [...container.querySelectorAll('[aria-label="Theme"]')]
  const thumbs = controls.map((control) => control.querySelector('.theme-thumb'))
  expect(thumbs.every(Boolean)).toBe(true)
  for (const [index, choice] of ['Dark', 'Light', 'System', 'Dark', 'System', 'Light'].entries()) {
    await act(() => controls[index % 2]!.querySelector<HTMLButtonElement>(`button[aria-label="${choice}"]`)!.click())
    for (const [controlIndex, control] of controls.entries()) {
      expect(control.querySelector('.theme-thumb')).toBe(thumbs[controlIndex])
      expect(control.querySelector('[aria-pressed="true"]')?.getAttribute('aria-label')).toBe(choice)
      expect(control.getAttribute('data-theme')).toBe(choice.toLowerCase())
      expect([...control.querySelectorAll<HTMLButtonElement>('button')].every((button) => !button.disabled)).toBe(true)
    }
    expect(readTheme()).toBe(choice.toLowerCase())
    expect(document.documentElement.style.colorScheme).toBe(choice === 'Dark' ? 'dark' : 'light')
  }
})

test('theme changes still apply when cookies cannot be written', async () => {
  const container = await renderThemeControls()
  Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: () => { throw new Error('Cookies unavailable') } })
  await act(() => container.querySelector<HTMLButtonElement>('.theme-switch button[aria-label="Dark"]')!.click())
  expect(document.documentElement.style.colorScheme).toBe('dark')
  expect([...container.querySelectorAll('[aria-pressed="true"]')].map((button) => button.getAttribute('aria-label'))).toEqual(['Dark', 'Dark'])
})

test('live theme motion keeps thumbs decorative and respects reduced motion', () => {
  expect(stylesheet).not.toMatch(/view-transition-name:|transition: none !important/)
  expect(stylesheet).toMatch(/::view-transition-new\(root\)\s*\{\s*animation: none;/)
  expect(stylesheet).toMatch(/::view-transition-old\(root\)\s*\{[^}]*animation: keysy-theme-fade-out 300ms ease-in-out both;/)
  expect(controlsCSS).toMatch(/\.theme-thumb\s*\{[^}]*pointer-events: none;/)
  expect(controlsCSS).toMatch(/transition: transform 200ms ease-in-out, background-color 200ms ease-in-out;/)
  expect(controlsCSS).toMatch(/@media \(prefers-reduced-motion: no-preference\)/)
  expect(stylesheet).toMatch(/@media \(prefers-reduced-motion: no-preference\)/)
})

test('a new choice interrupts the page fade immediately and stale callbacks keep the latest theme', async () => {
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
  await act(() => container.querySelector<HTMLButtonElement>('.account-theme button[aria-label="Dark"]')!.click())
  await act(() => updates[0]!())
  await act(() => container.querySelector<HTMLButtonElement>('.account-theme button[aria-label="Light"]')!.click())
  expect(skips[0]).toHaveBeenCalledTimes(1)
  expect([...container.querySelectorAll('[aria-pressed="true"]')].map((button) => button.getAttribute('aria-label'))).toEqual(['Light', 'Light'])
  await act(() => { updates[1]!(); updates[0]!() })
  expect(document.documentElement.style.colorScheme).toBe('light')
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#fafafa')
  finishes[0]!()
  await Promise.resolve()
  expect(document.documentElement.classList.contains('keysy-theme-transition')).toBe(true)
  finishes[1]!()
  await Promise.resolve()
  expect(document.documentElement.classList.contains('keysy-theme-transition')).toBe(false)
})
