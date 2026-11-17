import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './api-client'
import type { Organization } from './organization'

export type Member = { userId: string; name: string; email: string; role: Organization['role']; deleting: boolean }

export function parseMembers(value: unknown): Member[] {
  if (!Array.isArray(value)) throw new Error('Invalid members')
  return value.map((item: unknown) => {
    const member = (item ?? {}) as Record<string, unknown>
    if (typeof member.userId !== 'string' || !member.userId || typeof member.name !== 'string' || typeof member.email !== 'string'
      || typeof member.deleting !== 'boolean'
      || (member.role !== 'owner' && member.role !== 'admin' && member.role !== 'developer')) throw new Error('Invalid member')
    return { userId: member.userId, name: member.name, email: member.email, role: member.role, deleting: member.deleting }
  })
}

export function useRemoveMember(userID: string, organizationID: string, onSignedOut: () => void) {
  const queryClient = useQueryClient()
  const { queryKey } = memberQueryOptions(userID, organizationID, onSignedOut)
  const remove = useMutation({
    mutationKey: [...queryKey, 'remove'],
    mutationFn: async (member: Member) => {
      const message = `Could not remove ${member.name}. Try again.`
      const response = await apiFetch(`/v0/orgs/${encodeURIComponent(organizationID)}/members/${encodeURIComponent(member.userId)}`, { method: 'DELETE' }).catch(() => { throw new Error(message) })
      if (response.status === 401) { onSignedOut(); return }
      if (response.status !== 204 && response.status !== 403 && response.status !== 404) throw new Error(message)
      void queryClient.invalidateQueries({ queryKey, exact: true })
      void queryClient.invalidateQueries({ queryKey: ['organizations', userID], exact: true })
    },
    retry: false,
    networkMode: 'always',
  })
  return (member: Member) => remove.mutateAsync(member)
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
