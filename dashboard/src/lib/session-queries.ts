import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './api-client'

export type AccountSession = { id: string; client: 'web'; device: string; lastUsedAt: string; current: boolean }

export function parseSessions(value: unknown): AccountSession[] {
  if (!Array.isArray(value)) throw new Error('Invalid sessions')
  return value.map((item: unknown) => {
    const session = (item ?? {}) as Record<string, unknown>
    if (typeof session.id !== 'string' || !session.id || session.client !== 'web' || typeof session.device !== 'string'
      || typeof session.lastUsedAt !== 'string' || Number.isNaN(Date.parse(session.lastUsedAt)) || typeof session.current !== 'boolean') throw new Error('Invalid session')
    return { id: session.id, client: session.client, device: session.device, lastUsedAt: session.lastUsedAt, current: session.current }
  })
}

export function sessionQueryOptions(userID: string, onSignedOut: () => void) {
  return queryOptions({
    queryKey: ['sessions', userID],
    queryFn: async ({ signal }): Promise<AccountSession[]> => {
      const response = await apiFetch('/v0/me/sessions', { signal })
      if (response.status === 401) { onSignedOut(); throw new Error('Session expired') }
      if (!response.ok) throw new Error('Sessions check failed')
      return parseSessions(await response.json())
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: 'always',
  })
}

const revokeFailed = 'Could not revoke the session. Try again.'

async function errorMessage(response: Response) {
  try {
    const { error } = await response.json() as { error?: { message?: unknown } }
    if (typeof error?.message === 'string' && error.message) return error.message
  } catch {}
  return revokeFailed
}

// Resolves when the dialog can close: revoked, already gone, or signed out.
export function useRevokeSession(userID: string, onSignedOut: () => void) {
  const queryClient = useQueryClient()
  const { queryKey } = sessionQueryOptions(userID, onSignedOut)
  const revoke = useMutation({
    mutationKey: [...queryKey, 'revoke'],
    mutationFn: async (sessionID: string) => {
      const response = await apiFetch(`/v0/me/sessions/${encodeURIComponent(sessionID)}`, { method: 'DELETE' }).catch(() => { throw new Error(revokeFailed) })
      if (response.status === 401) { onSignedOut(); return }
      if (response.status !== 204 && response.status !== 404) throw new Error(await errorMessage(response))
      void queryClient.invalidateQueries({ queryKey, exact: true })
    },
    retry: false,
    networkMode: 'always',
  })
  return (sessionID: string) => revoke.mutateAsync(sessionID)
}
