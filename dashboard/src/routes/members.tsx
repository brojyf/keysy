import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/members')({ beforeLoad: () => { throw redirect({ to: '/people', search: true, hash: true, replace: true }) } })
