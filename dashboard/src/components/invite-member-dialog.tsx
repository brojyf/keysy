// Figma People · Invitations: 12.5 Owner, 12.8 Admin, errors 12.6 / 12.9–12.11.
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react'
import Button from './button'
import Dialog from './dialog'
import { useCurrentUser } from './current-user'
import { apiFetch } from '../lib/api-client'
import { closeDialog } from '../lib/dialog-controls'
import './invite-member-dialog.css'

export default function InviteMemberDialog({ ref, owner }: { ref: Ref<HTMLDialogElement>; owner: boolean }) {
  const { user, organization, onSignedOut } = useCurrentUser()
  const client = useQueryClient()
  const formId = useId()
  const emailId = useId()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'developer'>('developer')
  const [pending, setPending] = useState(false)
  const [inlineError, setInlineError] = useState('')
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const dialog = event.currentTarget.closest('dialog')
    const address = email.trim()
    if (!address || !organization || submitting.current || dialog?.hasAttribute('data-closing')) return
    submitting.current = true
    setPending(true)
    setInlineError('')
    setError('')
    try {
      const response = await apiFetch(`/v0/orgs/${encodeURIComponent(organization.id)}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address, role: owner ? role : 'developer' }),
      })
      if (response.status === 401) {
        onSignedOut()
        return
      }
      if (response.status === 404) void client.invalidateQueries({ queryKey: ['organizations', user.id], exact: true })
      if (response.status === 201) {
        void client.invalidateQueries({ queryKey: ['invitations', user.id, organization.id] })
        if (mounted.current && dialog) void closeDialog(dialog)
        return
      }
      const body = await response.json().catch(() => null)
      const code = body?.error?.code
      const message = body?.error?.message
      if (!mounted.current) return
      if (response.status === 409 && code === 'ALREADY_MEMBER') setInlineError(`${address} is already a member.`)
      else if (response.status === 409 && code === 'INVITATION_EXISTS')
        setInlineError(`${address} already has a pending invitation.`)
      else if (response.status === 400 && code === 'INVALID_EMAIL' && typeof message === 'string')
        setInlineError(message)
      else if (response.status === 429 && code === 'INVITATION_LIMIT_REACHED' && typeof message === 'string')
        setError(message)
      else setError('Could not send the invitation. Try again.')
    } catch {
      if (mounted.current) setError('Could not send the invitation. Try again.')
    } finally {
      submitting.current = false
      if (mounted.current) setPending(false)
    }
  }

  return (
    <Dialog
      ref={ref}
      title={owner ? 'Invite member' : 'Invite developer'}
      closable={!pending}
      onClose={() => {
        setEmail('')
        setRole('developer')
        setInlineError('')
        setError('')
      }}
      action={
        <Button variant="primary" type="submit" form={formId} disabled={!email.trim() || pending}>
          {pending ? 'Inviting...' : 'Invite'}
        </Button>
      }
    >
      <form id={formId} onSubmit={invite} noValidate>
        <div className="invite-fields">
          <div className="dialog-field">
            <label htmlFor={emailId}>Email</label>
            <input
              id={emailId}
              className="account-name"
              type="email"
              autoComplete="off"
              value={email}
              disabled={pending}
              aria-invalid={inlineError ? true : undefined}
              aria-describedby={inlineError ? `${emailId}-error` : undefined}
              onInput={(event) => {
                setEmail(event.currentTarget.value)
                setInlineError('')
                setError('')
              }}
            />
            {inlineError && (
              <span id={`${emailId}-error`} className="invite-email-error">
                {inlineError}
              </span>
            )}
          </div>
          {owner && (
            <fieldset className="invite-role dialog-field">
              <legend>Role</legend>
              <div className="invite-options">
                {(['admin', 'developer'] as const).map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name={`${formId}-role`}
                      value={option}
                      checked={role === option}
                      disabled={pending}
                      onChange={() => {
                        setRole(option)
                        setError('')
                      }}
                    />
                    {option === 'admin' ? 'Admin' : 'Developer'}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
        {error && (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}
