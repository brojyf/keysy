import { mockOrganizations } from '../mock-account'

export default function OrganizationsPage() {
  return (
    <div className="account-table">
      <table>
        <thead>
          <tr><th>Organization</th></tr>
        </thead>
        <tbody>
          {mockOrganizations.map((name) => <tr key={name}><td>{name}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}
