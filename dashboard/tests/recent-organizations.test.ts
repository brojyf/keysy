import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readRecentOrganizationIDs, rememberOrganization, recentOrganizations } from '../src/lib/recent-organizations.ts'

const organizations = ['Delta', 'Alpha', 'Charlie', 'Bravo'].map((name) => ({ id: name, name, role: 'owner' as const, memberCount: 1 }))

test('recent organizations use valid unique history then alphabetical names', () => {
  assert.deepEqual(recentOrganizations(organizations, ['missing', 'Bravo', 'Bravo', 'Delta']).map((org) => org.id), ['Bravo', 'Delta', 'Alpha'])
  assert.deepEqual(recentOrganizations(organizations.slice(0, 2), []).map((org) => org.id), ['Alpha', 'Delta'])
})

test('storage is per user, deduplicated, capped and resilient', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>()
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } })
    for (const id of ['a', 'b', 'c', 'd', 'b']) rememberOrganization('one', id)
    assert.deepEqual(readRecentOrganizationIDs('one'), ['b', 'd', 'c'])
    assert.deepEqual(readRecentOrganizationIDs('two'), [])
    values.set('keysy-recent-orgs:two', '["x", 4, null, "y"]')
    assert.deepEqual(readRecentOrganizationIDs('two'), ['x', 'y'])
    values.set('keysy-recent-orgs:two', '{')
    assert.deepEqual(readRecentOrganizationIDs('two'), [])
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '[]', setItem: () => { throw new Error('unavailable') } } })
    assert.doesNotThrow(() => rememberOrganization('one', 'a'))
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('unavailable') } })
    assert.deepEqual(readRecentOrganizationIDs('one'), [])
    assert.doesNotThrow(() => rememberOrganization('one', 'a'))
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
