import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react'
import Button from './button'
import Dialog from './dialog'
import { closeDialog } from '../lib/dialog-controls'
import { useCurrentUser } from './current-user'
import NameInput from './name-input'
import { validateName } from '../lib/name-validation'

export default function CreateOrganizationDialog({ ref }: { ref: Ref<HTMLDialogElement> }) {
  const formId = useId()
  const nameId = useId()
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const { createOrganization } = useCurrentUser()
  const [draft, setDraft] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const submitting = useRef(false)
  const name = draft ?? ''
  const nameIssue = validateName(name)

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const dialog = event.currentTarget.closest('dialog')
    if (nameIssue || submitting.current || dialog?.hasAttribute('data-closing')) return
    submitting.current = true
    setPending(true)
    setError(false)
    try {
      await createOrganization(name.trim())
      if (mounted.current && dialog) void closeDialog(dialog)
    } catch { if (mounted.current) setError(true) } finally { submitting.current = false; if (mounted.current) setPending(false) }
  }

  return (
    <Dialog ref={ref} title="Create an organization" closable={!pending} onClose={() => { setDraft(null); setError(false) }} action={
      <Button variant="primary" type="submit" form={formId} disabled={nameIssue !== null || pending}>{pending ? 'Creating...' : 'Create'}</Button>
    }>
      <form id={formId} onSubmit={create}>
        <div className="dialog-field">
          <label htmlFor={nameId}>Name</label>
          <NameInput id={nameId} value={name} disabled={pending} issue={draft === null ? null : nameIssue}
            onInput={(value) => { setDraft(value); setError(false) }} />
        </div>
        {error && <p className="dialog-error" role="alert">Could not create the organization. Try again.</p>}
      </form>
    </Dialog>
  )
}
