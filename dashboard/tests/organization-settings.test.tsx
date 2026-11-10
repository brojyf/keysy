import { Window } from 'happy-dom'
import { notifyManager } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

let pathname = ''
const router = { replace: mock(() => {}), push: mock(() => {}) }
mock.module('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => router }))
const { default: SessionGate } = await import('../src/components/session-gate')
const { default: SettingsPage } = await import('../src/app/settings/page')
const { default: GeneralPage } = await import('../src/app/account/page')
const { useCurrentUser } = await import('../src/components/current-user')

const organization = { id: '20000000-0000-0000-0000-000000000001', name: 'Platform', role: 'owner', memberCount: 2 }
const otherOrganization = { ...organization, id: '20000000-0000-0000-0000-000000000002', name: 'Other' }
const user = { id: 'user-id', email: 'owner@example.com', displayName: 'Owner', agentAutoApply: false }
const originalFetch = globalThis.fetch
const originalAPIURL = process.env.NEXT_PUBLIC_API_URL
const originalAuthURL = process.env.NEXT_PUBLIC_AUTH_URL
let browser: Window
let root: Root
let container: HTMLDivElement
let organizations: typeof organization[]
let deleteRequest: ReturnType<typeof mock>
let createRequest: ReturnType<typeof mock>
let renameRequest: ReturnType<typeof mock>
let listOrganizations: ReturnType<typeof mock>
let writeClipboard: ReturnType<typeof mock>

function confirmDeletion(url: string) {
  organizations = organizations.filter((organization) => !url.endsWith(`/${organization.id}`))
  return Promise.resolve(new Response(null, { status: 204 }))
}

async function settleOrganizationRequests() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

beforeEach(() => {
  notifyManager.setScheduler(queueMicrotask)
  notifyManager.setNotifyFunction((callback) => { act(callback) })
  pathname = `/orgs/${organization.id}/settings`
  organizations = [organization]
  deleteRequest = mock(confirmDeletion)
  createRequest = mock(() => {
    const created = { ...otherOrganization, id: 'created-id', name: 'Created' }
    organizations = [...organizations, created]
    return Promise.resolve(Response.json(created, { status: 201 }))
  })
  renameRequest = mock((url: string, init: RequestInit) => {
    const id = String(url).split('/').pop()
    const { name } = JSON.parse(String(init.body))
    organizations = organizations.map((item) => item.id === id ? { ...item, name } : item)
    return Promise.resolve(Response.json({ id, name }))
  })
  listOrganizations = mock(() => Promise.resolve(Response.json(organizations)))
  router.replace.mockClear()
  router.push.mockClear()
  process.env.NEXT_PUBLIC_API_URL = 'https://api.keysy.net'
  process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.keysy.net'
  browser = new Window({ url: 'https://dashboard.keysy.net' })
  writeClipboard = mock(() => Promise.resolve())
  Object.defineProperty(browser.navigator, 'clipboard', { configurable: true, value: { writeText: writeClipboard } })
  Object.assign(globalThis, { window: browser, document: browser.document, IS_REACT_ACT_ENVIRONMENT: true })
  globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST' && String(url).endsWith('/v0/orgs')) return createRequest(url, init)
    if (init?.method === 'DELETE') return deleteRequest(url, init)
    if (init?.method === 'PATCH' && String(url).includes('/v0/orgs/')) return renameRequest(url, init)
    if (String(url).endsWith('/v0/orgs')) return listOrganizations(url, init)
    if (String(url).endsWith('/v0/me')) return Promise.resolve(Response.json(user))
    return Promise.resolve(new Response(null, { status: 401 }))
  }) as typeof fetch
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
  notifyManager.setScheduler((callback) => setTimeout(callback, 0))
  notifyManager.setNotifyFunction((callback) => callback())
})

async function renderSettings() {
  await act(async () => root.render(<SessionGate><SettingsPage /></SessionGate>))
}

function buttonNamed(scope: ParentNode, label: string, className: string) {
  const matches = [...scope.querySelectorAll<HTMLButtonElement>('button')].filter((button) => button.getAttribute('aria-label') === label || button.textContent?.trim() === label)
  if (matches.length !== 1) throw new Error(`Expected one button named "${label}", found ${matches.length}`)
  expect(matches[0]!.classList.contains(className)).toBe(true)
  if (label === 'Cancel') expect(matches[0]!.classList.contains('button-danger')).toBe(false)
  return matches[0]!
}
function settingsButton(label: string) { return buttonNamed(container.querySelector('.organization-settings')!, label, 'button-danger') }
function dialog() { return container.querySelector<HTMLDialogElement>('.organization-settings dialog')! }
function confirmButton() {
  const buttons = dialog().querySelectorAll<HTMLButtonElement>('.dialog-actions button[type="submit"]')
  if (buttons.length !== 1) throw new Error(`Expected one delete confirmation submit button, found ${buttons.length}`)
  expect(buttons[0]!.classList.contains('button-danger')).toBe(true)
  return buttons[0]!
}
function submit() { dialog().querySelector('form')!.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })) }
async function enterName(name: string) {
  await act(() => {
    const input = dialog().querySelector('input')!
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(input, name)
    input.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}
async function openDelete() {
  await act(() => settingsButton('Delete').click())
}

test('settings shows the current organization and marks unavailable features as coming soon', async () => {
  await renderSettings()
  expect(container.querySelector('h1')?.textContent).toBe('General')
  expect(container.querySelector<HTMLInputElement>('#organization-settings-name')?.value).toBe(organization.name)
  expect(container.querySelector<HTMLInputElement>('#organization-settings-name')?.readOnly).toBe(false)
  expect(container.querySelector('code')?.textContent).toBe(organization.id)
  expect(container.querySelector('.topbar-org')?.textContent).toBe(organization.name)
  expect(container.querySelector(`[aria-current="page"][href="/orgs/${organization.id}/settings"]`)).not.toBeNull()
  expect([...container.querySelectorAll<HTMLButtonElement>('nav[aria-label="Settings"] button')].map((button) => [button.textContent, button.disabled, button.title])).toEqual([['Notifications', true, 'Coming soon']])
})

for (const [role, label] of [['owner', 'Owner'], ['admin', 'Admin'], ['developer', 'Developer']]) test(`settings shows the current organization's ${role} role as read-only text`, async () => {
  organizations = [{ ...organization, role: 'owner' }, { ...otherOrganization, role }]
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  const roleTerm = [...container.querySelectorAll('dt')].find((term) => term.textContent === 'Role')
  expect(roleTerm).toBeDefined()
  const roleValue = roleTerm!.nextElementSibling!
  expect(roleValue.tagName).toBe('DD')
  expect(roleValue.textContent).toBe(label)
  expect(roleValue.querySelector('input, select, button')).toBeNull()
})

test('copies the organization ID from the URL and clears success feedback after 2.5 seconds', async () => {
  organizations = [organization, otherOrganization]
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  const copyButton = container.querySelector<HTMLButtonElement>('button[aria-label="Copy organization ID"]')!
  expect(copyButton).not.toBeNull()
  await act(async () => copyButton.click())
  expect(writeClipboard).toHaveBeenCalledTimes(1)
  expect(writeClipboard).toHaveBeenCalledWith(otherOrganization.id)
  expect(copyButton.getAttribute('aria-label')).toBe('Organization ID copied')
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Organization ID copied.')
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 2550)) })
  expect(copyButton.getAttribute('aria-label')).toBe('Copy organization ID')
  expect(container.querySelector('[role="status"]')?.textContent).toBe('')
})

test('a clipboard failure shows feedback and permits retry', async () => {
  await renderSettings()
  writeClipboard.mockImplementationOnce(() => Promise.reject(new Error('Clipboard denied')))
  const copyButton = container.querySelector<HTMLButtonElement>('button[aria-label="Copy organization ID"]')!
  expect(copyButton).not.toBeNull()
  await act(async () => copyButton.click())
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Could not copy. Try again.')
  expect(copyButton.getAttribute('aria-label')).not.toBe('Organization ID copied')
  await act(async () => copyButton.click())
  expect(writeClipboard).toHaveBeenCalledTimes(2)
  expect(copyButton.getAttribute('aria-label')).toBe('Organization ID copied')
})

for (const olderFails of [true, false]) test(`only the latest clipboard result updates feedback when the older operation fails: ${olderFails}`, async () => {
  await renderSettings()
  let finishOlder!: () => void
  let finishLatest!: () => void
  writeClipboard.mockImplementationOnce(() => new Promise<void>((resolve, reject) => {
    finishOlder = () => olderFails ? reject(new Error('Clipboard denied')) : resolve()
  }))
  writeClipboard.mockImplementationOnce(() => new Promise<void>((resolve, reject) => {
    finishLatest = () => olderFails ? resolve() : reject(new Error('Clipboard denied'))
  }))
  const copyButton = container.querySelector<HTMLButtonElement>('button[aria-label="Copy organization ID"]')!
  await act(() => { copyButton.click(); copyButton.click() })
  expect(writeClipboard).toHaveBeenCalledTimes(2)
  await act(async () => finishLatest())
  const expectedLabel = olderFails ? 'Organization ID copied' : 'Copy failed. Try again.'
  const expectedFeedback = olderFails ? 'Organization ID copied.' : 'Could not copy. Try again.'
  expect(copyButton.getAttribute('aria-label')).toBe(expectedLabel)
  expect(container.querySelector('[role="status"]')?.textContent).toBe(expectedFeedback)
  await act(async () => finishOlder())
  expect(copyButton.getAttribute('aria-label')).toBe(expectedLabel)
  expect(container.querySelector('[role="status"]')?.textContent).toBe(expectedFeedback)
})

test('an unavailable clipboard reports failure without claiming success', async () => {
  Object.defineProperty(browser.navigator, 'clipboard', { configurable: true, value: undefined })
  await renderSettings()
  const copyButton = container.querySelector<HTMLButtonElement>('button[aria-label="Copy organization ID"]')!
  expect(copyButton).not.toBeNull()
  await act(async () => copyButton.click())
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Could not copy. Try again.')
  expect(copyButton.getAttribute('aria-label')).not.toBe('Organization ID copied')
})

test('a late clipboard result cannot show success for a different organization', async () => {
  organizations = [organization, otherOrganization]
  await renderSettings()
  let finish!: () => void
  writeClipboard.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
  const copyButton = container.querySelector<HTMLButtonElement>('button[aria-label="Copy organization ID"]')!
  expect(copyButton).not.toBeNull()
  await act(() => copyButton.click())
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  await act(async () => finish())
  expect(container.querySelector('[role="status"]')?.textContent).toBe('')
  expect(container.querySelector('button[aria-label="Organization ID copied"]')).toBeNull()
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Copy organization ID"]')!.click())
  expect(writeClipboard).toHaveBeenLastCalledWith(otherOrganization.id)
  expect(container.querySelector('button[aria-label="Organization ID copied"]')).not.toBeNull()
})

for (const width of [360, 700]) test(`settings stacks organization fields at ${width}px`, async () => {
  browser.happyDOM.setWindowSize({ width, height: 812 })
  const style = document.createElement('style')
  style.textContent = ['account.css', 'organization-settings.css'].map((file) => readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8')).join('\n')
  document.head.append(style)
  await renderSettings()
  const css = (selector: string) => window.getComputedStyle(container.querySelector(selector)!)
  expect(css('.account').flexDirection).toBe('column')
  expect(css('.account-rows > div').flexDirection).toBe('column')
  expect(css('.account-rows dt').width).toBe('auto')
  expect(css('.organization-id').overflowWrap).toBe('anywhere')
})

for (const role of ['admin', 'developer']) test(`${role} cannot open organization deletion`, async () => {
  organizations = [{ ...organization, role }]
  await renderSettings()
  const leave = settingsButton('Leave')
  expect(leave.textContent).toBe('Leave')
  expect(leave.disabled).toBe(true)
  expect(leave.title).toBe('Coming soon')
  expect([...container.querySelectorAll<HTMLButtonElement>('nav[aria-label="Settings"] button')].map((button) => [button.textContent, button.disabled, button.title])).toEqual([['Notifications', true, 'Coming soon'], ['My scope', true, 'Coming soon']])
  const fetchCalls = (globalThis.fetch as ReturnType<typeof mock>).mock.calls.length
  await act(() => leave.click())
  expect((globalThis.fetch as ReturnType<typeof mock>).mock.calls).toHaveLength(fetchCalls)
  expect(container.querySelector('.organization-settings dialog')).toBeNull()
  expect(deleteRequest).not.toHaveBeenCalled()
})

test('deletion requires the exact organization name and cancel resets confirmation', async () => {
  await renderSettings()
  await openDelete()
  expect(dialog().open).toBe(true)
  expect(document.activeElement === dialog().querySelector('input')).toBe(true)
  expect(confirmButton().disabled).toBe(true)
  for (const name of ['platform', ' Platform ', 'Other']) {
    await enterName(name)
    expect(confirmButton().disabled).toBe(true)
    await act(() => submit())
  }
  expect(deleteRequest).not.toHaveBeenCalled()
  await enterName(organization.name)
  expect(confirmButton().disabled).toBe(false)
  await act(async () => buttonNamed(dialog(), 'Cancel', 'button').click())
  await openDelete()
  expect(dialog().querySelector('input')?.value).toBe('')
  expect(confirmButton().disabled).toBe(true)
})

for (const cancel of ['Escape', 'Cancel']) test(`${cancel} prevents deletion during the closing animation`, async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  const closingDialog = dialog()
  let finish!: () => void
  const finished = new Promise<void>((resolve) => { finish = resolve })
  closingDialog.getAnimations = () => [{ finished } as unknown as Animation]
  deleteRequest.mockImplementation(() => new Promise<Response>(() => {}))
  await act(() => {
    if (cancel === 'Escape') closingDialog.dispatchEvent(new browser.Event('cancel', { cancelable: true }))
    else buttonNamed(closingDialog, 'Cancel', 'button').click()
    submit()
  })
  expect(closingDialog.dataset.closing).toBe('')
  expect(closingDialog.open).toBe(true)
  expect(deleteRequest).not.toHaveBeenCalled()
  await act(async () => finish())
  expect(closingDialog.open).toBe(false)
  await openDelete()
  expect(dialog().querySelector('input')?.value).toBe('')
  await enterName(organization.name)
  deleteRequest.mockImplementation(confirmDeletion)
  await act(async () => submit())
  expect(deleteRequest).toHaveBeenCalledTimes(1)
})

for (const remaining of [false, true]) test(`successful deletion updates the shell with remaining organizations: ${remaining}`, async () => {
  if (remaining) organizations = [organization, otherOrganization]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let finish!: (response: Response) => void
  deleteRequest.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
  await act(() => { submit(); submit() })
  expect(deleteRequest).toHaveBeenCalledTimes(1)
  const [url, init] = deleteRequest.mock.calls[0]
  expect(url).toBe(`https://api.keysy.net/v0/orgs/${organization.id}`)
  expect(init.method).toBe('DELETE')
  expect(init.credentials).toBe('include')
  expect(init.body).toBeUndefined()
  expect(confirmButton().textContent).toBe('Deleting...')
  expect(confirmButton().disabled).toBe(true)
  expect(dialog().querySelector('input')?.disabled).toBe(true)
  await act(() => dialog().dispatchEvent(new browser.Event('cancel', { cancelable: true })))
  expect(dialog().open).toBe(true)
  organizations = organizations.filter((item) => item.id !== organization.id)
  await act(async () => finish(new Response(null, { status: 204 })))
  if (remaining) {
    expect(router.replace).toHaveBeenCalledWith(`/orgs/${otherOrganization.id}/secrets`)
    pathname = `/orgs/${otherOrganization.id}/secrets`
    await act(async () => root.render(<SessionGate><p>Secrets</p></SessionGate>))
    expect(container.querySelector('.topbar-org')?.textContent).toBe('Other')
  } else {
    expect(router.replace).toHaveBeenCalledWith('/account/organizations')
    expect(container.querySelector('.rail')).toBeNull()
  }
})

for (const remaining of [false, true]) for (const batched of [false, true]) test(`successful overlapping deletions use the latest organizations with a remaining organization: ${remaining}, batched responses: ${batched}`, async () => {
  const survivingOrganization = { ...organization, id: 'surviving-id', name: 'Surviving' }
  organizations = [organization, otherOrganization, ...(remaining ? [survivingOrganization] : [])]
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  await openDelete()
  await enterName(otherOrganization.name)
  let finishOther!: (response: Response) => void
  deleteRequest.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishOther = resolve }))
  await act(() => submit())

  pathname = `/orgs/${organization.id}/settings`
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let finishCurrent!: (response: Response) => void
  deleteRequest.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishCurrent = resolve }))
  await act(() => submit())
  expect(deleteRequest.mock.calls.map(([url]) => url)).toEqual([
    `https://api.keysy.net/v0/orgs/${otherOrganization.id}`,
    `https://api.keysy.net/v0/orgs/${organization.id}`,
  ])

  if (batched) {
    organizations = remaining ? [survivingOrganization] : []
    await act(async () => {
      finishOther(new Response(null, { status: 204 }))
      finishCurrent(new Response(null, { status: 204 }))
    })
  } else {
    organizations = organizations.filter((item) => item.id !== otherOrganization.id)
    await act(async () => finishOther(new Response(null, { status: 204 })))
    expect(router.replace).not.toHaveBeenCalled()
    expect(container.querySelector('.topbar-org')?.textContent).toBe(organization.name)
    organizations = remaining ? [survivingOrganization] : []
    await act(async () => finishCurrent(new Response(null, { status: 204 })))
  }
  const destination = remaining ? `/orgs/${survivingOrganization.id}/secrets` : '/account/organizations'
  expect(router.replace).toHaveBeenCalledTimes(1)
  expect(router.replace).toHaveBeenCalledWith(destination)
  expect(listOrganizations).toHaveBeenCalledTimes(3)
  pathname = destination
  await act(async () => root.render(<SessionGate><p>Destination</p></SessionGate>))
  expect(container.querySelector('.topbar-org')?.textContent ?? null).toBe(remaining ? survivingOrganization.name : null)
  expect(container.textContent).toContain('Destination')
})

for (const failure of [404, 500, 'network', 'timeout'] as const) test(`delete handles ${failure} and allows retry`, async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => typeof failure === 'number'
    ? Promise.resolve(new Response(null, { status: failure }))
    : Promise.reject(failure === 'timeout' ? new DOMException('Timed out', 'TimeoutError') : new Error('Network unavailable')))
  await act(async () => submit())
  await settleOrganizationRequests()
  expect(dialog().querySelector('[role="alert"]')?.textContent).toBeTruthy()
  expect(dialog().querySelector('input')?.value).toBe(organization.name)
  expect(confirmButton().disabled).toBe(false)
  expect(container.querySelector('.topbar-org')?.textContent).toBe(organization.name)
  expect(router.replace).not.toHaveBeenCalled()
  deleteRequest.mockImplementation(confirmDeletion)
  await act(async () => submit())
  expect(deleteRequest).toHaveBeenCalledTimes(2)
  expect(router.replace).toHaveBeenCalledWith('/account/organizations')
})

for (const failure of ['network', 'timeout'] as const) for (const remaining of [false, true]) test(`a lost delete response navigates after reconciliation: ${failure}, remaining: ${remaining}`, async () => {
  if (remaining) organizations = [organization, otherOrganization]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => {
    organizations = remaining ? [otherOrganization] : []
    return Promise.reject(failure === 'timeout' ? new DOMException('Timed out', 'TimeoutError') : new Error('Response lost'))
  })
  await act(async () => submit())
  await settleOrganizationRequests()
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  expect(deleteRequest).toHaveBeenCalledTimes(1)
  expect(dialog()).toBeNull()
  expect(router.replace).toHaveBeenCalledTimes(1)
  expect(router.replace).toHaveBeenCalledWith(remaining ? `/orgs/${otherOrganization.id}/secrets` : '/account/organizations')
})

for (const remaining of [false, true]) test(`retry after a lost delete response reconciles organizations: ${remaining}`, async () => {
  if (remaining) organizations = [organization, otherOrganization]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => Promise.reject(new Error('Response lost')))
  await act(async () => submit())
  await settleOrganizationRequests()
  expect(dialog().querySelector('[role="alert"]')?.textContent).toBeTruthy()
  organizations = remaining ? [{ ...otherOrganization, name: 'Updated' }] : []
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
  await act(async () => submit())
  expect(listOrganizations).toHaveBeenCalledTimes(3)
  expect(container.querySelector('.topbar-org')?.textContent).not.toBe(organization.name)
  expect(router.replace).toHaveBeenCalledWith(remaining ? `/orgs/${otherOrganization.id}/secrets` : '/account/organizations')
  if (remaining) {
    pathname = `/orgs/${otherOrganization.id}/secrets`
    await act(async () => root.render(<SessionGate><p>Secrets</p></SessionGate>))
    expect(container.querySelector('.topbar-org')?.textContent).toBe('Updated')
  }
})

test('a 404 refreshes changed permissions without treating it as deletion', async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  organizations = [{ ...organization, role: 'developer' }]
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
  await act(async () => submit())
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  expect(container.querySelector('.topbar-org')?.textContent).toBe(organization.name)
  expect(settingsButton('Leave').textContent).toBe('Leave')
  expect(settingsButton('Leave').disabled).toBe(true)
  expect(router.replace).not.toHaveBeenCalled()
})

for (const outcome of ['404', 'network'] as const) for (const failure of ['network', 'invalid', 500] as const) test(`a failed ${outcome} reconciliation preserves organizations and allows retry: ${failure}`, async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => outcome === '404'
    ? Promise.resolve(new Response(null, { status: 404 }))
    : Promise.reject(new Error('Response lost')))
  listOrganizations.mockImplementation(() => failure === 'network'
    ? Promise.reject(new Error('Network unavailable'))
    : Promise.resolve(failure === 'invalid' ? Response.json({}) : new Response(null, { status: failure })))
  await act(async () => submit())
  await settleOrganizationRequests()
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  expect(container.querySelector('.topbar-org')?.textContent).toBe(organization.name)
  expect(router.replace).not.toHaveBeenCalled()
  expect(dialog().querySelector('[role="alert"]')?.textContent).toBeTruthy()
  expect(dialog().querySelector('input')?.value).toBe(organization.name)
  expect(confirmButton().disabled).toBe(false)
  listOrganizations.mockImplementation(() => Promise.resolve(Response.json([])))
  await act(async () => submit())
  expect(router.replace).toHaveBeenCalledWith('/account/organizations')
})

test('an expired session during 404 reconciliation redirects to sign-in', async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
  listOrganizations.mockImplementation(() => Promise.resolve(new Response(null, { status: 401 })))
  await act(async () => submit())
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  expect(router.replace).toHaveBeenCalledWith('/signin')
})

test('404 reconciliation stays pending and updates organizations after leaving settings', async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
  let finish!: (response: Response) => void
  listOrganizations.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
  await act(async () => submit())
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  const signal = listOrganizations.mock.calls[1][1].signal as AbortSignal
  expect(confirmButton().disabled).toBe(true)
  await act(() => {
    dialog().dispatchEvent(new browser.Event('cancel', { cancelable: true }))
    submit()
  })
  expect(dialog().open).toBe(true)
  expect(deleteRequest).toHaveBeenCalledTimes(1)
  pathname = '/account'
  await act(async () => root.render(<SessionGate><GeneralPage /></SessionGate>))
  expect(signal.aborted).toBe(false)
  await act(async () => finish(Response.json([])))
  expect(container.querySelector('.topbar-org')).toBeNull()
  expect(router.replace).not.toHaveBeenCalled()
})

for (const outcome of ['404', 'network'] as const) test(`a late ${outcome} reconciliation cannot restore a subsequently deleted organization`, async () => {
  organizations = [organization, otherOrganization]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let finishDelete!: () => void
  deleteRequest.mockImplementationOnce(() => new Promise<Response>((resolve, reject) => {
    finishDelete = () => outcome === '404'
      ? resolve(new Response(null, { status: 404 }))
      : reject(new Error('Response lost'))
  }))
  let finishRefresh!: (response: Response) => void
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishRefresh = resolve }))
  await act(() => submit())
  if (outcome === '404') await act(async () => finishDelete())

  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  if (outcome === 'network') await act(async () => finishDelete())
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  await openDelete()
  await enterName(otherOrganization.name)
  await act(async () => submit())
  expect(deleteRequest).toHaveBeenCalledTimes(2)
  expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
  router.replace.mockClear()

  organizations = []
  await act(async () => finishRefresh(Response.json([otherOrganization])))
  expect(listOrganizations).toHaveBeenCalledTimes(3)
  expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
  expect(container.querySelector('.organization-settings')).toBeNull()
  expect(container.querySelector('.topbar-org')).toBeNull()
  expect(router.replace).not.toHaveBeenCalled()
})

test('an expired delete session redirects to sign-in', async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 401 })))
  await act(async () => submit())
  expect(router.replace).toHaveBeenCalledWith('/signin')
})

test('signing out cannot be undone by a late delete response', async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let finish!: (response: Response) => void
  deleteRequest.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
  await act(() => submit())
  pathname = '/account'
  await act(async () => root.render(<SessionGate><GeneralPage /></SessionGate>))
  globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 204 }))) as unknown as typeof fetch
  await act(() => buttonNamed(container.querySelector('.account-sections')!, 'Sign out', 'button-danger').click())
  await act(async () => buttonNamed(container.querySelector('dialog')!, 'Sign out', 'button-danger').click())
  organizations = organizations.filter((item) => item.id !== organization.id)
  await act(async () => finish(new Response(null, { status: 204 })))
  expect(router.replace).toHaveBeenCalledWith('/signin')
  expect(router.replace).not.toHaveBeenCalledWith('/secrets')
  expect(router.replace).not.toHaveBeenCalledWith('/account/organizations')
})

test('a direct link selects the second organization for the header, navigation, and delete request', async () => {
  organizations = [organization, otherOrganization]
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  expect(container.querySelector('.topbar-org')?.textContent).toBe('Other')
  expect(container.querySelector('code')?.textContent).toBe(otherOrganization.id)
  expect([...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Main"] a')].map((link) => link.getAttribute('href'))).toEqual([
    `/orgs/${otherOrganization.id}/secrets`, `/orgs/${otherOrganization.id}/services`, `/orgs/${otherOrganization.id}/members`,
    `/orgs/${otherOrganization.id}/audit-log`, `/orgs/${otherOrganization.id}/settings`,
  ])
  await openDelete()
  await enterName(otherOrganization.name)
  await act(async () => submit())
  expect(deleteRequest.mock.calls[0][0]).toBe(`https://api.keysy.net/v0/orgs/${otherOrganization.id}`)
  expect(router.replace).toHaveBeenCalledWith(`/orgs/${organization.id}/secrets`)
})

test('permissions come from the organization in the URL', async () => {
  organizations = [organization, { ...otherOrganization, role: 'developer' }]
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  expect(container.querySelector('.topbar-org')?.textContent).toBe('Other')
  expect(settingsButton('Leave').disabled).toBe(true)
  expect(container.querySelector('.organization-settings dialog')).toBeNull()
})

for (const available of [false, true]) test(`an unavailable organization never falls back to another organization: ${available}`, async () => {
  organizations = available ? [organization] : []
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
  expect(container.querySelector('.organization-settings')).toBeNull()
  expect(container.querySelector('.topbar-org')).toBeNull()
  expect(container.querySelector('a[href="/account/organizations"]')).not.toBeNull()
  expect(router.replace).not.toHaveBeenCalled()
  expect(deleteRequest).not.toHaveBeenCalled()
})

test('switching organization paths discards confirmation and applies a late deletion without redirecting', async () => {
  organizations = [organization, otherOrganization]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let finish!: (response: Response) => void
  deleteRequest.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
  await act(() => submit())
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  expect(container.querySelector('.topbar-org')?.textContent).toBe('Other')
  await openDelete()
  expect(dialog().querySelector('input')?.value).toBe('')
  organizations = organizations.filter((item) => item.id !== organization.id)
  await act(async () => finish(new Response(null, { status: 204 })))
  expect(router.replace).not.toHaveBeenCalled()
  expect(container.querySelector('code')?.textContent).toBe(otherOrganization.id)
  pathname = `/orgs/${organization.id}/settings`
  await renderSettings()
  expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
  expect(container.querySelector('.rail')).toBeNull()
})

for (const outcome of ['success', 'network', 'timeout'] as const) test(`leaving settings reconciles a deletion after ${outcome} without redirecting`, async () => {
  organizations = [organization, otherOrganization]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let finish!: () => void
  deleteRequest.mockImplementation(() => new Promise<Response>((resolve, reject) => {
    finish = () => outcome === 'success'
      ? resolve(new Response(null, { status: 204 }))
      : reject(outcome === 'timeout' ? new DOMException('Timed out', 'TimeoutError') : new Error('Response lost'))
  }))
  await act(() => submit())
  pathname = '/account'
  await act(async () => root.render(<SessionGate><GeneralPage /></SessionGate>))
  organizations = [otherOrganization]
  await act(async () => finish())
  if (outcome !== 'success') expect(listOrganizations).toHaveBeenCalledTimes(2)
  expect(container.querySelector('.topbar-org')?.textContent).toBe(otherOrganization.name)
  expect(router.replace).not.toHaveBeenCalled()
  pathname = `/orgs/${organization.id}/settings`
  await renderSettings()
  expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
  expect(container.querySelector('.rail')).toBeNull()
})

test('an uncertain deletion after leaving settings keeps an organization that still exists with its refreshed role', async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let fail!: (error: Error) => void
  deleteRequest.mockImplementation(() => new Promise<Response>((_resolve, reject) => { fail = reject }))
  await act(() => submit())
  pathname = '/account'
  await act(async () => root.render(<SessionGate><GeneralPage /></SessionGate>))
  organizations = [{ ...organization, role: 'developer' }]
  await act(async () => fail(new Error('Response lost')))
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  expect(router.replace).not.toHaveBeenCalled()
  pathname = `/orgs/${organization.id}/settings`
  await renderSettings()
  expect(container.querySelector('h1')?.textContent).toBe('General')
  expect(settingsButton('Leave').textContent).toBe('Leave')
  expect(settingsButton('Leave').disabled).toBe(true)
})

for (const outcome of ['404', 'network'] as const) test(`a fresh reconciliation after another deletion removes the unavailable organization: ${outcome}`, async () => {
  organizations = [organization, otherOrganization]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let finishDelete!: () => void
  deleteRequest.mockImplementationOnce(() => new Promise<Response>((resolve, reject) => {
    finishDelete = () => outcome === '404'
      ? resolve(new Response(null, { status: 404 }))
      : reject(new Error('Response lost'))
  }))
  await act(() => submit())

  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  await openDelete()
  await enterName(otherOrganization.name)
  await act(async () => submit())
  expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  organizations = []
  await act(async () => finishDelete())
  expect(listOrganizations).toHaveBeenCalledTimes(3)

  pathname = `/orgs/${organization.id}/settings`
  await renderSettings()
  expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
  expect(container.querySelector('.organization-settings')).toBeNull()
})

function OrganizationChanges() {
  const { createOrganization } = useCurrentUser()
  return <button onClick={() => void createOrganization('Created')}>Create another organization</button>
}

test('a mounted delete dialog navigates only with the accepted reconciliation result', async () => {
  await act(async () => root.render(<SessionGate><SettingsPage /><OrganizationChanges /></SessionGate>))
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
  let finish!: (response: Response) => void
  let finishLatest!: (response: Response) => void
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve }))
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishLatest = resolve }))
  await act(() => submit())
  await act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Create another organization')!.click())
  await act(async () => finish(Response.json([])))
  expect(router.replace).not.toHaveBeenCalled()
  await act(async () => finishLatest(Response.json([{ ...otherOrganization, id: 'created-id', name: 'Created' }])))
  expect(listOrganizations).toHaveBeenCalledTimes(3)
  expect(router.replace).toHaveBeenCalledTimes(1)
  expect(router.replace).toHaveBeenCalledWith('/orgs/created-id/secrets')
})

test('each organization change during reconciliation triggers another read before accepting a snapshot', async () => {
  organizations = [organization, otherOrganization]
  await act(async () => root.render(<SessionGate><SettingsPage /><OrganizationChanges /></SessionGate>))
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 404 })))
  let finishFirst!: (response: Response) => void
  let finishSecond!: (response: Response) => void
  let finishThird!: (response: Response) => void
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishFirst = resolve }))
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishSecond = resolve }))
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishThird = resolve }))
  await act(() => submit())
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  await act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Create another organization')!.click())
  await act(async () => finishFirst(Response.json([])))
  expect(listOrganizations).toHaveBeenCalledTimes(3)
  expect(confirmButton().disabled).toBe(true)
  expect(router.replace).not.toHaveBeenCalled()
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  await openDelete()
  await enterName(otherOrganization.name)
  await act(async () => submit())
  router.replace.mockClear()
  await act(async () => finishSecond(Response.json([otherOrganization])))
  expect(listOrganizations).toHaveBeenCalledTimes(4)
  expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
  const created = { ...otherOrganization, id: 'created-id', name: 'Created' }
  await act(async () => finishThird(Response.json([created])))
  expect(router.replace).not.toHaveBeenCalled()
  pathname = `/orgs/${created.id}/settings`
  await renderSettings()
  expect(container.querySelector('.topbar-org')?.textContent).toBe('Created')
  pathname = `/orgs/${organization.id}/settings`
  await renderSettings()
  expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
})

test('an older cancelled reconciliation cannot replace newer permissions', async () => {
  organizations = [organization, otherOrganization]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
  let finishOlder!: (response: Response) => void
  let finishNewer!: (response: Response) => void
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishOlder = resolve }))
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishNewer = resolve }))
  await act(() => submit())
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  await openDelete()
  await enterName(otherOrganization.name)
  await act(() => submit())
  expect(listOrganizations).toHaveBeenCalledTimes(3)
  await act(async () => finishNewer(Response.json([{ ...otherOrganization, role: 'developer' }])))
  expect(settingsButton('Leave').textContent).toBe('Leave')
  organizations = [{ ...otherOrganization, role: 'developer' }]
  await act(async () => finishOlder(Response.json([organization, otherOrganization])))
  expect(listOrganizations).toHaveBeenCalledTimes(3)
  expect(settingsButton('Leave').textContent).toBe('Leave')
  expect(router.replace).not.toHaveBeenCalled()
  pathname = `/orgs/${organization.id}/settings`
  await renderSettings()
  expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
})

for (const outcome of ['signout', 'unmount'] as const) test(`a pending reconciliation is cancelled after ${outcome}`, async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
  let finish!: (response: Response) => void
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve }))
  await act(() => submit())
  const signal = listOrganizations.mock.calls[1][1].signal as AbortSignal
  if (outcome === 'signout') {
    pathname = '/account'
    await act(async () => root.render(<SessionGate><GeneralPage /></SessionGate>))
    globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 204 }))) as unknown as typeof fetch
    await act(() => buttonNamed(container.querySelector('.account-sections')!, 'Sign out', 'button-danger').click())
    await act(async () => buttonNamed(container.querySelector('dialog')!, 'Sign out', 'button-danger').click())
  } else {
    await act(() => root.unmount())
    root = createRoot(container)
  }
  expect(signal.aborted).toBe(true)
  router.replace.mockClear()
  await act(async () => finish(Response.json([])))
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  expect(router.replace).not.toHaveBeenCalled()
  expect(container.querySelector('.dashboard')).toBeNull()
})

for (const status of [204, 404, 'network', 'timeout'] as const) test(`leaving and returning to settings prevents an old ${status} deletion from navigating`, async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let finish!: () => void
  deleteRequest.mockImplementationOnce(() => new Promise<Response>((resolve, reject) => {
    finish = () => typeof status === 'number'
      ? resolve(new Response(null, { status }))
      : reject(status === 'timeout' ? new DOMException('Timed out', 'TimeoutError') : new Error('Response lost'))
  }))
  await act(() => submit())
  pathname = '/account'
  await act(async () => root.render(<SessionGate><GeneralPage /></SessionGate>))
  pathname = `/orgs/${organization.id}/settings`
  await renderSettings()
  await openDelete()
  expect(dialog().querySelector('input')?.value).toBe('')
  organizations = []
  await act(async () => finish())
  expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
  expect(router.replace).not.toHaveBeenCalled()
})

test('a cancelled list response with 401 cannot sign out the current session', async () => {
  organizations = [organization, otherOrganization]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 404 })))
  let finish!: (response: Response) => void
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve }))
  await act(() => submit())
  const signal = listOrganizations.mock.calls[1][1].signal as AbortSignal
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  await openDelete()
  await enterName(otherOrganization.name)
  await act(async () => submit())
  expect(signal.aborted).toBe(true)
  router.replace.mockClear()
  await act(async () => finish(new Response(null, { status: 401 })))
  expect(container.querySelector('.dashboard') !== null).toBe(true)
  expect(router.replace).not.toHaveBeenCalled()
})

test('simultaneous parallel deletions replace an overlapping read and preserve the final permissions', async () => {
  const remaining = { ...organization, id: 'remaining-id', name: 'Remaining' }
  organizations = [organization, otherOrganization, remaining]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let finishFirstDelete!: (response: Response) => void
  let finishSecondDelete!: (response: Response) => void
  deleteRequest.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishFirstDelete = resolve }))
  deleteRequest.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishSecondDelete = resolve }))
  await act(() => submit())
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  await openDelete()
  await enterName(otherOrganization.name)
  await act(() => submit())
  expect(deleteRequest).toHaveBeenCalledTimes(2)
  let finishOlderRead!: (response: Response) => void
  let finishFinalRead!: (response: Response) => void
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishOlderRead = resolve }))
  listOrganizations.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishFinalRead = resolve }))
  await act(async () => {
    finishFirstDelete(new Response(null, { status: 204 }))
    finishSecondDelete(new Response(null, { status: 204 }))
  })
  expect(listOrganizations).toHaveBeenCalledTimes(3)
  expect((listOrganizations.mock.calls[1][1].signal as AbortSignal).aborted).toBe(true)
  await act(async () => finishFinalRead(Response.json([{ ...remaining, role: 'developer' }])))
  await act(async () => finishOlderRead(Response.json([organization, otherOrganization, remaining])))
  expect(router.replace).toHaveBeenCalledTimes(1)
  expect(router.replace).toHaveBeenCalledWith('/orgs/remaining-id/secrets')
  pathname = '/orgs/remaining-id/settings'
  await renderSettings()
  expect(settingsButton('Leave').textContent).toBe('Leave')
  for (const deleted of [organization, otherOrganization]) {
    pathname = `/orgs/${deleted.id}/settings`
    await renderSettings()
    expect(container.querySelector('h1')?.textContent).toBe('Organization unavailable')
  }
})

async function typeOrganizationName(name: string) {
  await act(() => {
    const input = container.querySelector<HTMLInputElement>('#organization-settings-name')!
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(input, name)
    input.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}
function renameForm() { return container.querySelector<HTMLFormElement>('.organization-rename')! }
function submitRename() { renameForm().dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })) }

test('an owner renames the organization and the new name replaces the old one everywhere', async () => {
  await renderSettings()
  expect(container.querySelector('.organization-rename button[type="submit"]')).toBeNull()
  await typeOrganizationName('  Renamed  ')
  expect(container.querySelector('.organization-rename button[type="submit"]')?.textContent).toBe('Save')
  await act(async () => submitRename())
  await settleOrganizationRequests()
  expect(renameRequest).toHaveBeenCalledTimes(1)
  const [url, init] = renameRequest.mock.calls[0] as [string, RequestInit]
  expect(url).toBe(`https://api.keysy.net/v0/orgs/${organization.id}`)
  expect(init.method).toBe('PATCH')
  expect(init.body).toBe(JSON.stringify({ name: 'Renamed' }))
  expect(container.querySelector('.topbar-org')?.textContent).toBe('Renamed')
  expect(container.querySelector<HTMLInputElement>('#organization-settings-name')?.value).toBe('Renamed')
  expect(container.querySelector('.organization-rename button[type="submit"]')).toBeNull()
})

test('rename rejects a blank name without calling the API', async () => {
  await renderSettings()
  await typeOrganizationName('   ')
  expect(container.querySelector<HTMLButtonElement>('.organization-rename button[type="submit"]')?.disabled).toBe(true)
  await act(async () => submitRename())
  expect(renameRequest).not.toHaveBeenCalled()
})

test('a failed rename shows an error and keeps the draft', async () => {
  renameRequest.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 500 })))
  await renderSettings()
  await typeOrganizationName('Renamed')
  await act(async () => submitRename())
  await settleOrganizationRequests()
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Could not save. Try again.')
  expect(container.querySelector<HTMLInputElement>('#organization-settings-name')?.value).toBe('Renamed')
  expect(container.querySelector('.topbar-org')?.textContent).toBe(organization.name)
})

for (const saved of [true, false]) test(`a lost rename response reconciles with the refreshed name: saved ${saved}`, async () => {
  renameRequest.mockImplementationOnce((url: string, init: RequestInit) => {
    if (saved) organizations = organizations.map((item) => item.id === String(url).split('/').pop() ? { ...item, name: JSON.parse(String(init.body)).name } : item)
    return Promise.reject(new Error('Response lost'))
  })
  await renderSettings()
  await typeOrganizationName('Renamed')
  await act(async () => submitRename())
  await settleOrganizationRequests()
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  expect(container.querySelector('[role="alert"]')?.textContent ?? null).toBe(saved ? null : 'Could not save. Try again.')
  expect(container.querySelector('.topbar-org')?.textContent).toBe(saved ? 'Renamed' : organization.name)
  expect(container.querySelector<HTMLInputElement>('#organization-settings-name')?.value).toBe('Renamed')
  expect(container.querySelector('.organization-rename button[type="submit"]')?.textContent ?? null).toBe(saved ? null : 'Save')
})

for (const role of ['admin', 'developer']) test(`a ${role} cannot rename the organization`, async () => {
  organizations = [{ ...organization, role }]
  await renderSettings()
  expect(container.querySelector<HTMLInputElement>('#organization-settings-name')?.readOnly).toBe(true)
  expect(container.querySelector('.organization-rename button[type="submit"]')).toBeNull()
})
