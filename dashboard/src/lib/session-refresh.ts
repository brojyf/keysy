let pendingRefresh: Promise<Response> | null = null
let logoutPending = false
let sessionVersion = 0

// Concurrent 401s share one refresh: Supabase rotates the refresh token on each use.
function refreshSession(authURL: string): Promise<Response> {
  pendingRefresh ??= fetch(new URL('/v0/auth/refresh', authURL).href, { method: 'POST', credentials: 'include' }).finally(() => {
    pendingRefresh = null
  })
  return pendingRefresh
}

// Finish any refresh cookie writes before logout clears and revokes the session.
export async function logoutSession(authURL: string): Promise<Response> {
  logoutPending = true
  sessionVersion += 1
  try {
    await pendingRefresh?.catch(() => {})
    return await fetch(new URL('/v0/auth/logout', authURL).href, { method: 'POST', credentials: 'include' })
  } finally {
    logoutPending = false
  }
}

// fetchWithSessionRefresh renews an expired access cookie once, then retries.
// It returns the 401 when the session cannot be renewed and throws when auth is unavailable.
export async function fetchWithSessionRefresh(url: string, authURL: string, init: RequestInit = {}): Promise<Response> {
  const requestVersion = sessionVersion
  const response = await fetch(url, { ...init, credentials: 'include' })
  if (response.status !== 401) return response
  // A delayed 401 must not start a refresh during or after logout.
  if (logoutPending || requestVersion !== sessionVersion) throw new Error('Session changed')
  const refresh = await refreshSession(authURL)
  if (logoutPending || requestVersion !== sessionVersion) throw new Error('Session changed')
  if (refresh.status === 401) return response
  if (!refresh.ok) throw new Error('Session refresh failed')
  return fetch(url, { ...init, credentials: 'include' })
}
