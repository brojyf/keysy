'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { apiFetch } from '../lib/api-client'
import { logoutSession } from '../lib/session-refresh'
import { parseSessionUser, type SessionUser } from '../lib/session-user'
import { organizationRoute } from '../lib/organization-route'
import { parseOrganizations, type Organization } from '../lib/organization'
import { serviceURLs } from '../lib/service-urls'
import { CurrentUserContext } from './current-user'
import Rail from './rail'
import SignOutDialog from './sign-out-dialog'
import { openDialog } from '../lib/dialog-controls'
import Topbar from './topbar'
import LoadingSkeleton from './loading-skeleton'

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
  let redirect: string | null = null
  if (user === null && pathname !== '/signin') redirect = '/signin'
  else if (user && pathname === '/signin') redirect = organizations.length ? '/secrets' : '/account/organizations'
  else if (route === '/account/organizations') redirect = route
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
    openDialog(dialog)
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
    return <LoadingSkeleton pathname={pathname} />
  }

  if (user) {
    const accountMenu = { displayName: user.displayName, avatarUrl: user.avatarUrl, email: user.email, onSignOutRequest: requestSignOut }
    return (
      <CurrentUserContext.Provider value={{
        user,
        organizations,
        onOrganizationCreated: (organization) => setOrganizations((current) => [...current, organization]),
        onOrganizationDeleted: (organizationID) => setOrganizations((current) => current.filter((organization) => organization.id !== organizationID)),
        onUserChange: (updated) => setUser((current) => current ? updated : current),
        onSignedOut: () => setUser(null),
        onSignOutRequest: requestSignOut,
      }}>
        <div className="dashboard">
          <Topbar />
          <div className="dashboard-body">
            {route === 'full' && <Rail {...accountMenu} />}
            <main className="dashboard-content">{children}</main>
          </div>
        </div>
        <SignOutDialog ref={signOutDialog} status={logoutStatus} onConfirm={logout} />
      </CurrentUserContext.Provider>
    )
  }

  return children
}

export default SessionGate
