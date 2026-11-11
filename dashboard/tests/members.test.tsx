import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const { CurrentUserContext } = await import('../src/components/current-user')
const { default: MemberList } = await import('../src/components/member-list')

let browser: Window
let root: Root
let container: HTMLDivElement
const organization = { id: 'org-1', name: 'platform', role: 'developer' as const, memberCount: 3 }
const user = { id: 'user-id', email: 'jordan@acme.dev', displayName: 'Jordan Lee', agentAutoApply: false, memberships: [] }
const apiMembers = [
  { userId: 'user-sam', name: 'Sam Rivera', email: 'sam@acme.dev', role: 'developer' },
  { userId: 'user-alex', name: 'Alex Kim', email: 'alex@acme.dev', role: 'owner' },
  { userId: 'user-id', name: 'Jordan Lee', email: 'jordan@acme.dev', role: 'admin' },
]
const originalFetch = globalThis.fetch
const originalAPIURL = process.env.NEXT_PUBLIC_API_URL
const originalAuthURL = process.env.NEXT_PUBLIC_AUTH_URL
let request: ReturnType<typeof mock>
let onSignedOut: ReturnType<typeof mock>

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.keysy.net'
  process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.keysy.net'
  request = mock((url: string) => url === 'https://api.keysy.net/v0/orgs/org-1/members'
    ? Promise.resolve(Response.json(apiMembers))
    : Promise.reject(new Error(`Unexpected request ${url}`)))
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

async function renderMembers(role: 'owner' | 'admin' | 'developer' = 'developer') {
  const currentUser = { user, organizations: [{ ...organization, role }], organization: { ...organization, role }, onSignedOut } as never
  await act(async () => root.render(
    <CurrentUserContext.Provider value={currentUser}>
      <QueryClientProvider client={new QueryClient()}><MemberList /></QueryClientProvider>
    </CurrentUserContext.Provider>,
  ))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

function tableRows() {
  return [...container.querySelectorAll('tbody tr')].map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent))
}

function rowMenus() {
  return Object.fromEntries([...container.querySelectorAll('tbody tr')].flatMap((row) => {
    const more = row.querySelector('button')
    if (!more) return []
    const items = [...row.querySelectorAll('[popover] button')].map((item) => item.textContent)
    return [[more.getAttribute('aria-label'), items]]
  }))
}

function nameHeader() {
  return [...container.querySelectorAll<HTMLTableCellElement>('th')].find((cell) => cell.textContent === 'Name')!
}

async function search(value: string) {
  const field = container.querySelector<HTMLInputElement>('input')!
  await act(() => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}

test('Members shows the table skeleton while the list loads', async () => {
  request.mockImplementation(() => new Promise<Response>(() => {}))
  await renderMembers()
  expect(container.querySelector('h1')?.textContent).toBe('Members')
  expect(container.querySelector('.skeleton-table')).not.toBeNull()
  expect(container.querySelector('table')).toBeNull()
})

test('Members lists the org members by name with their roles', async () => {
  await renderMembers()
  expect(request.mock.calls[0][0]).toBe('https://api.keysy.net/v0/orgs/org-1/members')
  expect((request.mock.calls[0][1] as RequestInit).credentials).toBe('include')
  expect(container.querySelector('input')?.getAttribute('placeholder')).toBe('Search members')
  expect([...container.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['Name', 'Email', 'Role'])
  expect(tableRows()).toEqual([
    ['Alex Kim', 'alex@acme.dev', 'Owner'],
    ['Jordan Lee', 'jordan@acme.dev', 'Admin'],
    ['Sam Rivera', 'sam@acme.dev', 'Developer'],
  ])
  expect(nameHeader().getAttribute('aria-sort')).toBe('ascending')
})

test('an Owner gets a row menu on every member but the Owner', async () => {
  await renderMembers('owner')
  expect([...container.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['Name', 'Email', 'Role', ''])
  expect(rowMenus()).toEqual({
    'More actions for Jordan Lee': ['Change role', 'Transfer ownership', 'Remove'],
    'More actions for Sam Rivera': ['Change role', 'Transfer ownership', 'Remove'],
  })
})

test('an Admin gets a row menu on Developers only', async () => {
  await renderMembers('admin')
  expect(rowMenus()).toEqual({ 'More actions for Sam Rivera': ['Change role', 'Remove'] })
})

test('a Developer gets no row menu column', async () => {
  await renderMembers('developer')
  expect(container.querySelectorAll('th')).toHaveLength(3)
  expect(rowMenus()).toEqual({})
})

test('the Name header reverses the members', async () => {
  await renderMembers()
  await act(() => nameHeader().querySelector('button')!.click())
  expect(tableRows().map((row) => row[0])).toEqual(['Sam Rivera', 'Jordan Lee', 'Alex Kim'])
  expect(nameHeader().getAttribute('aria-sort')).toBe('descending')
})

test('Members search matches the name or the email', async () => {
  await renderMembers()
  await search('ALEX')
  expect(tableRows().map((row) => row[0])).toEqual(['Alex Kim'])
  await search('sam@')
  expect(tableRows().map((row) => row[0])).toEqual(['Sam Rivera'])
  await search('nobody')
  expect(tableRows()).toEqual([['No members match “nobody”']])
})

test('Members shows an error row when the list cannot load', async () => {
  request.mockImplementation(() => Promise.resolve(Response.json({ error: { code: 'ORG_NOT_FOUND' } }, { status: 404 })))
  await renderMembers()
  expect(tableRows()).toEqual([['Could not load members. Refresh the page to try again.']])
  expect(onSignedOut).not.toHaveBeenCalled()
})

test('Members signs out when the session has expired', async () => {
  request.mockImplementation(() => Promise.resolve(new Response(null, { status: 401 })))
  await renderMembers()
  expect(onSignedOut).toHaveBeenCalledTimes(1)
})
