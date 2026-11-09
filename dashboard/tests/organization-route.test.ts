import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { organizationForPath, organizationPath, organizationRoute } from '../src/lib/organization-route.ts'

test('organization route rules', () => {
  assert.equal(organizationRoute(0, '/organizations/new'), '/account/organizations')
  assert.equal(organizationRoute(0, '/account'), 'account')
  assert.equal(organizationRoute(0, '/account/organizations'), 'account')
  assert.equal(organizationRoute(0, '/accounting'), '/account/organizations')
  assert.equal(organizationRoute(0, '/secrets'), '/account/organizations')
  assert.equal(organizationRoute(1, '/organizations/new'), 'full')
  assert.equal(organizationRoute(1, '/account'), 'full')
  assert.equal(organizationRoute(1, '/secrets'), 'full')
})


test('organization links encode the organization ID as a single path segment', () => {
  assert.equal(organizationPath('org-123', '/settings'), '/orgs/org-123/settings')
  assert.equal(organizationPath('org/123', '/secrets'), '/orgs/org%2F123/secrets')
})

test('explicit organization paths never fall back to the first membership', () => {
  const organizations = [
    { id: 'first', name: 'First', role: 'owner' as const, memberCount: 1 },
    { id: 'second', name: 'Second', role: 'developer' as const, memberCount: 1 },
  ]
  assert.equal(organizationForPath(organizations, '/orgs/second/settings'), organizations[1])
  assert.equal(organizationForPath(organizations, '/orgs/%73econd/secrets'), organizations[1])
  for (const path of ['/orgs', '/orgs/', '/orgs/missing/settings', '/orgs/%zz/settings']) {
    assert.equal(organizationForPath(organizations, path), undefined)
  }
  assert.equal(organizationForPath([], '/orgs/second/settings'), undefined)
  assert.equal(organizationForPath(organizations, '/account'), organizations[0])
  assert.equal(organizationForPath(organizations, '/settings'), organizations[0])
})
