import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import AccountShell from '../../components/account-shell'

export const metadata: Metadata = { title: 'Account' }

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>
}
