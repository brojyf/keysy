import { createFileRoute } from '@tanstack/react-router'
import OrganizationSettings from '../../../components/organization-settings'

export const Route = createFileRoute('/orgs/$orgId/settings')({ component: OrganizationSettings, head: () => ({ meta: [{ title: 'Settings | Keysy' }] }) })
