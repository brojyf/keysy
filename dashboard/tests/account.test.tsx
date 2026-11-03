import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

let currentPathname = '/account'
mock.module('next/navigation', () => ({ usePathname: () => currentPathname }))

const { CurrentUserContext } = await import('../src/components/current-user')

const { default: AccountLayout } = await import('../src/app/account/layout')
const { default: GeneralPage } = await import('../src/app/account/page')
const { default: OrganizationsPage } = await import('../src/app/account/organizations/page')
const { default: SessionsPage } = await import('../src/app/account/sessions/page')

let browser: Window
let root: Root
let container: HTMLDivElement
const user = { id: 'user-id', email: 'member@example.com', displayName: 'Test Member', memberships: [] }
const originalFetch = globalThis.fetch
const originalAPIURL = process.env.NEXT_PUBLIC_API_URL
const originalAuthURL = process.env.NEXT_PUBLIC_AUTH_URL
let request: ReturnType<typeof mock>
let onUserChange: ReturnType<typeof mock>
let onSignedOut: ReturnType<typeof mock>

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.keysy.net'
  process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.keysy.net'
  request = mock(() => Promise.resolve(Response.json(user)))
  onUserChange = mock(() => {})
  onSignedOut = mock(() => {})
  globalThis.fetch = request
  browser = new Window({ url: 'https://dashboard.keysy.net' })
  Object.assign(globalThis, { window: browser, document: browser.document, IS_REACT_ACT_ENVIRONMENT: true })
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

async function renderAccount(pathname: string, page: ReactNode) {
  currentPathname = pathname
  await act(async () => root.render(<CurrentUserContext.Provider value={{ user, onUserChange, onSignedOut }}><AccountLayout>{page}</AccountLayout></CurrentUserContext.Provider>))
}

function text(selector: string) {
  return [...container.querySelectorAll(selector)].map((node) => node.textContent)
}

test('the account sidebar links to each account page and marks the current one', async () => {
  await renderAccount('/account/sessions', <SessionsPage />)
  const links = [...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Account"] a')]
  expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
    ['General', '/account'],
    ['Organizations', '/account/organizations'],
    ['Sessions', '/account/sessions'],
  ])
  expect(links.filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.textContent)).toEqual(['Sessions'])
  expect(container.querySelector('h1')?.textContent).toBe('Sessions')
})

test('General shows the session profile', async () => {
  await renderAccount('/account', <GeneralPage />)
  expect(container.querySelector('h1')?.textContent).toBe('General')
  expect(text('h2')).toEqual(['Profile', 'Agent', 'Appearance', 'Danger zone'])
  expect(text('dt')).toEqual(['Name', 'Email', 'Sign-in method', 'Apply changes automatically', 'Theme', 'Delete account'])
  expect(text('dd').slice(0, 3)).toEqual(['', 'member@example.com', 'Google'])
  expect(input().value).toBe('Test Member')
  expect(container.querySelector('[role="status"]')).toBeNull()
  const controls = [...container.querySelectorAll<HTMLButtonElement>('button')]
  expect(controls.length).toBeGreaterThan(0)
  expect(controls.every((button) => button.disabled)).toBe(true)
  expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false')
  expect(container.querySelector('[aria-pressed="true"]')?.getAttribute('aria-label')).toBe('System')
})

test('Organizations lists the mock organizations', async () => {
  await renderAccount('/account/organizations', <OrganizationsPage />)
  expect(text('th')).toEqual(['Organization'])
  expect(text('tbody td')).toEqual(['platform', 'marketing-site'])
})

test('Sessions lists the mock sessions without a revoke action', async () => {
  await renderAccount('/account/sessions', <SessionsPage />)
  expect(text('th')).toEqual(['Client', 'Device', 'Last used', ''])
  expect([...container.querySelectorAll('tbody tr')].map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent))).toEqual([
    ['Web', 'Chrome on macOS', 'Now', 'This session'],
    ['CLI', 'jordan-mbp', '2 hours ago', ''],
    ['Browser extension', 'Chrome on macOS', 'Yesterday', ''],
    ['CLI', 'work-desktop', 'Oct 12', ''],
  ])
  expect(container.querySelector('button')).toBeNull()
})

function input() { return container.querySelector<HTMLInputElement>('input')! }
function button(label: string) { return [...container.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent === label)! }
async function edit(value: string) {
  await act(() => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(input(), value)
    input().dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}

test('editing, discarding, and restoring the name controls the save bar', async () => {
  await renderAccount('/account', <GeneralPage />)
  await edit('New Name')
  expect(container.querySelector('[role="status"]')?.textContent).toBe('1 unsaved change')
  await act(() => button('Discard').click())
  expect(input().value).toBe(user.displayName)
  expect(container.querySelector('[role="status"]')).toBeNull()
  await edit('Changed')
  await edit('  Test Member  ')
  expect(container.querySelector('[role="status"]')).toBeNull()
  await edit('Changed')
  await edit('Test Member')
  expect(container.querySelector('[role="status"]')).toBeNull()
})

test('validates names by Unicode code points', async () => {
  await renderAccount('/account', <GeneralPage />)
  for (const value of ['   ', '界'.repeat(33), '😀'.repeat(33)]) {
    await edit(value)
    expect(button('Save').disabled).toBe(true)
  }
  for (const value of ['界'.repeat(32), '😀'.repeat(32)]) {
    await edit(value)
    expect(button('Save').disabled).toBe(false)
  }
})

test('submits a trimmed name with Enter and updates the session after saving', async () => {
  let finish!: (response: Response) => void
  request.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
  await renderAccount('/account', <GeneralPage />)
  await edit('  New Name  ')
  await act(() => input().form!.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })))
  expect(request).toHaveBeenCalledTimes(1)
  expect(request.mock.calls[0]).toEqual(['https://api.keysy.net/v0/me', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: 'New Name' }) }])
  expect(input().disabled).toBe(true)
  expect(button('Discard').disabled).toBe(true)
  expect(button('Saving...').disabled).toBe(true)
  const updated = { ...user, displayName: 'New Name' }
  await act(async () => finish(Response.json(updated)))
  expect(onUserChange).toHaveBeenCalledWith(updated)
  // The provider owns the user, so simulate its state update.
  await act(() => root.render(<CurrentUserContext.Provider value={{ user: updated, onUserChange, onSignedOut }}><AccountLayout><GeneralPage /></AccountLayout></CurrentUserContext.Provider>))
  expect(input().value).toBe('New Name')
  expect(container.querySelector('[role="status"]')).toBeNull()
})

test('save failures retain the draft and clear the alert on edit or discard', async () => {
  for (const respond of [
    () => Promise.resolve(new Response(null, { status: 503 })),
    () => Promise.reject(new TypeError('Network error')),
    () => Promise.resolve(new Response('invalid json', { status: 200 })),
    () => Promise.resolve(Response.json({ id: 'invalid' })),
  ]) {
    request.mockImplementation(respond)
    await renderAccount('/account', <GeneralPage />)
    await edit('Draft')
    await act(async () => button('Save').click())
    expect(input().value).toBe('Draft')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Could not save. Try again.')
    await edit('Draft changed')
    expect(container.querySelector('[role="alert"]')).toBeNull()
    await act(async () => button('Save').click())
    await act(() => button('Discard').click())
    expect(container.querySelector('[role="alert"]')).toBeNull()
    await act(() => root.unmount())
    root = createRoot(container)
  }
})

test('a rejected refresh signs out after saving', async () => {
  request.mockImplementation(() => Promise.resolve(new Response(null, { status: 401 })))
  await renderAccount('/account', <GeneralPage />)
  await edit('Draft')
  await act(async () => button('Save').click())
  expect(request.mock.calls.map((call) => call[0])).toEqual(['https://api.keysy.net/v0/me', 'https://auth.keysy.net/v0/auth/refresh'])
  expect(onSignedOut).toHaveBeenCalledTimes(1)
})
