import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SortableHeader, TableSearch } from './account-table-controls'
import Button from './button'
import { useCurrentUser } from './current-user'
import InviteMemberDialog from './invite-member-dialog'
import { InvitationTableSkeleton } from './loading-skeleton'
import MoreMenu from './more-menu'
import { usePeopleNav } from './people-nav'
import ResendFailedDialog from './resend-failed-dialog'
import SettingsLayout from './settings-layout'
import { apiFetch } from '../lib/api-client'
import { openDialog } from '../lib/dialog-controls'
import { invitationQueryOptions } from '../lib/invitation-queries'

const roleLabels = { admin: 'Admin', developer: 'Developer' }
const statusLabels = { pending: 'Pending', expired: 'Expired' }

// Figma People · Invitations. Every member sees the list; the Owner and Admins get a row menu.
// Resend renews expired invitations; the other actions wait for their APIs.
export default function InvitationList() {
  const { user, organization, onSignedOut } = useCurrentUser()
  const invitationQuery = useQuery({ ...invitationQueryOptions(user.id, organization?.id ?? '', onSignedOut), enabled: !!organization })
  const client = useQueryClient()
  const nav = usePeopleNav('Invitations')
  const inviteDialog = useRef<HTMLDialogElement>(null)
  const failedDialog = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const mounted = useRef(false)
  const [failure, setFailure] = useState<{ email: string; role: 'admin' | 'developer'; message: string; requestId: string | null } | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<'ascending' | 'descending'>('ascending')

  const hasActions = organization?.role === 'owner' || organization?.role === 'admin'
  const columnCount = hasActions ? 4 : 3
  const search = query.trim().toLowerCase()
  // A failed refetch keeps the old data; never show it after an error.
  const invitations = (invitationQuery.isError ? [] : invitationQuery.data ?? [])
    .filter(({ email }) => email.includes(search))
    .sort((a, b) => (direction === 'ascending' ? 1 : -1) * a.email.localeCompare(b.email))

  async function renew(email: string, role: 'admin' | 'developer') {
    if (!organization || submitting.current) return
    submitting.current = true
    let message = `Keysy couldn't send the invitation to ${email}. Try again in a moment.`
    let requestId: string | null = null
    try {
      const response = await apiFetch(`/v0/orgs/${encodeURIComponent(organization.id)}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      if (response.status === 401) {
        onSignedOut()
        return
      }
      if (response.status === 404) void client.invalidateQueries({ queryKey: ['organizations', user.id], exact: true })
      if (response.status === 201) {
        void client.invalidateQueries({ queryKey: ['invitations', user.id, organization.id] })
        return
      }
      requestId = response.headers.get('X-Request-ID') || null
      if (response.status === 429) {
        const body = await response.json().catch(() => null)
        if (body?.error?.code === 'INVITATION_LIMIT_REACHED' && typeof body.error.message === 'string') {
          message = body.error.message
        }
      }
    } catch {
      // Network failures use the generic message.
    } finally {
      submitting.current = false
    }
    if (mounted.current) {
      setFailure({ email, role, message, requestId })
      if (failedDialog.current) openDialog(failedDialog.current)
    }
  }

  function openInviteDialog() {
    if (inviteDialog.current) {
      openDialog(inviteDialog.current)
      inviteDialog.current.querySelector<HTMLInputElement>('input.account-name')?.focus()
    }
  }

  return (
    <SettingsLayout title="People" className="member-page" Icon={Users} heading="Invitations" nav={nav}>
      <div className="account-toolbar">
        <TableSearch label="Search invitations" value={query} onChange={setQuery} />
        {hasActions && <Button variant="primary" onClick={openInviteDialog}>Invite member</Button>}
      </div>
      {invitationQuery.isPending ? (
        <>
          <p role="status" className="visually-hidden">Loading invitations...</p>
          <InvitationTableSkeleton />
        </>
      ) : (
        <div className="account-table invitation-table">
          <table>
            <thead>
              <tr>
                <SortableHeader label="Email" direction={direction} onToggle={() => setDirection(direction === 'ascending' ? 'descending' : 'ascending')} />
                <th>Status</th>
                <th>Role</th>
                {hasActions && <th />}
              </tr>
            </thead>
            <tbody>
              {invitations.map(({ id, email, role, status }) => (
                <tr key={id}>
                  <td>{email}</td>
                  <td><span className={`invitation-status invitation-status-${status}`}>{statusLabels[status]}</span></td>
                  <td>{roleLabels[role]}</td>
                  {hasActions && (
                    <td className="account-table-actions">
                      {(organization?.role === 'owner' || role === 'developer') && <MoreMenu id={`invitation-menu-${id}`} label={`More actions for ${email}`}>
                        {organization?.role === 'owner' && <button className="account-menu-item" type="button">Change role</button>}
                        <button
                          className="account-menu-item"
                          type="button"
                          onClick={() => {
                            if (status !== 'expired') return
                            document.getElementById(`invitation-menu-${id}`)?.hidePopover()
                            void renew(email, role)
                          }}
                        >
                          Resend invitation
                        </button>
                        <hr className="account-menu-divider" />
                        <button className="account-menu-item account-menu-sign-out" type="button">Cancel invitation</button>
                      </MoreMenu>}
                    </td>
                  )}
                </tr>
              ))}
              {invitationQuery.isError && <tr><td className="account-table-empty" colSpan={columnCount} role="alert">Could not load invitations. Refresh the page to try again.</td></tr>}
              {invitationQuery.isSuccess && invitations.length === 0 && (
                <tr><td className="account-table-empty" colSpan={columnCount}>{search ? `No invitations match “${query.trim()}”` : 'No invitations'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <InviteMemberDialog ref={inviteDialog} owner={organization?.role === 'owner'} />
      <ResendFailedDialog
        dialogRef={failedDialog}
        message={failure?.message ?? ''}
        requestId={failure?.requestId ?? null}
        onRetry={() => { if (failure) void renew(failure.email, failure.role) }}
      />
    </SettingsLayout>
  )
}
