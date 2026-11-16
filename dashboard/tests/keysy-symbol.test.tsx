import { Window } from 'happy-dom'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import KeysySymbol from '../src/components/keysy-symbol'

const logo = (file: string) => readFileSync(new URL(`../../design/logo/${file}`, import.meta.url), 'utf8')
const paths = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map(([, path]) => path)
const fill = (svg: string) => svg.match(/fill="(#[0-9a-f]{6})"/i)![1].toLowerCase()
const stylesheet = ['../../design/tokens/tokens.css', '../src/components/dashboard.css']
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n')

let browser: Window
let root: Root
let container: HTMLDivElement

beforeEach(() => {
  browser = new Window({ url: 'https://dashboard.keysy.net' })
  Object.assign(globalThis, { window: browser, document: browser.document, IS_REACT_ACT_ENVIRONMENT: true })
  const style = document.createElement('style')
  style.textContent = stylesheet
  document.head.append(style)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(() => root.unmount())
  await browser.happyDOM.close()
})

test('draws the design logo paths at the requested size with an accessible name', async () => {
  await act(() => root.render(<KeysySymbol size={36} />))
  const svg = container.querySelector('svg[role="img"][aria-label="Keysy"]')!
  expect(svg.getAttribute('width')).toBe('36')
  expect(svg.getAttribute('height')).toBe('36')
  for (const file of ['symbol-light.svg', 'symbol-dark.svg']) expect(paths(svg.outerHTML)).toEqual(paths(logo(file)))
})

for (const [mode, file] of [['light', 'symbol-light.svg'], ['dark', 'symbol-dark.svg']]) {
  test(`uses the ${mode} logo color in ${mode} mode`, async () => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
    await act(() => root.render(<KeysySymbol size={24} />))
    expect(window.getComputedStyle(container.querySelector('svg')!).color.toLowerCase()).toBe(fill(logo(file)))
  })
}
