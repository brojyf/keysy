'use client'

import { useState } from 'react'
import { MoreIcon, SortableHeader, TableSearch } from '../../../components/account-table-controls'
import { mockSessions } from '../mock-account'

export default function SessionsPage() {
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<'ascending' | 'descending'>('descending')
  const search = query.trim().toLowerCase()
  const matches = mockSessions.filter(({ client, device }) => `${client} ${device}`.toLowerCase().includes(search))
  // The mock list is already newest first.
  const sessions = direction === 'descending' ? matches : matches.reverse()

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
                <td>{session.client}</td>
                <td>{session.device}</td>
                <td>{session.lastUsed}</td>
                <td className="account-table-actions">
                  {session.current
                    ? <span className="account-session-status">This session</span>
                    : <button className="account-more" type="button" aria-label={`More actions for ${session.device}`}><MoreIcon /></button>}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && <tr><td className="account-table-empty" colSpan={4}>No sessions match “{query.trim()}”</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
