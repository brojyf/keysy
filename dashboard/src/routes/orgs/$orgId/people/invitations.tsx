import { createFileRoute } from '@tanstack/react-router'
import InvitationList from '../../../../components/invitation-list'

function InvitationsPage() {
  return <InvitationList />
}

export const Route = createFileRoute('/orgs/$orgId/people/invitations')({ component: InvitationsPage, head: () => ({ meta: [{ title: 'Invitations | Keysy' }] }) })
