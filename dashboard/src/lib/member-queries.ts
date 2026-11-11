import { queryOptions } from '@tanstack/react-query'
import { apiFetch } from './api-client'
import type { Organization } from './organization'

export type Member = { userId: string; name: string; email: string; role: Organization['role'] }

export function parseMembers(value: unknown): Member[] {
  if (!Array.isArray(value)) throw new Error('Invalid members')
  return value.map((item: unknown) => {
    const member = (item ?? {}) as Record<string, unknown>
    if (typeof member.userId !== 'string' || !member.userId || typeof member.name !== 'string' || typeof member.email !== 'string'
      || (member.role !== 'owner' && member.role !== 'admin' && member.role !== 'developer')) throw new Error('Invalid member')
    return { userId: member.userId, name: member.name, email: member.email, role: member.role }
  })
}

export function memberQueryOptions(userID: string, organizationID: string, onSignedOut: () => void) {
  return queryOptions({
    queryKey: ['members', userID, organizationID],
    queryFn: async ({ signal, client }): Promise<Member[]> => {
      const response = await apiFetch(`/v0/orgs/${encodeURIComponent(organizationID)}/members`, { signal })
      if (response.status === 401) { onSignedOut(); throw new Error('Session expired') }
      // 404 means the org is gone or the viewer left it; the refreshed org list lets SessionGate show Organization unavailable.
      if (response.status === 404) void client.invalidateQueries({ queryKey: ['organizations', userID], exact: true })
      if (!response.ok) throw new Error('Members check failed')
      const members = parseMembers(await response.json())
      // The org list is cached for the session; a role changed since then makes it stale.
      const viewerRole = members.find((member) => member.userId === userID)?.role
      const cachedRole = client.getQueryData<Organization[]>(['organizations', userID])?.find(({ id }) => id === organizationID)?.role
      if (viewerRole && viewerRole !== cachedRole) void client.invalidateQueries({ queryKey: ['organizations', userID], exact: true })
      return members
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: 'always',
  })
}
