'use client'

import { useEffect, useRef, useState, type MouseEvent, type Ref } from 'react'
import { closeDialog } from '../lib/dialog-controls'
import { useRemoveMember, type Member } from '../lib/member-queries'
import { useCurrentUser } from './current-user'
import Button from './button'
import Dialog from './dialog'

// Figma People · Members › Remove member and Remove member · Deleting member.
export default function RemoveMemberDialog({ ref, member }: { ref: Ref<HTMLDialogElement>; member: Member | undefined }) {
  const { user, organization, onSignedOut } = useCurrentUser()
  const removeMember = useRemoveMember(user.id, organization?.id ?? '', onSignedOut)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function remove(event: MouseEvent<HTMLButtonElement>) {
    const dialog = event.currentTarget.closest('dialog')!
    if (!member || pending || dialog.hasAttribute('data-closing')) return
    setPending(true)
    setError('')
    try {
      await removeMember(member)
      if (mounted.current) void closeDialog(dialog)
    } catch (failure) {
      if (mounted.current) setError((failure as Error).message)
    } finally {
      if (mounted.current) setPending(false)
    }
  }

  return (
    <Dialog ref={ref} title={member ? `Remove ${member.name}?` : ''} closable={!pending} onClose={() => setError('')} action={
      <Button variant="danger" disabled={pending} onClick={remove}>{pending ? 'Removing...' : 'Remove'}</Button>
    }>
      <p>{member?.name} will lose access to {organization?.name} and its secrets. You can invite {member?.name} again.</p>
      {error && <p className="dialog-error" role="alert">{error}</p>}
    </Dialog>
  )
}
