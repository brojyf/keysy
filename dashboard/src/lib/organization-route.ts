export function organizationRoute(count: number, path: string): 'create' | 'account' | 'full' | '/organizations/new' | '/secrets' {
  if (count > 0) return path === '/organizations/new' ? '/secrets' : 'full'
  if (path === '/organizations/new') return 'create'
  if (path === '/account' || path.startsWith('/account/')) return 'account'
  return '/organizations/new'
}
