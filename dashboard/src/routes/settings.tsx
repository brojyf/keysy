import { createFileRoute } from '@tanstack/react-router'
import Page from './orgs/$orgId/settings'

export const Route = createFileRoute('/settings')({ component: Page, head: () => ({ meta: [{ title: 'Settings | Keysy' }] }) })
