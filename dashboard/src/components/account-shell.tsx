'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { useCurrentUser } from './current-user'
import type { ReactNode } from 'react'

const accountPages = [
  { href: '/account', label: 'General' },
  { href: '/account/organizations', label: 'Organizations' },
  { href: '/account/sessions', label: 'Sessions' },
]

export default function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const { organizations } = useCurrentUser()
  const currentPage = accountPages.find((page) => page.href === pathname) ?? accountPages[0]
  return (
    <div className="account">
      <aside className="account-sidebar">
        <p className="account-sidebar-title">Account</p>
        <nav className="account-nav" aria-label="Account">
          {accountPages.map(({ href, label }) => (
            <Link key={href} className="account-nav-item" href={href} aria-current={href === currentPage.href ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="account-page">
        <header className="account-page-header">
          <UserRound size={18} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
          <span className="account-page-slash" aria-hidden>/</span>
          <h1>{currentPage.label}</h1>
          {pathname === '/account/organizations' && organizations.length === 0 && <Link className="account-new-organization" href="/organizations/new">New organization</Link>}
        </header>
        {children}
      </div>
    </div>
  )
}
