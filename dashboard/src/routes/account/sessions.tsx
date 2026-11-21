import { createFileRoute } from '@tanstack/react-router'

import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { SortableHeader, TableSearch } from '../../components/account-table-controls'
import MoreMenu from '../../components/more-menu'
import { useCurrentUser } from '../../components/current-user'
import { SessionsSkeleton } from '../../components/loading-skeleton'
import RevokeSessionDialog from '../../components/revoke-session-dialog'
import { openDialog } from '../../lib/dialog-controls'
import { formatLastUsed } from '../../lib/session-last-used'
import { sessionQueryOptions, type AccountSession } from '../../lib/session-queries'

const clientLabels = { web: 'Web' }

export default function SessionsPage() {
  const { user, onSignedOut } = useCurrentUser()
  const sessionQuery = useQuery(sessionQueryOptions(user.id, onSignedOut))
  const dialog = useRef<HTMLDialogElement>(null)
  const [revoking, setRevoking] = useState<AccountSession>()
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<'ascending' | 'descending'>('descending')

  if (sessionQuery.isPending) return <SessionsSkeleton />

  const search = query.trim().toLowerCase()
  const sessions = (sessionQuery.data ?? [])
    .filter(({ client, device }) => `${clientLabels[client]} ${device}`.toLowerCase().includes(search))
    .sort((a, b) => (direction === 'descending' ? -1 : 1) * (Date.parse(a.lastUsedAt) - Date.parse(b.lastUsedAt)))

  function requestRevoke(session: AccountSession) {
    document.getElementById(`session-menu-${session.id}`)?.hidePopover()
    setRevoking(session)
    if (dialog.current) openDialog(dialog.current)
  }

  return (
    <>
      <TableSearch label="Search sessions" value={query} onChange={setQuery} />
      <div className="account-table account-sessions">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Device</th>
              <SortableHeader label="Last used" direction={direction} onToggle={() => setDirection(direction === 'descending' ? 'ascending' : 'descending')} />
              <th />
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>{clientLabels[session.client]}</td>
                <td>{session.device}</td>
                <td>{formatLastUsed(session.lastUsedAt, session.current)}</td>
                <td className="account-table-actions">
                  {session.current ? <span className="account-session-status">This session</span> : (
                    <MoreMenu id={`session-menu-${session.id}`} label={`More actions for ${session.device}`}>
                      <button className="account-menu-item account-menu-sign-out" type="button" onClick={() => requestRevoke(session)}>Revoke</button>
                    </MoreMenu>
                  )}
                </td>
              </tr>
            ))}
            {sessionQuery.isError && <tr><td className="account-table-empty" colSpan={4} role="alert">Could not load sessions. Refresh the page to try again.</td></tr>}
            {sessionQuery.isSuccess && sessions.length === 0 && <tr><td className="account-table-empty" colSpan={4}>{`No sessions match “${query.trim()}”`}</td></tr>}
          </tbody>
        </table>
      </div>
      <RevokeSessionDialog ref={dialog} session={revoking} />
    </>
  )
}

export const Route = createFileRoute('/account/sessions')({ component: SessionsPage, head: () => ({ meta: [{ title: 'Account | Keysy' }] }) })
