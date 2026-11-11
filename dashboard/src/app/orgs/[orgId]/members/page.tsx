import type { Metadata } from 'next'
import MemberList from '../../../../components/member-list'

export const metadata: Metadata = { title: 'Members' }

export default function MembersPage() {
  return <MemberList />
}
