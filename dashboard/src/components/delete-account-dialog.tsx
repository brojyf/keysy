'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react'
import { apiFetch } from '../lib/api-client'
import { organizationPath } from '../lib/organization-route'
import { logoutSession } from '../lib/session-refresh'
import { serviceURLs } from '../lib/service-urls'
import { useCurrentUser } from './current-user'
import Button from './button'
import Dialog from './dialog'

export default function DeleteAccountDialog({ ref }: { ref: Ref<HTMLDialogElement> }) {
  const formID = useId()
  const confirmationID = useId()
  const { user, organizations, onSignedOut } = useCurrentUser()
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  // The api refuses to delete an org owner, so show what to hand over first.
  const ownedOrganizations = organizations.filter((organization) => organization.role === 'owner')
  const valid = ownedOrganizations.length === 0 && confirmation === user.email

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || pending || event.currentTarget.closest('dialog')?.hasAttribute('data-closing')) return
    setPending(true)
    setError('')
    const response = await apiFetch('/v0/me', { method: 'DELETE' }).catch(() => null)
    if (response?.status === 401) {
      onSignedOut()
      return
    }
    if (response?.status === 204) {
      // The api revokes every session, but the access cookie stays valid until it expires, so clear it too.
      await logoutSession(serviceURLs().authURL).catch(() => {})
      // A full page load drops all signed-in state before the signed-out page shows.
      window.location.replace('/account-deleted')
      return
    }
    if (!mounted.current) return
    setError(response?.status === 409 ? 'Transfer or delete the organizations you own, then try again.' : 'Could not delete your account. Try again.')
    setPending(false)
  }

  return (
    <Dialog ref={ref} title="Delete account?" closable={!pending} onClose={() => { setConfirmation(''); setError('') }} action={
      <Button variant="danger" type="submit" form={formID} disabled={!valid || pending}>{pending ? 'Deleting...' : 'Delete account'}</Button>
    }>
      {ownedOrganizations.length > 0 ? (
        <>
          <p>Transfer ownership or delete {ownedOrganizations.length === 1 ? 'this organization' : 'these organizations'} first:</p>
          <ul className="account-delete-organizations">
            {ownedOrganizations.map((organization) => (
              <li key={organization.id}>
                <Link href={organizationPath(organization.id, '/settings')}>
                  <span>{organization.name}</span>
                  <span className="account-delete-role">Owner</span>
                  <ArrowRight size={16} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p>You’ll leave every organization. This can’t be undone.</p>
          <form id={formID} className="account-delete-form" onSubmit={remove} aria-busy={pending}>
            <div className="dialog-field">
              <label htmlFor={confirmationID}>Type {user.email} to confirm</label>
              <input id={confirmationID} className="account-name" autoComplete="off" value={confirmation} disabled={pending} onInput={(event) => { setConfirmation(event.currentTarget.value); setError('') }} />
            </div>
            {error && <p className="dialog-error" role="alert">{error}</p>}
          </form>
        </>
      )}
    </Dialog>
  )
}
