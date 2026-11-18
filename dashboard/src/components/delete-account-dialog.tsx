'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api-client'
import { organizationQueryOptions } from '../lib/organization-queries'
import { organizationPath } from '../lib/organization-route'
import { logoutSession } from '../lib/session-refresh'
import { serviceURLs } from '../lib/service-urls'
import { parseSessionUser } from '../lib/session-user'
import { useCurrentUser } from './current-user'
import Button from './button'
import Dialog from './dialog'

type OwnedOrganization = { id: string; name: string }

// A 409 ORG_OWNER lists the orgs the user owns; any other body gives an empty list.
async function ownedOrganizationsFrom(response: Response): Promise<OwnedOrganization[]> {
  try {
    const { error } = await response.json() as { error?: { organizations?: unknown } }
    const listed = error?.organizations
    if (Array.isArray(listed) && listed.every((item) => typeof item?.id === 'string' && typeof item?.name === 'string')) return listed
  } catch {}
  return []
}

// The DELETE may have committed even when its response is lost, so read the account state again.
async function deletionScheduled() {
  try {
    const response = await apiFetch('/v0/me')
    return response.ok && !!parseSessionUser(await response.json()).purgeAt
  } catch {
    return false
  }
}

export default function DeleteAccountDialog({ ref }: { ref: Ref<HTMLDialogElement> }) {
  const formID = useId()
  const confirmationID = useId()
  const { user, organizations, onSignedOut } = useCurrentUser()
  const queryClient = useQueryClient()
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [listedOrganizations, setListedOrganizations] = useState<OwnedOrganization[] | null>(null)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  // The api refuses to delete an org owner, so show what to hand over first.
  // The api list replaces the dashboard list when that one is out of date.
  const ownedOrganizations = listedOrganizations ?? organizations.filter((organization) => organization.role === 'owner')
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
    const outcomeUnknown = !response || response.status >= 500
    if (response?.status === 204 || (outcomeUnknown && await deletionScheduled())) {
      // The api revokes every session, but the access cookie stays valid until it expires, so clear it too.
      await logoutSession(serviceURLs().authURL).catch(() => {})
      // A full page load drops all signed-in state before the signed-out page shows.
      window.location.replace('/account-deleted')
      return
    }
    const listed = response?.status === 409 ? await ownedOrganizationsFrom(response) : []
    // The session gate checks org routes against the shared org list, so refresh it to open the listed orgs.
    if (listed.length > 0) void queryClient.invalidateQueries({ queryKey: organizationQueryOptions(user.id, undefined, onSignedOut).queryKey, exact: true })
    if (!mounted.current) return
    if (listed.length > 0) setListedOrganizations(listed)
    else setError(response?.status === 409 ? 'Transfer or delete the organizations you own, then try again.' : 'Could not delete your account. Try again.')
    setPending(false)
  }

  return (
    <Dialog ref={ref} title="Delete account?" closable={!pending} onClose={() => { setConfirmation(''); setError(''); setListedOrganizations(null) }} action={
      <Button variant="danger" type="submit" form={formID} disabled={!valid || pending}>{pending ? 'Deleting...' : 'Delete account'}</Button>
    }>
      {ownedOrganizations.length > 0 ? (
        <>
          <p>Transfer ownership or delete {ownedOrganizations.length === 1 ? 'this organization' : `these ${ownedOrganizations.length} organizations`} first:</p>
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
