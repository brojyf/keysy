import { createFileRoute } from '@tanstack/react-router'
import SecretsPage from '../../../pages/secrets'


export const Route = createFileRoute('/orgs/$orgId/secrets')({ component: SecretsPage, head: () => ({ meta: [{ title: 'Secrets | Keysy' }] }) })
