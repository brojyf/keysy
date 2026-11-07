'use client'

import { createContext, useContext } from 'react'
import type { Organization } from '../lib/organization'
import type { SessionUser } from '../lib/session-user'

type CurrentUser = {
  user: SessionUser
  organizations: Organization[]
  onOrganizationCreated: (organization: Organization) => void
  onOrganizationDeleted: (organizationID: string) => void
  onOrganizationsChange: (organizations: Organization[]) => void
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
