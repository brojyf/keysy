'use client'

import type { RefObject } from 'react'
import { closeDialog } from '../lib/dialog-controls'
import Button from './button'
import Dialog from './dialog'

export default function SaveFailedDialog({ dialogRef, formRef, nameInputRef, requestId }: { dialogRef: RefObject<HTMLDialogElement | null>; formRef: RefObject<HTMLFormElement | null>; nameInputRef: RefObject<HTMLInputElement | null>; requestId: string | null }) {
  async function retry() {
    if (!dialogRef.current || dialogRef.current.hasAttribute('data-closing')) return
    await closeDialog(dialogRef.current)
    formRef.current?.requestSubmit()
  }

  return (
    // Saving disables the submitter, so the dialog has no focus to restore; keep focus at the draft.
    <Dialog ref={dialogRef} title="Couldn't save changes" alert cancelLabel="Close" onClose={() => nameInputRef.current?.focus()} action={<Button variant="primary" onClick={() => void retry()}>Retry</Button>}>
      <div className="save-failed-body">
        <p>Your unsaved change is still here. Try again in a moment.</p>
        {requestId && <div className="save-failed-request-id"><span>Request ID</span><code>{requestId}</code></div>}
      </div>
    </Dialog>
  )
}
