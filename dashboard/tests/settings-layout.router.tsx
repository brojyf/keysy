// Runs without tests/setup.ts: the router mock there renders plain links, so it cannot show TanStack's active state.
import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'
import SettingsLayout from '../src/components/settings-layout'

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

test('only the current sidebar item is marked current when a parent link matches by prefix', async () => {
  const rootRoute = createRootRoute({
    component: () => (
      <SettingsLayout title="Account" Icon={UserRound} heading="Sessions" nav={[
        { label: 'General', href: '/account', current: false },
        { label: 'Sessions', href: '/account/sessions', current: true },
      ]}>
        <p>Page</p>
      </SettingsLayout>
    ),
  })
  const account = createRoute({ getParentRoute: () => rootRoute, path: '/account' })
  const sessions = createRoute({ getParentRoute: () => account, path: '/sessions' })
  const router = createRouter({ routeTree: rootRoute.addChildren([account.addChildren([sessions])]), history: createMemoryHistory({ initialEntries: ['/account/sessions'] }) })
  await act(async () => { await router.load(); root.render(<RouterProvider router={router} />) })
  expect([...container.querySelectorAll('[aria-current="page"]')].map((item) => item.textContent)).toEqual(['Sessions'])
})
