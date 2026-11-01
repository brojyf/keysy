import assert from 'node:assert/strict'
import { test } from 'node:test'
import nextConfig from '../next.config.mjs'

test('development proxies auth paths without changing their public URL', async () => {
  const config = nextConfig('phase-development-server')
  assert.deepEqual(await config.rewrites(), [
    { source: '/v0/auth/:path*', destination: 'http://localhost:8080/v0/auth/:path*' },
  ])
})

for (const phase of ['phase-production-build', 'phase-production-server']) {
  test(`${phase} leaves auth routing to the deployment proxy`, async () => {
    assert.deepEqual(await nextConfig(phase).rewrites(), [])
  })
}
