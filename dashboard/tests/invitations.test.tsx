import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const { CurrentUserContext } = await import('../src/components/current-user')
const { default: InvitationList } = await import('../src/components/invitation-list')

let browser: Window
let root: Root
let container: HTMLDivElement
const organization = { id: 'org-1', name: 'platform', role: 'developer' as const, memberCount: 3 }
const user = { id: 'user-id', email: 'jordan@acme.dev', displayName: 'Jordan Lee', agentAutoApply: false, memberships: [] }
const apiInvitations = [
  { id: 'invitation-taylor', email: 'taylor@acme.dev', role: 'admin', status: 'pending' },
  { id: 'invitation-morgan', email: 'morgan@acme.dev', role: 'developer', status: 'expired' },
  { id: 'invitation-casey', email: 'casey@acme.dev', role: 'developer', status: 'pending' },
]
const originalFetch = globalThis.fetch
const originalAPIURL = process.env.NEXT_PUBLIC_API_URL
const originalAuthURL = process.env.NEXT_PUBLIC_AUTH_URL
let request: ReturnType<typeof mock>
let onSignedOut: ReturnType<typeof mock>

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.keysy.net'
  process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.keysy.net'
  request = mock((url: string) => url === 'https://api.keysy.net/v0/orgs/org-1/invitations'
    ? Promise.resolve(Response.json(apiInvitations))
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

async function renderInvitations(role: 'owner' | 'admin' | 'developer' = 'developer', client = new QueryClient()) {
  const currentUser = { user, organizations: [{ ...organization, role }], organization: { ...organization, role }, onSignedOut } as never
  await act(async () => root.render(
    <CurrentUserContext.Provider value={currentUser}>
      <QueryClientProvider client={client}><InvitationList /></QueryClientProvider>
    </CurrentUserContext.Provider>,
  ))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

function tableRows() {
  return [...container.querySelectorAll('tbody tr')].map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent))
}

function emailHeader() {
  return [...container.querySelectorAll<HTMLTableCellElement>('th')].find((cell) => cell.textContent === 'Email')!
}

async function search(value: string) {
  const field = container.querySelector<HTMLInputElement>('input')!
  await act(() => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}

test('Invitations is the current People page and shows the invitation count with one request', async () => {
  await renderInvitations()
  const nav = container.querySelector('nav[aria-label="People"]')!
  expect([...nav.querySelectorAll('a')].map((link) => [link.textContent, link.getAttribute('href'), link.getAttribute('aria-current')])).toEqual([
    ['Members', '/orgs/org-1/people', null],
    ['Invitations3', '/orgs/org-1/people/invitations', 'page'],
  ])
  expect(nav.querySelector('.account-nav-count')?.textContent).toBe('3')
  expect([...container.querySelectorAll('h1')].map((heading) => heading.textContent)).toEqual(['Invitations'])
  expect(request).toHaveBeenCalledTimes(1)
})

test('Invitations shows the table skeleton while the list loads', async () => {
  request.mockImplementation(() => new Promise<Response>(() => {}))
  await renderInvitations()
  expect(container.querySelector('table')).toBeNull()
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading invitations...')
  expect(container.querySelector('.skeleton-member-table')?.getAttribute('aria-busy')).toBe('true')
  expect(container.querySelector('.account-nav-count')).toBeNull()
})

test('Invitations lists pending and expired invitations by email', async () => {
  await renderInvitations()
  expect(request.mock.calls[0][0]).toBe('https://api.keysy.net/v0/orgs/org-1/invitations')
  expect((request.mock.calls[0][1] as RequestInit).credentials).toBe('include')
  expect(container.querySelector('input')?.getAttribute('placeholder')).toBe('Search invitations')
  expect([...container.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['Email', 'Status', 'Role'])
  expect(tableRows()).toEqual([
    ['casey@acme.dev', 'Pending', 'Developer'],
    ['morgan@acme.dev', 'Expired', 'Developer'],
    ['taylor@acme.dev', 'Pending', 'Admin'],
  ])
  expect([...container.querySelectorAll('.invitation-status')].map((badge) => badge.className)).toEqual([
    'invitation-status invitation-status-pending',
    'invitation-status invitation-status-expired',
    'invitation-status invitation-status-pending',
  ])
  expect(emailHeader().getAttribute('aria-sort')).toBe('ascending')
})

test('the Email header reverses the invitations', async () => {
  await renderInvitations()
  await act(() => emailHeader().querySelector('button')!.click())
  expect(tableRows().map((row) => row[0])).toEqual(['taylor@acme.dev', 'morgan@acme.dev', 'casey@acme.dev'])
  expect(emailHeader().getAttribute('aria-sort')).toBe('descending')
})

for (const role of ['owner', 'admin'] as const) {
  test(`the ${role} gets a row menu on every invitation`, async () => {
    await renderInvitations(role)
    expect([...container.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['Email', 'Status', 'Role', ''])
    const menus = [...container.querySelectorAll('tbody tr')].map((row) => [
      row.querySelector('button')?.getAttribute('aria-label'),
      [...row.querySelectorAll('[popover] button')].map((item) => item.textContent),
    ])
    expect(menus).toEqual(['casey', 'morgan', 'taylor'].map((name) => [
      `More actions for ${name}@acme.dev`, ['Change role', 'Resend invitation', 'Cancel invitation'],
    ]))
  })
}

test('a Developer gets no row menu column', async () => {
  await renderInvitations('developer')
  expect(container.querySelectorAll('th')).toHaveLength(3)
  expect(container.querySelector('tbody button')).toBeNull()
})

test('Invitations search matches the email', async () => {
  await renderInvitations()
  await search('MORGAN')
  expect(tableRows().map((row) => row[0])).toEqual(['morgan@acme.dev'])
  await search('nobody')
  expect(tableRows()).toEqual([['No invitations match “nobody”']])
})

test('Invitations shows an empty row and no count when the org has no invitations', async () => {
  request.mockImplementation(() => Promise.resolve(Response.json([])))
  await renderInvitations()
  expect(tableRows()).toEqual([['No invitations']])
  expect(container.querySelector('.account-nav-count')).toBeNull()
})

test('Invitations hides cached invitations and rechecks the organizations when the organization is not found', async () => {
  const client = new QueryClient()
  client.setQueryData(['invitations', 'user-id', 'org-1'], apiInvitations)
  client.setQueryData(['organizations', 'user-id'], [organization])
  request.mockImplementation(() => Promise.resolve(Response.json({ error: { code: 'ORG_NOT_FOUND' } }, { status: 404 })))
  await renderInvitations('owner', client)
  expect(tableRows()).toEqual([['Could not load invitations. Refresh the page to try again.']])
  expect(container.querySelector('.account-nav-count')).toBeNull()
  expect(client.getQueryState(['organizations', 'user-id'])?.isInvalidated).toBe(true)
  expect(onSignedOut).not.toHaveBeenCalled()
})

test('Invitations signs out when the session has expired', async () => {
  request.mockImplementation(() => Promise.resolve(new Response(null, { status: 401 })))
  await renderInvitations()
  expect(onSignedOut).toHaveBeenCalledTimes(1)
})
