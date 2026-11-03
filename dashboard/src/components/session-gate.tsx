'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { fetchWithSessionRefresh } from '../lib/session-refresh'
import { parseSessionUser, type SessionUser } from '../lib/session-user'
import { serviceURLs } from '../lib/service-urls'
import { CurrentUserContext } from './current-user'
import Rail from './rail'
import Topbar from './topbar'

function SessionGate({ children }: { children: ReactNode }) {
  const { apiURL, authURL } = serviceURLs()
  const [user, setUser] = useState<SessionUser | null>()
  const [sessionError, setSessionError] = useState(false)
  const [logoutStatus, setLogoutStatus] = useState<'idle' | 'pending' | 'error'>('idle')
  const [sessionCheck, setSessionCheck] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function checkSession() {
      try {
        const response = await fetchWithSessionRefresh(new URL('/v0/me', apiURL).href, authURL, { signal: controller.signal })
        if (response.status === 401) {
          if (!controller.signal.aborted) setUser(null)
          return
        }
        if (!response.ok) throw new Error('Session check failed')
        const session = parseSessionUser(await response.json())
        if (!controller.signal.aborted) setUser(session)
      } catch {
        // Only a 401 means signed out; any other failure must not show sign-in.
        if (!controller.signal.aborted) setSessionError(true)
      }
    }
    void checkSession()
    return () => controller.abort()
  }, [apiURL, authURL, sessionCheck])

  function retrySessionCheck() {
    setSessionError(false)
    setUser(undefined)
    setSessionCheck((count) => count + 1)
  }

  async function logout() {
    if (logoutStatus === 'pending') return
    setLogoutStatus('pending')
    try {
      const response = await fetch(new URL('/v0/auth/logout', authURL).href, { method: 'POST', credentials: 'include' })
      if (!response.ok) throw new Error('Logout failed')
      setUser(null)
      setSessionError(false)
      setLogoutStatus('idle')
    } catch {
      setLogoutStatus('error')
    }
  }

  if (sessionError) {
    return (
      <main className="auth-page" aria-labelledby="session-error-title">
        <section className="sign-in-card">
          <img src="/keysy-symbol.svg" width="36" height="36" alt="Keysy" />
          <div className="sign-in-copy">
            <h1 id="session-error-title">Can't reach Keysy</h1>
            <p role="alert">Your session could not be checked. Try again in a moment.</p>
          </div>
          <button type="button" className="auth-button" onClick={retrySessionCheck}>Try again</button>
        </section>
      </main>
    )
  }

  if (user === undefined) {
    return <main className="auth-page"><p role="status">Checking your session...</p></main>
  }

  if (user) {
    return (
      <CurrentUserContext.Provider value={{ user, onUserChange: setUser, onSignedOut: () => setUser(null) }}>
        <div className="dashboard">
          <Topbar />
          <div className="dashboard-body">
            <Rail displayName={user.displayName} avatarUrl={user.avatarUrl} email={user.email} signOutStatus={logoutStatus} onSignOut={logout} />
            <main className="dashboard-content">{children}</main>
          </div>
        </div>
      </CurrentUserContext.Provider>
    )
  }

  return (
    <main className="auth-page" aria-labelledby="sign-in-title">
      <section className="sign-in-card">
        <img src="/keysy-symbol.svg" width="36" height="36" alt="Keysy" />
        <div className="sign-in-copy">
          <h1 id="sign-in-title">Sign in to Keysy</h1>
        </div>
        <a className="auth-button" href={new URL('/v0/auth/google', authURL).href}>
          <img src="/google-symbol.svg" width="18" height="18" alt="" />
          Continue with Google
        </a>
        <p className="sign-in-terms">
          By continuing, you agree to the{' '}
          <span aria-disabled="true" title="Coming soon">Terms</span> and{' '}
          <span aria-disabled="true" title="Coming soon">Privacy Policy</span>.
        </p>
      </section>
      <footer className="sign-in-footer">
        <span>© 2026 Keysy</span>
        <span aria-disabled="true" title="Coming soon">Status</span>
        <span aria-disabled="true" title="Coming soon">Privacy</span>
        <span aria-disabled="true" title="Coming soon">Terms</span>
      </footer>
    </main>
  )
}

export default SessionGate
