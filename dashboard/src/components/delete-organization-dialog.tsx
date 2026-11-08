'use client'

import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react'
import { closeDialog } from '../lib/dialog-controls'
import type { Organization } from '../lib/organization'
import { useCurrentUser } from './current-user'
import Dialog from './dialog'

export default function DeleteOrganizationDialog({ ref, organization }: { ref: Ref<HTMLDialogElement>; organization: Organization }) {
  const formID = useId()
  const confirmationID = useId()
  const { deleteOrganization } = useCurrentUser()
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
      const result = await deleteOrganization(organization.id)
      if (!result || !mounted.current) return
      if (result.status === 404) {
        const updated = result.organizations
        if (!updated.some((item) => item.id === organization.id)) return
        setError('The organization was not found, or you no longer have permission to delete it.')
        return
      }
    } catch {
      if (mounted.current) setError('Could not delete the organization. Try again.')
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
