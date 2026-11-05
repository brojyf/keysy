let pendingRefresh: Promise<Response> | null = null
let logoutPending = false
let sessionVersion = 0
const requestTimeoutMilliseconds = 20_000 // Matches the 20 second server write limit.

function requestSignal(source?: AbortSignal | null) {
  const timeout = AbortSignal.timeout(requestTimeoutMilliseconds)
  if (!source) return timeout
  const controller = new AbortController()
  for (const signal of [source, timeout]) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: requestSignal(init.signal) })
}

// Concurrent 401s share one refresh: Supabase rotates the refresh token on each use.
function refreshSession(authURL: string): Promise<Response> {
  pendingRefresh ??= fetchWithTimeout(new URL('/v0/auth/refresh', authURL).href, { method: 'POST', credentials: 'include' }).finally(() => {
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
    return await fetchWithTimeout(new URL('/v0/auth/logout', authURL).href, { method: 'POST', credentials: 'include' })
  } finally {
    logoutPending = false
  }
}

// fetchWithSessionRefresh renews an expired access cookie once, then retries.
// It returns the 401 when the session cannot be renewed and throws when auth is unavailable.
export async function fetchWithSessionRefresh(url: string, authURL: string, init: RequestInit = {}): Promise<Response> {
  const requestVersion = sessionVersion
  const response = await fetchWithTimeout(url, { ...init, credentials: 'include' })
  if (response.status !== 401) return response
  // A delayed 401 must not start a refresh during or after logout.
  if (logoutPending || requestVersion !== sessionVersion) throw new Error('Session changed')
  const refresh = await refreshSession(authURL)
  if (logoutPending || requestVersion !== sessionVersion) throw new Error('Session changed')
  if (refresh.status === 401) return response
  if (!refresh.ok) throw new Error('Session refresh failed')
  return fetchWithTimeout(url, { ...init, credentials: 'include' })
}
