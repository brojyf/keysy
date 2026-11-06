import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { organizationRoute } from '../src/lib/organization-route.ts'

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
