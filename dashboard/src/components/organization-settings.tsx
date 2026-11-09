'use client'

import Link from 'next/link'
import { Check, Copy, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { openDialog } from '../lib/dialog-controls'
import { useCurrentUser } from './current-user'
import DeleteOrganizationDialog from './delete-organization-dialog'
import { organizationPath } from '../lib/organization-route'

export default function OrganizationSettings() {
  const { organization } = useCurrentUser()
  const deleteDialog = useRef<HTMLDialogElement>(null)
  const copyOperation = useRef(0)
  const [copyFeedback, setCopyFeedback] = useState<{ id: string; status: 'copied' | 'error' } | null>(null)
  useEffect(() => {
    if (copyFeedback?.status !== 'copied') return
    const timer = setTimeout(() => setCopyFeedback(null), 2500)
    return () => clearTimeout(timer)
  }, [copyFeedback])
  if (!organization) return null
  const owner = organization.role === 'owner'
  const copied = copyFeedback?.id === organization.id && copyFeedback.status === 'copied'
  const copyFailed = copyFeedback?.id === organization.id && copyFeedback.status === 'error'
  const copyLabel = copied ? 'Organization ID copied' : copyFailed ? 'Copy failed. Try again.' : 'Copy organization ID'

  async function copyOrganizationID(id: string) {
    const operation = ++copyOperation.current
    try {
      await window.navigator.clipboard.writeText(id)
      if (operation === copyOperation.current) setCopyFeedback({ id, status: 'copied' })
    } catch {
      if (operation === copyOperation.current) setCopyFeedback({ id, status: 'error' })
    }
  }

  return (
    <div className="account organization-settings">
      <aside className="account-sidebar">
        <p className="account-sidebar-title">Settings</p>
        <nav className="account-nav" aria-label="Settings">
          <Link className="account-nav-item" href={organizationPath(organization.id, '/settings')} aria-current="page">General</Link>
          <button className="account-nav-item" type="button">Notifications</button>
          {!owner && <button className="account-nav-item" type="button">My scope</button>}
        </nav>
      </aside>
      <div className="account-page">
        <header className="account-page-header">
          <Settings size={18} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
          <span className="account-page-slash" aria-hidden>/</span>
          <h1>General</h1>
        </header>
        <div className="account-sections">
          <section>
            <h2>Organization</h2>
            <dl className="account-rows">
              <div><dt><label htmlFor="organization-settings-name">Name</label></dt><dd><input id="organization-settings-name" className="account-name" value={organization.name} readOnly /></dd></div>
              <div><dt>Organization ID</dt><dd>
                <button className="organization-copy" type="button" aria-label={copyLabel} title={copyLabel} onClick={() => void copyOrganizationID(organization.id)}>
                  <code className="organization-id">{organization.id}</code>
                  {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                </button>
                <span className="organization-copy-status" role="status">{copied ? 'Organization ID copied.' : copyFailed ? 'Could not copy. Try again.' : ''}</span>
              </dd></div>
              <div><dt>Role</dt><dd>{organization.role[0].toUpperCase() + organization.role.slice(1)}</dd></div>
            </dl>
          </section>
          <section>
            <h2 className="account-danger">Danger zone</h2>
            <dl className="account-rows">
              <div>
                <dt>{owner ? 'Delete organization' : 'Leave organization'}</dt>
                <dd className="account-control">
                  <button className="button button-danger" type="button" onClick={() => {
                    if (!owner) return
                    const dialog = deleteDialog.current
                    if (!dialog) return
                    openDialog(dialog)
                    dialog.querySelector('input')?.focus()
                  }}>{owner ? 'Delete' : 'Leave'}</button>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
      {owner && <DeleteOrganizationDialog key={organization.id} ref={deleteDialog} organization={organization} />}
    </div>
  )
}
