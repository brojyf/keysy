import type { Metadata } from 'next'
import InvitationList from '../../../../../components/invitation-list'

export const metadata: Metadata = { title: 'Invitations' }

export default function InvitationsPage() {
  return <InvitationList />
}
