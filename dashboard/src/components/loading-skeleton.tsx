import type { CSSProperties, ReactNode } from 'react'

function Bone({ width, height = 12, radius, className = '' }: { width: number; height?: number; radius?: number; className?: string }) {
  return <div aria-hidden="true" className={`skeleton-bone ${className}`} style={{ width, height, borderRadius: radius ?? height / 2 }} />
}

function PageHeader({ width, action = false }: { width: number; action?: boolean }) {
  return (
    <div className="skeleton-page-header">
      <Bone width={18} height={18} radius={6} />
      <Bone width={width} height={16} />
      {action && <Bone width={103} height={28} radius={8} className="skeleton-action" />}
    </div>
  )
}

// A null cell stays empty, like a hover-only row action.
function Table({ columns, headers, rows, sortColumn, rowHeight = 43, boneHeight = 12 }: { columns: number[]; headers: (number | null)[]; rows: (number | number[] | null)[][]; sortColumn?: number; rowHeight?: number; boneHeight?: number }) {
  const style = { gridTemplateColumns: columns.map((width) => `minmax(0, ${width}fr)`).join(' ') } as CSSProperties
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header" style={style}>
        {headers.map((width, i) => (
          <div key={i}>
            {width !== null && <Bone width={width} className="skeleton-header-bone" />}
            {i === sortColumn && <Bone width={14} height={14} radius={4} className="skeleton-header-bone" />}
          </div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} className="skeleton-table-row" style={{ ...style, minHeight: row.some(Array.isArray) ? 66 : rowHeight }}>
          {row.map((cell, j) => (
            <div key={j} className="skeleton-table-cell">
              {(cell === null ? [] : Array.isArray(cell) ? cell : [cell]).map((width, k) => <Bone key={k} width={width} height={boneHeight} />)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Sidebar({ page }: { page: 'secrets' | 'settings' | 'account' }) {
  return (
    <div className="skeleton-sidebar">
      <div className="skeleton-sidebar-title">
        <Bone width={page === 'settings' ? 54 : 47} />
        {page === 'secrets' && <Bone width={24} height={24} radius={8} />}
      </div>
      {page === 'secrets' ? (
        <>
          <Bone width={215} height={32} radius={10} className="skeleton-filter" />
          <div className="skeleton-tree">
            <Bone width={14} height={14} radius={4} />
            <Bone width={7} />
          </div>
        </>
      ) : (
        <div className="skeleton-sidebar-items">
          {(page === 'settings' ? [47, 76, 54] : [47, 83, 54]).map((width, i) => <Bone key={i} width={width} />)}
        </div>
      )}
    </div>
  )
}

function Secrets() {
  return (
    <>
      <Sidebar page="secrets" />
      <div className="skeleton-content">
        <PageHeader width={66} action />
        <Table columns={[1080]} headers={[41]} rowHeight={41} boneHeight={10} rows={[[72], [22], [86], [43], [50], [58]]} />
      </div>
    </>
  )
}
function Services() {
  return (
    <div className="skeleton-content">
      <PageHeader width={75} />
      <Table columns={[296, 561, 221]} headers={[47, 47, 47]} boneHeight={10} rows={[[50, 331, 10], [22, 115, 10], [43, 122, 10], [22, 194, 10], [65, 144, 10], [43, 88, 47]]} />
    </div>
  )
}
function Members() {
  return (
    <div className="skeleton-content">
      <PageHeader width={66} />
      <Table columns={[182, 201, 695]} headers={[41, 27, 41]} rows={[[54, 34, 81], [68, 61, 47], [68, 61, 81]]} />
      <div className="skeleton-members-heading">
        <Bone width={101} />
        <Bone width={156} height={28} radius={8} />
      </div>
      <Table columns={[296, 561, 221]} headers={[95, 54, 47]} rows={[[47, 79, 68], [47, 50, 68]]} />
    </div>
  )
}
function AuditLog() {
  return (
    <div className="skeleton-content">
      <PageHeader width={78} />
      <Bone width={297} className="skeleton-caption" />
      <Table columns={[226, 263, 230, 173, 186]} headers={[27, 41, 34, 14, 20]} rows={[[59, 154, 194, 53, 20], [67, 195, 160, 67, 20], [61, 133, [149, 147], 67, 34], [71, 133, 112, 67, 20], [41, 183, 165, 53, 59], [40, 81, [81, 61], 53, 20]]} />
    </div>
  )
}
function CardRow({ label, value, height = 12, radius, end = false }: { label: number; value: number; height?: number; radius?: number; end?: boolean }) {
  return (
    <div className="skeleton-card-row">
      <Bone width={label} />
      <Bone width={value} height={height} radius={radius} className={end ? 'skeleton-card-end' : ''} />
    </div>
  )
}
function Section({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div className="skeleton-section">
      <Bone width={width} height={14} />
      <div className="skeleton-card">{children}</div>
    </div>
  )
}
function Settings() {
  return (
    <>
      <Sidebar page="settings" />
      <div className="skeleton-content skeleton-form">
        <PageHeader width={66} />
        <Section width={99}>
          <CardRow label={27} value={426} height={32} radius={10} />
          <CardRow label={101} value={94} />
        </Section>
        <Section width={92}>
          <CardRow label={122} value={59} height={28} radius={8} end />
        </Section>
      </div>
    </>
  )
}
function Account() {
  return (
    <>
      <Sidebar page="account" />
      <div className="skeleton-content skeleton-form">
        <PageHeader width={66} />
        <Section width={51}>
          <CardRow label={27} value={426} height={32} radius={10} />
          <CardRow label={34} value={101} />
          <CardRow label={95} value={41} />
        </Section>
        <Section width={42}><CardRow label={183} value={32} height={18} end /></Section>
        <Section width={83}><CardRow label={34} value={88} height={30} end /></Section>
        <Section width={58}><CardRow label={155} value={73} height={28} radius={8} end /></Section>
        <Section width={92}><CardRow label={95} value={63} height={28} radius={8} end /></Section>
      </div>
    </>
  )
}

// The table part of 14.15 Sessions; the Sessions page also shows it while its list loads.
export function SessionsSkeleton() {
  return (
    <div className="skeleton-sessions">
      <Bone width={280} height={32} radius={10} />
      <Table columns={[200, 198, 200, 120]} headers={[36, 41, 60, null]} sortColumn={2} rows={[[20, 101, 20, 73], [20, 68, 71, null], [111, 101, 59, null], [20, 81, 38, null]]} />
    </div>
  )
}
function AccountSessions() {
  return (
    <>
      <Sidebar page="account" />
      <div className="skeleton-content skeleton-account-table">
        <PageHeader width={75} />
        <SessionsSkeleton />
      </div>
    </>
  )
}

function SkeletonTopbar() {
  return (
    <div className="skeleton-topbar">
      <div className="skeleton-logo"><img src="/keysy-symbol.svg" width="24" height="24" alt="Keysy" /></div>
      <Bone width={72} />
      <div className="skeleton-topbar-right">
        <Bone width={220} height={30} className="skeleton-search" />
        <Bone width={30} height={30} />
        <Bone width={30} height={30} />
        <Bone width={30} height={30} />
        <div className="skeleton-topbar-divider" />
        <Bone width={30} height={30} />
      </div>
    </div>
  )
}
function SkeletonRail() {
  return (
    <div className="skeleton-rail">
      <div>
        <div className="skeleton-rail-cell"><Bone width={18} height={18} radius={6} /></div>
        <div className="skeleton-rail-divider" />
        {[0, 1, 2].map((i) => <div key={i} className="skeleton-rail-cell"><Bone width={18} height={18} radius={6} /></div>)}
        <div className="skeleton-rail-divider" />
        <div className="skeleton-rail-cell"><Bone width={18} height={18} radius={6} /></div>
      </div>
      <div className="skeleton-rail-cell"><Bone width={28} height={28} /></div>
    </div>
  )
}

// More specific paths come first.
const pages = { secrets: Secrets, services: Services, members: Members, 'audit-log': AuditLog, settings: Settings, 'account/sessions': AccountSessions, account: Account }

export default function LoadingSkeleton({ pathname }: { pathname: string }) {
  const pagePath = pathname.replace(/^\/orgs\/[^/]+(?=\/|$)/, '')
  const page = (Object.keys(pages) as (keyof typeof pages)[]).find((name) => pagePath === `/${name}` || pagePath.startsWith(`/${name}/`))
  const Page = page ? pages[page] : null
  return (
    <>
      <p role="status" className="skeleton-status">Checking your session...</p>
      <div className="skeleton-page" aria-busy="true">
        <SkeletonTopbar />
        <div className="skeleton-body">
          <SkeletonRail />
          <main className="skeleton-main">
            {Page && <div className="skeleton-route" data-skeleton-page={page}><Page /></div>}
          </main>
        </div>
      </div>
    </>
  )
}
