import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Button from '../src/components/button'

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

test('renders a secondary button that does not submit forms by default', async () => {
  await act(() => root.render(<Button>Cancel</Button>))
  const button = container.querySelector('button')!
  expect(button.className).toBe('button')
  expect(button.type).toBe('button')
})

for (const [variant, className] of [['primary', 'button button-primary'], ['danger', 'button button-danger']] as const) {
  test(`maps the Figma ${variant} variant to its class`, async () => {
    await act(() => root.render(<Button variant={variant}>Label</Button>))
    expect(container.querySelector('button')!.className).toBe(className)
  })
}

test('passes button attributes through', async () => {
  await act(() => root.render(<Button type="submit" form="form-id" disabled aria-busy>Save</Button>))
  const button = container.querySelector('button')!
  expect(button.type).toBe('submit')
  expect(button.getAttribute('form')).toBe('form-id')
  expect(button.disabled).toBe(true)
  expect(button.getAttribute('aria-busy')).toBe('true')
})
