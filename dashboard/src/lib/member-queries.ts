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
    queryFn: async ({ signal }): Promise<Member[]> => {
      const response = await apiFetch(`/v0/orgs/${encodeURIComponent(organizationID)}/members`, { signal })
      if (response.status === 401) { onSignedOut(); throw new Error('Session expired') }
      if (!response.ok) throw new Error('Members check failed')
      return parseMembers(await response.json())
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: 'always',
  })
}
