'use client'

import type { Ref } from 'react'

type SignOutDialogProps = {
  ref: Ref<HTMLDialogElement>
  status: 'idle' | 'pending' | 'error'
  onConfirm: () => void
}

export default function SignOutDialog({ ref, status, onConfirm }: SignOutDialogProps) {
  const pending = status === 'pending'
  return (
    <dialog
      className="sign-out-dialog"
      ref={ref}
      aria-labelledby="sign-out-dialog-title"
      onCancel={(event) => { if (pending) event.preventDefault() }}
    >
      <h2 id="sign-out-dialog-title">Sign out?</h2>
      <p>You'll need to sign in again on this device.</p>
      {status === 'error' && <p className="sign-out-dialog-error" role="alert">Could not sign out. Try again.</p>}
      <div className="sign-out-dialog-actions">
        <button className="sign-out-dialog-cancel" type="button" disabled={pending} onClick={(event) => event.currentTarget.closest('dialog')?.close()}>
          Cancel
        </button>
        <button className="sign-out-dialog-confirm" type="button" disabled={pending} onClick={onConfirm}>
          {pending ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </dialog>
  )
}
