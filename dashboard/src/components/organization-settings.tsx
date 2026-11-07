'use client'

import Link from 'next/link'
import { Settings } from 'lucide-react'
import { useRef } from 'react'
import { openDialog } from '../lib/dialog-controls'
import { useCurrentUser } from './current-user'
import DeleteOrganizationDialog from './delete-organization-dialog'
import { organizationPath } from '../lib/organization-route'

export default function OrganizationSettings() {
  const { organization } = useCurrentUser()
  const deleteDialog = useRef<HTMLDialogElement>(null)
  if (!organization) return null
  const owner = organization.role === 'owner'

  return (
    <div className="account organization-settings">
      <aside className="account-sidebar">
        <p className="account-sidebar-title">Settings</p>
        <nav className="account-nav" aria-label="Settings">
          <Link className="account-nav-item" href={organizationPath(organization.id, '/settings')} aria-current="page">General</Link>
          <button className="account-nav-item" type="button" disabled title="Coming soon">Notifications</button>
          {!owner && <button className="account-nav-item" type="button" disabled title="Coming soon">My scope</button>}
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
              <div><dt><label htmlFor="organization-settings-name">Name</label></dt><dd><input id="organization-settings-name" className="account-name" value={organization.name} readOnly title="Renaming is coming soon" /></dd></div>
              <div><dt>Organization ID</dt><dd><code className="organization-id">{organization.id}</code></dd></div>
            </dl>
          </section>
          <section>
            <h2 className="account-danger">Danger zone</h2>
            {owner && <p className="organization-settings-note">To leave instead, transfer ownership on the Members page.</p>}
            <dl className="account-rows">
              <div>
                <dt>{owner ? 'Delete organization' : 'Leave organization'}</dt>
                <dd className="account-control">
                  <button className="account-delete" type="button" disabled={!owner} title={owner ? undefined : 'Coming soon'} onClick={() => {
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
