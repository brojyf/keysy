'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api-client'
import { logoutSession } from '../lib/session-refresh'
import { parseSessionUser, type SessionUser } from '../lib/session-user'
import { organizationForPath, organizationPath, organizationRoute } from '../lib/organization-route'
import { organizationQueryOptions, useOrganizationMutations } from '../lib/organization-queries'
import { serviceURLs } from '../lib/service-urls'
import { CurrentUserContext } from './current-user'
import Rail from './rail'
import SignOutDialog from './sign-out-dialog'
import { openDialog } from '../lib/dialog-controls'
import Topbar from './topbar'
import LoadingSkeleton from './loading-skeleton'

function SessionGateContent({ children }: { children: ReactNode }) {
  const { authURL } = serviceURLs()
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<SessionUser | null>()
  const [sessionError, setSessionError] = useState(false)
  const [logoutStatus, setLogoutStatus] = useState<'idle' | 'pending' | 'error'>('idle')
  const [sessionCheck, setSessionCheck] = useState(0)
  const signOutDialog = useRef<HTMLDialogElement>(null)
  const [currentSession, setCurrentSession] = useState<AbortController>()
  const navigation = useRef({ pathname })
  useLayoutEffect(() => { navigation.current = { pathname } }, [pathname])

  const signedOut = useCallback((controller: AbortController | undefined) => {
    if (!controller || controller.signal.aborted) return
    controller.abort()
    queryClient.clear()
    setUser(null)
  }, [queryClient])

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
        await queryClient.query(organizationQueryOptions(session.id, controller.signal, () => signedOut(controller)))
        if (!controller.signal.aborted) { setCurrentSession(controller); setUser(session) }
      } catch {
        // Only a 401 means signed out; any other failure must not show sign-in.
        if (!controller.signal.aborted) setSessionError(true)
      }
    }
    void checkSession()
    return () => { controller.abort(); queryClient.clear() }
  }, [authURL, sessionCheck, queryClient, signedOut])

  const onSignedOut = () => signedOut(currentSession)
  const organizationQuery = useQuery({ ...organizationQueryOptions(user?.id ?? '', currentSession?.signal, onSignedOut), enabled: !!user })
  const organizations = organizationQuery.data ?? []
  const { createOrganization: addOrganization, deleteOrganization: removeOrganization } = useOrganizationMutations(user?.id ?? '', currentSession?.signal, onSignedOut)

  async function createOrganization(name: string) {
    const startedAt = navigation.current
    const organization = await addOrganization(name)
    if (organization && currentSession && !currentSession.signal.aborted && navigation.current === startedAt && startedAt.pathname === '/account/organizations') {
      router.push(organizationPath(organization.id, '/secrets'))
    }
    return organization
  }

  async function deleteOrganization(organizationID: string) {
    const startedAt = navigation.current
    const result = await removeOrganization(organizationID)
    if (result && currentSession && !currentSession.signal.aborted && navigation.current === startedAt && !result.organizations.some((item) => item.id === organizationID)) {
      router.replace(result.organizations[0] ? organizationPath(result.organizations[0].id, '/secrets') : '/account/organizations')
    }
    return result
  }

  const route = user ? organizationRoute(organizations.length, pathname) : null
  const organization = organizationForPath(organizations, pathname)
  const organizationScoped = pathname === '/orgs' || pathname.startsWith('/orgs/')
  let redirect: string | null = null
  if (user === null && pathname !== '/signin') redirect = '/signin'
  else if (user && pathname === '/signin') redirect = organizations[0] ? organizationPath(organizations[0].id, '/secrets') : '/account/organizations'
  else if (user && /^\/(secrets|services|members|audit-log|settings)(?:\/|$)/.test(pathname)) redirect = organizations[0] ? organizationPath(organizations[0].id, pathname) : '/account/organizations'
  else if (route === '/account/organizations' && !organizationScoped) redirect = route
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
      signedOut(currentSession)
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
        organization,
        createOrganization,
        deleteOrganization,
        onUserChange: (updated) => setUser((current) => current ? updated : current),
        onSignedOut,
        onSignOutRequest: requestSignOut,
      }}>
        <div className="dashboard">
          <Topbar />
          <div className="dashboard-body">
            {route === 'full' && organization && <Rail {...accountMenu} />}
            <main className="dashboard-content">
              {organizationScoped && !organization ? (
                <section aria-labelledby="organization-unavailable-title">
                  <h1 id="organization-unavailable-title">Organization unavailable</h1>
                  <p>This organization does not exist, was deleted, or you no longer have access.</p>
                  <Link href="/account/organizations">View your organizations</Link>
                </section>
              ) : children}
            </main>
          </div>
        </div>
        <SignOutDialog ref={signOutDialog} status={logoutStatus} onConfirm={logout} />
      </CurrentUserContext.Provider>
    )
  }

  return children
}

export default function SessionGate({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return <QueryClientProvider client={queryClient}><SessionGateContent>{children}</SessionGateContent></QueryClientProvider>
}
