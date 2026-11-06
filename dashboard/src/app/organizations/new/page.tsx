import type { Metadata } from 'next'
import CreateOrganizationForm from '../../../components/create-organization-form'
import AuthFooter from '../../../components/auth-footer'

export const metadata: Metadata = { title: 'New organization' }

export default function NewOrganizationPage() {
  return <main className="auth-page" aria-labelledby="create-organization-title"><CreateOrganizationForm /><AuthFooter /></main>
}
