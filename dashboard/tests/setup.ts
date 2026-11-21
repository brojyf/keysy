import { mock } from 'bun:test'
import { createElement } from 'react'
import * as router from '@tanstack/react-router'

export let pathname = () => '/'
export let navigate = (_options: { to: string; replace?: boolean }) => {}
export function setRouterMock(path: () => string, navigation: typeof navigate) { pathname = path; navigate = navigation }

mock.module('@tanstack/react-router', () => ({
  ...router,
  Link: ({ to, children, ...props }: { to: string; children?: React.ReactNode }) => createElement('a', { ...props, href: to }, children),
  useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) => select({ pathname: pathname() }),
  useNavigate: () => navigate,
}))
