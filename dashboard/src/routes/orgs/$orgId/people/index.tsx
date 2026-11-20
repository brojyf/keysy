import { createFileRoute } from '@tanstack/react-router'
import MemberList from '../../../../components/member-list'

export const Route = createFileRoute('/orgs/$orgId/people/')({ component: MemberList, head: () => ({ meta: [{ title: 'Members | Keysy' }] }) })
