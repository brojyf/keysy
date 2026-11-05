'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type MouseEvent, type ToggleEvent } from 'react'
import { MoreIcon, SortableHeader, TableSearch } from '../../../components/account-table-controls'
import { mockOrganizations } from '../mock-account'

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
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<'ascending' | 'descending'>('ascending')
  const search = query.trim().toLowerCase()
  const organizations = mockOrganizations
    .filter(({ name }) => name.toLowerCase().includes(search))
    .sort((a, b) => (direction === 'ascending' ? 1 : -1) * a.name.localeCompare(b.name))

  function openOrganization(event: MouseEvent<HTMLTableRowElement>) {
    if (!(event.target as Element).closest('a, button, [popover]')) router.push(settingsHref)
  }

  return (
    <>
      <TableSearch label="Search organizations" value={query} onChange={setQuery} />
      <div className="account-table account-orgs">
        <table>
          <thead>
            <tr>
              <SortableHeader label="Organization" direction={direction} onToggle={() => setDirection(direction === 'ascending' ? 'descending' : 'ascending')} />
              <th>Role</th>
              <th>Members</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {organizations.map(({ name, role, members }) => (
              <tr key={name} className="account-org-row" onClick={openOrganization}>
                <td><Link className="account-table-link" href={settingsHref}>{name}</Link></td>
                <td>{role}</td>
                <td>{members}</td>
                <td className="account-table-actions">
                  <button className="account-more" type="button" popoverTarget={`organization-menu-${name}`} aria-label={`More actions for ${name}`}>
                    <MoreIcon />
                  </button>
                  <div id={`organization-menu-${name}`} className="account-menu account-row-menu" popover="auto" onBeforeToggle={placeRowMenu}>
                    <Link className="account-menu-item" href="/secrets">Dashboard</Link>
                    <Link className="account-menu-item" href={settingsHref}>Settings</Link>
                  </div>
                </td>
              </tr>
            ))}
            {organizations.length === 0 && <tr><td className="account-table-empty" colSpan={4}>No organizations match “{query.trim()}”</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
