export default function nextConfig(phase) {
  const authURL = process.env.NEXT_PUBLIC_AUTH_URL
  if (!authURL && phase === 'phase-production-build') {
    throw new Error('NEXT_PUBLIC_AUTH_URL is required at build time')
  }
  if (authURL) {
    let url
    try {
      url = new URL(authURL)
    } catch {
      throw new Error('NEXT_PUBLIC_AUTH_URL must be a valid origin')
    }
    const localHTTP = url.protocol === 'http:' && url.hostname === 'localhost'
    if ((url.protocol !== 'https:' && !localHTTP) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('NEXT_PUBLIC_AUTH_URL requires an HTTPS origin, except HTTP localhost; credentials, paths, query, and fragment are forbidden')
    }
  }
  return {}
}
