import { Monitor, Moon, Sun } from 'lucide-react'
import { mockProfile } from './mock-account'

const themes = [
  { label: 'System', Icon: Monitor },
  { label: 'Light', Icon: Sun },
  { label: 'Dark', Icon: Moon },
]

export default function GeneralPage() {
  return (
    <div className="account-sections">
      <section>
        <h2>Profile</h2>
        <dl className="account-rows">
          <div><dt>Name</dt><dd>{mockProfile.name}</dd></div>
          <div><dt>Email</dt><dd>{mockProfile.email}</dd></div>
          <div><dt>Sign-in method</dt><dd>{mockProfile.signInMethod}</dd></div>
        </dl>
      </section>
      <section>
        <h2>Agent</h2>
        <dl className="account-rows">
          <div>
            <dt>Apply changes automatically</dt>
            <dd className="account-control">
              <button className="account-switch" type="button" role="switch" aria-checked="false" aria-label="Apply changes automatically" disabled title="Coming soon" />
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>Appearance</h2>
        <dl className="account-rows">
          <div>
            <dt>Theme</dt>
            <dd className="account-control">
              <span className="account-theme" role="group" aria-label="Theme">
                {themes.map(({ label, Icon }, index) => (
                  <button key={label} type="button" aria-label={label} aria-pressed={index === 0} disabled title="Coming soon">
                    <Icon size={14} strokeWidth={2} aria-hidden />
                  </button>
                ))}
              </span>
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h2 className="account-danger">Danger zone</h2>
        <dl className="account-rows">
          <div>
            <dt>Delete account</dt>
            <dd className="account-control">
              <button className="account-delete" type="button" disabled title="Coming soon">Delete</button>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
