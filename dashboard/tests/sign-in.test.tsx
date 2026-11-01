import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from '../src/App'

let browser: Window
let root: Root
let container: HTMLDivElement

beforeEach(async () => {
  browser = new Window()
  Object.assign(globalThis, {
    window: browser,
    document: browser.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(() => root.render(<App />))
})

afterEach(async () => {
  await act(() => root.unmount())
  await browser.happyDOM.close()
})

test('shows the Figma sign-in copy, logos, and legal placeholders', () => {
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
  expect(container.textContent).toContain('Use your Google account to continue.')
  expect(container.querySelector('button')?.textContent).toBe('Continue with Google')
  expect(container.querySelector('img[alt="Keysy"]')?.getAttribute('width')).toBe('36')
  expect(container.querySelector('button img')?.getAttribute('width')).toBe('18')
  expect(container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(5)
  expect(container.querySelector('a')).toBeNull()
})

test('mock sign-in shows only Logout and logout restores sign-in', async () => {
  await act(() => container.querySelector('button')!.click())
  expect(container.textContent).toBe('Logout')
  expect(container.querySelector('h1')).toBeNull()

  await act(() => container.querySelector('button')!.click())
  expect(container.querySelector('h1')?.textContent).toBe('Sign in to Keysy')
  expect(container.querySelector('button')?.textContent).toBe('Continue with Google')

  await act(() => container.querySelector('button')!.click())
  expect(container.textContent).toBe('Logout')
})

test('a fresh app starts signed out after a mock sign-in', async () => {
  await act(() => container.querySelector('button')!.click())
  await act(() => root.unmount())
  root = createRoot(container)
  await act(() => root.render(<App />))
  expect(container.querySelector('button')?.textContent).toBe('Continue with Google')
  expect(browser.localStorage.length).toBe(0)
  expect(browser.sessionStorage.length).toBe(0)
})
