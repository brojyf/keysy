'use client'

import type { Ref } from 'react'
import Button from './button'
import Dialog from './dialog'

type SignOutDialogProps = {
  ref: Ref<HTMLDialogElement>
  status: 'idle' | 'pending' | 'error'
  onConfirm: () => void
}

export default function SignOutDialog({ ref, status, onConfirm }: SignOutDialogProps) {
  const pending = status === 'pending'
  return (
    <Dialog ref={ref} title="Sign out of Keysy?" closable={!pending} action={
      <Button variant="danger" disabled={pending} onClick={onConfirm}>
        {pending ? 'Signing out...' : 'Sign out'}
      </Button>
    }>
      <p>This only signs you out on this device.</p>
      {status === 'error' && <p className="dialog-error" role="alert">Could not sign out. Try again.</p>}
    </Dialog>
  )
}
