import { createFileRoute } from '@tanstack/react-router'
import Page from './orgs/$orgId/people/index'

export const Route = createFileRoute('/people')({ component: Page, head: () => ({ meta: [{ title: 'Members | Keysy' }] }) })
