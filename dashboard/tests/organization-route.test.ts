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

test('switch organization keeps only the first section and encodes the ID', async () => {
  const { switchOrganizationPath } = await import('../src/lib/organization-route.ts')
  assert.equal(switchOrganizationPath('B', '/orgs/A/people/invitations'), '/orgs/B/people')
  assert.equal(switchOrganizationPath('B', '/orgs/A/settings'), '/orgs/B/settings')
  assert.equal(switchOrganizationPath('B', '/orgs/A'), '/orgs/B/secrets')
  assert.equal(switchOrganizationPath('B', '/account/sessions'), '/orgs/B/secrets')
  assert.equal(switchOrganizationPath('B/C', '/orgs/A/people'), '/orgs/B%2FC/people')
})

test('preferred organization applies only to non-organization paths', () => {
  const organizations = [{ id: 'a', name: 'A', role: 'owner' as const, memberCount: 1 }, { id: 'b', name: 'B', role: 'owner' as const, memberCount: 1 }]
  assert.equal(organizationForPath(organizations, '/account', organizations[1]), organizations[1])
  assert.equal(organizationForPath(organizations, '/orgs/missing', organizations[1]), undefined)
})
