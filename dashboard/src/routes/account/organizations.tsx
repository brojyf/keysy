import { createFileRoute, Link } from '@tanstack/react-router'

import { useRef, useState } from 'react'
import { SortableHeader, TableSearch } from '../../components/account-table-controls'
import MoreMenu from '../../components/more-menu'
import Button from '../../components/button'
import CreateOrganizationDialog from '../../components/create-organization-dialog'
import { openDialog } from '../../lib/dialog-controls'
import { useCurrentUser } from '../../components/current-user'
import { organizationPath } from '../../lib/organization-route'

function OrganizationsPage() {
  const dialog = useRef<HTMLDialogElement>(null)
  const { organizations: allOrganizations } = useCurrentUser()
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<'ascending' | 'descending'>('ascending')
  const search = query.trim().toLowerCase()
  const organizations = allOrganizations
    .filter(({ name }) => name.toLowerCase().includes(search))
    .sort((a, b) => (direction === 'ascending' ? 1 : -1) * a.name.localeCompare(b.name))

  function openCreateDialog() {
    if (!dialog.current) return
    openDialog(dialog.current)
    dialog.current.querySelector<HTMLInputElement>('input.account-name')?.focus()
  }

  if (allOrganizations.length === 0) return (
    <>
      <div className="account-organizations-empty">
        <div><h2>No organizations yet</h2><p>Create an organization, or ask a teammate to invite you.</p></div>
        <Button variant="primary" onClick={openCreateDialog}>New organization</Button>
      </div>
      <CreateOrganizationDialog ref={dialog} />
    </>
  )

  return (
    <>
      <div className="account-toolbar">
        <TableSearch label="Search organizations" value={query} onChange={setQuery} />
        <Button variant="primary" onClick={openCreateDialog}>New organization</Button>
      </div>
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
              <tr key={id}>
                <td>{name}</td>
                <td>{role[0].toUpperCase() + role.slice(1)}</td>
                <td>{memberCount}</td>
                <td className="account-table-actions">
                  <MoreMenu id={`organization-menu-${id}`} label={`More actions for ${name}`}>
                    <Link className="account-menu-item" to={organizationPath(id, '/secrets')}>Dashboard</Link>
                    <Link className="account-menu-item" to={organizationPath(id, '/settings')}>Settings</Link>
                  </MoreMenu>
                </td>
              </tr>
            ))}
            {organizations.length === 0 && <tr><td className="account-table-empty" colSpan={4}>{`No organizations match “${query.trim()}”`}</td></tr>}
          </tbody>
        </table>
      </div>
      <CreateOrganizationDialog ref={dialog} />
    </>
  )
}

export const Route = createFileRoute('/account/organizations')({ component: OrganizationsPage, head: () => ({ meta: [{ title: 'Account | Keysy' }] }) })
