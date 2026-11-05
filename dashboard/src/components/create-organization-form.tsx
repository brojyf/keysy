'use client'

import { useRef, useState, type FormEvent } from 'react'
import { parseCreatedOrganization } from '../lib/organization'
import { fetchWithSessionRefresh } from '../lib/session-refresh'
import { serviceURLs } from '../lib/service-urls'
import { useCurrentUser } from './current-user'

export default function CreateOrganizationForm() {
  const { onOrganizationCreated, onSignedOut } = useCurrentUser()
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const submitting = useRef(false)
  const trimmed = name.trim()
  const valid = [...trimmed].length > 0 && [...trimmed].length <= 32

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || submitting.current) return
    submitting.current = true
    setPending(true)
    setError(false)
    try {
      const { apiURL, authURL } = serviceURLs()
      const response = await fetchWithSessionRefresh(new URL('/v0/orgs', apiURL).href, authURL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }),
      })
      if (response.status === 401) { onSignedOut(); return }
      if (response.status !== 201) throw new Error('Create failed')
      const organization = parseCreatedOrganization(await response.json())
      onOrganizationCreated({ ...organization, role: 'owner', memberCount: 1 })
    } catch { setError(true) } finally { submitting.current = false; setPending(false) }
  }

  return (
    <form className="sign-in-card create-organization-card" onSubmit={create}>
      <img src="/keysy-symbol.svg" width="36" height="36" alt="Keysy" />
      <div className="sign-in-copy"><h1 id="create-organization-title">Create an organization</h1></div>
      <div className="create-organization-field">
        <label htmlFor="organization-name">Name</label>
        <input id="organization-name" className="account-name" autoComplete="off" value={name} disabled={pending} onInput={(event) => { setName(event.currentTarget.value); setError(false) }} />
      </div>
      {error && <p role="alert">Could not create the organization. Try again.</p>}
      <button className="create-organization-button" type="submit" disabled={!valid || pending}>{pending ? 'Creating...' : 'Create organization'}</button>
    </form>
  )
}
