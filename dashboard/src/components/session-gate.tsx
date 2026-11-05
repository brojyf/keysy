'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { apiFetch } from '../lib/api-client'
import { logoutSession } from '../lib/session-refresh'
import { parseSessionUser, type SessionUser } from '../lib/session-user'
import { organizationRoute } from '../lib/organization-route'
import { parseOrganizations, type Organization } from '../lib/organization'
import AccountMenu from './account-menu'
import AuthFooter from './auth-footer'
import { serviceURLs } from '../lib/service-urls'
import { CurrentUserContext } from './current-user'
import Rail from './rail'
import SignOutDialog from './sign-out-dialog'
import Topbar from './topbar'

function SessionGate({ children }: { children: ReactNode }) {
  const { authURL } = serviceURLs()
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [user, setUser] = useState<SessionUser | null>()
  const [sessionError, setSessionError] = useState(false)
  const [logoutStatus, setLogoutStatus] = useState<'idle' | 'pending' | 'error'>('idle')
  const [sessionCheck, setSessionCheck] = useState(0)
  const signOutDialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function checkSession() {
      try {
        const response = await apiFetch('/v0/me', { signal: controller.signal })
        if (response.status === 401) {
          if (!controller.signal.aborted) setUser(null)
          return
        }
        if (!response.ok) throw new Error('Session check failed')
        const session = parseSessionUser(await response.json())
        const orgResponse = await apiFetch('/v0/orgs', { signal: controller.signal })
        if (orgResponse.status === 401) { if (!controller.signal.aborted) setUser(null); return }
        if (!orgResponse.ok) throw new Error('Organizations check failed')
        const orgs = parseOrganizations(await orgResponse.json())
        if (!controller.signal.aborted) { setOrganizations(orgs); setUser(session) }
      } catch {
        // Only a 401 means signed out; any other failure must not show sign-in.
        if (!controller.signal.aborted) setSessionError(true)
      }
    }
    void checkSession()
    return () => controller.abort()
  }, [authURL, sessionCheck])

  const route = user ? organizationRoute(organizations.length, pathname) : null
  const redirect = route === '/organizations/new' || route === '/secrets' ? route : null
  useEffect(() => { if (redirect) router.replace(redirect) }, [redirect, router])

  function retrySessionCheck() {
    setSessionError(false)
    setUser(undefined)
    setSessionCheck((count) => count + 1)
  }

  function requestSignOut() {
    if (logoutStatus === 'error') setLogoutStatus('idle')
    const dialog = signOutDialog.current
    if (!dialog) return
    // Safari shows a focus ring on the first button after a mouse click, so focus the dialog itself.
    dialog.autofocus = true
    dialog.showModal()
  }

  async function logout() {
    if (logoutStatus === 'pending') return
    setLogoutStatus('pending')
    try {
      const response = await logoutSession(authURL)
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

  if (user === undefined || redirect) {
    return <main className="auth-page"><p role="status">Checking your session...</p></main>
  }

  if (user) {
    const accountMenu = { displayName: user.displayName, avatarUrl: user.avatarUrl, email: user.email, onSignOutRequest: requestSignOut }
    return (
      <CurrentUserContext.Provider value={{
        user,
        organizations,
        onOrganizationCreated: (organization) => setOrganizations((current) => [...current, organization]),
        onUserChange: (updated) => setUser((current) => current ? updated : current),
        onSignedOut: () => setUser(null),
        onSignOutRequest: requestSignOut,
      }}>
        {route === 'create' ? (
          <>
            {children}
            <div className="create-account-menu"><AccountMenu {...accountMenu} selected={false} /></div>
          </>
        ) : (
          <div className="dashboard">
            <Topbar />
            <div className="dashboard-body">
              <Rail {...accountMenu} />
              <main className="dashboard-content">{children}</main>
            </div>
          </div>
        )}
        <SignOutDialog ref={signOutDialog} status={logoutStatus} onConfirm={logout} />
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
      <AuthFooter />
    </main>
  )
}

export default SessionGate
