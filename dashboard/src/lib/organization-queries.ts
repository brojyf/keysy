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

export type DeleteOrganizationResult = { outcome: 'completed' | 'unavailable'; organizations: Organization[] }

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
      queryClient.setQueryData<Organization[]>(queryKey, (current = []) => current.some((item) => item.id === organization.id) ? current : [...current, organization])
      void revalidation.catch(() => {})
    },
    retry: false,
    networkMode: 'always',
  })

  const rename = useMutation({
    mutationKey: [...queryKey, 'rename'],
    mutationFn: async ({ organizationID, name }: { organizationID: string; name: string }): Promise<{ id: string; name: string } | null> => {
      const response = await apiFetch(`/v0/orgs/${encodeURIComponent(organizationID)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), signal: sessionSignal,
      })
      sessionSignal?.throwIfAborted()
      if (response.status === 401) { onSignedOut(); return null }
      if (response.status !== 200) throw new Error('Rename failed')
      return parseCreatedOrganization(await response.json())
    },
    onSuccess: (renamed) => {
      if (!active() || !renamed) return
      const revalidation = refreshOrganizations()
      queryClient.setQueryData<Organization[]>(queryKey, (current = []) => current.map((organization) => organization.id === renamed.id ? { ...organization, name: renamed.name } : organization))
      void revalidation.catch(() => {})
    },
    onError: () => { if (active()) return refreshOrganizations().catch(() => {}) },
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
    renameOrganization: async (organizationID: string, name: string) => {
      const organization = await rename.mutateAsync({ organizationID, name })
      return active() ? organization : null
    },
    deleteOrganization: async (organizationID: string): Promise<DeleteOrganizationResult | null> => {
      try {
        const status = await remove.mutateAsync(organizationID)
        if (!active() || status === null) return null
        if (status === 204) return { outcome: 'completed', organizations: currentOrganizations() }
      } catch (error) {
        if (!active()) return null
        const reconciliation = queryClient.getQueryState(queryKey)
        if (reconciliation?.status !== 'success' || reconciliation.isInvalidated || currentOrganizations().some((organization) => organization.id === organizationID)) throw error
      }
      const reconciliation = queryClient.getQueryState(queryKey)
      if (reconciliation?.status !== 'success' || reconciliation.isInvalidated) throw reconciliation?.error ?? new Error('Organizations check failed')
      const organizations = currentOrganizations()
      if (organizations.some((organization) => organization.id === organizationID)) throw new Error('The organization was not found, or you no longer have permission to delete it.')
      return { outcome: 'unavailable', organizations }
    },
  }
}
