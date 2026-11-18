import type { Ref } from 'react'
import { NAME_MAX_LENGTH, type NameIssue } from '../lib/name-validation'

type NameInputProps = {
  ref?: Ref<HTMLInputElement>
  id: string
  value: string
  issue: NameIssue | null
  disabled: boolean
  readOnly?: boolean
  onInput: (value: string) => void
}

export default function NameInput({ ref, id, value, issue, disabled, readOnly, onInput }: NameInputProps) {
  const descriptionId = `${id}-error`
  const hint = issue?.kind === 'required' ? 'Required' : issue ? `${issue.count}/${NAME_MAX_LENGTH}` : ''

  return (
    <div className="account-name-field">
      <input
        ref={ref}
        id={id}
        className="account-name"
        autoComplete="off"
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        onInput={(event) => onInput(event.currentTarget.value)}
        aria-invalid={issue ? true : undefined}
        aria-describedby={issue ? descriptionId : undefined}
      />
      {issue && <span className="account-name-error" aria-hidden="true">{hint}</span>}
      <span id={descriptionId} className="visually-hidden" role="status">
        {issue ? (issue.kind === 'required' ? 'Enter a name.' : `Name must be ${NAME_MAX_LENGTH} characters or fewer.`) : ''}
      </span>
    </div>
  )
}
