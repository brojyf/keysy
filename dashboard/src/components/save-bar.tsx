import { Check, CircleAlert, LoaderCircle } from 'lucide-react'
import type { RefObject } from 'react'
import Button from './button'

type SaveBarProps = {
  saveBar: { ref: RefObject<HTMLDivElement | null>; saving: boolean; saved: boolean; visible: boolean }
  networkError: boolean
  saveDisabled: boolean
  onDiscard: () => void
}

export default function SaveBar({ saveBar: { ref, saving, saved, visible }, networkError, saveDisabled, onDiscard }: SaveBarProps) {
  return (
    <div ref={ref} data-saved={saved || undefined} className={`account-save-bar${visible ? '' : ' account-save-bar-leaving'}`}>
      {networkError ? <span className="account-save-error" role="alert"><CircleAlert size={16} aria-hidden />Couldn't reach Keysy</span> : <span role="status">
        <span className="account-save-count" aria-hidden={saved}>1 unsaved change</span>
        {saved && <span className="account-save-success">Saved</span>}
      </span>}
      <Button disabled={saving || saved} onClick={onDiscard}>Discard</Button>
      <Button variant="primary" type="submit" data-feedback={saving || saved || undefined} data-save-state={saved ? 'saved' : saving ? 'saving' : 'idle'} aria-busy={saving} aria-label={saving ? 'Saving' : saved ? 'Saved' : undefined} disabled={saving || saved || saveDisabled}>
        <span className="account-save-label">{networkError ? 'Retry' : 'Save'}</span>
        <LoaderCircle className="account-save-icon account-save-spinner" size={14} strokeWidth={2} aria-hidden />
        <Check className="account-save-icon account-save-check" size={14} strokeWidth={2} aria-hidden />
      </Button>
    </div>
  )
}
