import { queryOptions } from '@tanstack/react-query'
import { apiFetch } from './api-client'

export type Invitation = { id: string; email: string; role: 'admin' | 'developer'; status: 'pending' | 'expired' }

export function parseInvitations(value: unknown): Invitation[] {
  if (!Array.isArray(value)) throw new Error('Invalid invitations')
  return value.map((item: unknown) => {
    const invitation = (item ?? {}) as Record<string, unknown>
    if (typeof invitation.id !== 'string' || !invitation.id || typeof invitation.email !== 'string'
      || (invitation.role !== 'admin' && invitation.role !== 'developer')
      || (invitation.status !== 'pending' && invitation.status !== 'expired')) throw new Error('Invalid invitation')
    return { id: invitation.id, email: invitation.email, role: invitation.role, status: invitation.status }
  })
}

export function invitationQueryOptions(userID: string, organizationID: string, onSignedOut: () => void) {
  return queryOptions({
    queryKey: ['invitations', userID, organizationID],
    queryFn: async ({ signal, client }): Promise<Invitation[]> => {
      const response = await apiFetch(`/v0/orgs/${encodeURIComponent(organizationID)}/invitations`, { signal })
      if (response.status === 401) { onSignedOut(); throw new Error('Session expired') }
      // 404 means the org is gone or the viewer left it; the refreshed org list lets SessionGate show Organization unavailable.
      if (response.status === 404) void client.invalidateQueries({ queryKey: ['organizations', userID], exact: true })
      if (!response.ok) throw new Error('Invitations check failed')
      return parseInvitations(await response.json())
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: 'always',
  })
}
