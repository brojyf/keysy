'use client'

import { createContext, useContext } from 'react'
import type { Organization } from '../lib/organization'
import type { SessionUser } from '../lib/session-user'
import type { DeleteOrganizationResult } from '../lib/organization-queries'

type CurrentUser = {
  user: SessionUser
  organizations: Organization[]
  organization: Organization | undefined
  createOrganization: (name: string) => Promise<Organization | null>
  renameOrganization: (organizationID: string, name: string) => Promise<{ id: string; name: string } | null>
  deleteOrganization: (organizationID: string) => Promise<DeleteOrganizationResult | null>
  onUserChange: (user: SessionUser) => void
  onSignedOut: () => void
  onSignOutRequest: () => void
}

export const CurrentUserContext = createContext<CurrentUser | null>(null)

export function useCurrentUser() {
  const currentUser = useContext(CurrentUserContext)
  if (!currentUser) throw new Error('Current user is unavailable')
  return currentUser
}
