import { createFileRoute } from '@tanstack/react-router'
import MemberList from '../../../../components/member-list'


export default function MembersPage() {
  return <MemberList />
}

export const Route = createFileRoute('/orgs/$orgId/people/')({ component: MembersPage, head: () => ({ meta: [{ title: 'Members | Keysy' }] }) })
