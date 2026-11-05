import { exitAnimationFinished } from './exit-animation'

export function openDialog(dialog: HTMLDialogElement) {
  // Safari shows a focus ring on the first button after a mouse click, so focus the dialog itself.
  dialog.autofocus = true
  dialog.showModal()
}

export async function closeDialog(dialog: HTMLDialogElement) {
  dialog.dataset.closing = ''
  await exitAnimationFinished(dialog)
  dialog.close()
  delete dialog.dataset.closing
}
