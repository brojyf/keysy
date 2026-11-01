import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from '../src/App'

let browser: Window
let root: Root
let container: HTMLDivElement
const originalFetch = globalThis.fetch
const originalAuthURL = process.env.NEXT_PUBLIC_AUTH_URL
let sessionRequest: ReturnType<typeof mock>

beforeEach(() => {
  process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.keysy.net/'
  browser = new Window({ url: 'https://dashboard.keysy.net' })
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
  if (originalAuthURL === undefined) delete process.env.NEXT_PUBLIC_AUTH_URL
  else process.env.NEXT_PUBLIC_AUTH_URL = originalAuthURL
  await browser.happyDOM.close()
})

async function renderApp() {
  await act(async () => root.render(<App />))
}

test('shows the sign-in design and links directly to the auth origin', async () => {
  await renderApp()
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
  expect(container.textContent).toContain('Use your Google account to continue.')
  const login = container.querySelector<HTMLAnchorElement>('a.auth-button')
  expect(login?.textContent).toBe('Continue with Google')
  expect(login?.getAttribute('href')).toBe('https://auth.keysy.net/v0/auth/google')
  expect(login?.href).toBe('https://auth.keysy.net/v0/auth/google')
  expect(container.querySelector('img[alt="Keysy"]')?.getAttribute('width')).toBe('36')
  expect(container.querySelector('img[alt="Keysy"]')?.getAttribute('src')).toBe('/sign-in/keysy-symbol.svg')
  expect(login?.querySelector('img')?.getAttribute('width')).toBe('18')
  expect(login?.querySelector('img')?.getAttribute('src')).toBe('/sign-in/google-symbol.svg')
  expect(container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(5)
  expect(sessionRequest.mock.calls[0]?.[0]).toBe('https://auth.keysy.net/v0/auth/session')
  expect(sessionRequest.mock.calls[0]?.[1].credentials).toBe('include')
})

test('development calls the separate localhost auth port without a rewrite', async () => {
  delete process.env.NEXT_PUBLIC_AUTH_URL
  await renderApp()
  expect(container.querySelector('a.auth-button')?.getAttribute('href')).toBe('http://localhost:8080/v0/auth/google')
  expect(sessionRequest.mock.calls[0]?.[0]).toBe('http://localhost:8080/v0/auth/session')
  expect(sessionRequest.mock.calls[0]?.[1].credentials).toBe('include')
})

test('shows a signed-in state only after server verification', async () => {
  sessionRequest.mockImplementation(() => Promise.resolve(Response.json({ user: { id: 'user-id', email: 'member@example.com' } })))
  await renderApp()
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Signed in as member@example.com.')
  expect(container.querySelector('a.auth-button')).toBeNull()
  expect(container.querySelector('button')?.textContent).toBe('Logout')
  expect(browser.localStorage.length).toBe(0)
  expect(browser.sessionStorage.length).toBe(0)
})

test('logout waits for the server, prevents duplicate requests, and restores sign-in', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ user: { id: 'user-id' } })))
  await renderApp()
  let finishLogout!: (response: Response) => void
  sessionRequest.mockImplementation(() => new Promise<Response>((resolve) => { finishLogout = resolve }))
  const logout = container.querySelector<HTMLButtonElement>('button')!
  await act(async () => logout.click())
  expect(logout.disabled).toBe(true)
  expect(logout.textContent).toBe('Signing out...')
  expect(sessionRequest.mock.calls[1]?.[0]).toBe('https://auth.keysy.net/v0/auth/logout')
  expect(sessionRequest.mock.calls[1]?.[1]).toEqual({ method: 'POST', credentials: 'include' })
  logout.click()
  expect(sessionRequest).toHaveBeenCalledTimes(2)
  expect(container.querySelector('h1')).toBeNull()
  await act(async () => finishLogout(new Response(null, { status: 204 })))
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
  expect(container.textContent).not.toContain('Signed in as')
})

test('failed logout keeps the signed-in state and allows retry', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ user: { id: 'user-id' } })))
  await renderApp()
  sessionRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 503 })))
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Could not sign out. Try again.')
  expect(container.querySelector('button')?.disabled).toBe(false)
  expect(container.textContent).toContain('Signed in as your account.')
  sessionRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 204 })))
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
})

test('a reload verifies the session again instead of trusting local state', async () => {
  sessionRequest.mockImplementationOnce(() => Promise.resolve(Response.json({ user: { id: 'user-id', email: 'member@example.com' } })))
  await renderApp()
  await act(() => root.unmount())
  root = createRoot(container)
  await renderApp()
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
  expect(sessionRequest).toHaveBeenCalledTimes(2)
})

test('an unavailable or invalid session response never fabricates a login', async () => {
  for (const response of [new Response(null, { status: 503 }), Response.json({ user: {} })]) {
    sessionRequest.mockImplementation(() => Promise.resolve(response))
    await renderApp()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not check your session.')
    expect(container.textContent).not.toContain('Signed in as')
    await act(() => root.unmount())
    root = createRoot(container)
  }
})
