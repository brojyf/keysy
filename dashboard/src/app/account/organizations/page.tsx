'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type MouseEvent, type ToggleEvent } from 'react'
import { MoreIcon, SortableHeader, TableSearch } from '../../../components/account-table-controls'
import CreateOrganizationDialog from '../../../components/create-organization-dialog'
import { openDialog } from '../../../lib/dialog-controls'
import { useCurrentUser } from '../../../components/current-user'
import { organizationPath } from '../../../lib/organization-route'

function placeRowMenu(event: ToggleEvent<HTMLDivElement>) {
  if (event.newState !== 'open') return
  const menu = event.currentTarget
  const trigger = menu.previousElementSibling!.getBoundingClientRect()
  menu.style.top = `${trigger.bottom + 4}px`
  menu.style.right = `${document.documentElement.clientWidth - trigger.right}px`
}

export default function OrganizationsPage() {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const { organizations: allOrganizations } = useCurrentUser()
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<'ascending' | 'descending'>('ascending')
  const search = query.trim().toLowerCase()
  const organizations = allOrganizations
    .filter(({ name }) => name.toLowerCase().includes(search))
    .sort((a, b) => (direction === 'ascending' ? 1 : -1) * a.name.localeCompare(b.name))

  function openOrganization(event: MouseEvent<HTMLTableRowElement>, organizationID: string) {
    if (!(event.target as Element).closest('a, button, [popover]')) router.push(organizationPath(organizationID, '/settings'))
  }

  if (allOrganizations.length === 0) return (
    <>
      <div className="account-organizations-empty">
        <div><h2>No organizations yet</h2><p>Create one, or ask an Admin to add you.</p></div>
        <button className="button button-primary" type="button" onClick={() => {
          if (!dialog.current) return
          openDialog(dialog.current)
          dialog.current.querySelector<HTMLInputElement>('#organization-name')?.focus()
        }}>New organization</button>
      </div>
      <CreateOrganizationDialog ref={dialog} />
    </>
  )

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
            {organizations.map(({ id, name, role, memberCount }) => (
              <tr key={id} className="account-org-row" onClick={(event) => openOrganization(event, id)}>
                <td><Link className="account-table-link" href={organizationPath(id, '/settings')}>{name}</Link></td>
                <td>{role[0].toUpperCase() + role.slice(1)}</td>
                <td>{memberCount}</td>
                <td className="account-table-actions">
                  <button className="account-more" type="button" popoverTarget={`organization-menu-${id}`} aria-label={`More actions for ${name}`}>
                    <MoreIcon />
                  </button>
                  <div id={`organization-menu-${id}`} className="account-menu account-row-menu" popover="auto" onBeforeToggle={placeRowMenu}>
                    <Link className="account-menu-item" href={organizationPath(id, '/secrets')}>Dashboard</Link>
                    <Link className="account-menu-item" href={organizationPath(id, '/settings')}>Settings</Link>
                  </div>
                </td>
              </tr>
            ))}
            {organizations.length === 0 && <tr><td className="account-table-empty" colSpan={4}>{`No organizations match “${query.trim()}”`}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
