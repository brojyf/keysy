import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import nextConfig from '../next.config.mjs'

const names = ['NEXT_PUBLIC_AUTH_URL', 'NEXT_PUBLIC_API_URL']
const originals = Object.fromEntries(names.map(name => [name, process.env[name]]))

afterEach(() => {
  for (const name of names) {
    if (originals[name] === undefined) delete process.env[name]
    else process.env[name] = originals[name]
  }
})

for (const phase of ['phase-development-server', 'phase-production-build', 'phase-production-server']) {
  test(`${phase} does not proxy auth requests through the dashboard`, () => {
    process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.keysy.net'
    process.env.NEXT_PUBLIC_API_URL = 'https://api.keysy.net'
    assert.equal(nextConfig(phase).rewrites, undefined)
  })
}

test('development indicator defaults to the bottom-right corner', () => {
  delete process.env.NEXT_PUBLIC_AUTH_URL
  assert.equal(nextConfig('phase-development-server').devIndicators?.position, 'bottom-right')
})

for (const name of names) {
  test(`production builds require ${name}`, () => {
    for (const other of names) process.env[other] = 'https://keysy.net'
    delete process.env[name]
    assert.throws(() => nextConfig('phase-production-build'), new RegExp(name))
  })

  test(`${name} is optional outside production builds`, () => {
    for (const other of names) delete process.env[other]
    assert.doesNotThrow(() => nextConfig('phase-development-server'))
    assert.doesNotThrow(() => nextConfig('phase-production-server'))
  })

  test(`${name} allows HTTPS origins and local HTTP only`, () => {
    for (const other of names) process.env[other] = 'https://keysy.net'
    for (const value of ['https://keysy.net', 'https://keysy.net/', 'http://localhost:8080']) {
      process.env[name] = value
      assert.doesNotThrow(() => nextConfig('phase-production-build'))
    }
    for (const value of ['http://keysy.net', 'http://localhost.attacker.test', '//keysy.net', 'https://user:secret@keysy.net', 'https://keysy.net/path', 'https://keysy.net/?query=value', 'https://keysy.net/#fragment', 'not-a-url']) {
      process.env[name] = value
      assert.throws(() => nextConfig('phase-production-build'), new RegExp(name))
    }
  })
}
