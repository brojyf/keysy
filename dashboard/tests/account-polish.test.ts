import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { Window, type HTMLButtonElement } from 'happy-dom'

const stylesheet = [
  '../../design/tokens/tokens.css',
  '../src/components/dashboard.css',
  '../src/components/account.css',
  '../src/components/dialog.css',
  '../src/components/button.css',
  '../src/components/icon-button.css',
  '../src/components/sign-in.css',
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n')

for (const dark of [false, true]) {
  test(`polished controls retain an outline for forced-colors mode in ${dark ? 'dark' : 'light'} mode`, async () => {
    const window = new Window()
    try {
      const document = window.document
      document.documentElement.classList.toggle('dark', dark)
      const style = document.createElement('style')
      // Happy DOM cannot render forced colors. Check the transparent outline that browsers recolor.
      style.textContent = stylesheet
        .replaceAll(':focus-visible', '[data-focus-visible]')
        // Happy DOM cannot match the descendant selector inside this :is() group.
        .replaceAll(
          '#account-menu :is(.account-menu-item, .theme-switch button)[data-focus-visible]',
          '#account-menu .account-menu-item[data-focus-visible], #account-menu .theme-switch button[data-focus-visible]',
        )
      document.head.append(style)
      document.body.innerHTML = `
        <div class="dialog">
          <button class="button" data-focus-visible>Cancel</button>
          <button class="button button-danger-outline" data-focus-visible>Delete</button>
          <button class="button button-primary" data-focus-visible>Confirm</button>
        </div>
        <div id="account-menu">
          <a class="account-menu-item" href="/account" data-focus-visible>Account</a>
          <span class="theme-switch"><button data-focus-visible>Theme</button></span>
        </div>
        <div class="account-sections"><span class="theme-switch"><button data-focus-visible>Theme</button></span></div>
        <button class="icon-button-square" data-focus-visible>More</button>
        <div class="account-menu account-row-menu">
          <a class="account-menu-item" href="/account" data-focus-visible>Settings</a>
        </div>
        <div class="account-save-bar">
          <button class="button" data-focus-visible>Cancel</button>
          <button class="button button-primary" type="submit" data-focus-visible>Save</button>
        </div>
        <a class="auth-button" href="/signin" data-focus-visible>Continue with Google</a>`
      for (const control of document.querySelectorAll('[data-focus-visible]')) {
        const css = window.getComputedStyle(control)
        assert.equal(css.outlineWidth, '2px', control.outerHTML)
        assert.equal(css.outlineStyle, 'solid', control.outerHTML)
        assert.equal(css.outlineColor, control.classList.contains('button') ? window.getComputedStyle(document.documentElement).getPropertyValue('--color-button') : 'transparent', control.outerHTML)
        assert.equal(css.outlineOffset, '2px', control.outerHTML)
      }
    } finally {
      await window.happyDOM.close()
    }
  })

  for (const motion of ['no-preference', 'reduce']) {
    test(`account polish preserves focus, content sizing, and feedback in ${dark ? 'dark' : 'light'} mode with ${motion} motion`, async () => {
      const window = new Window({ settings: { device: { prefersReducedMotion: motion } } })
      try {
        const document = window.document
        document.documentElement.classList.toggle('dark', dark)
        const style = document.createElement('style')
        // Happy DOM does not implement these native pseudo-classes. Attributes keep their specificity.
        style.textContent = stylesheet
          .replaceAll(':popover-open', '[data-popover-open]')
          .replaceAll(':focus-visible', '[data-focus-visible]')
          .replaceAll(':active', '[data-active]')
        document.head.append(style)
        document.body.innerHTML = `
          <div class="account-sections"><span class="theme-switch"><span class="theme-thumb"></span><button data-focus-visible data-active>Theme</button></span></div>
          <div id="account-menu"><span class="theme-switch"><span class="theme-thumb"></span></span><a class="account-menu-item account-menu-press" data-active>Account</a></div>
          <button class="icon-button-square" data-focus-visible data-active>More</button>
          <div class="account-menu account-row-menu" data-popover-open>
            <a class="account-menu-item" data-focus-visible data-active>Dashboard with a label that wraps onto multiple lines</a>
            <a class="account-menu-item">Settings</a>
          </div>
          <div class="account-save-bar"><button class="button button-primary" type="submit" data-save-state="idle" data-focus-visible data-active>
            <span class="account-save-label">Save</span>
            <span class="account-save-icon account-save-spinner"></span>
            <span class="account-save-icon account-save-check"></span>
          </button></div>`
        const css = (selector: string) => window.getComputedStyle(document.querySelector(selector)!)
        const tokens = window.getComputedStyle(document.documentElement)
        const expectedRing = `0 0 0 2px ${tokens.getPropertyValue('--color-raised')}, 0 0 0 4px ${tokens.getPropertyValue('--color-button')}`
        for (const selector of ['.account-sections .theme-switch button', '.icon-button-square']) {
          assert.equal(css(selector).boxShadow, expectedRing, selector)
          if (motion === 'reduce') assert.equal(css(selector).transition, 'none', selector)
        }
        const menuRing = `0 0 0 2px ${tokens.getPropertyValue('--color-menu')}, 0 0 0 4px ${tokens.getPropertyValue('--color-accent')}`
        assert.equal(css('.account-row-menu .account-menu-item').boxShadow, menuRing, '.account-row-menu .account-menu-item')
        if (motion === 'reduce') assert.equal(css('.account-row-menu .account-menu-item').transition, 'none', '.account-row-menu .account-menu-item')
        for (const selector of ['.account-sections .theme-switch button', '.icon-button-square']) {
          assert.equal(css(selector).scale, motion === 'reduce' ? '1' : '0.97', selector)
        }
        // Menu items close the menu on click, so a press scale is never seen and only shrinks the row highlight.
        for (const selector of ['.account-row-menu .account-menu-item', '#account-menu .account-menu-press']) {
          assert.ok(['', 'none', '1'].includes(css(selector).scale), selector)
        }

        assert.equal(css('.account-save-bar button').outlineOffset, '2px')
        assert.equal(css('.account-save-bar button').boxShadow, '')
        assert.equal(css('.account-save-bar button').scale, motion === 'reduce' ? '1' : '0.97')

        // Happy DOM has no layout engine. These checks guard the CSS constraints, not pixel geometry.
        for (const selector of ['.account-row-menu', '.account-row-menu .account-menu-item']) {
          assert.ok(['', 'auto'].includes(css(selector).height), `${selector} must grow with its content`)
          assert.notEqual(css(selector).whiteSpace, 'nowrap')
        }
        if (motion === 'reduce') {
          assert.equal(css('.account-row-menu').transition, 'none')
          assert.equal(css('.account-row-menu .account-menu-item').animation, 'none')
          assert.equal(css('.account-row-menu .account-menu-item:nth-child(2)').animation, 'none')
          assert.equal(css('.account-sections .theme-switch .theme-thumb').transition, '')
        } else {
          assert.equal(css('.account-row-menu .account-menu-item').animation, 'account-menu-row-enter 120ms ease-out backwards')
          assert.equal(css('.account-row-menu .account-menu-item:nth-child(2)').animationDelay, '20ms')
          // Row menus open below their trigger, so rows drop in from above.
          assert.equal(css('.account-row-menu').getPropertyValue('--menu-row-offset').trim(), '-4px')
          assert.equal(css('.account-sections .theme-switch .theme-thumb').transition, `transform 300ms ${tokens.getPropertyValue('--ease-spring')}, background-color 200ms ease`)
        }
        assert.equal(css('#account-menu .theme-thumb').transition, motion === 'reduce' ? '' : 'transform 200ms ease-in-out, background-color 200ms ease-in-out')

        const button = document.querySelector<HTMLButtonElement>('.account-save-bar button')!
        for (const state of ['idle', 'saving', 'saved']) {
          button.dataset.saveState = state
          button.toggleAttribute('data-feedback', state !== 'idle')
          assert.equal(css('.account-save-label').visibility, state === 'idle' ? 'visible' : 'hidden')
          assert.equal(css('.account-save-spinner').visibility, state === 'saving' ? 'visible' : 'hidden')
          assert.equal(css('.account-save-check').visibility, state === 'saved' ? 'visible' : 'hidden')
          if (motion === 'reduce') {
            for (const selector of ['.account-save-label', '.account-save-spinner', '.account-save-check']) {
              assert.equal(css(selector).transition, 'none')
            }
            assert.equal(css('.account-save-spinner').animation, 'none')
          } else {
            assert.equal(css('.account-save-spinner').animationPlayState, state === 'saving' ? 'running' : 'paused')
          }
        }
      } finally {
        await window.happyDOM.close()
      }
    })
  }
}

test('account menu rows rise bottom-up, from the avatar the panel grows out of', async () => {
  const window = new Window()
  try {
    const document = window.document
    const style = document.createElement('style')
    style.textContent = stylesheet.replaceAll(':popover-open', '[data-popover-open]')
    document.head.append(style)
    document.body.innerHTML = `
      <div id="account-menu" class="account-menu" data-popover-open>
        <div class="account-menu-identity"></div>
        <a class="account-menu-item">Account</a>
        <div class="account-menu-row">Theme</div>
        <button class="account-menu-item account-menu-sign-out">Sign out</button>
      </div>`
    const delay = (selector: string) => parseFloat(window.getComputedStyle(document.querySelector(selector)!).animationDelay) || 0
    const topDown = ['.account-menu-identity', 'a.account-menu-item', '.account-menu-row', '.account-menu-sign-out'].map(delay)
    assert.deepEqual(topDown, [60, 40, 20, 0])
    assert.equal(window.getComputedStyle(document.querySelector('#account-menu')!).getPropertyValue('--menu-row-offset').trim(), '4px')
  } finally {
    await window.happyDOM.close()
  }
})

for (const dark of [false, true]) {
  test(`menus use the menu tokens in ${dark ? 'dark' : 'light'} mode`, async () => {
    const window = new Window()
    try {
      const document = window.document
      document.documentElement.classList.toggle('dark', dark)
      const style = document.createElement('style')
      style.textContent = stylesheet.replaceAll(':hover', '[data-hover]')
      document.head.append(style)
      document.body.innerHTML = `
        <div id="account-menu" class="account-menu">
          <span class="theme-switch"><span class="theme-thumb"></span></span>
          <hr class="account-menu-divider">
          <a class="account-menu-item" data-hover>Account</a>
        </div>
        <div class="account-menu account-row-menu"><a class="account-menu-item" data-hover>Settings</a></div>`
      const css = (selector: string) => window.getComputedStyle(document.querySelector(selector)!)
      const token = (name: string) => window.getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
      for (const menu of ['#account-menu', '.account-row-menu']) {
        assert.equal(css(menu).backgroundColor, token('menu'), menu)
        assert.equal(css(`${menu} .account-menu-item`).backgroundColor, token('menu-soft'), `${menu} item hover`)
      }
      assert.equal(css('#account-menu .account-menu-divider').backgroundColor, token('menu-line'))
      assert.equal(css('#account-menu .theme-switch').borderTopColor, token('menu-line'))
      assert.equal(css('#account-menu .theme-thumb').backgroundColor, token('menu-soft'))
    } finally {
      await window.happyDOM.close()
    }
  })
}

function contrast(first: string, second: string) {
  const luminance = (hex: string) => {
    const [red, green, blue] = hex.slice(1).match(/../g)!.map(channel => {
      const value = parseInt(channel, 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return red * 0.2126 + green * 0.7152 + blue * 0.0722
  }
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

for (const dark of [false, true]) {
  test(`menu focus rings reach 3:1 against the menu in ${dark ? 'dark' : 'light'} mode`, async () => {
    const window = new Window()
    try {
      const document = window.document
      document.documentElement.classList.toggle('dark', dark)
      const style = document.createElement('style')
      style.textContent = stylesheet
        .replaceAll(':focus-visible', '[data-focus-visible]')
        // Happy DOM cannot match the descendant selector inside this :is() group.
        .replaceAll(
          '#account-menu :is(.account-menu-item, .theme-switch button)[data-focus-visible]',
          '#account-menu .account-menu-item[data-focus-visible], #account-menu .theme-switch button[data-focus-visible]',
        )
      document.head.append(style)
      document.body.innerHTML = `
        <div id="account-menu">
          <a class="account-menu-item" data-focus-visible>Account</a>
          <span class="theme-switch"><button data-focus-visible>Theme</button></span>
        </div>
        <div class="account-menu account-row-menu"><a class="account-menu-item" data-focus-visible>Settings</a></div>`
      const menu = window.getComputedStyle(document.documentElement).getPropertyValue('--color-menu').trim()
      for (const control of document.querySelectorAll('[data-focus-visible]')) {
        const ring = window.getComputedStyle(control).boxShadow.match(/4px (#[0-9a-f]{6})$/i)?.[1]
        assert.ok(ring, control.outerHTML)
        const ratio = contrast(ring, menu)
        assert.ok(ratio >= 3, `${control.outerHTML} ring/menu: ${ratio.toFixed(2)}:1; expected 3:1`)
      }
    } finally {
      await window.happyDOM.close()
    }
  })
}
