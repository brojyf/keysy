'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { KeyRound, ScrollText, Server, Settings, Users, type LucideIcon } from 'lucide-react'
import { Fragment } from 'react'
import { useCurrentUser } from './current-user'
import AccountMenu, { type AccountMenuProps } from './account-menu'

const railGroups: { href: string; label: string; Icon: LucideIcon }[][] = [
  [{ href: '/secrets', label: 'Secrets', Icon: KeyRound }],
  [
    { href: '/services', label: 'Services', Icon: Server },
    { href: '/members', label: 'Members', Icon: Users },
    { href: '/audit-log', label: 'Audit log', Icon: ScrollText },
  ],
  [{ href: '/settings', label: 'Settings', Icon: Settings }],
]

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Rail(accountMenu: AccountMenuProps) {
  const pathname = usePathname() ?? ''
  const { organizations } = useCurrentUser()
  return (
    <aside className="rail">
      {organizations.length > 0 && <nav className="rail-nav" aria-label="Main">
        {railGroups.map((group, index) => (
          <Fragment key={group[0].href}>
            {index > 0 && <hr className="rail-divider" />}
            {group.map(({ href, label, Icon }) => (
              <Link
                key={href}
                className="rail-item"
                href={href}
                aria-label={label}
                title={label}
                aria-current={isCurrentPath(pathname, href) ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
              </Link>
            ))}
          </Fragment>
        ))}
      </nav>}
      <AccountMenu {...accountMenu} selected={isCurrentPath(pathname, '/account')} />
    </aside>
  )
}
