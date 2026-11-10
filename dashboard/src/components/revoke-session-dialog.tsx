'use client'

import { useEffect, useRef, useState, type MouseEvent, type Ref } from 'react'
import { closeDialog } from '../lib/dialog-controls'
import { useRevokeSession, type AccountSession } from '../lib/session-queries'
import { useCurrentUser } from './current-user'
import Button from './button'
import Dialog from './dialog'

export default function RevokeSessionDialog({ ref, session }: { ref: Ref<HTMLDialogElement>; session: AccountSession | undefined }) {
  const { user, onSignedOut } = useCurrentUser()
  const revokeSession = useRevokeSession(user.id, onSignedOut)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function revoke(event: MouseEvent<HTMLButtonElement>) {
    const dialog = event.currentTarget.closest('dialog')!
    if (!session || pending || dialog.hasAttribute('data-closing')) return
    setPending(true)
    setError('')
    try {
      await revokeSession(session.id)
      if (mounted.current) void closeDialog(dialog)
    } catch (failure) {
      if (mounted.current) setError((failure as Error).message)
    } finally {
      if (mounted.current) setPending(false)
    }
  }

  return (
    <Dialog ref={ref} title="Revoke session?" closable={!pending} onClose={() => setError('')} action={
      <Button variant="danger" disabled={pending} onClick={revoke}>{pending ? 'Revoking...' : 'Revoke'}</Button>
    }>
      <p>{session?.device} will be signed out.</p>
      {error && <p className="dialog-error" role="alert">{error}</p>}
    </Dialog>
  )
}
