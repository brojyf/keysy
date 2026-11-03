'use client'

import { createContext, useContext } from 'react'
import type { SessionUser } from '../lib/session-user'

type CurrentUser = {
  user: SessionUser
  onUserChange: (user: SessionUser) => void
  onSignedOut: () => void
}

export const CurrentUserContext = createContext<CurrentUser | null>(null)

export function useCurrentUser() {
  const currentUser = useContext(CurrentUserContext)
  if (!currentUser) throw new Error('Current user is unavailable')
  return currentUser
}
