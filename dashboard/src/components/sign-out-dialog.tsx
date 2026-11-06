'use client'

import type { Ref } from 'react'
import { closeDialog } from '../lib/dialog-controls'
import Dialog from './dialog'

type SignOutDialogProps = {
  ref: Ref<HTMLDialogElement>
  status: 'idle' | 'pending' | 'error'
  onConfirm: () => void
}

export default function SignOutDialog({ ref, status, onConfirm }: SignOutDialogProps) {
  const pending = status === 'pending'
  return (
    <Dialog ref={ref} title="Sign out?" closable={!pending} actions={
      <>
        <button className="dialog-cancel" type="button" disabled={pending} onClick={(event) => void closeDialog(event.currentTarget.closest('dialog')!)}>
          Cancel
        </button>
        <button className="dialog-danger" type="button" disabled={pending} onClick={onConfirm}>
          {pending ? 'Signing out...' : 'Sign out'}
        </button>
      </>
    }>
      <p>You'll need to sign in again on this device.</p>
      {status === 'error' && <p className="dialog-error" role="alert">Could not sign out. Try again.</p>}
    </Dialog>
  )
}
