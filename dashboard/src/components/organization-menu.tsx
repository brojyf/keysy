import { Link, useLocation } from '@tanstack/react-router'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useId, useRef, type ToggleEvent } from 'react'
import { openDialog } from '../lib/dialog-controls'
import { switchOrganizationPath } from '../lib/organization-route'
import { readRecentOrganizationIDs, recentOrganizations } from '../lib/recent-organizations'
import CreateOrganizationDialog from './create-organization-dialog'
import { useCurrentUser } from './current-user'

export default function OrganizationMenu() {
  const { user, organization, organizations } = useCurrentUser()
  const pathname = useLocation({ select: (location) => location.pathname })
  const menuID = useId()
  const menu = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  if (!organization) return null
  const recent = recentOrganizations(organizations, [organization.id, ...readRecentOrganizationIDs(user.id)])

  function placeMenu(event: ToggleEvent<HTMLDivElement>) {
    if (event.newState !== 'open') return
    const trigger = event.currentTarget.previousElementSibling!.getBoundingClientRect()
    event.currentTarget.style.top = `${trigger.bottom + 8}px`
    event.currentTarget.style.left = `${trigger.left - 6}px`
  }

  function createOrganization() {
    menu.current?.hidePopover()
    if (!dialog.current) return
    openDialog(dialog.current)
    dialog.current.querySelector<HTMLInputElement>('input.account-name')?.focus()
  }

  return (
    <>
      <button className="topbar-org" type="button" popoverTarget={menuID}>
        {organization.name}
        <ChevronsUpDown size={14} strokeWidth={1.17} absoluteStrokeWidth aria-hidden />
      </button>
      <div id={menuID} ref={menu} className="account-menu organization-menu" popover="auto" onBeforeToggle={placeMenu}>
        <div className="organization-menu-label">Organizations</div>
        {recent.map((item) => (
          <Link key={item.id} className="account-menu-item organization-menu-org" to={switchOrganizationPath(item.id, pathname)} aria-current={item.id === organization.id ? 'true' : undefined} onClick={() => menu.current?.hidePopover()}>
            <span>{item.name}</span>
            {item.id === organization.id && <Check size={14} strokeWidth={2} absoluteStrokeWidth aria-hidden />}
          </Link>
        ))}
        <hr className="account-menu-divider" />
        <Link className="account-menu-item" to="/account/organizations" onClick={() => menu.current?.hidePopover()}>All organizations</Link>
        <hr className="account-menu-divider" />
        <button className="account-menu-item organization-menu-new" type="button" onClick={createOrganization}>
          <Plus size={14} strokeWidth={1.17} absoluteStrokeWidth aria-hidden />New organization
        </button>
      </div>
      <CreateOrganizationDialog ref={dialog} />
    </>
  )
}
