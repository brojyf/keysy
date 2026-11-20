import { createFileRoute } from '@tanstack/react-router'


export default function SecretsPage() {
  return <p>This is the Secrets page.</p>
}

export const Route = createFileRoute('/orgs/$orgId/secrets')({ component: SecretsPage, head: () => ({ meta: [{ title: 'Secrets | Keysy' }] }) })
