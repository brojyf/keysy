'use client'

import { Check, Copy, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { openDialog } from '../lib/dialog-controls'
import { useCurrentUser } from './current-user'
import DeleteOrganizationDialog from './delete-organization-dialog'
import { organizationPath } from '../lib/organization-route'
import SettingsLayout from './settings-layout'
import { SettingsRow, SettingsSection } from './settings-section'

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
    <SettingsLayout
      title="Settings"
      className="organization-settings"
      Icon={Settings}
      heading="General"
      nav={[
        { label: 'General', href: organizationPath(organization.id, '/settings'), current: true },
        { label: 'Notifications' },
        ...(owner ? [] : [{ label: 'My scope' }]),
      ]}
    >
      <div className="account-sections">
        <SettingsSection title="Organization">
          <SettingsRow label={<label htmlFor="organization-settings-name">Name</label>}>
            <input id="organization-settings-name" className="account-name" value={organization.name} readOnly title="Renaming is coming soon" />
          </SettingsRow>
          <SettingsRow label="Organization ID">
            <button className="organization-copy" type="button" aria-label={copyLabel} title={copyLabel} onClick={() => void copyOrganizationID(organization.id)}>
              <code className="organization-id">{organization.id}</code>
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            </button>
            <span className="organization-copy-status" role="status">{copied ? 'Organization ID copied.' : copyFailed ? 'Could not copy. Try again.' : ''}</span>
          </SettingsRow>
          <SettingsRow label="Role">{organization.role[0].toUpperCase() + organization.role.slice(1)}</SettingsRow>
        </SettingsSection>
        <SettingsSection title="Danger zone" danger>
          <SettingsRow label={owner ? 'Delete organization' : 'Leave organization'} control>
            <button className="account-delete" type="button" disabled={!owner} title={owner ? undefined : 'Coming soon'} onClick={() => {
              const dialog = deleteDialog.current
              if (!dialog) return
              openDialog(dialog)
              dialog.querySelector('input')?.focus()
            }}>{owner ? 'Delete' : 'Leave'}</button>
          </SettingsRow>
        </SettingsSection>
      </div>
      {owner && <DeleteOrganizationDialog key={organization.id} ref={deleteDialog} organization={organization} />}
    </SettingsLayout>
  )
}
