import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateServiceURLs } from '../vite.config.ts'

const names = ['VITE_AUTH_URL', 'VITE_API_URL']

for (const name of names) {
  test(`production builds require ${name}`, () => {
    const env: Record<string, string> = Object.fromEntries(names.map(other => [other, 'https://keysy.net']))
    delete env[name]
    assert.throws(() => validateServiceURLs('build', env), new RegExp(name))
  })

  test(`${name} is optional outside production builds`, () => {
    assert.doesNotThrow(() => validateServiceURLs('serve', {}))
  })

  test(`${name} allows HTTPS origins and local HTTP only`, () => {
    const env: Record<string, string> = Object.fromEntries(names.map(other => [other, 'https://keysy.net']))
    for (const value of ['https://keysy.net', 'https://keysy.net/', 'http://localhost:8080']) {
      env[name] = value
      assert.doesNotThrow(() => validateServiceURLs('build', env))
    }
    for (const value of ['http://keysy.net', 'http://localhost.attacker.test', '//keysy.net', 'https://user:secret@keysy.net', 'https://keysy.net/path', 'https://keysy.net/?query=value', 'https://keysy.net/#fragment', 'not-a-url']) {
      env[name] = value
      assert.throws(() => validateServiceURLs('build', env), new RegExp(name))
    }
  })
}
