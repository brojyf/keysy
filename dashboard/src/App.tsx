'use client'

import { useEffect, useState } from 'react'

function App() {
  const authURL = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:8080'
  const [user, setUser] = useState<{ id: string; email?: string } | null>()
  const [sessionError, setSessionError] = useState(false)
  const [logoutStatus, setLogoutStatus] = useState<'idle' | 'pending' | 'error'>('idle')

  useEffect(() => {
    const controller = new AbortController()
    async function checkSession() {
      try {
        const response = await fetch(new URL('/v0/auth/session', authURL).href, {
          credentials: 'include',
          signal: controller.signal,
        })
        if (response.status === 401) {
          if (!controller.signal.aborted) setUser(null)
          return
        }
        if (!response.ok) throw new Error('Session check failed')
        const session = await response.json()
        if (typeof session?.user?.id !== 'string' || !session.user.id || (session.user.email !== undefined && typeof session.user.email !== 'string')) {
          throw new Error('Invalid session response')
        }
        if (!controller.signal.aborted) setUser(session.user)
      } catch {
        if (!controller.signal.aborted) {
          setUser(null)
          setSessionError(true)
        }
      }
    }
    void checkSession()
    return () => controller.abort()
  }, [authURL])

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

  if (user === undefined) {
    return <main className="auth-page"><p role="status">Checking your session...</p></main>
  }

  if (user) {
    return (
      <main className="auth-page">
        <section className="sign-in-card">
          <p role="status">Signed in as {user.email || 'your account'}.</p>
          <button className="auth-button" type="button" disabled={logoutStatus === 'pending'} onClick={logout}>
            {logoutStatus === 'pending' ? 'Signing out...' : 'Logout'}
          </button>
          {logoutStatus === 'error' && <p role="alert">Could not sign out. Try again.</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page" aria-labelledby="sign-in-title">
      <section className="sign-in-card">
        <img src="/sign-in/keysy-symbol.svg" width="36" height="36" alt="Keysy" />
        <div className="sign-in-copy">
          <h1 id="sign-in-title">Sign in to Keysy</h1>
          <p>Use your Google account to continue.</p>
        </div>
        {sessionError && <p role="alert">Could not check your session. Reload the page to try again.</p>}
        <a className="auth-button" href={new URL('/v0/auth/google', authURL).href}>
          <img src="/sign-in/google-symbol.svg" width="18" height="18" alt="" />
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

export default App
