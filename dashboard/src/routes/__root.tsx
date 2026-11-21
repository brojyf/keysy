import { createRootRoute, HeadContent, Outlet } from '@tanstack/react-router'
import SessionGate from '../components/session-gate'
import ThemeSync from '../components/theme-sync'

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: 'Keysy' }] }),
  component: () => <><HeadContent /><ThemeSync /><SessionGate><Outlet /></SessionGate></>,
})
