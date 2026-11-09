import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'

export default function nextConfig(phase: string): NextConfig {
  for (const name of ['NEXT_PUBLIC_AUTH_URL', 'NEXT_PUBLIC_API_URL']) {
    const value = process.env[name]
    if (!value && phase === 'phase-production-build') {
      throw new Error(`${name} is required at build time`)
    }
    if (value) {
      let url
      try {
        url = new URL(value)
      } catch {
        throw new Error(`${name} must be a valid origin`)
      }
      const localHTTP = url.protocol === 'http:' && url.hostname === 'localhost'
      if ((url.protocol !== 'https:' && !localHTTP) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        throw new Error(`${name} requires an HTTPS origin, except HTTP localhost; credentials, paths, query, and fragment are forbidden`)
      }
    }
  }
  return {
    turbopack: { root: fileURLToPath(new URL('..', import.meta.url)) },
    devIndicators: {
      position: 'bottom-right',
    },
    async redirects() {
      return [{ source: '/', destination: '/secrets', permanent: false }]
    },
  }
}
