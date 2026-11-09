import type { ReactNode } from 'react'

export function SettingsSection({ title, danger = false, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <section>
      <h2 className={danger ? 'account-danger' : undefined}>{title}</h2>
      <dl className="account-rows">{children}</dl>
    </section>
  )
}

export function SettingsRow({ label, control = false, children }: { label: ReactNode; control?: boolean; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={control ? 'account-control' : undefined}>{children}</dd>
    </div>
  )
}
