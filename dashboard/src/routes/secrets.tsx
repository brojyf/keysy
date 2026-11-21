import { createFileRoute } from '@tanstack/react-router'
import Page from './orgs/$orgId/secrets'

export const Route = createFileRoute('/secrets')({ component: Page, head: () => ({ meta: [{ title: 'Secrets | Keysy' }] }) })
