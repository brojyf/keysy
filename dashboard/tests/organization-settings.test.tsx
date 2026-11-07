import { Window } from 'happy-dom'
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
let listOrganizations: ReturnType<typeof mock>

beforeEach(() => {
  pathname = `/orgs/${organization.id}/settings`
  organizations = [organization]
  deleteRequest = mock(() => Promise.resolve(new Response(null, { status: 204 })))
  listOrganizations = mock(() => Promise.resolve(Response.json(organizations)))
  router.replace.mockClear()
  router.push.mockClear()
  process.env.NEXT_PUBLIC_API_URL = 'https://api.keysy.net'
  process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.keysy.net'
  browser = new Window({ url: 'https://dashboard.keysy.net' })
  Object.assign(globalThis, { window: browser, document: browser.document, IS_REACT_ACT_ENVIRONMENT: true })
  globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'DELETE') return deleteRequest(url, init)
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
})

async function renderSettings() {
  await act(async () => root.render(<SessionGate><SettingsPage /></SessionGate>))
}

function dialog() { return container.querySelector<HTMLDialogElement>('.organization-settings dialog')! }
function confirmButton() { return dialog().querySelector<HTMLButtonElement>('.dialog-danger')! }
function submit() { dialog().querySelector('form')!.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })) }
async function enterName(name: string) {
  await act(() => {
    const input = dialog().querySelector('input')!
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(input, name)
    input.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}
async function openDelete() {
  await act(() => container.querySelector<HTMLButtonElement>('.organization-settings .account-delete')!.click())
}

test('settings shows the current organization and disables unavailable features', async () => {
  await renderSettings()
  expect(container.querySelector('h1')?.textContent).toBe('General')
  expect(container.querySelector<HTMLInputElement>('#organization-settings-name')?.value).toBe(organization.name)
  expect(container.querySelector<HTMLInputElement>('#organization-settings-name')?.readOnly).toBe(true)
  expect(container.querySelector('code')?.textContent).toBe(organization.id)
  expect(container.querySelector('.topbar-org')?.textContent).toBe(organization.name)
  expect(container.querySelector(`[aria-current="page"][href="/orgs/${organization.id}/settings"]`)).not.toBeNull()
  expect(container.querySelector<HTMLButtonElement>('nav[aria-label="Settings"] button')?.disabled).toBe(true)
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
  const leave = container.querySelector<HTMLButtonElement>('.organization-settings .account-delete')!
  expect(leave.textContent).toBe('Leave')
  expect(leave.disabled).toBe(true)
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
  await act(async () => dialog().querySelector<HTMLButtonElement>('.dialog-cancel')!.click())
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
    else closingDialog.querySelector<HTMLButtonElement>('.dialog-cancel')!.click()
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
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })))
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

for (const failure of [404, 500, 'network', 'timeout'] as const) test(`delete handles ${failure} and allows retry`, async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => typeof failure === 'number'
    ? Promise.resolve(new Response(null, { status: failure }))
    : Promise.reject(failure === 'timeout' ? new DOMException('Timed out', 'TimeoutError') : new Error('Network unavailable')))
  await act(async () => submit())
  expect(dialog().querySelector('[role="alert"]')?.textContent).toBeTruthy()
  expect(dialog().querySelector('input')?.value).toBe(organization.name)
  expect(confirmButton().disabled).toBe(false)
  expect(container.querySelector('.topbar-org')?.textContent).toBe(organization.name)
  expect(router.replace).not.toHaveBeenCalled()
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })))
  await act(async () => submit())
  expect(deleteRequest).toHaveBeenCalledTimes(2)
  expect(router.replace).toHaveBeenCalledWith('/account/organizations')
})

for (const remaining of [false, true]) test(`retry after a lost delete response reconciles organizations: ${remaining}`, async () => {
  if (remaining) organizations = [organization, otherOrganization]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => Promise.reject(new Error('Response lost')))
  await act(async () => submit())
  expect(dialog().querySelector('[role="alert"]')?.textContent).toBeTruthy()
  organizations = remaining ? [{ ...otherOrganization, name: 'Updated' }] : []
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
  await act(async () => submit())
  expect(listOrganizations).toHaveBeenCalledTimes(2)
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
  expect(container.querySelector<HTMLButtonElement>('.organization-settings .account-delete')?.textContent).toBe('Leave')
  expect(container.querySelector<HTMLButtonElement>('.organization-settings .account-delete')?.disabled).toBe(true)
  expect(router.replace).not.toHaveBeenCalled()
})

for (const failure of ['network', 'invalid', 500] as const) test(`a failed 404 reconciliation preserves organizations and allows retry: ${failure}`, async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  deleteRequest.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
  listOrganizations.mockImplementation(() => failure === 'network'
    ? Promise.reject(new Error('Network unavailable'))
    : Promise.resolve(failure === 'invalid' ? Response.json({}) : new Response(null, { status: failure })))
  await act(async () => submit())
  expect(listOrganizations).toHaveBeenCalledTimes(2)
  expect(container.querySelector('.topbar-org')?.textContent).toBe(organization.name)
  expect(router.replace).not.toHaveBeenCalled()
  expect(dialog().querySelector('[role="alert"]')?.textContent).toBeTruthy()
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

test('404 reconciliation stays pending and ignores its response after unmount', async () => {
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
  expect(signal.aborted).toBe(true)
  await act(async () => finish(Response.json([])))
  expect(container.querySelector('.topbar-org')?.textContent).toBe(organization.name)
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

test('signing out ignores a late delete response and aborts the request', async () => {
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let finish!: (response: Response) => void
  deleteRequest.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
  await act(() => submit())
  const signal = deleteRequest.mock.calls[0][1].signal as AbortSignal
  pathname = '/account'
  await act(async () => root.render(<SessionGate><GeneralPage /></SessionGate>))
  expect(signal.aborted).toBe(true)
  globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 204 }))) as unknown as typeof fetch
  await act(() => container.querySelector<HTMLButtonElement>('.account-sign-out')!.click())
  await act(async () => container.querySelector<HTMLButtonElement>('.dialog-danger')!.click())
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
  expect(container.querySelector<HTMLButtonElement>('.organization-settings .account-delete')?.disabled).toBe(true)
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

test('switching organization paths discards confirmation and ignores a late deletion', async () => {
  organizations = [organization, otherOrganization]
  await renderSettings()
  await openDelete()
  await enterName(organization.name)
  let finish!: (response: Response) => void
  deleteRequest.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
  await act(() => submit())
  const signal = deleteRequest.mock.calls[0][1].signal as AbortSignal
  pathname = `/orgs/${otherOrganization.id}/settings`
  await renderSettings()
  expect(signal.aborted).toBe(true)
  expect(container.querySelector('.topbar-org')?.textContent).toBe('Other')
  await openDelete()
  expect(dialog().querySelector('input')?.value).toBe('')
  await act(async () => finish(new Response(null, { status: 204 })))
  expect(router.replace).not.toHaveBeenCalled()
  expect(container.querySelector('code')?.textContent).toBe(otherOrganization.id)
})
