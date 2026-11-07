import type { Organization } from './organization'

export function organizationPath(organizationID: string, path: string): string {
  return `/orgs/${encodeURIComponent(organizationID)}${path}`
}

export function organizationForPath(organizations: Organization[], path: string): Organization | undefined {
  if (path !== '/orgs' && !path.startsWith('/orgs/')) return organizations[0]
  const id = path.match(/^\/orgs\/([^/]+)(?:\/|$)/)?.[1]
  if (!id) return undefined
  try {
    return organizations.find((organization) => organization.id === decodeURIComponent(id))
  } catch {
    return undefined
  }
}

export function organizationRoute(count: number, path: string): 'account' | 'full' | '/account/organizations' {
  if (count > 0) return 'full'
  if (path === '/account' || path.startsWith('/account/')) return 'account'
  return '/account/organizations'
}
