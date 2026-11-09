'use client'

import { usePathname } from 'next/navigation'
import { UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import SettingsLayout from './settings-layout'

const accountPages = [
  { href: '/account', label: 'General' },
  { href: '/account/organizations', label: 'Organizations' },
  { href: '/account/sessions', label: 'Sessions' },
]

export default function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const currentPage = accountPages.find((page) => page.href === pathname) ?? accountPages[0]
  return (
    <SettingsLayout title="Account" nav={accountPages.map(({ href, label }) => ({ href, label, current: href === currentPage.href }))} Icon={UserRound} heading={currentPage.label}>
      {children}
    </SettingsLayout>
  )
}
