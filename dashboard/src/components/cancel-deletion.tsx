'use client'

import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { apiFetch } from '../lib/api-client'
import AuthFooter from './auth-footer'
import Button from './button'

type CancelDeletionProps = {
  purgeAt: string
  signOutStatus: 'idle' | 'pending' | 'error'
  onSignOut: () => void
  onCancelled: () => void
  onSignedOut: () => void
}

// Signed-in users with a scheduled deletion see only this page until they cancel or sign out.
export default function CancelDeletion({ purgeAt, signOutStatus, onSignOut, onCancelled, onSignedOut }: CancelDeletionProps) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle')
  const purgeDate = new Date(purgeAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const pending = status === 'pending' || signOutStatus === 'pending'

  async function cancelDeletion() {
    if (pending) return
    setStatus('pending')
    const response = await apiFetch('/v0/me/cancel-deletion', { method: 'POST' }).catch(() => null)
    if (response?.status === 401) return onSignedOut()
    if (response?.status === 204) return onCancelled()
    setStatus('error')
  }

  const error = status === 'error' ? 'Could not cancel the deletion. Try again.' : signOutStatus === 'error' ? 'Could not sign out. Try again.' : ''
  return (
    <main className="auth-page" aria-labelledby="cancel-deletion-title">
      <section className="sign-in-card account-deleted-card">
        <span className="account-deleted-badge"><CircleAlert size={20} strokeWidth={2} aria-hidden /></span>
        <div className="sign-in-copy">
          <h1 id="cancel-deletion-title">Account scheduled for deletion</h1>
          <p>Keysy will permanently delete your account on {purgeDate}.<br />Cancel the deletion to keep your account.</p>
        </div>
        {error && <p className="cancel-deletion-error" role="alert">{error}</p>}
        <div className="cancel-deletion-actions">
          <Button disabled={pending} onClick={onSignOut}>Sign out</Button>
          <Button variant="primary" disabled={pending} onClick={() => void cancelDeletion()}>Cancel deletion</Button>
        </div>
      </section>
      <AuthFooter />
    </main>
  )
}
