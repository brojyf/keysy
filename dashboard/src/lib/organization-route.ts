export function organizationRoute(count: number, path: string): 'account' | 'full' | '/account/organizations' {
  if (count > 0) return 'full'
  if (path === '/account' || path.startsWith('/account/')) return 'account'
  return '/account/organizations'
}
