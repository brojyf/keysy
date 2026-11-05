import CreateOrganizationForm from '../../../components/create-organization-form'
import AuthFooter from '../../../components/auth-footer'

export default function NewOrganizationPage() {
  return <main className="auth-page" aria-labelledby="create-organization-title"><CreateOrganizationForm /><AuthFooter /></main>
}
