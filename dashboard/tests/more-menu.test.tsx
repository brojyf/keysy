import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import MoreMenu from '../src/components/more-menu'

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

test('renders an accessible trigger immediately before its popover and children', async () => {
  await act(() => root.render(<MoreMenu id="row-menu" label="More actions"><button>Action</button></MoreMenu>))
  const trigger = container.querySelector('button')!
  const menu = container.querySelector<HTMLDivElement>('#row-menu')!
  expect(trigger.getAttribute('aria-label')).toBe('More actions')
  expect(trigger.getAttribute('popovertarget')).toBe('row-menu')
  expect(trigger.className).toBe('icon-button icon-button-square')
  expect(menu.tagName).toBe('DIV')
  expect(menu.getAttribute('popover')).toBe('auto')
  expect(menu.className).toBe('account-menu account-row-menu')
  expect(menu.textContent).toBe('Action')
  expect(menu.previousElementSibling).toBe(trigger)
})
