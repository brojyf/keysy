import { createFileRoute, Outlet } from '@tanstack/react-router'
import AccountShell from '../components/account-shell'

export const Route = createFileRoute('/account')({
  component: () => <AccountShell><Outlet /></AccountShell>,
  head: () => ({ meta: [{ title: 'Account | Keysy' }] }),
})
