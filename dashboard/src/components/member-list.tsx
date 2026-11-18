'use client'

import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { SortableHeader, TableSearch } from './account-table-controls'
import { useCurrentUser } from './current-user'
import MoreMenu from './more-menu'
import { MemberTableSkeleton } from './loading-skeleton'
import { usePeopleNav } from './people-nav'
import RemoveMemberDialog from './remove-member-dialog'
import SettingsLayout from './settings-layout'
import { openDialog } from '../lib/dialog-controls'
import { memberQueryOptions, type Member } from '../lib/member-queries'

const roleLabels = { owner: 'Owner', admin: 'Admin', developer: 'Developer' }

// Figma People · Members (Owner, Admin, and Developer views), Members · Deleting member, and More menu · Deleting member.
// An Owner manages everyone but the Owner; an Admin manages Developers.
function canManage(viewerRole: Member['role'] | undefined, memberRole: Member['role']) {
  return (viewerRole === 'owner' && memberRole !== 'owner') || (viewerRole === 'admin' && memberRole === 'developer')
}

// Figma People · Members. Change role and Transfer ownership do nothing until their APIs exist.
// The member page comes later.
export default function MemberList() {
  const { user, organization, onSignedOut } = useCurrentUser()
  const memberQuery = useQuery({ ...memberQueryOptions(user.id, organization?.id ?? '', onSignedOut), enabled: !!organization })
  const nav = usePeopleNav('Members')
  const dialog = useRef<HTMLDialogElement>(null)
  const [removing, setRemoving] = useState<Member>()
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<'ascending' | 'descending'>('ascending')

  // The member list is newer than the cached org role.
  const viewerRole = (memberQuery.isError ? undefined : memberQuery.data?.find(({ userId }) => userId === user.id)?.role) ?? organization?.role
  const hasActions = viewerRole === 'owner' || viewerRole === 'admin'
  const columnCount = hasActions ? 4 : 3
  const search = query.trim().toLowerCase()
  // A failed refetch keeps the old data; never show it after an error.
  const members = (memberQuery.isError ? [] : memberQuery.data ?? [])
    .filter(({ name, email }) => `${name} ${email}`.toLowerCase().includes(search))
    .sort((a, b) => (direction === 'ascending' ? 1 : -1) * a.name.localeCompare(b.name))

  function requestRemove(member: Member) {
    document.getElementById(`member-menu-${member.userId}`)?.hidePopover()
    setRemoving(member)
    if (dialog.current) openDialog(dialog.current)
  }

  return (
    <SettingsLayout title="People" className="member-page" Icon={Users} heading="Members" nav={nav}>
      <TableSearch label="Search members" value={query} onChange={setQuery} />
      {memberQuery.isPending ? (
        <>
          <p role="status" className="visually-hidden">Loading members...</p>
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
              {members.map(({ userId, name, email, role, deleting }) => (
                <tr key={userId}>
                  <td>{name}{deleting && <span className="member-deleting">Deleting</span>}</td>
                  <td>{email}</td>
                  <td>{roleLabels[role]}</td>
                  {hasActions && (
                    <td className="account-table-actions">
                      {canManage(viewerRole, role) && (
                        <MoreMenu id={`member-menu-${userId}`} label={`More actions for ${name}`}>
                          {!deleting && (
                            <>
                              <button className="account-menu-item" type="button">Change role</button>
                              {viewerRole === 'owner' && (
                                <>
                                  <button className="account-menu-item" type="button">Transfer ownership</button>
                                  <hr className="account-menu-divider" />
                                </>
                              )}
                            </>
                          )}
                          <button className="account-menu-item account-menu-sign-out" type="button" onClick={() => requestRemove({ userId, name, email, role, deleting })}>Remove</button>
                        </MoreMenu>
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
      <RemoveMemberDialog ref={dialog} member={removing} />
    </SettingsLayout>
  )
}
