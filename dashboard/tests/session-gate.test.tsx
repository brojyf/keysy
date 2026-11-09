import { Window } from 'happy-dom'
import { notifyManager, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import SessionGate from '../src/components/session-gate'
import SignInPage, { metadata as signInMetadata } from '../src/app/signin/page'
import { metadata as rootMetadata } from '../src/app/layout'
import GeneralPage from '../src/app/account/page'
import * as secretsPage from '../src/app/secrets/page'
import * as servicesPage from '../src/app/services/page'
import * as membersPage from '../src/app/members/page'
import * as auditLogPage from '../src/app/audit-log/page'
import * as settingsPage from '../src/app/settings/page'
import * as accountLayout from '../src/app/account/layout'
import { useCurrentUser } from '../src/components/current-user'
import { fetchWithSessionRefresh, logoutSession } from '../src/lib/session-refresh'
import { organizationQueryOptions, useOrganizationMutations } from '../src/lib/organization-queries'

let currentPathname = '/orgs/org-id/secrets'
const router = { replace: mock(() => {}), push: mock(() => {}) }
mock.module('next/navigation', () => ({ usePathname: () => currentPathname, useRouter: () => router }))

let browser: Window
let root: Root
let container: HTMLDivElement
const originalFetch = globalThis.fetch
const originalTimeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')!
const originalAPIURL = process.env.NEXT_PUBLIC_API_URL
const originalAuthURL = process.env.NEXT_PUBLIC_AUTH_URL
let sessionRequest: ReturnType<typeof mock>
let organizationsRequest: ReturnType<typeof mock>
let restoreTimeout: (() => void) | undefined

function controlledTimeouts() {
  const controllers: AbortController[] = []
  const durations: number[] = []
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: (milliseconds: number) => {
      durations.push(milliseconds)
      const controller = new AbortController()
      controllers.push(controller)
      return controller.signal
    },
  })
  restoreTimeout = () => Object.defineProperty(AbortSignal, 'timeout', originalTimeoutDescriptor)
  return { controllers, durations }
}

function rejectWhenAborted(_url: string, init: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
  })
}

async function settleOrganizationRequests() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

beforeEach(() => {
  notifyManager.setScheduler(queueMicrotask)
  notifyManager.setNotifyFunction((callback) => { act(callback) })
  currentPathname = '/orgs/org-id/secrets'
  process.env.NEXT_PUBLIC_API_URL = 'https://api.keysy.net/'
  process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.keysy.net/'
  browser = new Window({ url: 'https://dashboard.keysy.net' })
  Object.assign(browser.HTMLElement.prototype, { hidePopover() {} })
  sessionRequest = mock(() => Promise.resolve(new Response(null, { status: 401 })))
  organizationsRequest = mock(() => Promise.resolve(Response.json([{ id: 'org-id', name: 'platform', role: 'owner', memberCount: 1 }])))
  router.replace.mockClear()
  router.push.mockClear()
  Object.assign(globalThis, {
    window: browser,
    document: browser.document,
    fetch: (url: string, init: RequestInit) => url.endsWith('/v0/orgs') ? organizationsRequest(url, init) : sessionRequest(url, init),
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(() => root.unmount())
  globalThis.fetch = originalFetch
  restoreTimeout?.()
  restoreTimeout = undefined
  if (originalAPIURL === undefined) delete process.env.NEXT_PUBLIC_API_URL
  else process.env.NEXT_PUBLIC_API_URL = originalAPIURL
  if (originalAuthURL === undefined) delete process.env.NEXT_PUBLIC_AUTH_URL
  else process.env.NEXT_PUBLIC_AUTH_URL = originalAuthURL
  await browser.happyDOM.close()
  notifyManager.setScheduler((callback) => setTimeout(callback, 0))
  notifyManager.setNotifyFunction((callback) => callback())
})

test('each API attempt, refresh, retry, and logout gets a 20 second timeout', async () => {
  const { durations } = controlledTimeouts()
  sessionRequest.mockImplementation((url: string) => Promise.resolve(new Response(null, { status: url.endsWith('/v0/me') ? 401 : 204 })))
  await fetchWithSessionRefresh('https://api.keysy.net/v0/me', 'https://auth.keysy.net/')
  await logoutSession('https://auth.keysy.net/')
  expect(durations).toEqual([20_000, 20_000, 20_000, 20_000])
})

test('a caller abort cancels the fetch signal', async () => {
  controlledTimeouts()
  const caller = new AbortController()
  sessionRequest.mockImplementation((_url: string, init: RequestInit) => {
    caller.abort()
    return Promise.resolve(new Response(null, { status: 204, headers: { 'x-signal-aborted': String(init.signal?.aborted) } }))
  })
  const response = await fetchWithSessionRefresh('https://api.keysy.net/v0/me', 'https://auth.keysy.net/', { signal: caller.signal })
  expect(response.headers.get('x-signal-aborted')).toBe('true')
})

test('a signal already aborted before the call cancels the fetch signal', async () => {
  controlledTimeouts()
  const caller = new AbortController()
  caller.abort()
  sessionRequest.mockImplementation((_url: string, init: RequestInit) =>
    Promise.resolve(new Response(null, { status: 204, headers: { 'x-signal-aborted': String(init.signal?.aborted) } })))
  const response = await fetchWithSessionRefresh('https://api.keysy.net/v0/me', 'https://auth.keysy.net/', { signal: caller.signal })
  expect(response.headers.get('x-signal-aborted')).toBe('true')
})

test('caller abort and timeout still abort fetch signals after the response resolves', async () => {
  const { controllers, durations } = controlledTimeouts()
  const caller = new AbortController()
  const signals: (AbortSignal | null | undefined)[] = []
  sessionRequest.mockImplementation((_url: string, init: RequestInit) => {
    signals.push(init.signal)
    return Promise.resolve(new Response(null, { status: 204 }))
  })

  await fetchWithSessionRefresh('https://api.keysy.net/v0/me', 'https://auth.keysy.net/', { signal: caller.signal })
  caller.abort()
  expect(signals[0]?.aborted).toBe(true)

  await fetchWithSessionRefresh('https://api.keysy.net/v0/me', 'https://auth.keysy.net/', { signal: new AbortController().signal })
  controllers[1].abort()
  expect(signals[1]?.aborted).toBe(true)
  expect(durations).toEqual([20_000, 20_000])
})

test('/v0/me timeout shows the session reachability error', async () => {
  const { controllers, durations } = controlledTimeouts()
  sessionRequest.mockImplementation((_url: string, init: RequestInit) => rejectWhenAborted('', init))
  await renderSessionGate()
  controllers[0].abort(new DOMException('Timed out', 'TimeoutError'))
  await act(async () => Promise.resolve())
  expect(durations).toEqual([20_000])
  expect(container.querySelector('h1')?.textContent).toBe("Can't reach Keysy")
})

test('/v0/orgs timeout shows the session reachability error', async () => {
  const { controllers, durations } = controlledTimeouts()
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json(validUser)))
  organizationsRequest.mockImplementation((url: string, init: RequestInit) => rejectWhenAborted(url, init))
  await renderSessionGate()
  controllers[1].abort(new DOMException('Timed out', 'TimeoutError'))
  await act(async () => Promise.resolve())
  expect(durations).toEqual([20_000, 20_000])
  expect(container.querySelector('h1')?.textContent).toBe("Can't reach Keysy")
})

async function renderSessionGate() {
  await act(async () => root.render(<SessionGate><p>This is the Secrets page.</p></SessionGate>))
}

test('signed-out protected routes replace with /signin and hide their children', async () => {
  await renderSessionGate()
  expect(router.replace).toHaveBeenCalledWith('/signin')
  expect(container.textContent).not.toContain('This is the Secrets page.')
  expect(container.querySelector('a.auth-button')).toBeNull()
  currentPathname = '/signin'
  await act(async () => root.render(<SessionGate><SignInPage /></SessionGate>))
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
  expect(router.replace).toHaveBeenCalledTimes(1)
})

test('pending /signin hides the sign-in page until the session resolves', async () => {
  currentPathname = '/signin'
  sessionRequest.mockImplementation(() => new Promise<Response>(() => {}))
  await act(async () => root.render(<SessionGate><SignInPage /></SessionGate>))
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect(container.querySelector('a.auth-button')).toBeNull()
  expect(router.replace).not.toHaveBeenCalled()
})

for (const hasOrganizations of [true, false]) {
  test(`signed-in users on /signin redirect with organizations: ${hasOrganizations}`, async () => {
    currentPathname = '/signin'
    sessionRequest.mockImplementation(() => Promise.resolve(Response.json(validUser)))
    if (!hasOrganizations) organizationsRequest.mockImplementation(() => Promise.resolve(Response.json([])))
    await act(async () => root.render(<SessionGate><p>Login content</p></SessionGate>))
    expect(router.replace).toHaveBeenCalledWith(hasOrganizations ? '/orgs/org-id/secrets' : '/account/organizations')
    expect(container.textContent).not.toContain('Login content')
    expect(container.querySelector('.dashboard')).toBeNull()
  })
}

test('signed-out users on /signin see its children without redirect', async () => {
  currentPathname = '/signin'
  await act(async () => root.render(<SessionGate><p>Login content</p></SessionGate>))
  expect(container.textContent).toContain('Login content')
  expect(container.querySelector('.dashboard')).toBeNull()
  expect(router.replace).not.toHaveBeenCalled()
})

test('session errors stay on /signin and retry can resolve signed out', async () => {
  currentPathname = '/signin'
  sessionRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 503 })))
  await act(async () => root.render(<SessionGate><p>Login content</p></SessionGate>))
  expect(container.querySelector('h1')?.textContent).toBe("Can't reach Keysy")
  expect(router.replace).not.toHaveBeenCalled()
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(container.textContent).toContain('Login content')
  expect(router.replace).not.toHaveBeenCalled()
})

test('session retry on /signin redirects a verified user', async () => {
  currentPathname = '/signin'
  sessionRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 503 })))
  await act(async () => root.render(<SessionGate><p>Login content</p></SessionGate>))
  expect(router.replace).not.toHaveBeenCalled()
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json(validUser)))
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(router.replace).toHaveBeenCalledWith('/orgs/org-id/secrets')
  expect(container.textContent).not.toContain('Login content')
})

test('protected session retry redirects after a confirmed signed-out response', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 503 })))
  await renderSessionGate()
  expect(router.replace).not.toHaveBeenCalled()
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(router.replace).toHaveBeenCalledWith('/signin')
  expect(container.textContent).not.toContain('This is the Secrets page.')
})

function signOutButton() {
  return container.querySelector<HTMLButtonElement>('.account-menu-sign-out')
}

function signOutDialog() {
  return container.querySelector<HTMLDialogElement>('dialog.dialog')!
}

function buttonNamed(scope: ParentNode, label: string) {
  const matches = [...scope.querySelectorAll<HTMLButtonElement>('button')].filter((button) => button.getAttribute('aria-label') === label || button.textContent?.trim() === label)
  if (matches.length !== 1) throw new Error(`Expected one button named "${label}", found ${matches.length}`)
  return matches[0]!
}

function styledButton(scope: ParentNode, label: string, className: string) {
  const button = buttonNamed(scope, label)
  expect(button.classList.contains(className)).toBe(true)
  return button
}

function dialogButton(label: string) {
  return buttonNamed(signOutDialog(), label)
}

test('shows the sign-in design and links directly to the auth origin', async () => {
  currentPathname = '/signin'
  await act(async () => root.render(<SessionGate><SignInPage /></SessionGate>))
  expect(signInMetadata.title).toBe('Sign in')
  expect(rootMetadata.title).toEqual({ template: '%s | Keysy', default: 'Keysy' })
  expect(router.replace).not.toHaveBeenCalled()
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
  expect(container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0)
  expect(container.innerHTML.toLowerCase()).not.toContain('coming soon')
  expect(sessionRequest.mock.calls[0]?.[0]).toBe('https://api.keysy.net/v0/me')
  expect(sessionRequest.mock.calls[0]?.[1].credentials).toBe('include')
})

test('development calls the separate localhost auth port without a rewrite', async () => {
  delete process.env.NEXT_PUBLIC_AUTH_URL
  delete process.env.NEXT_PUBLIC_API_URL
  currentPathname = '/signin'
  await act(async () => root.render(<SessionGate><SignInPage /></SessionGate>))
  expect(container.querySelector('a.auth-button')?.getAttribute('href')).toBe('http://localhost:8080/v0/auth/google')
  expect(sessionRequest.mock.calls[0]?.[0]).toBe('http://localhost:8081/v0/me')
  expect(sessionRequest.mock.calls[0]?.[1].credentials).toBe('include')
})

test('shows the rail and page content only after server verification', async () => {
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
  await renderSessionGate()
  expect(container.querySelector('a.auth-button')).toBeNull()
  const links = [...container.querySelectorAll<HTMLAnchorElement>('nav a')]
  expect(links.map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')])).toEqual([
    ['Secrets', '/orgs/org-id/secrets'],
    ['Services', '/orgs/org-id/services'],
    ['Members', '/orgs/org-id/members'],
    ['Audit log', '/orgs/org-id/audit-log'],
    ['Settings', '/orgs/org-id/settings'],
  ])
  expect(links.filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.getAttribute('aria-label'))).toEqual(['Secrets'])
  expect(container.querySelector('main')?.textContent).toBe('This is the Secrets page.')
  expect(container.querySelector('button[aria-label="Account menu"]')).not.toBeNull()
  const accountButton = container.querySelector<HTMLButtonElement>('button[aria-label="Account menu"]')!
  expect(accountButton.hasAttribute('data-tooltip')).toBe(false)
  expect(accountButton.hasAttribute('title')).toBe(false)
  expect(links.map((link) => [link.getAttribute('aria-label'), link.getAttribute('data-tooltip'), link.hasAttribute('title')])).toEqual([
    ['Secrets', 'Secrets', false],
    ['Services', 'Services', false],
    ['Members', 'Members', false],
    ['Audit log', 'Audit log', false],
    ['Settings', 'Settings', false],
  ])
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

test('logout waits for the server, prevents duplicate requests, and redirects to sign-in', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
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
  expect(sessionRequest.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', credentials: 'include' })
  expect(sessionRequest.mock.calls[1]?.[1].signal).toBeInstanceOf(AbortSignal)
  logout.click()
  expect(sessionRequest).toHaveBeenCalledTimes(2)
  expect(container.querySelector('h1')).toBeNull()
  await act(async () => finishLogout(new Response(null, { status: 204 })))
  expect(router.replace).toHaveBeenCalledWith('/signin')
  expect(container.querySelector('nav')).toBeNull()
  expect(container.textContent).not.toContain('This is the Secrets page.')
  currentPathname = '/signin'
  await act(async () => root.render(<SessionGate><SignInPage /></SessionGate>))
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
  expect(router.replace).toHaveBeenCalledTimes(1)
})

for (const setting of ['display name', 'agent auto apply']) {
  test(`a late ${setting} save cannot restore the session after logout`, async () => {
    const user = { id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' }
    sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json(user)))
    await act(async () => root.render(<SessionGate><GeneralPage /></SessionGate>))
    let finishSave!: (response: Response) => void
    sessionRequest.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishSave = resolve }))
    if (setting === 'display name') {
      const input = container.querySelector<HTMLInputElement>('#account-name')!
      await act(() => {
        input.value = 'Updated Member'
        input.dispatchEvent(new browser.Event('input', { bubbles: true }))
      })
      await act(() => { container.querySelector('form')!.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })) })
    } else {
      await act(() => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click())
    }
    expect(sessionRequest.mock.calls[1]?.[1].method).toBe('PATCH')
    sessionRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 204 })))
    await act(() => signOutButton()!.click())
    await act(async () => dialogButton('Sign out').click())
    expect(router.replace).toHaveBeenCalledWith('/signin')

    await act(async () => finishSave(Response.json({ ...user, displayName: 'Updated Member', agentAutoApply: true })))
    expect(router.replace).toHaveBeenCalledWith('/signin')
    expect(container.querySelector('nav')).toBeNull()
    expect(container.querySelector('.dashboard')).toBeNull()
    expect(container.querySelector('.account-sections')).toBeNull()
  })
}

test('logout clears both cookies after an in-flight refresh and stays signed out on reload', async () => {
  const user = { id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' }
  const cookies = new Map([['access', 'old-access'], ['refresh', 'old-refresh']])
  const cookieWrites: string[] = []
  let finishRefresh!: () => void
  sessionRequest.mockImplementation((url: string, init: RequestInit) => {
    if (url.endsWith('/v0/auth/refresh')) {
      if (!cookies.has('refresh')) return Promise.resolve(new Response(null, { status: 401 }))
      return new Promise<Response>((resolve) => {
        finishRefresh = () => {
          cookies.set('access', 'new-access')
          cookies.set('refresh', 'new-refresh')
          cookieWrites.push('refresh')
          resolve(new Response(null, { status: 204 }))
        }
      })
    }
    if (url.endsWith('/v0/auth/logout')) {
      cookies.clear()
      cookieWrites.push('logout')
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    return Promise.resolve(cookies.has('access') && (init.method !== 'PATCH' || cookies.get('access') === 'new-access')
      ? Response.json(user) : new Response(null, { status: 401 }))
  })
  await act(async () => root.render(<SessionGate><GeneralPage /></SessionGate>))
  await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click())
  expect(finishRefresh).toBeFunction()
  await act(() => signOutButton()!.click())
  await act(async () => dialogButton('Sign out').click())
  const loggedOutBeforeRefresh = cookieWrites.includes('logout')
  await act(async () => finishRefresh())
  expect([...cookies.keys()]).toEqual([])
  expect(loggedOutBeforeRefresh).toBe(false)
  expect(cookieWrites).toEqual(['refresh', 'logout'])
  expect(router.replace).toHaveBeenCalledWith('/signin')
  await act(() => root.unmount())
  root = createRoot(container)
  await renderSessionGate()
  expect(router.replace).toHaveBeenCalledWith('/signin')
})

for (const timing of ['during', 'after']) {
  test(`a late save 401 cannot start a refresh ${timing} logout`, async () => {
    const user = { id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' }
    sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json(user)))
    await act(async () => root.render(<SessionGate><GeneralPage /></SessionGate>))
    let finishSave!: (response: Response) => void
    let finishLogout!: (response: Response) => void
    sessionRequest.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishSave = resolve }))
    await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click())
    sessionRequest.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishLogout = resolve }))
    await act(() => signOutButton()!.click())
    await act(async () => dialogButton('Sign out').click())
    sessionRequest.mockImplementation((url: string) => Promise.resolve(url.endsWith('/v0/auth/refresh')
      ? new Response(null, { status: 204 }) : Response.json(user)))
    if (timing === 'after') await act(async () => finishLogout(new Response(null, { status: 204 })))
    await act(async () => finishSave(new Response(null, { status: 401 })))
    if (timing === 'during') await act(async () => finishLogout(new Response(null, { status: 204 })))
    expect(sessionRequest.mock.calls.filter((call) => call[0].endsWith('/v0/auth/refresh'))).toHaveLength(0)
    expect(router.replace).toHaveBeenCalledWith('/signin')
    expect(container.querySelector('.dashboard')).toBeNull()
    expect(container.querySelector('.account-sections')).toBeNull()
  })
}

test('new expired requests cannot start a refresh while logout is pending', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
  await renderSessionGate()
  let finishLogout!: (response: Response) => void
  sessionRequest.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishLogout = resolve }))
  await act(() => signOutButton()!.click())
  await act(async () => dialogButton('Sign out').click())
  sessionRequest.mockImplementation((url: string) => Promise.resolve(new Response(null, { status: url.endsWith('/v0/auth/refresh') ? 204 : 401 })))
  await fetchWithSessionRefresh('https://api.keysy.net/v0/me', 'https://auth.keysy.net/').catch(() => {})
  await act(async () => finishLogout(new Response(null, { status: 204 })))
  expect(sessionRequest.mock.calls.filter((call) => call[0].endsWith('/v0/auth/refresh'))).toHaveLength(0)
})

test('a failed in-flight refresh does not prevent logout', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
  await act(async () => root.render(<SessionGate><GeneralPage /></SessionGate>))
  let failRefresh!: (error: Error) => void
  sessionRequest.mockImplementation((url: string) => {
    if (url.endsWith('/v0/auth/refresh')) return new Promise<Response>((_, reject) => { failRefresh = reject })
    return Promise.resolve(new Response(null, { status: url.endsWith('/v0/auth/logout') ? 204 : 401 }))
  })
  await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click())
  expect(failRefresh).toBeFunction()
  await act(() => signOutButton()!.click())
  await act(async () => dialogButton('Sign out').click())
  const logoutCallsBeforeFailure = sessionRequest.mock.calls.filter((call) => call[0].endsWith('/v0/auth/logout')).length
  await act(async () => failRefresh(new TypeError('Failed to fetch')))
  expect(logoutCallsBeforeFailure).toBe(0)
  expect(sessionRequest.mock.calls.filter((call) => call[0].endsWith('/v0/auth/logout'))).toHaveLength(1)
  expect(router.replace).toHaveBeenCalledWith('/signin')
})

function holdExitAnimation(element: Element) {
  let finish = () => {}
  const finished = new Promise<void>((resolve) => { finish = resolve })
  element.getAnimations = () => [{ finished } as unknown as Animation]
  return finish
}

test('Cancel keeps the sign out dialog open until its exit animation finishes', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
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
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
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
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
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
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
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
  const iconButtons = [...topbar!.querySelectorAll<HTMLButtonElement>('.topbar-icon-button')]
  expect(iconButtons.map((button) => [button.getAttribute('aria-label'), button.getAttribute('data-tooltip'), button.hasAttribute('title')])).toEqual([
    ['Report issue', 'Report issue', false],
    ['Support', 'Support', false],
    ['Notifications', 'Notifications', false],
    ['Open agent', 'Open agent', false],
  ])
})

test('exports page titles for dashboard routes', () => {
  expect([
    secretsPage.metadata.title,
    servicesPage.metadata.title,
    membersPage.metadata.title,
    auditLogPage.metadata.title,
    settingsPage.metadata.title,
    accountLayout.metadata.title,
  ]).toEqual(['Secrets', 'Services', 'Members', 'Audit log', 'Settings', 'Account'])
})

test('highlights the rail item for nested paths', async () => {
  currentPathname = '/orgs/org-id/audit-log/2026'
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
  await renderSessionGate()
  expect(container.querySelector('nav a[aria-current="page"]')?.getAttribute('aria-label')).toBe('Audit log')
})

test('failed logout keeps the signed-in state and allows retry', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
  await renderSessionGate()
  sessionRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 503 })))
  await act(async () => signOutButton()!.click())
  await act(async () => dialogButton('Sign out').click())
  expect(signOutDialog().open).toBe(true)
  expect(signOutDialog().querySelector('[role="alert"]')?.textContent).toBe('Could not sign out. Try again.')
  expect(dialogButton('Sign out').disabled).toBe(false)
  expect(container.querySelector('nav')).not.toBeNull()
  respondByURL(204)
  expect((await fetchWithSessionRefresh('https://api.keysy.net/v0/me', 'https://auth.keysy.net/')).ok).toBe(true)
  await act(async () => dialogButton('Cancel').click())
  await act(async () => signOutButton()!.click())
  expect(signOutDialog().querySelector('[role="alert"]')).toBeNull()
  sessionRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 204 })))
  await act(async () => dialogButton('Sign out').click())
  expect(router.replace).toHaveBeenCalledWith('/signin')
})

test('a reload verifies the session again instead of trusting local state', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
  await renderSessionGate()
  await act(() => root.unmount())
  root = createRoot(container)
  await renderSessionGate()
  expect(router.replace).toHaveBeenCalledWith('/signin')
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
    return Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' }))
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
  expect(sessionRequest.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', credentials: 'include' })
  expect(sessionRequest.mock.calls[1]?.[1].signal).toBeInstanceOf(AbortSignal)
  expect(sessionRequest.mock.calls[2]?.[1].credentials).toBe('include')
  expect(container.querySelector('main')?.textContent).toBe('This is the Secrets page.')
})

test('a rejected refresh redirects to sign-in without retrying the session check', async () => {
  respondByURL(401)
  await renderSessionGate()
  expect(sessionRequest).toHaveBeenCalledTimes(2)
  expect(router.replace).toHaveBeenCalledWith('/signin')
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
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(sessionRequest).toHaveBeenCalledTimes(2)
  expect(sessionRequest.mock.calls[1]?.[0]).toBe('https://api.keysy.net/v0/me')
  expect(container.querySelector('main')?.textContent).toBe('This is the Secrets page.')
})

test('shows the Google avatar and falls back after an image error', async () => {
 sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member', avatarUrl: 'https://google.test/avatar' })))
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
 for (const fields of [{ id: 1 }, { email: null }, { displayName: null }, { avatarUrl: 42 }, { agentAutoApply: null }]) {
 sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Member', ...fields })))
 await renderSessionGate()
 expect(container.querySelector('nav')).toBeNull()
 expect(container.querySelector('a.auth-button')).toBeNull()
 expect(container.querySelector('[role="alert"]')).not.toBeNull()
 await act(() => root.unmount()); root = createRoot(container)
 }
})


test('a context user change updates the account menu name', async () => {
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' })))
  function ChangeName() {
    const { user, onUserChange } = useCurrentUser()
    return <button onClick={() => onUserChange({ ...user, displayName: 'Updated Member' })}>Change name</button>
  }
  await act(async () => root.render(<SessionGate><ChangeName /></SessionGate>))
  await act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Change name')!.click())
  expect(container.querySelector('.account-menu-name')?.textContent).toBe('Updated Member')
})

const validUser = { id: 'user-id', email: 'member@example.com', agentAutoApply: false, displayName: 'Test Member' }
const { default: AccountLayout } = await import('../src/app/account/layout')
const { default: OrganizationsPage } = await import('../src/app/account/organizations/page')

async function renderEmpty(path: string, page: React.ReactNode) {
  currentPathname = path
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json(validUser)))
  organizationsRequest.mockImplementation(() => Promise.resolve(Response.json([])))
  await act(async () => root.render(<SessionGate>{page}</SessionGate>))
}

async function openCreateDialog() {
  await act(() => styledButton(container.querySelector('.account-page')!, 'New organization', 'button-primary').click())
}

function setOrganizationName(value: string) {
  const input = container.querySelector<HTMLInputElement>('#organization-name')!
  Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new browser.Event('input', { bubbles: true }))
}

function submitOrganization() {
  container.querySelector('form')!.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }))
}

test('checks organizations after the user with credentials and a combined signal', async () => {
  currentPathname = '/secrets'
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json(validUser)))
  organizationsRequest.mockImplementation((url: string, init: RequestInit) => {
    expect(sessionRequest).toHaveBeenCalledTimes(1)
    expect(url).toBe('https://api.keysy.net/v0/orgs')
    expect(init.credentials).toBe('include')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.signal).not.toBe(sessionRequest.mock.calls[0][1].signal)
    return Promise.resolve(Response.json([]))
  })
  await renderSessionGate()
  await act(async () => Promise.resolve())
  expect(router.replace).toHaveBeenCalledWith('/account/organizations')
  expect(container.textContent).toContain('Checking your session...')
  expect(container.querySelector('.dashboard')).toBeNull()
  expect(container.querySelector('nav')).toBeNull()
  expect(container.querySelector('header.topbar')).toBeNull()
})

test('organization check rejects a member count of zero', async () => {
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json(validUser)))
  organizationsRequest.mockImplementation(() => Promise.resolve(Response.json([{ id: '1', name: 'Org', role: 'owner', memberCount: 0 }])))
  await renderSessionGate()
  expect(container.querySelector('h1')?.textContent).toBe("Can't reach Keysy")
})

for (const response of ['401', '503', 'network', 'malformed']) {
  test(`organization check handles ${response}`, async () => {
    sessionRequest.mockImplementation((url: string) => Promise.resolve(url.endsWith('/refresh') ? new Response(null, { status: 401 }) : Response.json(validUser)))
    organizationsRequest.mockImplementation(() => response === 'network' ? Promise.reject(new Error('network')) : Promise.resolve(response === 'malformed' ? Response.json({}) : new Response(null, { status: Number(response) })))
    await renderSessionGate()
    if (response === '401') expect(router.replace).toHaveBeenCalledWith('/signin')
    else {
      expect(container.querySelector('h1')?.textContent).toBe("Can't reach Keysy")
      expect(router.replace).not.toHaveBeenCalled()
    }
  })
}

test('refreshes an expired organization request', async () => {
  sessionRequest.mockImplementation((url: string) => Promise.resolve(url.endsWith('/refresh') ? new Response(null, { status: 204 }) : Response.json(validUser)))
  organizationsRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 401 })))
  await renderSessionGate()
  expect(organizationsRequest).toHaveBeenCalledTimes(2)
  expect(sessionRequest.mock.calls[1][0]).toEndWith('/v0/auth/refresh')
  expect(container.querySelector('.topbar-org')?.textContent).toBe('platform')
})

test('create form validates names and submits one trimmed request, then redirects', async () => {
  await renderEmpty('/account/organizations', <AccountLayout><OrganizationsPage /></AccountLayout>)
  await openCreateDialog()
  expect(container.querySelector('.dialog h2')?.textContent).toBe('Create an organization')
  expect(container.querySelector('label')?.textContent).toBe('Name')
  expect(document.activeElement).toBe(container.querySelector('#organization-name'))
  const button = dialogButton('Create')
  expect(button.classList.contains('button-primary')).toBe(true)
  expect(button.disabled).toBe(true)
  await act(() => setOrganizationName(' '.repeat(3)))
  expect(button.disabled).toBe(true)
  await act(() => setOrganizationName('😀'.repeat(33)))
  expect(button.disabled).toBe(true)
  await act(() => setOrganizationName(`  ${'😀'.repeat(32)}  `))
  expect(button.disabled).toBe(false)
  let finish!: (response: Response) => void
  organizationsRequest.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
  await act(() => { submitOrganization(); submitOrganization() })
  expect(organizationsRequest).toHaveBeenCalledTimes(2)
  const [url, init] = organizationsRequest.mock.calls[1]
  expect(url).toBe('https://api.keysy.net/v0/orgs')
  expect(init.method).toBe('POST')
  expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  expect(init.body).toBe(JSON.stringify({ name: '😀'.repeat(32) }))
  expect(button.textContent).toBe('Creating...')
  expect(container.querySelector<HTMLInputElement>('#organization-name')!.disabled).toBe(true)
  const createDialog = container.querySelector<HTMLDialogElement>('dialog')!
  await act(() => createDialog.dispatchEvent(new browser.Event('cancel', { cancelable: true })))
  expect(createDialog.open).toBe(true)
  organizationsRequest.mockImplementation(() => Promise.resolve(Response.json([{ id: 'new-id', name: 'New org', role: 'owner', memberCount: 1 }])))
  await act(async () => finish(Response.json({ id: 'new-id', name: 'New org' }, { status: 201 })))
  expect(router.push).toHaveBeenCalledWith('/orgs/new-id/secrets')
  expect(container.querySelector('.rail')).not.toBeNull()
  currentPathname = '/orgs/new-id/secrets'
  await act(async () => root.render(<SessionGate><p>Secrets</p></SessionGate>))
  expect(container.querySelector('.topbar-org')?.textContent).toBe('New org')
})

test('a create timeout shows the form error and sends one POST', async () => {
  const { controllers, durations } = controlledTimeouts()
  await renderEmpty('/account/organizations', <AccountLayout><OrganizationsPage /></AccountLayout>)
  await openCreateDialog()
  organizationsRequest.mockImplementation((url: string, init: RequestInit) =>
    init.method === 'POST' ? rejectWhenAborted(url, init) : Promise.resolve(Response.json([])))
  await act(() => setOrganizationName('Keep this name'))
  await act(() => submitOrganization())
  controllers[2].abort(new DOMException('Timed out', 'TimeoutError'))
  await settleOrganizationRequests()
  expect(durations).toEqual([20_000, 20_000, 20_000])
  expect(organizationsRequest.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1)
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Could not create the organization. Try again.')
  expect(container.querySelector<HTMLInputElement>('#organization-name')?.value).toBe('Keep this name')
})

for (const failure of ['500', 'malformed', '401']) {
  test(`create handles ${failure}`, async () => {
    await renderEmpty('/account/organizations', <AccountLayout><OrganizationsPage /></AccountLayout>)
    await openCreateDialog()
    sessionRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 401 })))
    organizationsRequest.mockImplementation(() => Promise.resolve(failure === 'malformed' ? Response.json({ id: 42 }, { status: 201 }) : new Response(null, { status: Number(failure) })))
    await act(() => setOrganizationName('Name'))
    await act(async () => submitOrganization())
    await settleOrganizationRequests()
    if (failure === '401') expect(router.replace).toHaveBeenCalledWith('/signin')
    else {
      expect(container.querySelector('[role="alert"]')?.textContent).toBe('Could not create the organization. Try again.')
      expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('Name')
      await act(() => setOrganizationName('Other'))
      expect(container.querySelector('[role="alert"]')).toBeNull()
    }
  })
}

test('sign out on create page ignores a late create response', async () => {
  await renderEmpty('/account/organizations', <AccountLayout><OrganizationsPage /></AccountLayout>)
  await openCreateDialog()
  let finish!: (response: Response) => void
  organizationsRequest.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
  await act(() => setOrganizationName('Name'))
  await act(() => submitOrganization())
  sessionRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })))
  currentPathname = '/account'
  await act(async () => root.render(<SessionGate><AccountLayout><GeneralPage /></AccountLayout></SessionGate>))
  await act(() => styledButton(container.querySelector('.account-sections')!, 'Sign out', 'button-danger').click())
  await act(async () => dialogButton('Sign out').click())
  await act(async () => finish(Response.json({ id: '1', name: 'Name' }, { status: 201 })))
  expect(router.push).not.toHaveBeenCalled()
  expect(router.replace).toHaveBeenCalledWith('/signin')
})

test('leaving the creation page preserves a confirmed organization without stale navigation', async () => {
  await renderEmpty('/account/organizations', <AccountLayout><OrganizationsPage /></AccountLayout>)
  await openCreateDialog()
  let finish!: (response: Response) => void
  organizationsRequest.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve }))
  await act(() => setOrganizationName('New organization'))
  await act(() => submitOrganization())
  currentPathname = '/account'
  await act(async () => root.render(<SessionGate><AccountLayout><GeneralPage /></AccountLayout></SessionGate>))
  organizationsRequest.mockImplementation(() => Promise.resolve(Response.json([{ id: 'new-id', name: 'New organization', role: 'owner', memberCount: 1 }])))
  await act(async () => finish(Response.json({ id: 'new-id', name: 'New organization' }, { status: 201 })))
  expect(router.push).not.toHaveBeenCalled()
  currentPathname = '/orgs/new-id/secrets'
  await act(async () => root.render(<SessionGate><p>Secrets</p></SessionGate>))
  expect(container.querySelector('.topbar-org')?.textContent).toBe('New organization')
  expect(container.querySelector('h1')?.textContent).not.toBe('Organization unavailable')
})

function CreateForSession({ userID, signal }: { userID: string; signal: AbortSignal }) {
  const { createOrganization } = useOrganizationMutations(userID, signal, () => {})
  return <button onClick={() => void createOrganization('Delayed').catch(() => {})}>Create</button>
}

function ObserveOrganizations({ signal }: { signal: AbortSignal }) {
  useQuery(organizationQueryOptions('user-id', signal, () => {}))
  return null
}

test('overlapping creates do not duplicate an organization already accepted from a list refresh', async () => {
  const queryClient = new QueryClient()
  const session = new AbortController()
  const first = { id: 'first-created', name: 'First', role: 'owner', memberCount: 1 }
  const second = { id: 'second-created', name: 'Renamed', role: 'developer', memberCount: 3 }
  organizationsRequest.mockImplementationOnce(() => Promise.resolve(Response.json([])))
  await act(async () => root.render(<QueryClientProvider client={queryClient}><ObserveOrganizations signal={session.signal} /><CreateForSession userID="user-id" signal={session.signal} /></QueryClientProvider>))
  let finishFirst!: (response: Response) => void
  let finishSecond!: (response: Response) => void
  organizationsRequest.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishFirst = resolve }))
  organizationsRequest.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishSecond = resolve }))
  await act(() => { container.querySelector('button')!.click(); container.querySelector('button')!.click() })
  organizationsRequest.mockImplementationOnce(() => Promise.resolve(Response.json([first, second])))
  await act(async () => finishFirst(Response.json(first, { status: 201 })))
  expect(queryClient.getQueryData(['organizations', 'user-id'])).toEqual([first, second])
  organizationsRequest.mockImplementationOnce(() => Promise.reject(new Error('Refresh unavailable')))
  await act(async () => finishSecond(Response.json({ id: second.id, name: 'Second' }, { status: 201 })))
  await settleOrganizationRequests()
  expect(organizationsRequest).toHaveBeenCalledTimes(5)
  expect(queryClient.getQueryState(['organizations', 'user-id'])?.status).toBe('error')
  expect(queryClient.getQueryData(['organizations', 'user-id'])).toEqual([first, second])
})

for (const status of [204, 404, 'network'] as const) test(`deletion exposes a business outcome after ${status}`, async () => {
  const queryClient = new QueryClient()
  const session = new AbortController()
  organizationsRequest.mockImplementationOnce(() => Promise.resolve(Response.json([{ id: 'org-id', name: 'Platform', role: 'owner', memberCount: 1 }])))
  const onResult = mock(() => {})
  function DeleteForSession() {
    const { deleteOrganization } = useOrganizationMutations('user-id', session.signal, () => {})
    return <button onClick={() => void deleteOrganization('org-id').then(onResult)}>Delete</button>
  }
  await act(async () => root.render(<QueryClientProvider client={queryClient}><ObserveOrganizations signal={session.signal} /><DeleteForSession /></QueryClientProvider>))
  sessionRequest.mockImplementationOnce(() => status === 'network'
    ? Promise.reject(new Error('Response lost'))
    : Promise.resolve(new Response(null, { status })))
  organizationsRequest.mockImplementationOnce(() => Promise.resolve(Response.json([])))
  await act(async () => container.querySelector('button')!.click())
  await settleOrganizationRequests()
  expect(onResult).toHaveBeenCalledWith({ outcome: status === 204 ? 'completed' : 'unavailable', organizations: [] })
})

test('an old mutation cannot populate a new account after its response body was delayed across session replacement', async () => {
  const queryClient = new QueryClient()
  const oldSession = new AbortController()
  const newSession = new AbortController()
  const newOrganizations = [{ id: 'new-org', name: 'New account', role: 'developer', memberCount: 1 }]
  queryClient.setQueryData(['organizations', 'old-user'], [])
  let finish!: (value: unknown) => void
  const response = new Response(null, { status: 201 })
  response.json = () => new Promise((resolve) => { finish = resolve })
  organizationsRequest.mockImplementationOnce(() => Promise.resolve(response))
  await act(() => root.render(<QueryClientProvider client={queryClient}><CreateForSession userID="old-user" signal={oldSession.signal} /></QueryClientProvider>))
  await act(async () => container.querySelector('button')!.click())
  expect(finish).toBeDefined()
  oldSession.abort()
  queryClient.clear()
  queryClient.setQueryData(['organizations', 'new-user'], newOrganizations)
  await act(() => root.render(<QueryClientProvider client={queryClient}><CreateForSession userID="new-user" signal={newSession.signal} /></QueryClientProvider>))
  await act(async () => finish({ id: 'old-created', name: 'Old account' }))
  expect(queryClient.getQueryData(['organizations', 'new-user'])).toEqual(newOrganizations)
  expect(queryClient.getQueryData(['organizations', 'old-user'])).toBeUndefined()
  queryClient.clear()
})

test('separate SessionGate instances do not share an organization cache for the same user', async () => {
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json(validUser)))
  organizationsRequest.mockImplementationOnce(() => Promise.resolve(Response.json([{ id: 'org-id', name: 'First', role: 'owner', memberCount: 1 }])))
  organizationsRequest.mockImplementationOnce(() => Promise.resolve(Response.json([{ id: 'org-id', name: 'Second', role: 'developer', memberCount: 1 }])))
  await act(async () => root.render(<><SessionGate><p>First app</p></SessionGate><SessionGate><p>Second app</p></SessionGate></>))
  expect(organizationsRequest).toHaveBeenCalledTimes(2)
  expect([...container.querySelectorAll('.topbar-org')].map((node) => node.textContent)).toEqual(['First', 'Second'])
})

test('focus and reconnect keep the verified organization list until an explicit refresh', async () => {
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json(validUser)))
  await renderSessionGate()
  await act(async () => {
    browser.dispatchEvent(new browser.Event('focus'))
    browser.document.dispatchEvent(new browser.Event('visibilitychange'))
    browser.dispatchEvent(new browser.Event('online'))
  })
  expect(organizationsRequest).toHaveBeenCalledTimes(1)
  expect(container.querySelector('.topbar-org')?.textContent).toBe('platform')
})

test('empty account shell hides organization controls and shows empty organizations', async () => {
  await renderEmpty('/account/organizations', <AccountLayout><OrganizationsPage /></AccountLayout>)
  expect(container.querySelector('.rail')).toBeNull()
  expect(container.querySelector('.account-organizations-empty h2')?.textContent).toBe('No organizations yet')
  expect(container.querySelector('.account-organizations-empty p')?.textContent).toBe('Create one, or ask an Admin to add you.')
  expect(container.querySelector('table')).toBeNull()
  expect(container.querySelector('.account-search')).toBeNull()
  await openCreateDialog()
  expect(document.activeElement).toBe(container.querySelector('#organization-name'))
  await act(() => setOrganizationName('Discard this'))
  const cancel = dialogButton('Cancel')
  expect(cancel.classList.contains('button')).toBe(true)
  expect(cancel.classList.contains('button-primary')).toBe(false)
  expect(cancel.classList.contains('button-danger')).toBe(false)
  await act(async () => cancel.click())
  await openCreateDialog()
  expect(container.querySelector<HTMLInputElement>('#organization-name')?.value).toBe('')
  await act(() => setOrganizationName('Discard with Escape'))
  await act(async () => container.querySelector<HTMLDialogElement>('dialog')!.dispatchEvent(new browser.Event('cancel', { cancelable: true })))
  await openCreateDialog()
  expect(container.querySelector<HTMLInputElement>('#organization-name')?.value).toBe('')
  currentPathname = '/account'
  await act(async () => root.render(<SessionGate><AccountLayout><GeneralPage /></AccountLayout></SessionGate>))
  expect(container.querySelector('button.topbar-org')).toBeNull()
  expect(container.querySelector('[aria-label="Search"]')).toBeNull()
  expect(container.querySelector('[aria-label="Notifications"]')).not.toBeNull()
  expect(container.querySelector('[aria-label="Open agent"]')).toBeNull()
  expect([...container.querySelectorAll('.topbar button')].map((button) => button.getAttribute('aria-label'))).toEqual(['Report issue', 'Support', 'Notifications'])
  expect([...container.querySelectorAll('h2')].map((node) => node.textContent)).toEqual(['Profile', 'Appearance', 'Session', 'Danger zone', 'Sign out?'])
  sessionRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })))
  await act(() => styledButton(container.querySelector('.account-sections')!, 'Sign out', 'button-danger').click())
  await act(async () => dialogButton('Sign out').click())
  expect(router.replace).toHaveBeenCalledWith('/signin')
})

for (const page of ['secrets', 'services', 'members', 'audit-log', 'settings', 'account']) {
  for (const suffix of ['', '/nested']) test(`pending session shows the ${page} skeleton for /${page}${suffix}`, async () => {
    currentPathname = `/${page}${suffix}`
    sessionRequest.mockImplementation(() => new Promise<Response>(() => {}))
    await renderSessionGate()
    expect(container.querySelector(`[data-skeleton-page="${page}"]`)).not.toBeNull()
  })
}

test('pending session shows the Sessions skeleton for /account/sessions', async () => {
  currentPathname = '/account/sessions'
  sessionRequest.mockImplementation(() => new Promise<Response>(() => {}))
  await renderSessionGate()
  expect(container.querySelector('[data-skeleton-page="account/sessions"] .skeleton-sessions .skeleton-table')).not.toBeNull()
  expect(container.querySelectorAll('.skeleton-sessions .skeleton-table-row')).toHaveLength(4)
})

test('pending session shows an accessible shell without page content for an unmapped path', async () => {
  currentPathname = '/unknown'
  sessionRequest.mockImplementation(() => new Promise<Response>(() => {}))
  await renderSessionGate()
  expect(container.querySelector('[data-skeleton-page]')).toBeNull()
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Checking your session...')
  expect(container.querySelector('[role="status"]')?.closest('[aria-busy="true"]') === null).toBe(true)
  expect(container.querySelector('a, button, nav')).toBeNull()
})

test('session skeleton disappears after the session resolves', async () => {
  let resolveSession!: (response: Response) => void
  sessionRequest.mockImplementation(() => new Promise<Response>((resolve) => { resolveSession = resolve }))
  await renderSessionGate()
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  await act(async () => { resolveSession(Response.json(validUser)); await Promise.resolve() })
  await act(async () => Promise.resolve())
  expect(container.querySelector('[aria-busy="true"]')).toBeNull()
})

for (const selector of ['.topbar-icon-button', '.rail-item[data-tooltip]']) {
  test(`${selector} tooltip dismisses on Escape without moving focus and resets on re-entry`, async () => {
    sessionRequest.mockImplementation(() => Promise.resolve(Response.json(validUser)))
    await renderSessionGate()
    const trigger = container.querySelector<HTMLElement>(selector)!
    await act(() => trigger.focus())
    document.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.activeElement).toBe(trigger)
    expect(trigger.hasAttribute('data-tooltip-dismissed')).toBe(true)
    trigger.querySelector('svg')!.dispatchEvent(new browser.PointerEvent('pointerover', { bubbles: true, relatedTarget: trigger }))
    expect(trigger.hasAttribute('data-tooltip-dismissed')).toBe(true)
    trigger.blur()
    await act(() => trigger.focus())
    expect(trigger.hasAttribute('data-tooltip-dismissed')).toBe(false)
  })

  test(`${selector} hovered tooltip dismisses when focus is elsewhere`, async () => {
    sessionRequest.mockImplementation(() => Promise.resolve(Response.json(validUser)))
    await renderSessionGate()
    const trigger = container.querySelector<HTMLElement>(selector)!
    trigger.dispatchEvent(new browser.PointerEvent('pointerover', { bubbles: true }))
    document.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(trigger.hasAttribute('data-tooltip-dismissed')).toBe(true)
    trigger.dispatchEvent(new browser.PointerEvent('pointerover', { bubbles: true, relatedTarget: document.body }))
    expect(trigger.hasAttribute('data-tooltip-dismissed')).toBe(false)
    document.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(trigger.hasAttribute('data-tooltip-dismissed')).toBe(false)
  })
}

for (const page of ['secrets', 'services', 'members', 'audit-log', 'settings']) {
  test(`the legacy /${page} entry redirects to a specific organization`, async () => {
    currentPathname = `/${page}`
    sessionRequest.mockImplementation(() => Promise.resolve(Response.json(validUser)))
    await renderSessionGate()
    expect(router.replace).toHaveBeenCalledWith(`/orgs/org-id/${page}`)
    expect(container.querySelector('.dashboard')).toBeNull()
  })
  test(`the scoped ${page} route shows its own pending skeleton`, async () => {
    currentPathname = `/orgs/org-id/${page}`
    sessionRequest.mockImplementation(() => new Promise<Response>(() => {}))
    await renderSessionGate()
    expect(container.querySelector(`[data-skeleton-page="${page}"]`)).not.toBeNull()
  })
}
