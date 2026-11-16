import type { ReactNode } from 'react'
import { MoreIcon } from './account-table-controls'
import IconButton from './icon-button'
import { placeRowMenu } from '../lib/row-menu'

// Mirrors the Figma More menu: a ⋯ trigger and a popover menu, right aligned below it.
export default function MoreMenu({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <>
      <IconButton shape="square" popoverTarget={id} aria-label={label}><MoreIcon /></IconButton>
      <div id={id} className="account-menu account-row-menu" popover="auto" onBeforeToggle={placeRowMenu}>{children}</div>
    </>
  )
}
