import type { RefObject } from 'react'
import { closeDialog } from '../lib/dialog-controls'
import Button from './button'
import Dialog from './dialog'

export default function ResendFailedDialog({ dialogRef, message, requestId, onRetry }: {
  dialogRef: RefObject<HTMLDialogElement | null>
  message: string
  requestId: string | null
  onRetry: () => void
}) {
  async function retry() {
    if (!dialogRef.current || dialogRef.current.hasAttribute('data-closing')) return
    await closeDialog(dialogRef.current)
    onRetry()
  }

  return (
    <Dialog
      ref={dialogRef}
      title="Couldn't resend invitation"
      alert
      cancelLabel="Close"
      action={<Button variant="primary" onClick={() => void retry()}>Retry</Button>}
    >
      <div className="save-failed-body">
        <p>{message}</p>
        {requestId && (
          <div className="save-failed-request-id">
            <span>Request ID</span>
            <code>{requestId}</code>
          </div>
        )}
      </div>
    </Dialog>
  )
}
