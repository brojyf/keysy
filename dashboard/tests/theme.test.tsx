import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CurrentUserContext } from '../src/components/current-user'
import GeneralPage from '../src/app/account/page'
import AccountMenu from '../src/components/account-menu'
import { applyTheme, readTheme, setTheme } from '../src/lib/theme'

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

test('both controls share their selection and system changes update the page', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  const user = { id: 'id', email: 'test@example.com', displayName: 'Test', memberships: [] }
  await act(() => root.render(<CurrentUserContext.Provider value={{ user, onUserChange: () => {}, onSignedOut: () => {} }}><GeneralPage /><AccountMenu displayName="Test" email="test@example.com" signOutStatus="idle" onSignOut={() => {}} selected={false} /></CurrentUserContext.Provider>))
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
