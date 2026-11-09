import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './api-client'
import { parseCreatedOrganization, parseOrganizations, type Organization } from './organization'

export function organizationQueryOptions(userID: string, sessionSignal: AbortSignal | undefined, onSignedOut: () => void) {
  return queryOptions({
    queryKey: ['organizations', userID],
    queryFn: async ({ signal }): Promise<Organization[]> => {
      const response = await apiFetch('/v0/orgs', { signal })
      signal.throwIfAborted()
      sessionSignal?.throwIfAborted()
      if (response.status === 401) { onSignedOut(); throw new Error('Session expired') }
      if (!response.ok) throw new Error('Organizations check failed')
      const organizations = parseOrganizations(await response.json())
      signal.throwIfAborted()
      sessionSignal?.throwIfAborted()
      return organizations
    },
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: 'always',
  })
}

export type DeleteOrganizationResult = { status: 204 | 404; organizations: Organization[] }

export function useOrganizationMutations(userID: string, sessionSignal: AbortSignal | undefined, onSignedOut: () => void) {
  const queryClient = useQueryClient()
  const { queryKey } = organizationQueryOptions(userID, sessionSignal, onSignedOut)
  const filters = { queryKey, exact: true }
  const active = () => !!sessionSignal && !sessionSignal.aborted
  const currentOrganizations = () => queryClient.getQueryData<Organization[]>(queryKey) ?? []

  function refreshOrganizations() {
    // Invalidation replaces an older GET; its callers wait for the replacement too.
    return queryClient.invalidateQueries(filters, { throwOnError: true })
  }

  const create = useMutation({
    mutationKey: [...queryKey, 'create'],
    mutationFn: async (name: string): Promise<Organization | null> => {
      const response = await apiFetch('/v0/orgs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), signal: sessionSignal,
      })
      sessionSignal?.throwIfAborted()
      if (response.status === 401) { onSignedOut(); return null }
      if (response.status !== 201) throw new Error('Create failed')
      return { ...parseCreatedOrganization(await response.json()), role: 'owner', memberCount: 1 }
    },
    onSuccess: (organization) => {
      if (!active() || !organization) return
      const revalidation = refreshOrganizations()
      queryClient.setQueryData<Organization[]>(queryKey, (current = []) => [...current, organization])
      void revalidation.catch(() => {})
    },
    retry: false,
    networkMode: 'always',
  })

  const remove = useMutation({
    mutationKey: [...queryKey, 'delete'],
    mutationFn: async (organizationID: string) => {
      const response = await apiFetch(`/v0/orgs/${encodeURIComponent(organizationID)}`, { method: 'DELETE', signal: sessionSignal })
      sessionSignal?.throwIfAborted()
      if (response.status === 401) { onSignedOut(); return null }
      if (response.status !== 204 && response.status !== 404) throw new Error('Delete failed')
      return response.status
    },
    onSuccess: (status, organizationID) => {
      if (!active() || status === null) return
      const revalidation = refreshOrganizations()
      if (status === 404) return revalidation.catch(() => {})
      queryClient.setQueryData<Organization[]>(queryKey, (current = []) => current.filter((organization) => organization.id !== organizationID))
      void revalidation.catch(() => {})
    },
    onError: () => { if (active()) return refreshOrganizations().catch(() => {}) },
    retry: false,
    networkMode: 'always',
  })

  return {
    createOrganization: async (name: string) => {
      const organization = await create.mutateAsync(name)
      return active() ? organization : null
    },
    deleteOrganization: async (organizationID: string): Promise<DeleteOrganizationResult | null> => {
      const status = await remove.mutateAsync(organizationID).catch((error) => {
        const reconciliation = queryClient.getQueryState(queryKey)
        if (active() && reconciliation?.status === 'success' && !reconciliation.isInvalidated && !currentOrganizations().some((organization) => organization.id === organizationID)) {
          return 404 as const
        }
        throw error
      })
      if (status === 404 && queryClient.getQueryState(queryKey)?.status === 'error') throw queryClient.getQueryState(queryKey)!.error
      return active() && status !== null ? { status, organizations: currentOrganizations() } : null
    },
  }
}
