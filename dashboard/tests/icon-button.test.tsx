import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import IconButton from '../src/components/icon-button'

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

test('renders a round button that does not submit forms by default', async () => {
  await act(() => root.render(<IconButton aria-label="Open">Icon</IconButton>))
  const button = container.querySelector('button')!
  expect(button.className).toBe('icon-button icon-button-round')
  expect(button.type).toBe('button')
})

test('maps the square shape to its class', async () => {
  await act(() => root.render(<IconButton shape="square" aria-label="More">Icon</IconButton>))
  expect(container.querySelector('button')!.className).toBe('icon-button icon-button-square')
})

test('passes button attributes through', async () => {
  await act(() => root.render(<IconButton aria-label="More" popoverTarget="menu" data-tooltip="More" disabled>Icon</IconButton>))
  const button = container.querySelector('button')!
  expect(button.getAttribute('aria-label')).toBe('More')
  expect(button.getAttribute('popovertarget')).toBe('menu')
  expect(button.getAttribute('data-tooltip')).toBe('More')
  expect(button.disabled).toBe(true)
})
