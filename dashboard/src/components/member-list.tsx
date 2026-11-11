'use client'

import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useState } from 'react'
import { SortableHeader, TableSearch } from './account-table-controls'
import { useCurrentUser } from './current-user'
import { MemberTableSkeleton } from './loading-skeleton'
import { memberQueryOptions } from '../lib/member-queries'

const roleLabels = { owner: 'Owner', admin: 'Admin', developer: 'Developer' }

// Figma 11.1 Members. The row menu and member page come with their APIs.
export default function MemberList() {
  const { user, organization, onSignedOut } = useCurrentUser()
  const memberQuery = useQuery({ ...memberQueryOptions(user.id, organization?.id ?? '', onSignedOut), enabled: !!organization })
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<'ascending' | 'descending'>('ascending')

  const search = query.trim().toLowerCase()
  const members = (memberQuery.data ?? [])
    .filter(({ name, email }) => `${name} ${email}`.toLowerCase().includes(search))
    .sort((a, b) => (direction === 'ascending' ? 1 : -1) * a.name.localeCompare(b.name))

  return (
    <div className="member-page">
      <header className="account-page-header">
        <Users size={18} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
        <h1>Members</h1>
      </header>
      <TableSearch label="Search members" value={query} onChange={setQuery} />
      {memberQuery.isPending ? <MemberTableSkeleton /> : (
        <div className="account-table member-table">
          <table>
            <thead>
              <tr>
                <SortableHeader label="Name" direction={direction} onToggle={() => setDirection(direction === 'ascending' ? 'descending' : 'ascending')} />
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map(({ userId, name, email, role }) => (
                <tr key={userId}>
                  <td>{name}</td>
                  <td>{email}</td>
                  <td>{roleLabels[role]}</td>
                </tr>
              ))}
              {memberQuery.isError && <tr><td className="account-table-empty" colSpan={3} role="alert">Could not load members. Refresh the page to try again.</td></tr>}
              {memberQuery.isSuccess && members.length === 0 && <tr><td className="account-table-empty" colSpan={3}>{`No members match “${query.trim()}”`}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
