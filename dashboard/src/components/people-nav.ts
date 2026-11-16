'use client'

import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './current-user'
import type { SettingsNavItem } from './settings-layout'
import { invitationQueryOptions } from '../lib/invitation-queries'
import { organizationPath } from '../lib/organization-route'

// Figma People · Members and People · Invitations: the Invitations row shows the invitation count.
// Invitations shares this query, so its page sends one request.
export function usePeopleNav(current: 'Members' | 'Invitations'): SettingsNavItem[] {
  const { user, organization, onSignedOut } = useCurrentUser()
  const organizationID = organization?.id ?? ''
  const invitationQuery = useQuery({ ...invitationQueryOptions(user.id, organizationID, onSignedOut), enabled: !!organization })
  const count = invitationQuery.isError ? 0 : invitationQuery.data?.length ?? 0
  return [
    { label: 'Members', href: organizationPath(organizationID, '/people'), current: current === 'Members' },
    { label: 'Invitations', href: organizationPath(organizationID, '/people/invitations'), current: current === 'Invitations', count: count || undefined },
    { label: 'Permission sets' },
  ]
}
