'use client'

import { Check, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useCurrentUser } from '../../components/current-user'
import { exitAnimationFinished } from '../../lib/exit-animation'
import { apiFetch } from '../../lib/api-client'
import { parseSessionUser } from '../../lib/session-user'
import { SettingsRow, SettingsSection } from '../../components/settings-section'
import ThemeSwitch from '../../components/theme-switch'

export default function GeneralPage() {
  const { user, organizations, onUserChange, onSignedOut, onSignOutRequest } = useCurrentUser()
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
      const response = await apiFetch('/v0/me', {
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
      const response = await apiFetch('/v0/me', {
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
      <SettingsSection title="Profile">
        <SettingsRow label={<label htmlFor="account-name">Name</label>}>
          <input id="account-name" className="account-name" autoComplete="off" value={draft} disabled={saving} onInput={(event) => { setDraft(event.currentTarget.value); setError(false); if (saved) setSaveState('idle') }} />
        </SettingsRow>
        <SettingsRow label="Email">{user.email}</SettingsRow>
        <SettingsRow label="Sign-in method">Google</SettingsRow>
      </SettingsSection>
      {organizations.length > 0 && (
        <SettingsSection title="Agent">
          <SettingsRow label="Apply changes automatically" control>
            <button className="account-switch" type="button" role="switch" aria-checked={pendingAutoApply ?? user.agentAutoApply} aria-label="Apply changes automatically" disabled={settingSaving || saving} onClick={toggleAutoApply} />
            {settingError && <span role="alert">Could not save. Try again.</span>}
          </SettingsRow>
        </SettingsSection>
      )}
      <SettingsSection title="Appearance">
        <SettingsRow label="Theme" control>
          <ThemeSwitch />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="Session">
        <SettingsRow label="Sign out of this device" control>
          <button className="button button-danger" type="button" onClick={onSignOutRequest}>Sign out</button>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="Danger zone" danger>
        <SettingsRow label="Delete account" control>
          <button className="button button-danger" type="button" disabled title="Coming soon">Delete</button>
        </SettingsRow>
      </SettingsSection>
      {saveBarMounted && (
        <div ref={saveBar} data-saved={saved || undefined} className={`account-save-bar${changed || saving || saveState === 'saved' ? '' : ' account-save-bar-leaving'}`}>
          <span role="status">
            <span className="account-save-count" aria-hidden={saved}>1 unsaved change</span>
            {saved && <span className="account-save-success">Saved</span>}
          </span>
          {error && <span role="alert">Could not save. Try again.</span>}
          <button className="button" type="button" disabled={saving || saved} onClick={() => { setDraft(user.displayName); setError(false) }}>Discard</button>
          <button className="button button-primary" type="submit" data-feedback={saving || saved || undefined} data-save-state={saved ? 'saved' : saving ? 'saving' : 'idle'} aria-busy={saving} aria-label={saving ? 'Saving' : saved ? 'Saved' : undefined} disabled={saving || saved || settingSaving || !valid}>
            <span className="account-save-label">Save</span>
            <LoaderCircle className="account-save-icon account-save-spinner" size={14} strokeWidth={2} aria-hidden />
            <Check className="account-save-icon account-save-check" size={14} strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}
    </form>
  )
}
