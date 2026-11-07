'use client'

import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react'
import { useRouter } from 'next/navigation'
import { closeDialog } from '../lib/dialog-controls'
import Dialog from './dialog'
import { parseCreatedOrganization } from '../lib/organization'
import { apiFetch } from '../lib/api-client'
import { useCurrentUser } from './current-user'
import { organizationPath } from '../lib/organization-route'

export default function CreateOrganizationDialog({ ref }: { ref: Ref<HTMLDialogElement> }) {
  const router = useRouter()
  const formId = useId()
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const { onOrganizationCreated, onSignedOut } = useCurrentUser()
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const submitting = useRef(false)
  const trimmed = name.trim()
  const valid = [...trimmed].length > 0 && [...trimmed].length <= 32

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || submitting.current) return
    submitting.current = true
    setPending(true)
    setError(false)
    try {
      const response = await apiFetch('/v0/orgs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }),
      })
      if (!mounted.current) return
      if (response.status === 401) { onSignedOut(); return }
      if (response.status !== 201) throw new Error('Create failed')
      const organization = parseCreatedOrganization(await response.json())
      if (!mounted.current) return
      onOrganizationCreated({ ...organization, role: 'owner', memberCount: 1 })
      router.push(organizationPath(organization.id, '/secrets'))
    } catch { if (mounted.current) setError(true) } finally { submitting.current = false; if (mounted.current) setPending(false) }
  }

  return (
    <Dialog ref={ref} title="Create an organization" closable={!pending} onClose={() => { setName(''); setError(false) }} actions={
      <>
        <button className="dialog-cancel" type="button" disabled={pending} onClick={(event) => void closeDialog(event.currentTarget.closest('dialog')!)}>Cancel</button>
        <button className="dialog-primary" type="submit" form={formId} disabled={!valid || pending}>{pending ? 'Creating...' : 'Create'}</button>
      </>
    }>
      <form id={formId} onSubmit={create}>
        <div className="dialog-field">
          <label htmlFor="organization-name">Name</label>
          <input id="organization-name" className="account-name" autoComplete="off" value={name} disabled={pending} onInput={(event) => { setName(event.currentTarget.value); setError(false) }} />
        </div>
        {error && <p className="dialog-error" role="alert">Could not create the organization. Try again.</p>}
      </form>
    </Dialog>
  )
}
