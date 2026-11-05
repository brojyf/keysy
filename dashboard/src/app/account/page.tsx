'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useCurrentUser } from '../../components/current-user'
import { exitAnimationFinished } from '../../lib/exit-animation'
import { fetchWithSessionRefresh } from '../../lib/session-refresh'
import { parseSessionUser } from '../../lib/session-user'
import { serviceURLs } from '../../lib/service-urls'
import { setTheme, useTheme, type Theme } from '../../lib/theme'

const themes = [
  { label: 'System', Icon: Monitor },
  { label: 'Light', Icon: Sun },
  { label: 'Dark', Icon: Moon },
]

export default function GeneralPage() {
  const { user, onUserChange, onSignedOut, onSignOutRequest } = useCurrentUser()
  const theme = useTheme()
  const [draft, setDraft] = useState(user.displayName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [pendingAutoApply, setPendingAutoApply] = useState<boolean | null>(null)
  const settingSaving = pendingAutoApply !== null
  const [settingError, setSettingError] = useState(false)
  const trimmed = draft.trim()
  const changed = trimmed !== user.displayName
  const valid = trimmed.length > 0 && [...trimmed].length <= 32
  const saveBar = useRef<HTMLDivElement>(null)
  const [saveBarMounted, setSaveBarMounted] = useState(false)
  if (changed && !saveBarMounted) setSaveBarMounted(true)

  useEffect(() => {
    if (changed || !saveBar.current) return
    let interrupted = false
    void exitAnimationFinished(saveBar.current).then(() => { if (!interrupted) setSaveBarMounted(false) })
    return () => { interrupted = true }
  }, [changed])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!changed || !valid || saving || settingSaving) return
    setSaving(true)
    setError(false)
    try {
      const { apiURL, authURL } = serviceURLs()
      const response = await fetchWithSessionRefresh(new URL('/v0/me', apiURL).href, authURL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      })
      if (response.status === 401) {
        onSignedOut()
        return
      }
      if (!response.ok) throw new Error('Save failed')
      const updated = parseSessionUser(await response.json())
      setDraft(updated.displayName)
      onUserChange(updated)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  async function toggleAutoApply() {
    if (settingSaving || saving) return
    const agentAutoApply = !user.agentAutoApply
    setPendingAutoApply(agentAutoApply)
    setSettingError(false)
    try {
      const { apiURL, authURL } = serviceURLs()
      const response = await fetchWithSessionRefresh(new URL('/v0/me', apiURL).href, authURL, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentAutoApply }),
      })
      if (response.status === 401) { onSignedOut(); return }
      if (!response.ok) throw new Error('Save failed')
      onUserChange(parseSessionUser(await response.json()))
    } catch { setSettingError(true) } finally { setPendingAutoApply(null) }
  }

  return (
    <form className={`account-sections${saveBarMounted ? ' account-sections-editing' : ''}`} onSubmit={save}>
      <section>
        <h2>Profile</h2>
        <dl className="account-rows">
          <div><dt><label htmlFor="account-name">Name</label></dt><dd><input id="account-name" className="account-name" autoComplete="off" value={draft} disabled={saving} onInput={(event) => { setDraft(event.currentTarget.value); setError(false) }} /></dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Sign-in method</dt><dd>Google</dd></div>
        </dl>
      </section>
      <section>
        <h2>Agent</h2>
        <dl className="account-rows">
          <div>
            <dt>Apply changes automatically</dt>
            <dd className="account-control">
              <button className="account-switch" type="button" role="switch" aria-checked={pendingAutoApply ?? user.agentAutoApply} aria-label="Apply changes automatically" disabled={settingSaving || saving} onClick={toggleAutoApply} />
              {settingError && <span role="alert">Could not save. Try again.</span>}
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
                {themes.map(({ label, Icon }) => (
                  <button key={label} type="button" aria-label={label} aria-pressed={theme === label.toLowerCase()} onClick={() => setTheme(label.toLowerCase() as Theme)}>
                    {theme === label.toLowerCase() && <span className="theme-thumb" aria-hidden="true" />}
                    <Icon size={14} strokeWidth={2} aria-hidden />
                  </button>
                ))}
              </span>
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>Session</h2>
        <dl className="account-rows">
          <div>
            <dt>Sign out of this device</dt>
            <dd className="account-control">
              <button className="account-sign-out" type="button" onClick={onSignOutRequest}>Sign out</button>
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
      {saveBarMounted && (
        <div ref={saveBar} className={`account-save-bar${changed ? '' : ' account-save-bar-leaving'}`}>
          <span role="status">1 unsaved change</span>
          {error && <span role="alert">Could not save. Try again.</span>}
          <button type="button" disabled={saving} onClick={() => { setDraft(user.displayName); setError(false) }}>Discard</button>
          <button type="submit" disabled={saving || settingSaving || !valid}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      )}
    </form>
  )
}
