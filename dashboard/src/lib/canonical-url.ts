// TanStack Router treats /signin/ and /signin as one location, so navigating between them never changes the URL.
// Remove trailing slashes once at startup, like the default Next.js redirect.
// The result is absolute: a relative //signin would name another host.
export function canonicalURL({ origin, pathname, search, hash }: Pick<Location, 'origin' | 'pathname' | 'search' | 'hash'>) {
  const canonicalPath = pathname.replace(/\/+$/, '') || '/'
  return canonicalPath === pathname ? undefined : origin + canonicalPath + search + hash
}
