import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Dialog from '../src/components/dialog'
import { openDialog } from '../src/lib/dialog-controls'

let browser: Window
let root: Root
let container: HTMLDivElement

beforeEach(() => {
  browser = new Window({ url: 'https://dashboard.keysy.net' })
  Object.assign(globalThis, { window: browser, document: browser.document, IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(() => root.unmount())
  await browser.happyDOM.close()
})

test('labels the dialog and renders children and actions without an alert by default', async () => {
  const ref = createRef<HTMLDialogElement>()
  await act(() => root.render(<Dialog ref={ref} title="Title" actions={<button>Action</button>}><p>Body</p></Dialog>))
  const dialog = ref.current!
  const title = dialog.querySelector('h2')!
  expect(title.textContent).toBe('Title')
  expect(title.id).toBeTruthy()
  expect(dialog.getAttribute('aria-labelledby')).toBe(title.id)
  expect(dialog.querySelector('.dialog-alert')).toBeNull()
  expect(dialog.querySelector('p')?.textContent).toBe('Body')
  expect(dialog.querySelector('.dialog-actions button')?.textContent).toBe('Action')
})

test('renders an alert icon when requested', async () => {
  const ref = createRef<HTMLDialogElement>()
  await act(() => root.render(<Dialog ref={ref} title="Alert" alert actions={null}>Body</Dialog>))
  expect(ref.current!.querySelector('h2 .dialog-alert')?.getAttribute('aria-hidden')).toBe('true')
})

for (const closable of [true, false]) {
  test(`Escape ${closable ? 'closes' : 'keeps open'} the dialog`, async () => {
    const ref = createRef<HTMLDialogElement>()
    await act(() => root.render(<Dialog ref={ref} title="Title" closable={closable} actions={null}>Body</Dialog>))
    const dialog = ref.current!
    openDialog(dialog)
    let finish!: () => void
    const finished = new Promise<void>((resolve) => { finish = resolve })
    dialog.getAnimations = () => [{ finished } as unknown as Animation]
    const escape = new browser.Event('cancel', { cancelable: true })
    await act(() => { dialog.dispatchEvent(escape) })
    expect(escape.defaultPrevented).toBe(true)
    expect(dialog.open).toBe(true)
    expect(dialog.dataset.closing).toBe(closable ? '' : undefined)
    await act(async () => finish())
    expect(dialog.open).toBe(!closable)
    expect(dialog.dataset.closing).toBeUndefined()
  })
}
