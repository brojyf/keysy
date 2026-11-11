'use client'

import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useState } from 'react'
import { MoreIcon, SortableHeader, TableSearch } from './account-table-controls'
import { useCurrentUser } from './current-user'
import { MemberTableSkeleton } from './loading-skeleton'
import { memberQueryOptions, type Member } from '../lib/member-queries'
import { placeRowMenu } from '../lib/row-menu'

const roleLabels = { owner: 'Owner', admin: 'Admin', developer: 'Developer' }

// Figma 11.1–11.3: an Owner manages everyone but the Owner; an Admin manages Developers.
function canManage(viewerRole: Member['role'] | undefined, memberRole: Member['role']) {
  return (viewerRole === 'owner' && memberRole !== 'owner') || (viewerRole === 'admin' && memberRole === 'developer')
}

// Figma 11.1–11.6 Members. The row menu items do nothing until their APIs exist.
// The member page comes later.
export default function MemberList() {
  const { user, organization, onSignedOut } = useCurrentUser()
  const memberQuery = useQuery({ ...memberQueryOptions(user.id, organization?.id ?? '', onSignedOut), enabled: !!organization })
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<'ascending' | 'descending'>('ascending')

  const viewerRole = organization?.role
  const hasActions = viewerRole === 'owner' || viewerRole === 'admin'
  const columnCount = hasActions ? 4 : 3
  const search = query.trim().toLowerCase()
  // A failed refetch keeps the old data; never show it after an error.
  const members = (memberQuery.isError ? [] : memberQuery.data ?? [])
    .filter(({ name, email }) => `${name} ${email}`.toLowerCase().includes(search))
    .sort((a, b) => (direction === 'ascending' ? 1 : -1) * a.name.localeCompare(b.name))

  return (
    <div className="member-page">
      <header className="account-page-header">
        <Users size={18} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
        <h1>Members</h1>
      </header>
      <TableSearch label="Search members" value={query} onChange={setQuery} />
      {memberQuery.isPending ? (
        <>
          <p role="status" className="skeleton-status">Loading members...</p>
          <MemberTableSkeleton />
        </>
      ) : (
        <div className="account-table member-table">
          <table>
            <thead>
              <tr>
                <SortableHeader label="Name" direction={direction} onToggle={() => setDirection(direction === 'ascending' ? 'descending' : 'ascending')} />
                <th>Email</th>
                <th>Role</th>
                {hasActions && <th />}
              </tr>
            </thead>
            <tbody>
              {members.map(({ userId, name, email, role }) => (
                <tr key={userId}>
                  <td>{name}</td>
                  <td>{email}</td>
                  <td>{roleLabels[role]}</td>
                  {hasActions && (
                    <td className="account-table-actions">
                      {canManage(viewerRole, role) && (
                        <>
                          <button className="account-more" type="button" popoverTarget={`member-menu-${userId}`} aria-label={`More actions for ${name}`}>
                            <MoreIcon />
                          </button>
                          <div id={`member-menu-${userId}`} className="account-menu account-row-menu member-row-menu" popover="auto" onBeforeToggle={placeRowMenu}>
                            <button className="account-menu-item" type="button">Change role</button>
                            {viewerRole === 'owner' && (
                              <>
                                <button className="account-menu-item" type="button">Transfer ownership</button>
                                <hr className="account-menu-divider" />
                              </>
                            )}
                            <button className="account-menu-item account-menu-sign-out" type="button">Remove</button>
                          </div>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {memberQuery.isError && <tr><td className="account-table-empty" colSpan={columnCount} role="alert">Could not load members. Refresh the page to try again.</td></tr>}
              {memberQuery.isSuccess && members.length === 0 && <tr><td className="account-table-empty" colSpan={columnCount}>{`No members match “${query.trim()}”`}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
