'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useCurrentUser } from './current-user'

const accountPages = [
  { href: '/account', label: 'General' },
  { href: '/account/organizations', label: 'Organizations' },
  { href: '/account/sessions', label: 'Sessions' },
]

export default function AccountShell({ children }: { children: ReactNode }) {
  const { organizations } = useCurrentUser()
  const [width, setWidth] = useState(240)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ pointerId: number, x: number, width: number } | null>(null)
  const resize = (value: number) => setWidth(Math.max(200, Math.min(320, value)))
  const pathname = usePathname() ?? ''
  const currentPage = accountPages.find((page) => page.href === pathname) ?? accountPages[0]
  return (
    <div className={`account${dragging ? ' account-resizing' : ''}`}>
      <aside id="account-sidebar" className="account-sidebar" style={organizations.length === 0 ? { '--account-sidebar-width': `${width}px` } as CSSProperties : undefined}>
        <p className="account-sidebar-title">Account</p>
        <nav className="account-nav" aria-label="Account">
          {accountPages.map(({ href, label }) => (
            <Link key={href} className="account-nav-item" href={href} aria-current={href === currentPage.href ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        {organizations.length === 0 && <div
          className="account-sidebar-resize"
          role="separator"
          tabIndex={0}
          aria-label="Account"
          aria-orientation="vertical"
          aria-controls="account-sidebar"
          aria-valuemin={200}
          aria-valuemax={320}
          aria-valuenow={width}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { pointerId: event.pointerId, x: event.clientX, width }
            setDragging(true)
          }}
          onPointerMove={(event) => {
            if (drag.current?.pointerId === event.pointerId) resize(drag.current.width + event.clientX - drag.current.x)
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointerId === event.pointerId) { drag.current = null; setDragging(false) }
          }}
          onPointerCancel={(event) => {
            if (drag.current?.pointerId === event.pointerId) { drag.current = null; setDragging(false) }
          }}
          onLostPointerCapture={(event) => {
            if (drag.current?.pointerId === event.pointerId) { drag.current = null; setDragging(false) }
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') resize(width - 8)
            else if (event.key === 'ArrowRight') resize(width + 8)
            else if (event.key === 'Home') resize(200)
            else if (event.key === 'End') resize(320)
            else return
            event.preventDefault()
          }}
        />}
      </aside>
      <div className="account-page">
        <header className="account-page-header">
          <UserRound size={18} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
          <span className="account-page-slash" aria-hidden>/</span>
          <h1>{currentPage.label}</h1>
        </header>
        {children}
      </div>
    </div>
  )
}
