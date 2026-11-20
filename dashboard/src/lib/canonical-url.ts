// TanStack Router treats /signin/ and /signin as one location, so navigating between them never changes the URL.
// Remove trailing slashes once at startup, like the default Next.js redirect.
export function canonicalURL({ pathname, search, hash }: Pick<Location, 'pathname' | 'search' | 'hash'>) {
  const canonicalPath = pathname.replace(/\/+$/, '') || '/'
  return canonicalPath === pathname ? undefined : canonicalPath + search + hash
}
