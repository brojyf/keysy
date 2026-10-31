import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { productWindow, type SecretRow } from '@/content'

function EnvironmentToggle() {
  return (
    <div className="flex rounded-lg bg-soft p-0.5 text-xs">
      {productWindow.environments.map((env, i) => (
        <span key={env} className={cn('rounded-md px-2.5 py-1', i === 0 ? 'bg-surface font-medium shadow-sm' : 'text-muted')}>
          {env}
        </span>
      ))}
    </div>
  )
}

// Dashboard mockup: sidebar, secrets table, and an optional side panel.
export function ProductWindow({
  aside,
  highlightedPaths = [],
  renderPath = row => row.path,
  className,
}: {
  aside?: ReactNode
  highlightedPaths?: string[]
  renderPath?: (row: SecretRow) => ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-line bg-surface text-left shadow-xl shadow-black/5', className)}>
      <div className="flex items-center gap-2 border-b border-line bg-bg px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="mx-auto rounded-md bg-surface px-3 py-0.5 font-mono text-[11px] text-muted">{productWindow.breadcrumb}</span>
      </div>
      <div className="flex">
        <aside className="hidden w-44 shrink-0 flex-col gap-1 border-r border-line p-3 text-[13px] md:flex">
          <p className="px-2 pb-1 text-xs font-bold">{productWindow.navGroup}</p>
          {productWindow.navItems.map((item, i) => (
            <span key={item} className={cn('rounded-md px-2 py-1.5', i === 0 ? 'bg-soft font-medium' : 'text-muted')}>
              {item}
            </span>
          ))}
        </aside>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{productWindow.title}</p>
              <p className="text-xs text-muted">{productWindow.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <EnvironmentToggle />
              <span className="rounded-lg bg-button px-2.5 py-1 text-xs font-medium text-on-button">{productWindow.newSecret}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-line px-3 py-1.5 text-xs text-muted">
            {productWindow.search}
            <kbd className="font-mono">⌘K</kbd>
          </div>
          <table className="mt-3 w-full table-fixed text-[12px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2 font-normal">{productWindow.columns[0]}</th>
                <th className="w-20 py-2 font-normal">{productWindow.columns[1]}</th>
                <th className="hidden w-24 py-2 font-normal sm:table-cell">{productWindow.columns[2]}</th>
              </tr>
            </thead>
            <tbody>
              {productWindow.rows.map(row => (
                <tr
                  key={row.path}
                  className={cn('border-t border-line transition-colors duration-700', highlightedPaths.includes(row.path) && 'bg-accent/5')}
                >
                  <td className="truncate py-2 pr-2 font-mono">{renderPath(row)}</td>
                  <td className="py-2 font-mono text-muted">{row.version}</td>
                  <td className={cn('hidden py-2 sm:table-cell', row.expires === '—' ? 'text-muted' : 'text-accent')}>{row.expires}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted">{productWindow.footnote}</p>
        </div>
        {aside && <div className="hidden w-64 shrink-0 border-l border-line lg:block">{aside}</div>}
      </div>
    </div>
  )
}
