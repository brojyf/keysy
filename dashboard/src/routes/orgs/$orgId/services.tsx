import { createFileRoute } from '@tanstack/react-router'
import ServicesPage from '../../../pages/services'


export const Route = createFileRoute('/orgs/$orgId/services')({ component: ServicesPage, head: () => ({ meta: [{ title: 'Services | Keysy' }] }) })
