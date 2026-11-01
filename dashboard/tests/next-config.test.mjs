import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import nextConfig from '../next.config.mjs'

const originalAuthURL = process.env.NEXT_PUBLIC_AUTH_URL

afterEach(() => {
  if (originalAuthURL === undefined) delete process.env.NEXT_PUBLIC_AUTH_URL
  else process.env.NEXT_PUBLIC_AUTH_URL = originalAuthURL
})

for (const phase of ['phase-development-server', 'phase-production-build', 'phase-production-server']) {
  test(`${phase} does not proxy auth requests through the dashboard`, () => {
    process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.keysy.net'
    assert.equal(nextConfig(phase).rewrites, undefined)
  })
}

test('production builds require an explicit public auth URL', () => {
  delete process.env.NEXT_PUBLIC_AUTH_URL
  assert.throws(() => nextConfig('phase-production-build'), /NEXT_PUBLIC_AUTH_URL/)
})

test('development can use the separate localhost auth port without configuration', () => {
  delete process.env.NEXT_PUBLIC_AUTH_URL
  assert.doesNotThrow(() => nextConfig('phase-development-server'))
})

test('production startup does not require the build-time public auth URL', () => {
  delete process.env.NEXT_PUBLIC_AUTH_URL
  assert.doesNotThrow(() => nextConfig('phase-production-server'))
})

test('auth URLs allow HTTPS origins and local HTTP only', () => {
  for (const authURL of ['https://auth.keysy.net', 'https://auth.keysy.net/', 'http://localhost:8080']) {
    process.env.NEXT_PUBLIC_AUTH_URL = authURL
    assert.doesNotThrow(() => nextConfig('phase-production-build'))
  }
  for (const authURL of ['http://auth.keysy.net', '//auth.keysy.net', 'https://user:secret@auth.keysy.net', 'https://auth.keysy.net/path', 'https://auth.keysy.net/?query=value', 'https://auth.keysy.net/#fragment', 'not-a-url']) {
    process.env.NEXT_PUBLIC_AUTH_URL = authURL
    assert.throws(() => nextConfig('phase-production-build'), /NEXT_PUBLIC_AUTH_URL/)
  }
})
