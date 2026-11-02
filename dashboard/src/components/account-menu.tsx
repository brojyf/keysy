'use client'

import Link from 'next/link'
import { Monitor, Moon, Sun, UserRound } from 'lucide-react'
import { useRef } from 'react'
import { mockProfile } from '../app/account/mock-account'

// Theme is not available yet: the dashboard is light-only, so the switch is disabled.
const themeOptions = [
  { label: 'System', Icon: Monitor },
  { label: 'Light', Icon: Sun },
  { label: 'Dark', Icon: Moon },
]

export type AccountMenuProps = {
  email?: string
  signOutStatus: 'idle' | 'pending' | 'error'
  onSignOut: () => void
}

export default function AccountMenu({ email, signOutStatus, onSignOut, selected }: AccountMenuProps & { selected: boolean }) {
  const menu = useRef<HTMLDivElement>(null)
  return (
    <>
      <button
        className="rail-item"
        type="button"
        popoverTarget="account-menu"
        aria-label="Account menu"
        title="Account"
        data-selected={selected || undefined}
      >
        <span className="rail-avatar">
          <UserRound size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
        </span>
      </button>
      <div id="account-menu" className="account-menu" popover="auto" ref={menu}>
        <div className="account-menu-identity">
          {/* The session has no name yet; the name is mock data like the Account page. */}
          <p className="account-menu-name">{mockProfile.name}</p>
          {email && <p className="account-menu-email">{email}</p>}
        </div>
        <hr className="account-menu-divider" />
        <Link className="account-menu-item" href="/account" onClick={() => menu.current?.hidePopover()}>
          Account
        </Link>
        <div className="account-menu-row">
          Theme
          <div className="theme-switch" role="group" aria-label="Theme" title="Coming soon">
            {themeOptions.map(({ label, Icon }) => (
              <button key={label} type="button" aria-label={label} aria-pressed={label === 'System'} disabled>
                <Icon size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
              </button>
            ))}
          </div>
        </div>
        <hr className="account-menu-divider" />
        <button className="account-menu-item" type="button" disabled={signOutStatus === 'pending'} onClick={onSignOut}>
          {signOutStatus === 'pending' ? 'Signing out...' : 'Sign out'}
        </button>
        {signOutStatus === 'error' && <p className="account-menu-error" role="alert">Could not sign out. Try again.</p>}
      </div>
    </>
  )
}
