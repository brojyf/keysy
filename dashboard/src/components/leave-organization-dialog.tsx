'use client'

import { useEffect, useRef, useState, type MouseEvent, type Ref } from 'react'
import type { Organization } from '../lib/organization'
import { useCurrentUser } from './current-user'
import Button from './button'
import Dialog from './dialog'

// Figma 9 · Settings · General › Leave organization.
export default function LeaveOrganizationDialog({ ref, organization }: { ref: Ref<HTMLDialogElement>; organization: Organization }) {
  const { leaveOrganization } = useCurrentUser()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function leave(event: MouseEvent<HTMLButtonElement>) {
    if (submitting.current || event.currentTarget.closest('dialog')?.hasAttribute('data-closing')) return
    submitting.current = true
    setPending(true)
    setError('')
    try {
      await leaveOrganization(organization.id)
    } catch {
      if (mounted.current) setError('Could not leave the organization. Try again.')
    } finally {
      submitting.current = false
      if (mounted.current) setPending(false)
    }
  }

  return (
    <Dialog ref={ref} title={`Leave ${organization.name}?`} closable={!pending} onClose={() => setError('')} action={
      <Button variant="danger" disabled={pending} onClick={leave}>{pending ? 'Leaving...' : 'Leave'}</Button>
    }>
      <p>You will lose access to {organization.name} and its secrets.</p>
      {error && <p className="dialog-error" role="alert">{error}</p>}
    </Dialog>
  )
}
