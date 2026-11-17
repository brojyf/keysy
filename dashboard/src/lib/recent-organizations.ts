import type { Organization } from './organization'

export function readRecentOrganizationIDs(userID: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`keysy-recent-orgs:${userID}`) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function rememberOrganization(userID: string, organizationID: string) {
  try {
    const ids = [organizationID, ...readRecentOrganizationIDs(userID)]
    localStorage.setItem(`keysy-recent-orgs:${userID}`, JSON.stringify([...new Set(ids)].slice(0, 3)))
  } catch {
    // Storage can be unavailable.
  }
}

export function recentOrganizations(organizations: Organization[], recentIDs: string[]): Organization[] {
  const byID = new Map(organizations.map((organization) => [organization.id, organization]))
  const ordered = [...new Set(recentIDs)].flatMap((id) => {
    const organization = byID.get(id)
    return organization ? [organization] : []
  })
  const included = new Set(ordered.map((organization) => organization.id))
  return [...ordered, ...organizations.filter((organization) => !included.has(organization.id)).sort((a, b) => a.name.localeCompare(b.name))].slice(0, 3)
}
