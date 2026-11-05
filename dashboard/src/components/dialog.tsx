'use client'

import { CircleAlert } from 'lucide-react'
import { useId, type ReactNode, type Ref } from 'react'
import { closeDialog } from '../lib/dialog-controls'

type DialogProps = {
  ref: Ref<HTMLDialogElement>
  title: string
  alert?: boolean
  closable?: boolean
  actions: ReactNode
  children: ReactNode
}

export default function Dialog({ ref, title, alert = false, closable = true, actions, children }: DialogProps) {
  const titleId = useId()
  return (
    <dialog className="dialog" ref={ref} aria-labelledby={titleId} onCancel={(event) => {
      event.preventDefault()
      if (closable) void closeDialog(event.currentTarget)
    }}>
      <h2 id={titleId}>{alert && <CircleAlert size={16} aria-hidden className="dialog-alert" />}{title}</h2>
      {children}
      <div className="dialog-actions">{actions}</div>
    </dialog>
  )
}
