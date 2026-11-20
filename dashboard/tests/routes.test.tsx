import { expect, test } from 'bun:test'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '../src/routeTree.gen'
import { Route as root } from '../src/routes/index'
import { Route as members } from '../src/routes/members'
import { Route as orgMembers } from '../src/routes/orgs/$orgId/members'

for (const [route, to] of [[root, '/secrets'], [members, '/people'], [orgMembers, '/orgs/$orgId/people']] as const) {
  test(`redirects to ${to} with replacement`, () => {
    try {
      route.options.beforeLoad!({ params: { orgId: 'a/b' } } as never)
      throw new Error('Expected a redirect')
    } catch (error) {
      expect((error as { options: object }).options).toMatchObject({ to, replace: true, statusCode: 307 })
      if (route === orgMembers) expect((error as { options: { params: object } }).options.params).toEqual({ orgId: 'a/b' })
      if (route !== root) expect((error as { options: object }).options).toMatchObject({ search: true, hash: true })
    }
  })
}

test('string paths preserve encoded organization IDs', () => {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) })
  expect(router.buildLocation({ to: '/orgs/a%2Fb/secrets' }).href).toBe('/orgs/a%2Fb/secrets')
  expect(router.buildLocation({ to: '/orgs/$orgId/people', params: { orgId: 'a/b' } }).href).toBe('/orgs/a%2Fb/people')
})

test('people routes match members, invitations, and the members alias', () => {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) })
  expect(router.matchRoutes('/orgs/example/people').at(-1)?.routeId).toBe('/orgs/$orgId/people/')
  expect(router.matchRoutes('/orgs/example/people/invitations').at(-1)?.routeId).toBe('/orgs/$orgId/people/invitations')
  expect(router.routesById['/people'].options.component).toBe(router.routesById['/orgs/$orgId/people/'].options.component)
})
