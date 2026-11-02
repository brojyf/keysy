'use client'

import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { useRef } from 'react'

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
        {email && <p className="account-menu-email">{email}</p>}
        <Link className="account-menu-item" href="/account" onClick={() => menu.current?.hidePopover()}>
          Account
        </Link>
        <button className="account-menu-item" type="button" disabled={signOutStatus === 'pending'} onClick={onSignOut}>
          {signOutStatus === 'pending' ? 'Signing out...' : 'Sign out'}
        </button>
        {signOutStatus === 'error' && <p className="account-menu-error" role="alert">Could not sign out. Try again.</p>}
      </div>
    </>
  )
}
