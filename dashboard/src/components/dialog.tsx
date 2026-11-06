'use client'

import { CircleAlert } from 'lucide-react'
import { useId, type ReactNode, type Ref } from 'react'
import { closeDialog } from '../lib/dialog-controls'

type DialogProps = {
  ref: Ref<HTMLDialogElement>
  title: string
  alert?: boolean
  closable?: boolean
  onClose?: () => void
  actions: ReactNode
  children: ReactNode
}

export default function Dialog({ ref, title, alert = false, closable = true, onClose, actions, children }: DialogProps) {
  const titleId = useId()
  return (
    <dialog className="dialog" ref={ref} aria-labelledby={titleId} onClose={onClose} onCancel={(event) => {
      event.preventDefault()
      if (closable) void closeDialog(event.currentTarget)
    }}>
      <h2 id={titleId}>{alert && <CircleAlert size={16} aria-hidden className="dialog-alert" />}{title}</h2>
      {children}
      <div className="dialog-actions">{actions}</div>
    </dialog>
  )
}
