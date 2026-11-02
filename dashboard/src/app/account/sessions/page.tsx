import { mockSessions } from '../mock-account'

export default function SessionsPage() {
  return (
    <div className="account-table account-sessions">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Device</th>
            <th>Last used</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {mockSessions.map((session) => (
            <tr key={session.id}>
              <td>{session.client}</td>
              <td>{session.device}</td>
              <td>{session.lastUsed}</td>
              <td className="account-session-status">{session.current ? 'This session' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
