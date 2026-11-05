import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

let currentPathname = '/account'
const routerPush = mock(() => {})
mock.module('next/navigation', () => ({ usePathname: () => currentPathname, useRouter: () => ({ push: routerPush }) }))

const { CurrentUserContext } = await import('../src/components/current-user')

const { default: AccountLayout } = await import('../src/app/account/layout')
const { default: GeneralPage } = await import('../src/app/account/page')
const { default: OrganizationsPage } = await import('../src/app/account/organizations/page')
const { default: SessionsPage } = await import('../src/app/account/sessions/page')

let browser: Window
let root: Root
let container: HTMLDivElement
const organizations = [{ id: 'org-1', name: 'platform', role: 'developer' as const, memberCount: 12 }, { id: 'org-2', name: 'marketing-site', role: 'admin' as const, memberCount: 4 }, { id: 'org-3', name: 'z-owner', role: 'owner' as const, memberCount: 1 }]
const user = { id: 'user-id', email: 'member@example.com', displayName: 'Test Member', agentAutoApply: false, memberships: [] }
const originalFetch = globalThis.fetch
const originalAPIURL = process.env.NEXT_PUBLIC_API_URL
const originalAuthURL = process.env.NEXT_PUBLIC_AUTH_URL
let request: ReturnType<typeof mock>
let onUserChange: ReturnType<typeof mock>
let onSignedOut: ReturnType<typeof mock>
let onSignOutRequest: ReturnType<typeof mock>

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.keysy.net'
  process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.keysy.net'
  request = mock(() => Promise.resolve(Response.json(user)))
  onUserChange = mock(() => {})
  onSignedOut = mock(() => {})
  onSignOutRequest = mock(() => {})
  routerPush.mockClear()
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

async function renderAccount(pathname: string, page: ReactNode, sessionUser = user) {
  currentPathname = pathname
  await act(async () => root.render(<CurrentUserContext.Provider value={{ user: sessionUser, organizations, onOrganizationCreated: () => {}, onUserChange, onSignedOut, onSignOutRequest }}><AccountLayout>{page}</AccountLayout></CurrentUserContext.Provider>))
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
  expect(text('h2')).toEqual(['Profile', 'Agent', 'Appearance', 'Session', 'Danger zone'])
  expect(text('dt')).toEqual(['Name', 'Email', 'Sign-in method', 'Apply changes automatically', 'Theme', 'Sign out of this device', 'Delete account'])
  expect(text('dd').slice(0, 3)).toEqual(['', 'member@example.com', 'Google'])
  expect(input().value).toBe('Test Member')
  expect(container.querySelector('[role="status"]')).toBeNull()
  const controls = [...container.querySelectorAll<HTMLButtonElement>('button')]
  expect(controls.length).toBeGreaterThan(0)
  expect(controls.filter((button) => !button.disabled).map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual(['Apply changes automatically', 'System', 'Light', 'Dark', 'Sign out'])
  expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false')
  expect(container.querySelector('[aria-pressed="true"]')?.getAttribute('aria-label')).toBe('System')
})

function tableRows() {
  return [...container.querySelectorAll('tbody tr')].map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent))
}

async function search(value: string) {
  const field = container.querySelector<HTMLInputElement>('input')!
  await act(() => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}

function headerSort(name: string) {
  return [...container.querySelectorAll<HTMLTableCellElement>('th')].find((cell) => cell.textContent === name)!
}

test('General requests sign out from the Session section above the Danger zone', async () => {
  await renderAccount('/account', <GeneralPage />)
  expect(text('.account-sections h2')).toEqual(['Profile', 'Agent', 'Appearance', 'Session', 'Danger zone'])
  expect(text('.account-sections section:nth-of-type(4) dt')).toEqual(['Sign out of this device'])
  const button = container.querySelector<HTMLButtonElement>('.account-sign-out')!
  expect(button.textContent).toBe('Sign out')
  await act(async () => button.click())
  expect(onSignOutRequest).toHaveBeenCalledTimes(1)
  expect(request).not.toHaveBeenCalled()
})

test('Organizations lists the mock organizations from A to Z', async () => {
  await renderAccount('/account/organizations', <OrganizationsPage />)
  expect(text('th')).toEqual(['Organization', 'Role', 'Members', ''])
  expect(tableRows().map((row) => row.slice(0, 3))).toEqual([
    ['marketing-site', 'Admin', '4'],
    ['platform', 'Developer', '12'],
    ['z-owner', 'Owner', '1'],
  ])
  expect(headerSort('Organization').getAttribute('aria-sort')).toBe('ascending')
})

test('the Organization header toggles the sort direction', async () => {
  await renderAccount('/account/organizations', <OrganizationsPage />)
  await act(() => headerSort('Organization').querySelector('button')!.click())
  expect(text('tbody a.account-table-link')).toEqual(['z-owner', 'platform', 'marketing-site'])
  expect(headerSort('Organization').getAttribute('aria-sort')).toBe('descending')
  await act(() => headerSort('Organization').querySelector('button')!.click())
  expect(text('tbody a.account-table-link')).toEqual(['marketing-site', 'platform', 'z-owner'])
})

test('Organizations search filters the rows and shows a no results row', async () => {
  await renderAccount('/account/organizations', <OrganizationsPage />)
  expect(container.querySelector('[aria-label="Clear search"]')).toBeNull()
  await search('PLAT')
  expect(text('tbody a.account-table-link')).toEqual(['platform'])
  await search('acme')
  expect(tableRows()).toEqual([['No organizations match “acme”']])
  expect(text('th')).toEqual(['Organization', 'Role', 'Members', ''])
  expect(container.querySelector('tbody td')?.getAttribute('colspan')).toBe('4')
})

test('clearing the search restores the rows and keeps focus in the field', async () => {
  await renderAccount('/account/organizations', <OrganizationsPage />)
  await search('acme')
  await act(() => container.querySelector<HTMLButtonElement>('[aria-label="Clear search"]')!.click())
  const field = container.querySelector<HTMLInputElement>('input')!
  expect(field.value).toBe('')
  expect(document.activeElement).toBe(field as unknown as Element)
  expect(tableRows()).toHaveLength(3)
})

test('an organization row opens the organization settings', async () => {
  await renderAccount('/account/organizations', <OrganizationsPage />)
  expect(container.querySelector('tbody a.account-table-link')?.getAttribute('href')).toBe('/settings')
  await act(() => container.querySelector<HTMLTableCellElement>('tbody td:nth-child(2)')!.click())
  expect(routerPush).toHaveBeenCalledWith('/settings')
})

test('the organization row menu links to the dashboard and settings without opening the row', async () => {
  await renderAccount('/account/organizations', <OrganizationsPage />)
  const more = container.querySelector<HTMLButtonElement>('[aria-label="More actions for marketing-site"]')!
  const menu = document.getElementById(more.getAttribute('popovertarget')!)!
  expect([...menu.querySelectorAll('a')].map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
    ['Dashboard', '/secrets'],
    ['Settings', '/settings'],
  ])
  await act(() => menu.click())
  await act(() => more.click())
  expect(routerPush).not.toHaveBeenCalled()
})

test('Sessions lists the mock sessions newest first with disabled row actions', async () => {
  await renderAccount('/account/sessions', <SessionsPage />)
  expect(text('th')).toEqual(['Client', 'Device', 'Last used', ''])
  expect(tableRows()).toEqual([
    ['Web', 'Chrome on macOS', 'Now', 'This session'],
    ['CLI', 'jordan-mbp', '2 hours ago', ''],
    ['Browser extension', 'Chrome on macOS', 'Yesterday', ''],
    ['CLI', 'work-desktop', 'Oct 12', ''],
  ])
  expect(headerSort('Last used').getAttribute('aria-sort')).toBe('descending')
  const more = [...container.querySelectorAll<HTMLButtonElement>('tbody button')]
  expect(more.map((button) => [button.getAttribute('aria-label'), button.disabled])).toEqual([
    ['More actions for jordan-mbp', true],
    ['More actions for Chrome on macOS', true],
    ['More actions for work-desktop', true],
  ])
})

test('the Last used header reverses the sessions', async () => {
  await renderAccount('/account/sessions', <SessionsPage />)
  await act(() => headerSort('Last used').querySelector('button')!.click())
  expect(tableRows().map((row) => row[2])).toEqual(['Oct 12', 'Yesterday', '2 hours ago', 'Now'])
  expect(headerSort('Last used').getAttribute('aria-sort')).toBe('ascending')
})

test('Sessions search matches the client or the device', async () => {
  await renderAccount('/account/sessions', <SessionsPage />)
  await search('cli')
  expect(tableRows().map((row) => row[1])).toEqual(['jordan-mbp', 'work-desktop'])
  await search('chrome')
  expect(tableRows().map((row) => row[0])).toEqual(['Web', 'Browser extension'])
  await search('acme')
  expect(tableRows()).toEqual([['No sessions match “acme”']])
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

function holdExitAnimation(element: Element) {
  let finish = () => {}
  const finished = new Promise<void>((resolve) => { finish = resolve })
  element.getAnimations = () => [{ finished } as unknown as Animation]
  return finish
}

test('the save bar stays mounted until its exit animation finishes', async () => {
  await renderAccount('/account', <GeneralPage />)
  await edit('New Name')
  const saveBar = container.querySelector('.account-save-bar')!
  expect(saveBar.classList.contains('account-save-bar-leaving')).toBe(false)
  const finishExit = holdExitAnimation(saveBar)
  await act(async () => button('Discard').click())
  expect(saveBar.classList.contains('account-save-bar-leaving')).toBe(true)
  expect(container.querySelector('.account-sections-editing')).not.toBeNull()
  await act(async () => finishExit())
  expect(container.querySelector('.account-save-bar')).toBeNull()
  expect(container.querySelector('.account-sections-editing')).toBeNull()
})

test('editing again interrupts the save bar exit', async () => {
  await renderAccount('/account', <GeneralPage />)
  await edit('New Name')
  const saveBar = container.querySelector('.account-save-bar')!
  const finishExit = holdExitAnimation(saveBar)
  await act(async () => button('Discard').click())
  await edit('Another Name')
  await act(async () => finishExit())
  expect(container.querySelector('.account-save-bar')).toBe(saveBar)
  expect(saveBar.classList.contains('account-save-bar-leaving')).toBe(false)
})

test('the name input opts out of browser autofill', async () => {
  await renderAccount('/account', <GeneralPage />)
  expect(input().getAttribute('autocomplete')).toBe('off')
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
  expect(request.mock.calls[0]?.[0]).toBe('https://api.keysy.net/v0/me')
  expect(request.mock.calls[0]?.[1]).toMatchObject({ method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: 'New Name' }) })
  expect(request.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal)
  expect(input().disabled).toBe(true)
  expect(button('Discard').disabled).toBe(true)
  const savingButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
  expect(savingButton.disabled).toBe(true)
  expect(savingButton.getAttribute('aria-busy')).toBe('true')
  expect(savingButton.getAttribute('aria-label')).toBe('Saving')
  expect(savingButton.querySelector('.account-save-label')?.textContent).toBe('Save')
  expect(savingButton.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  await act(() => input().form!.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })))
  expect(request).toHaveBeenCalledTimes(1)
  const updated = { ...user, displayName: 'New Name' }
  await act(async () => finish(Response.json(updated)))
  expect(onUserChange).toHaveBeenCalledWith(updated)
  // The provider owns the user, so simulate its state update.
  await act(() => root.render(<CurrentUserContext.Provider value={{ user: updated, organizations, onOrganizationCreated: () => {}, onUserChange, onSignedOut, onSignOutRequest }}><AccountLayout><GeneralPage /></AccountLayout></CurrentUserContext.Provider>))
  expect(input().value).toBe('New Name')
  const saveBar = container.querySelector('.account-save-bar')!
  const finishExit = holdExitAnimation(saveBar)
  expect(saveBar.classList.contains('account-save-bar-leaving')).toBe(false)
  expect(savingButton.getAttribute('aria-label')).toBe('Saved')
  expect(savingButton.disabled).toBe(true)
  expect(button('Discard').disabled).toBe(true)
  expect(container.querySelector('.account-save-success')?.textContent).toBe('Saved')
  expect(container.querySelector('.account-save-spinner')).toBeNull()
  expect(container.querySelector('.account-save-check')).not.toBeNull()
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 850)) })
  expect(saveBar.classList.contains('account-save-bar-leaving')).toBe(true)
  expect(savingButton.getAttribute('aria-label')).toBe('Saved')
  await act(async () => finishExit())
  expect(container.querySelector('.account-save-bar')).toBeNull()
})

test('editing during the success message cancels dismissal and keeps the new draft', async () => {
  const updated = { ...user, displayName: 'New Name' }
  request.mockImplementation(() => Promise.resolve(Response.json(updated)))
  await renderAccount('/account', <GeneralPage />)
  await edit('New Name')
  await act(async () => button('Save').click())
  await renderAccount('/account', <GeneralPage />, updated)
  expect(container.querySelector('.account-save-check')).not.toBeNull()
  await edit('Another Name')
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 850)) })
  expect(input().value).toBe('Another Name')
  expect(container.querySelector('.account-save-bar-leaving')).toBeNull()
  expect(container.querySelector('.account-save-check')).toBeNull()
  expect(button('Save').disabled).toBe(false)
  expect(container.querySelector('[role="status"]')?.textContent).toBe('1 unsaved change')
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
    expect(button('Save').disabled).toBe(false)
    expect(button('Save').getAttribute('aria-busy')).toBe('false')
    expect(button('Save').querySelector('svg')).toBeNull()
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

test('the agent preference is saved and errors leave the setting unchanged', async () => {
  await renderAccount('/account', <GeneralPage />)
  const toggle = container.querySelector<HTMLButtonElement>('[role="switch"]')!
  request.mockImplementation(() => Promise.resolve(Response.json({ ...user, agentAutoApply: true })))
  await act(async () => toggle.click())
  expect(request.mock.calls[0][1].body).toBe(JSON.stringify({ agentAutoApply: true }))
  expect(onUserChange).toHaveBeenCalledWith({ ...user, agentAutoApply: true })
  request.mockImplementation(() => Promise.resolve(new Response(null, { status: 500 })))
  await act(async () => toggle.click())
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Could not save. Try again.')
  expect(toggle.getAttribute('aria-checked')).toBe('false')
})

for (const agentAutoApply of [false, true]) {
  test(`the agent switch responds before saving from ${agentAutoApply}`, async () => {
    const sessionUser = { ...user, agentAutoApply }
    let finish!: (response: Response) => void
    request.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
    await renderAccount('/account', <GeneralPage />, sessionUser)
    await edit('Draft Name')
    const toggle = container.querySelector<HTMLButtonElement>('[role="switch"]')!
    await act(() => toggle.click())
    expect(toggle.getAttribute('aria-checked')).toBe(String(!agentAutoApply))
    expect(request.mock.calls[0][1].body).toBe(JSON.stringify({ agentAutoApply: !agentAutoApply }))
    expect(onUserChange).not.toHaveBeenCalled()
    expect(toggle.disabled).toBe(true)
    await act(() => toggle.click())
    await act(() => input().form!.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })))
    expect(request).toHaveBeenCalledTimes(1)
    const updated = { ...sessionUser, agentAutoApply: !agentAutoApply }
    await act(async () => finish(Response.json(updated)))
    expect(onUserChange).toHaveBeenCalledWith(updated)
    await renderAccount('/account', <GeneralPage />, updated)
    expect(toggle.getAttribute('aria-checked')).toBe(String(!agentAutoApply))
    expect(toggle.disabled).toBe(false)
    expect(input().value).toBe('Draft Name')
  })

  test(`the agent switch restores ${agentAutoApply} after a failed save and allows retry`, async () => {
    let finish!: (response: Response) => void
    request.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
    await renderAccount('/account', <GeneralPage />, { ...user, agentAutoApply })
    const toggle = container.querySelector<HTMLButtonElement>('[role="switch"]')!
    await act(() => toggle.click())
    expect(toggle.getAttribute('aria-checked')).toBe(String(!agentAutoApply))
    await act(async () => finish(new Response(null, { status: 503 })))
    expect(toggle.getAttribute('aria-checked')).toBe(String(agentAutoApply))
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Could not save. Try again.')
    expect(onUserChange).not.toHaveBeenCalled()
    expect(toggle.disabled).toBe(false)
    await act(() => toggle.click())
    expect(toggle.getAttribute('aria-checked')).toBe(String(!agentAutoApply))
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(request).toHaveBeenCalledTimes(2)
    await act(async () => finish(new Response(null, { status: 503 })))
  })
}
