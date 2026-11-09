import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type SettingsNavItem = { label: string; href?: string; current?: boolean }

type SettingsLayoutProps = {
  title: string
  nav: SettingsNavItem[]
  Icon: LucideIcon
  heading: string
  className?: string
  children: ReactNode
}

export default function SettingsLayout({ title, nav, Icon, heading, className, children }: SettingsLayoutProps) {
  return (
    <div className={className ? `account ${className}` : 'account'}>
      <aside className="account-sidebar">
        <p className="account-sidebar-title">{title}</p>
        <nav className="account-nav" aria-label={title}>
          {nav.map(({ label, href, current }) => href
            ? <Link key={label} className="account-nav-item" href={href} aria-current={current ? 'page' : undefined}>{label}</Link>
            : <button key={label} className="account-nav-item" type="button" disabled title="Coming soon">{label}</button>)}
        </nav>
      </aside>
      <div className="account-page">
        <header className="account-page-header">
          <Icon size={18} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
          <span className="account-page-slash" aria-hidden>/</span>
          <h1>{heading}</h1>
        </header>
        {children}
      </div>
    </div>
  )
}
