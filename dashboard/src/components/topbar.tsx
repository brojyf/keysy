'use client'

import { Bell, Bug, ChevronsUpDown, Search } from 'lucide-react'
import { useCurrentUser } from './current-user'

// Figma icons with no lucide equivalent.
function QuestionMarkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 5a2.5 2.5 0 1 1 3.75 2.16C8 7.6 7.5 8.16 7.5 9v.38" />
      <path d="M7.5 12.5h.01" />
    </svg>
  )
}

function AgentSparkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" aria-hidden>
      <path d="M7.5 1.875 8.625 4.8125 11.5625 5.9375 8.625 7.0625 7.5 10 6.375 7.0625 3.4375 5.9375 6.375 4.8125ZM11.875 9.375l.5 1.375 1.375.5-1.375.5-.5 1.375-.5-1.375L10 11.25l1.375-.5Z" />
    </svg>
  )
}

export default function Topbar() {
  const { organizations } = useCurrentUser()
  const organizationName = organizations[0]?.name
  return (
    <header className={`topbar${organizationName ? '' : ' topbar-account-only'}`}>
      <span className="topbar-logo">
        <img src="/keysy-symbol.svg" width="24" height="24" alt="Keysy" />
      </span>
      {organizationName && (
        <>
          <button className="topbar-org" type="button">
            {organizationName}
            <ChevronsUpDown size={14} strokeWidth={1.17} absoluteStrokeWidth aria-hidden />
          </button>
          <button className="topbar-search" type="button" aria-label="Search">
            <Search size={14} strokeWidth={1.17} absoluteStrokeWidth aria-hidden />
            <span className="topbar-search-placeholder">Search</span>
            <kbd>⌘K</kbd>
          </button>
        </>
      )}
      <button className="topbar-icon-button" type="button" aria-label="Report issue" data-tooltip="Report issue">
        <Bug size={15} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
      </button>
      <button className="topbar-icon-button" type="button" aria-label="Support" data-tooltip="Support">
        <QuestionMarkIcon />
      </button>
      {organizationName && (
        <>
          <button className="topbar-icon-button" type="button" aria-label="Notifications" data-tooltip="Notifications">
            <Bell size={15} strokeWidth={2} absoluteStrokeWidth aria-hidden />
          </button>
          <hr className="topbar-divider" />
          <button className="topbar-icon-button topbar-agent" type="button" aria-label="Open agent" data-tooltip="Open agent">
            <AgentSparkIcon />
          </button>
        </>
      )}
    </header>
  )
}
