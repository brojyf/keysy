import { createFileRoute } from '@tanstack/react-router'
import Page from './orgs/$orgId/audit-log'

export const Route = createFileRoute('/audit-log')({ component: Page, head: () => ({ meta: [{ title: 'Audit log | Keysy' }] }) })
