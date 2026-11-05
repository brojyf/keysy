import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import SessionGate from '../src/components/session-gate'
import { useCurrentUser } from '../src/components/current-user'
import { fetchWithSessionRefresh } from '../src/lib/session-refresh'

let currentPathname = '/secrets'
mock.module('next/navigation', () => ({ usePathname: () => currentPathname }))

let browser: Window
let root: Root
let container: HTMLDivElement
const originalFetch = globalThis.fetch
const originalAPIURL = process.env.NEXT_PUBLIC_API_URL
const originalAuthURL = process.env.NEXT_PUBLIC_AUTH_URL
let sessionRequest: ReturnType<typeof mock>

beforeEach(() => {
  currentPathname = '/secrets'
  process.env.NEXT_PUBLIC_API_URL = 'https://api.keysy.net/'
  process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.keysy.net/'
  browser = new Window({ url: 'https://dashboard.keysy.net' })
  Object.assign(browser.HTMLElement.prototype, { hidePopover() {} })
  sessionRequest = mock(() => Promise.resolve(new Response(null, { status: 401 })))
  Object.assign(globalThis, {
    window: browser,
    document: browser.document,
    fetch: sessionRequest,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(() => root.unmount())
  globalThis.fetch = originalFetch
  if (originalAPIURL === undefined) delete process.env.NEXT_PUBLIC_API_URL
  else process.env.NEXT_PUBLIC_API_URL = originalAPIURL
  if (originalAuthURL === undefined) delete process.env.NEXT_PUBLIC_AUTH_URL
  else process.env.NEXT_PUBLIC_AUTH_URL = originalAuthURL
  await browser.happyDOM.close()
})

async function renderSessionGate() {
  await act(async () => root.render(<SessionGate><p>This is the Secrets page.</p></SessionGate>))
}

function signOutButton() {
  return container.querySelector<HTMLButtonElement>('.account-menu-sign-out')
}

function signOutDialog() {
  return container.querySelector<HTMLDialogElement>('dialog.sign-out-dialog')!
}

function dialogButton(label: string) {
  return [...signOutDialog().querySelectorAll('button')].find((button) => button.textContent === label)!
}

test('shows the sign-in design and links directly to the auth origin', async () => {
  await renderSessionGate()
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
  expect(container.textContent).not.toContain('Use your Google account to continue.')
  const login = container.querySelector<HTMLAnchorElement>('a.auth-button')
  expect(login?.textContent).toBe('Continue with Google')
  expect(login?.getAttribute('href')).toBe('https://auth.keysy.net/v0/auth/google')
  expect(login?.href).toBe('https://auth.keysy.net/v0/auth/google')
  expect(container.querySelector('img[alt="Keysy"]')?.getAttribute('width')).toBe('36')
  expect(container.querySelector('img[alt="Keysy"]')?.getAttribute('src')).toBe('/keysy-symbol.svg')
  expect(login?.querySelector('img')?.getAttribute('width')).toBe('18')
  expect(login?.querySelector('img')?.getAttribute('src')).toBe('/google-symbol.svg')
  expect(container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(5)
  expect(sessionRequest.mock.calls[0]?.[0]).toBe('https://api.keysy.net/v0/me')
  expect(sessionRequest.mock.calls[0]?.[1].credentials).toBe('include')
})

test('development calls the separate localhost auth port without a rewrite', async () => {
  delete process.env.NEXT_PUBLIC_AUTH_URL
  delete process.env.NEXT_PUBLIC_API_URL
  await renderSessionGate()
  expect(container.querySelector('a.auth-button')?.getAttribute('href')).toBe('http://localhost:8080/v0/auth/google')
  expect(sessionRequest.mock.calls[0]?.[0]).toBe('http://localhost:8081/v0/me')
  expect(sessionRequest.mock.calls[0]?.[1].credentials).toBe('include')
})

test('shows the rail and page content only after server verification', async () => {
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' })))
  await renderSessionGate()
  expect(container.querySelector('a.auth-button')).toBeNull()
  const links = [...container.querySelectorAll<HTMLAnchorElement>('nav a')]
  expect(links.map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')])).toEqual([
    ['Secrets', '/secrets'],
    ['Services', '/services'],
    ['Members', '/members'],
    ['Audit log', '/audit-log'],
    ['Settings', '/settings'],
  ])
  expect(links.filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.getAttribute('aria-label'))).toEqual(['Secrets'])
  expect(container.querySelector('main')?.textContent).toBe('This is the Secrets page.')
  expect(container.querySelector('button[aria-label="Account menu"]')).not.toBeNull()
  expect(container.querySelector('.account-menu-name')?.textContent).toBe('Test Member')
  expect(container.querySelector('.account-menu-email')?.textContent).toBe('member@example.com')
  expect(container.querySelector<HTMLAnchorElement>('[popover] a')?.getAttribute('href')).toBe('/account')
  const themeButtons = [...container.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Theme"] button')]
  expect(themeButtons.map((button) => [button.getAttribute('aria-label'), button.getAttribute('aria-pressed'), button.disabled])).toEqual([
    ['System', 'true', false],
    ['Light', 'false', false],
    ['Dark', 'false', false],
  ])
  expect(signOutButton()?.textContent).toBe('Sign out')
  expect(signOutButton()?.classList.contains('account-menu-sign-out')).toBe(true)
  expect(browser.localStorage.length).toBe(0)
  expect(browser.sessionStorage.length).toBe(0)
})

test('logout waits for the server, prevents duplicate requests, and restores sign-in', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' })))
  await renderSessionGate()
  let finishLogout!: (response: Response) => void
  sessionRequest.mockImplementation(() => new Promise<Response>((resolve) => { finishLogout = resolve }))
  await act(async () => signOutButton()!.click())
  const logout = dialogButton('Sign out')
  await act(async () => logout.click())
  expect(logout.disabled).toBe(true)
  expect(logout.textContent).toBe('Signing out...')
  expect(dialogButton('Cancel').disabled).toBe(true)
  expect(sessionRequest.mock.calls[1]?.[0]).toBe('https://auth.keysy.net/v0/auth/logout')
  expect(sessionRequest.mock.calls[1]?.[1]).toEqual({ method: 'POST', credentials: 'include' })
  logout.click()
  expect(sessionRequest).toHaveBeenCalledTimes(2)
  expect(container.querySelector('h1')).toBeNull()
  await act(async () => finishLogout(new Response(null, { status: 204 })))
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
  expect(container.querySelector('nav')).toBeNull()
})

function holdExitAnimation(element: Element) {
  let finish = () => {}
  const finished = new Promise<void>((resolve) => { finish = resolve })
  element.getAnimations = () => [{ finished } as unknown as Animation]
  return finish
}

test('Cancel keeps the sign out dialog open until its exit animation finishes', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' })))
  await renderSessionGate()
  await act(async () => signOutButton()!.click())
  const finishExit = holdExitAnimation(signOutDialog())
  await act(async () => dialogButton('Cancel').click())
  expect(signOutDialog().open).toBe(true)
  expect(signOutDialog().dataset.closing).toBe('')
  await act(async () => finishExit())
  expect(signOutDialog().open).toBe(false)
  expect(signOutDialog().dataset.closing).toBeUndefined()
})

test('Escape closes the sign out dialog through the same exit animation', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' })))
  await renderSessionGate()
  await act(async () => signOutButton()!.click())
  const finishExit = holdExitAnimation(signOutDialog())
  const escape = new browser.Event('cancel', { cancelable: true })
  await act(async () => { signOutDialog().dispatchEvent(escape) })
  expect(escape.defaultPrevented).toBe(true)
  expect(signOutDialog().open).toBe(true)
  await act(async () => finishExit())
  expect(signOutDialog().open).toBe(false)
})

test('sign out asks for confirmation and Cancel keeps the session', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' })))
  await renderSessionGate()
  expect(signOutDialog().open).toBe(false)
  await act(async () => signOutButton()!.click())
  expect(signOutDialog().open).toBe(true)
  expect(signOutDialog().autofocus).toBe(true)
  expect(signOutDialog().querySelector('h2')?.textContent).toBe('Sign out?')
  expect(signOutDialog().querySelector('p')?.textContent).toBe("You'll need to sign in again on this device.")
  expect(sessionRequest).toHaveBeenCalledTimes(1)
  await act(async () => dialogButton('Cancel').click())
  expect(signOutDialog().open).toBe(false)
  expect(sessionRequest).toHaveBeenCalledTimes(1)
  expect(container.querySelector('nav')).not.toBeNull()
})

test('shows the top bar with the mock organization and action buttons', async () => {
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' })))
  await renderSessionGate()
  const topbar = container.querySelector('header.topbar')
  expect(topbar?.querySelector('img[alt="Keysy"]')?.getAttribute('src')).toBe('/keysy-symbol.svg')
  expect(topbar?.querySelector('button.topbar-org')?.textContent).toBe('platform')
  expect([...topbar!.querySelectorAll('button')].map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual([
    'platform',
    'Search',
    'Report issue',
    'Support',
    'Notifications',
    'Open agent',
  ])
})

test('highlights the rail item for nested paths', async () => {
  currentPathname = '/audit-log/2026'
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' })))
  await renderSessionGate()
  expect(container.querySelector('nav a[aria-current="page"]')?.getAttribute('aria-label')).toBe('Audit log')
})

test('failed logout keeps the signed-in state and allows retry', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' })))
  await renderSessionGate()
  sessionRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 503 })))
  await act(async () => signOutButton()!.click())
  await act(async () => dialogButton('Sign out').click())
  expect(signOutDialog().open).toBe(true)
  expect(signOutDialog().querySelector('[role="alert"]')?.textContent).toBe('Could not sign out. Try again.')
  expect(dialogButton('Sign out').disabled).toBe(false)
  expect(container.querySelector('nav')).not.toBeNull()
  await act(async () => dialogButton('Cancel').click())
  await act(async () => signOutButton()!.click())
  expect(signOutDialog().querySelector('[role="alert"]')).toBeNull()
  sessionRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 204 })))
  await act(async () => dialogButton('Sign out').click())
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
})

test('a reload verifies the session again instead of trusting local state', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' })))
  await renderSessionGate()
  await act(() => root.unmount())
  root = createRoot(container)
  await renderSessionGate()
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
  expect(sessionRequest.mock.calls.map((call) => call[0])).toEqual([
    'https://api.keysy.net/v0/me',
    'https://api.keysy.net/v0/me',
    'https://auth.keysy.net/v0/auth/refresh',
  ])
})

function respondByURL(refreshStatus: number) {
  let meCalls = 0
  sessionRequest.mockImplementation((url: string) => {
    if (url.endsWith('/v0/auth/refresh')) return Promise.resolve(new Response(null, { status: refreshStatus }))
    meCalls += 1
    if (meCalls === 1) return Promise.resolve(new Response(null, { status: 401 }))
    return Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' }))
  })
}

test('an expired access token is refreshed once, then the session check is retried', async () => {
  respondByURL(204)
  await renderSessionGate()
  expect(sessionRequest.mock.calls.map((call) => call[0])).toEqual([
    'https://api.keysy.net/v0/me',
    'https://auth.keysy.net/v0/auth/refresh',
    'https://api.keysy.net/v0/me',
  ])
  expect(sessionRequest.mock.calls[1]?.[1]).toEqual({ method: 'POST', credentials: 'include' })
  expect(sessionRequest.mock.calls[2]?.[1].credentials).toBe('include')
  expect(container.querySelector('main')?.textContent).toBe('This is the Secrets page.')
})

test('a rejected refresh shows sign-in without retrying the session check', async () => {
  respondByURL(401)
  await renderSessionGate()
  expect(sessionRequest).toHaveBeenCalledTimes(2)
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
})

test('an unavailable refresh shows an error with retry instead of sign-in', async () => {
  respondByURL(503)
  await renderSessionGate()
  expect(sessionRequest).toHaveBeenCalledTimes(2)
  expect(container.querySelector('h1')?.textContent).toBe("Can't reach Keysy")
})

test('concurrent expired requests share one refresh', async () => {
  let finishRefresh!: (response: Response) => void
  sessionRequest.mockImplementation((url: string) => {
    if (url.endsWith('/v0/auth/refresh')) return new Promise<Response>((resolve) => { finishRefresh = resolve })
    return Promise.resolve(new Response(null, { status: 401 }))
  })
  const first = fetchWithSessionRefresh('https://api.keysy.net/v0/me', 'https://auth.keysy.net/')
  const second = fetchWithSessionRefresh('https://api.keysy.net/v0/me', 'https://auth.keysy.net/')
  while (!finishRefresh) await Promise.resolve()
  finishRefresh(new Response(null, { status: 401 }))
  expect((await first).status).toBe(401)
  expect((await second).status).toBe(401)
  expect(sessionRequest.mock.calls.filter((call) => call[0].endsWith('/v0/auth/refresh'))).toHaveLength(1)
})

test('an unavailable or invalid session check shows an error with retry instead of sign-in', async () => {
  for (const respond of [
    () => Promise.resolve(new Response(null, { status: 503 })),
    () => Promise.reject(new TypeError('Failed to fetch')),
    () => Promise.resolve(Response.json({ user: {} })),
  ]) {
    sessionRequest.mockImplementation(respond)
    await renderSessionGate()
    expect(container.querySelector('h1')?.textContent).toBe("Can't reach Keysy")
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Your session could not be checked. Try again in a moment.')
    expect(container.querySelector('a.auth-button')).toBeNull()
    expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Try again'])
    expect(container.querySelector('nav')).toBeNull()
    await act(() => root.unmount())
    root = createRoot(container)
  }
})

test('retry checks the session again', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))
  await renderSessionGate()
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' })))
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(sessionRequest).toHaveBeenCalledTimes(2)
  expect(sessionRequest.mock.calls[1]?.[0]).toBe('https://api.keysy.net/v0/me')
  expect(container.querySelector('main')?.textContent).toBe('This is the Secrets page.')
})

test('shows the Google avatar and falls back after an image error', async () => {
 sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member', avatarUrl: 'https://google.test/avatar' })))
 await renderSessionGate()
 const avatar = container.querySelector<HTMLImageElement>('.rail-avatar img')!
 expect(avatar.getAttribute('src')).toBe('https://google.test/avatar')
 expect(avatar.getAttribute('referrerpolicy')).toBe('no-referrer')
 expect(avatar.alt).toBe('')
 await act(() => avatar.dispatchEvent(new browser.Event('error')))
 expect(container.querySelector('.rail-avatar img')).toBeNull()
 expect(container.querySelector('.rail-avatar svg')).not.toBeNull()
})

test('rejects malformed me fields', async () => {
 for (const fields of [{ id: 1 }, { email: null }, { displayName: null }, { avatarUrl: 42 }]) {
 sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Member', ...fields })))
 await renderSessionGate()
 expect(container.querySelector('nav')).toBeNull()
 expect(container.querySelector('a.auth-button')).toBeNull()
 expect(container.querySelector('[role="alert"]')).not.toBeNull()
 await act(() => root.unmount()); root = createRoot(container)
 }
})


test('a context user change updates the account menu name', async () => {
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', displayName: 'Test Member' })))
  function ChangeName() {
    const { user, onUserChange } = useCurrentUser()
    return <button onClick={() => onUserChange({ ...user, displayName: 'Updated Member' })}>Change name</button>
  }
  await act(async () => root.render(<SessionGate><ChangeName /></SessionGate>))
  await act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Change name')!.click())
  expect(container.querySelector('.account-menu-name')?.textContent).toBe('Updated Member')
})
