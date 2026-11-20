import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/orgs/$orgId/members')({ beforeLoad: ({ params }) => { throw redirect({ to: '/orgs/$orgId/people', params, replace: true }) } })
