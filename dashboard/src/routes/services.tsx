import { createFileRoute } from '@tanstack/react-router'
import Page from './orgs/$orgId/services'

export const Route = createFileRoute('/services')({ component: Page, head: () => ({ meta: [{ title: 'Services | Keysy' }] }) })
