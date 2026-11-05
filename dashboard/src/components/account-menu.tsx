'use client'

import Link from 'next/link'
import { Monitor, Moon, Sun, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { setTheme, useTheme, type Theme } from '../lib/theme'

const themeOptions = [
  { label: 'System', Icon: Monitor },
  { label: 'Light', Icon: Sun },
  { label: 'Dark', Icon: Moon },
]

export type AccountMenuProps = {
  displayName: string
  avatarUrl?: string
  email: string
  onSignOutRequest: () => void
}

export default function AccountMenu({ displayName, avatarUrl, email, onSignOutRequest, selected }: AccountMenuProps & { selected: boolean }) {
  const theme = useTheme()
  const [failedAvatarURL, setFailedAvatarURL] = useState<string>()
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
          {avatarUrl && failedAvatarURL !== avatarUrl
            ? <img src={avatarUrl} referrerPolicy="no-referrer" alt="" onError={() => setFailedAvatarURL(avatarUrl)} />
            : <UserRound size={18} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />}
        </span>
      </button>
      <div id="account-menu" className="account-menu" popover="auto" ref={menu}>
        <div className="account-menu-identity">
          <p className="account-menu-name">{displayName}</p>
          {email && <p className="account-menu-email">{email}</p>}
        </div>
        <hr className="account-menu-divider" />
        <Link className="account-menu-item" href="/account" onClick={() => menu.current?.hidePopover()}>
          Account
        </Link>
        <div className="account-menu-row">
          Theme
          <div className="theme-switch" role="group" aria-label="Theme">
            {themeOptions.map(({ label, Icon }) => (
              <button key={label} type="button" aria-label={label} aria-pressed={theme === label.toLowerCase()} onClick={() => setTheme(label.toLowerCase() as Theme)}>
                <Icon size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
              </button>
            ))}
          </div>
        </div>
        <hr className="account-menu-divider" />
        <button className="account-menu-item account-menu-sign-out" type="button" onClick={() => { menu.current?.hidePopover(); onSignOutRequest() }}>
          Sign out
        </button>
      </div>
    </>
  )
}
