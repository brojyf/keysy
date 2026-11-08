'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react'
import { apiFetch } from '../lib/api-client'
import { closeDialog } from '../lib/dialog-controls'
import type { Organization } from '../lib/organization'
import { useCurrentUser } from './current-user'
import Dialog from './dialog'
import { organizationPath } from '../lib/organization-route'

export default function DeleteOrganizationDialog({ ref, organization }: { ref: Ref<HTMLDialogElement>; organization: Organization }) {
  const router = useRouter()
  const formID = useId()
  const confirmationID = useId()
  const { organizations, onOrganizationDeleted, refreshOrganizations, onSignedOut } = useCurrentUser()
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const valid = confirmation === organization.name

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || submitting.current || organization.role !== 'owner' || event.currentTarget.closest('dialog')?.hasAttribute('data-closing')) return
    submitting.current = true
    setPending(true)
    setError('')
    try {
      const response = await apiFetch(`/v0/orgs/${encodeURIComponent(organization.id)}`, { method: 'DELETE' })
      if (response.status === 401) { onSignedOut(); return }
      if (response.status === 404) {
        const updated = await refreshOrganizations()
        if (!updated || !mounted.current) return
        if (!updated.some((item) => item.id === organization.id)) {
          router.replace(updated[0] ? organizationPath(updated[0].id, '/secrets') : '/account/organizations')
          return
        }
        setError('The organization was not found, or you no longer have permission to delete it.')
        return
      }
      if (response.status !== 204) throw new Error('Delete failed')
      onOrganizationDeleted(organization.id)
      if (!mounted.current) return
      const remaining = organizations.find((item) => item.id !== organization.id)
      router.replace(remaining ? organizationPath(remaining.id, '/secrets') : '/account/organizations')
    } catch {
      if (!mounted.current) {
        await refreshOrganizations().catch(() => {})
        return
      }
      setError('Could not delete the organization. Try again.')
    } finally {
      submitting.current = false
      if (mounted.current) setPending(false)
    }
  }

  return (
    <Dialog ref={ref} title="Delete organization?" closable={!pending} onClose={() => { setConfirmation(''); setError('') }} actions={
      <>
        <button className="dialog-cancel" type="button" disabled={pending} onClick={(event) => void closeDialog(event.currentTarget.closest('dialog')!)}>Cancel</button>
        <button className="dialog-danger" type="submit" form={formID} disabled={!valid || pending}>{pending ? 'Deleting...' : 'Delete organization'}</button>
      </>
    }>
      <p>{organization.name} will no longer be available. You can’t undo this action.</p>
      <form id={formID} className="organization-delete-form" onSubmit={remove} aria-busy={pending}>
        <div className="dialog-field">
          <label htmlFor={confirmationID}>Type {organization.name} to confirm</label>
          <input id={confirmationID} className="account-name" autoComplete="off" value={confirmation} disabled={pending} onInput={(event) => { setConfirmation(event.currentTarget.value); setError('') }} />
        </div>
        {error && <p className="dialog-error" role="alert">{error}</p>}
      </form>
    </Dialog>
  )
}
