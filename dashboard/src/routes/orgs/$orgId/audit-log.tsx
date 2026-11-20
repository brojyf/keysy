import { createFileRoute } from '@tanstack/react-router'


export default function AuditLogPage() {
  return <p>This is the Audit log page.</p>
}

export const Route = createFileRoute('/orgs/$orgId/audit-log')({ component: AuditLogPage, head: () => ({ meta: [{ title: 'Audit log | Keysy' }] }) })
