import { createFileRoute } from '@tanstack/react-router'
import AuditLogPage from '../pages/audit-log'

export const Route = createFileRoute('/audit-log')({ component: AuditLogPage, head: () => ({ meta: [{ title: 'Audit log | Keysy' }] }) })
