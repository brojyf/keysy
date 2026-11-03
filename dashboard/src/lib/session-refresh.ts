let pendingRefresh: Promise<Response> | null = null

// Concurrent 401s share one refresh: Supabase rotates the refresh token on each use.
function refreshSession(authURL: string): Promise<Response> {
  pendingRefresh ??= fetch(new URL('/v0/auth/refresh', authURL).href, { method: 'POST', credentials: 'include' }).finally(() => {
    pendingRefresh = null
  })
  return pendingRefresh
}

// fetchWithSessionRefresh renews an expired access cookie once, then retries.
// It returns the 401 when the session cannot be renewed and throws when auth is unavailable.
export async function fetchWithSessionRefresh(url: string, authURL: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, { ...init, credentials: 'include' })
  if (response.status !== 401) return response
  const refresh = await refreshSession(authURL)
  if (refresh.status === 401) return response
  if (!refresh.ok) throw new Error('Session refresh failed')
  return fetch(url, { ...init, credentials: 'include' })
}
