'use client'

import { useState, type FormEvent } from 'react'
import Button from '../../components/button'
import { useCurrentUser } from '../../components/current-user'
import { apiFetch } from '../../lib/api-client'
import { parseSessionUser } from '../../lib/session-user'
import { SettingsRow, SettingsSection } from '../../components/settings-section'
import SaveBar from '../../components/save-bar'
import { useSaveBar } from '../../lib/use-save-bar'
import ThemeSwitch from '../../components/theme-switch'

export default function GeneralPage() {
  const { user, organizations, onUserChange, onSignedOut, onSignOutRequest } = useCurrentUser()
  const [draft, setDraft] = useState(user.displayName)
  const [error, setError] = useState(false)
  const [pendingAutoApply, setPendingAutoApply] = useState<boolean | null>(null)
  const settingSaving = pendingAutoApply !== null
  const [settingError, setSettingError] = useState(false)
  const trimmed = draft.trim()
  const changed = trimmed !== user.displayName
  const valid = trimmed.length > 0 && [...trimmed].length <= 32
  const saveBar = useSaveBar(changed)
  const { saving, saved, setSaveState } = saveBar

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
    <form className={`account-sections${saveBar.mounted ? ' account-sections-editing' : ''}`} onSubmit={save}>
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
          <Button variant="danger" onClick={onSignOutRequest}>Sign out</Button>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="Danger zone" danger>
        <SettingsRow label="Delete account" control>
          <Button variant="danger" disabled title="Coming soon">Delete</Button>
        </SettingsRow>
      </SettingsSection>
      {saveBar.mounted && <SaveBar saveBar={saveBar} error={error} saveDisabled={settingSaving || !valid} onDiscard={() => { setDraft(user.displayName); setError(false) }} />}
    </form>
  )
}
