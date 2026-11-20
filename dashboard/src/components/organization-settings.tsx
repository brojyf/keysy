import { Check, Copy, Settings } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { openDialog } from '../lib/dialog-controls'
import { useSaveBar } from '../lib/use-save-bar'
import SaveBar from './save-bar'
import SaveFailedDialog from './save-failed-dialog'
import { SaveRequestError } from '../lib/save-request-error'
import Button from './button'
import { useCurrentUser } from './current-user'
import DeleteOrganizationDialog from './delete-organization-dialog'
import LeaveOrganizationDialog from './leave-organization-dialog'
import { organizationPath } from '../lib/organization-route'
import SettingsLayout from './settings-layout'
import { SettingsRow, SettingsSection } from './settings-section'
import NameInput from './name-input'
import { validateName } from '../lib/name-validation'

export default function OrganizationSettings() {
  const { organization, renameOrganization } = useCurrentUser()
  const dangerDialog = useRef<HTMLDialogElement>(null)
  const saveFailedDialog = useRef<HTMLDialogElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const copyOperation = useRef(0)
  const [nameDraft, setNameDraft] = useState<{ id: string; value: string } | null>(null)
  const [renameError, setRenameError] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<{ id: string; status: 'copied' | 'error' } | null>(null)
  useEffect(() => {
    if (copyFeedback?.status !== 'copied') return
    const timer = setTimeout(() => setCopyFeedback(null), 2500)
    return () => clearTimeout(timer)
  }, [copyFeedback])
  const draftName = organization && nameDraft?.id === organization.id ? nameDraft.value : organization?.name ?? ''
  const trimmedName = draftName.trim()
  const nameChanged = !!organization && trimmedName !== organization.name
  const saveBar = useSaveBar(nameChanged)
  const { saving, saved, setSaveState } = saveBar
  if (!organization) return null
  const owner = organization.role === 'owner'
  const nameIssue = validateName(draftName)
  const copied = copyFeedback?.id === organization.id && copyFeedback.status === 'copied'
  const copyFailed = copyFeedback?.id === organization.id && copyFeedback.status === 'error'
  const copyLabel = copied ? 'Organization ID copied' : copyFailed ? 'Copy failed. Try again.' : 'Copy organization ID'

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organization || !nameChanged || nameIssue || saving || saved) return
    setSaveState('saving')
    setRenameError(false)
    try {
      await renameOrganization(organization.id, trimmedName)
      setNameDraft(null)
      setSaveState('saved')
    } catch (error) {
      if (error instanceof SaveRequestError) {
        setRequestId(error.requestId)
        if (saveFailedDialog.current) openDialog(saveFailedDialog.current)
      } else setRenameError(true)
      setSaveState('idle')
    }
  }

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
      <form ref={formRef} className={`account-sections${saveBar.mounted ? ' account-sections-editing' : ''}`} onSubmit={(event) => void rename(event)}>
        <SettingsSection title="Organization">
          <SettingsRow label={<label htmlFor="organization-settings-name">Name</label>}>
            <NameInput ref={nameInputRef} id="organization-settings-name" value={draftName} readOnly={!owner} disabled={saving}
              issue={owner && draftName !== organization.name ? nameIssue : null}
              onInput={(value) => { setNameDraft({ id: organization.id, value }); setRenameError(false); if (saved) setSaveState('idle') }} />
          </SettingsRow>
          <SettingsRow label="Organization ID">
            <button className="organization-copy" type="button" aria-label={copyLabel} title={copyLabel} onClick={() => void copyOrganizationID(organization.id)}>
              <code className="organization-id">{organization.id}</code>
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            </button>
            <span className="visually-hidden" role="status">{copied ? 'Organization ID copied.' : copyFailed ? 'Could not copy. Try again.' : ''}</span>
          </SettingsRow>
          <SettingsRow label="Role">{organization.role[0].toUpperCase() + organization.role.slice(1)}</SettingsRow>
        </SettingsSection>
        <SettingsSection title="Danger zone" danger>
          <SettingsRow label={owner ? 'Delete organization' : 'Leave organization'} control>
            <Button variant="dangerOutline" onClick={() => {
              const dialog = dangerDialog.current
              if (!dialog) return
              openDialog(dialog)
              dialog.querySelector('input')?.focus()
            }}>{owner ? 'Delete' : 'Leave'}</Button>
          </SettingsRow>
        </SettingsSection>
        {saveBar.mounted && <SaveBar saveBar={saveBar} networkError={renameError} saveDisabled={nameIssue !== null} onDiscard={() => { setNameDraft(null); setRenameError(false) }} />}
      </form>
      {owner
        ? <DeleteOrganizationDialog key={organization.id} ref={dangerDialog} organization={organization} />
        : <LeaveOrganizationDialog key={organization.id} ref={dangerDialog} organization={organization} />}
      <SaveFailedDialog dialogRef={saveFailedDialog} formRef={formRef} nameInputRef={nameInputRef} requestId={requestId} />
    </SettingsLayout>
  )
}
