import { createFileRoute } from '@tanstack/react-router'


export default function ServicesPage() {
  return <p>This is the Services page.</p>
}

export const Route = createFileRoute('/orgs/$orgId/services')({ component: ServicesPage, head: () => ({ meta: [{ title: 'Services | Keysy' }] }) })
