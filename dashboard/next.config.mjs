export default function nextConfig(phase) {
  return {
    async rewrites() {
      return phase === 'phase-development-server'
        ? [{ source: '/v0/auth/:path*', destination: 'http://localhost:8080/v0/auth/:path*' }]
        : []
    },
  }
}
