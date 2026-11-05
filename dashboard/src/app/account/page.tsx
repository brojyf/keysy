'use client'

import { Check, LoaderCircle, Monitor, Moon, Sun } from 'lucide-react'
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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'leaving'>('idle')
  const saving = saveState === 'saving'
  const saved = saveState === 'saved' || saveState === 'leaving'
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
    if (saveState !== 'saved') return
    const timer = setTimeout(() => setSaveState('leaving'), 800)
    return () => clearTimeout(timer)
  }, [saveState])

  useEffect(() => {
    if (changed || saving || saveState === 'saved' || !saveBar.current) return
    let interrupted = false
    void exitAnimationFinished(saveBar.current).then(() => {
      if (!interrupted) {
        setSaveBarMounted(false)
        setSaveState('idle')
      }
    })
    return () => { interrupted = true }
  }, [changed, saving, saveState])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!changed || !valid || saving || saved || settingSaving) return
    setSaveState('saving')
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
      setSaveState('saved')
      onUserChange(updated)
    } catch {
      setError(true)
    } finally {
      setSaveState((state) => state === 'saving' ? 'idle' : state)
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
          <div><dt><label htmlFor="account-name">Name</label></dt><dd><input id="account-name" className="account-name" autoComplete="off" value={draft} disabled={saving} onInput={(event) => { setDraft(event.currentTarget.value); setError(false); if (saved) setSaveState('idle') }} /></dd></div>
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
              <span className="account-theme" role="group" aria-label="Theme" data-theme={theme}>
                <span className="theme-thumb" aria-hidden="true" />
                {themes.map(({ label, Icon }) => (
                  <button key={label} type="button" aria-label={label} aria-pressed={theme === label.toLowerCase()} onClick={() => setTheme(label.toLowerCase() as Theme)}>
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
        <div ref={saveBar} data-saved={saved || undefined} className={`account-save-bar${changed || saving || saveState === 'saved' ? '' : ' account-save-bar-leaving'}`}>
          <span role="status">
            <span className="account-save-count" aria-hidden={saved}>1 unsaved change</span>
            {saved && <span className="account-save-success">Saved</span>}
          </span>
          {error && <span role="alert">Could not save. Try again.</span>}
          <button type="button" disabled={saving || saved} onClick={() => { setDraft(user.displayName); setError(false) }}>Discard</button>
          <button type="submit" data-feedback={saving || saved || undefined} aria-busy={saving} aria-label={saving ? 'Saving' : saved ? 'Saved' : undefined} disabled={saving || saved || settingSaving || !valid}>
            <span className="account-save-label">Save</span>
            {saving && <LoaderCircle className="account-save-icon account-save-spinner" size={14} strokeWidth={2} aria-hidden />}
            {saved && <Check className="account-save-icon account-save-check" size={14} strokeWidth={2} aria-hidden />}
          </button>
        </div>
      )}
    </form>
  )
}
