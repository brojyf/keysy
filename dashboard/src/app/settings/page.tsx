import type { Metadata } from 'next'
import OrganizationSettings from '../../components/organization-settings'

export const metadata: Metadata = { title: 'Settings' }

export default function SettingsPage() {
  return <OrganizationSettings />
}
