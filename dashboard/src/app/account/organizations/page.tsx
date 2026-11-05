'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type MouseEvent, type ToggleEvent } from 'react'
import { MoreIcon, SortableHeader, TableSearch } from '../../../components/account-table-controls'
import { useCurrentUser } from '../../../components/current-user'

const settingsHref = '/settings'

function placeRowMenu(event: ToggleEvent<HTMLDivElement>) {
  if (event.newState !== 'open') return
  const menu = event.currentTarget
  const trigger = menu.previousElementSibling!.getBoundingClientRect()
  menu.style.top = `${trigger.bottom + 4}px`
  menu.style.right = `${document.documentElement.clientWidth - trigger.right}px`
}

export default function OrganizationsPage() {
  const router = useRouter()
  const { organizations: allOrganizations } = useCurrentUser()
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<'ascending' | 'descending'>('ascending')
  const search = query.trim().toLowerCase()
  const organizations = allOrganizations
    .filter(({ name }) => name.toLowerCase().includes(search))
    .sort((a, b) => (direction === 'ascending' ? 1 : -1) * a.name.localeCompare(b.name))

  function openOrganization(event: MouseEvent<HTMLTableRowElement>) {
    if (!(event.target as Element).closest('a, button, [popover]')) router.push(settingsHref)
  }

  return (
    <>
      {allOrganizations.length > 0 && <TableSearch label="Search organizations" value={query} onChange={setQuery} />}
      <div className="account-table account-orgs">
        <table>
          <thead>
            <tr>
              {allOrganizations.length > 0 ? (
                <SortableHeader label="Organization" direction={direction} onToggle={() => setDirection(direction === 'ascending' ? 'descending' : 'ascending')} />
              ) : <th>Organization</th>}
              <th>Role</th>
              <th>Members</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {organizations.map(({ id, name, role, memberCount }) => (
              <tr key={id} className="account-org-row" onClick={openOrganization}>
                <td><Link className="account-table-link" href={settingsHref}>{name}</Link></td>
                <td>{role[0].toUpperCase() + role.slice(1)}</td>
                <td>{memberCount}</td>
                <td className="account-table-actions">
                  <button className="account-more" type="button" popoverTarget={`organization-menu-${id}`} aria-label={`More actions for ${name}`}>
                    <MoreIcon />
                  </button>
                  <div id={`organization-menu-${id}`} className="account-menu account-row-menu" popover="auto" onBeforeToggle={placeRowMenu}>
                    <Link className="account-menu-item" href="/secrets">Dashboard</Link>
                    <Link className="account-menu-item" href={settingsHref}>Settings</Link>
                  </div>
                </td>
              </tr>
            ))}
            {organizations.length === 0 && <tr><td className="account-table-empty" colSpan={4}>{allOrganizations.length === 0 ? 'No organizations yet' : `No organizations match “${query.trim()}”`}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
