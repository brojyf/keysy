import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

let currentPathname = '/account'
mock.module('next/navigation', () => ({ usePathname: () => currentPathname }))

const { default: AccountLayout } = await import('../src/app/account/layout')
const { default: GeneralPage } = await import('../src/app/account/page')
const { default: OrganizationsPage } = await import('../src/app/account/organizations/page')
const { default: SessionsPage } = await import('../src/app/account/sessions/page')

let browser: Window
let root: Root
let container: HTMLDivElement

beforeEach(() => {
  browser = new Window({ url: 'https://dashboard.keysy.net' })
  Object.assign(globalThis, { window: browser, document: browser.document, IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(() => root.unmount())
  await browser.happyDOM.close()
})

async function renderAccount(pathname: string, page: ReactNode) {
  currentPathname = pathname
  await act(async () => root.render(<AccountLayout>{page}</AccountLayout>))
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

test('General shows the mock profile as read-only values', async () => {
  await renderAccount('/account', <GeneralPage />)
  expect(container.querySelector('h1')?.textContent).toBe('General')
  expect(text('h2')).toEqual(['Profile', 'Agent', 'Appearance', 'Danger zone'])
  expect(text('dt')).toEqual(['Name', 'Email', 'Sign-in method', 'Apply changes automatically', 'Theme', 'Delete account'])
  expect(text('dd').slice(0, 3)).toEqual(['Jordan Lee', 'jordan@acme.dev', 'Google'])
  expect(container.querySelector('input')).toBeNull()
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
