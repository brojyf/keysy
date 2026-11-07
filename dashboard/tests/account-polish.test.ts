import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { Window, type HTMLButtonElement } from 'happy-dom'

const stylesheet = [
  '../../design/tokens/tokens.css',
  '../src/components/dashboard.css',
  '../src/components/account.css',
  '../src/components/dialog.css',
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
          <button class="dialog-cancel" data-focus-visible>Cancel</button>
          <button class="dialog-danger" data-focus-visible>Delete</button>
          <button class="dialog-primary" data-focus-visible>Confirm</button>
        </div>
        <div id="account-menu">
          <a class="account-menu-item" href="/account" data-focus-visible>Account</a>
          <span class="theme-switch"><button data-focus-visible>Theme</button></span>
        </div>
        <span class="account-theme"><button data-focus-visible>Theme</button></span>
        <button class="account-more" data-focus-visible>More</button>
        <div class="account-menu account-row-menu">
          <a class="account-menu-item" href="/account" data-focus-visible>Settings</a>
        </div>
        <div class="account-save-bar">
          <button data-focus-visible>Cancel</button>
          <button type="submit" data-focus-visible>Save</button>
        </div>
        <a class="auth-button" href="/signin" data-focus-visible>Continue with Google</a>`
      for (const control of document.querySelectorAll('[data-focus-visible]')) {
        const css = window.getComputedStyle(control)
        assert.equal(css.outlineWidth, '2px', control.outerHTML)
        assert.equal(css.outlineStyle, 'solid', control.outerHTML)
        assert.equal(css.outlineColor, 'transparent', control.outerHTML)
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
          <span class="account-theme"><span class="theme-thumb"></span><button data-focus-visible data-active>Theme</button></span>
          <div id="account-menu"><span class="theme-switch"><span class="theme-thumb"></span></span></div>
          <button class="account-more" data-focus-visible data-active>More</button>
          <div class="account-menu account-row-menu" data-popover-open>
            <a class="account-menu-item" data-focus-visible data-active>Dashboard with a label that wraps onto multiple lines</a>
            <a class="account-menu-item">Settings</a>
          </div>
          <div class="account-save-bar"><button type="submit" data-save-state="idle" data-focus-visible data-active>
            <span class="account-save-label">Save</span>
            <span class="account-save-icon account-save-spinner"></span>
            <span class="account-save-icon account-save-check"></span>
          </button></div>`
        const css = (selector: string) => window.getComputedStyle(document.querySelector(selector)!)
        const tokens = window.getComputedStyle(document.documentElement)
        const expectedRing = `0 0 0 2px ${tokens.getPropertyValue('--color-raised')}, 0 0 0 4px ${tokens.getPropertyValue('--color-button')}`
        for (const selector of ['.account-theme button', '.account-more', '.account-menu-item', '.account-save-bar button']) {
          assert.equal(css(selector).boxShadow, expectedRing, selector)
          assert.equal(css(selector).scale, motion === 'reduce' ? '1' : '0.97', selector)
          if (motion === 'reduce') assert.equal(css(selector).transition, 'none', selector)
        }

        // Happy DOM has no layout engine. These checks guard the CSS constraints, not pixel geometry.
        for (const selector of ['.account-row-menu', '.account-row-menu .account-menu-item']) {
          assert.ok(['', 'auto'].includes(css(selector).height), `${selector} must grow with its content`)
          assert.notEqual(css(selector).whiteSpace, 'nowrap')
        }
        if (motion === 'reduce') {
          assert.equal(css('.account-row-menu').transition, 'none')
          assert.equal(css('.account-row-menu .account-menu-item').animation, 'none')
          assert.equal(css('.account-row-menu .account-menu-item:nth-child(2)').animation, 'none')
          assert.equal(css('.account-theme .theme-thumb').transition, '')
        } else {
          assert.equal(css('.account-row-menu .account-menu-item').animation, 'account-menu-row-enter 120ms ease-out backwards')
          assert.equal(css('.account-row-menu .account-menu-item:nth-child(2)').animationDelay, '20ms')
          assert.equal(css('.account-theme .theme-thumb').transition, `transform 300ms ${tokens.getPropertyValue('--ease-spring')}, background-color 200ms ease`)
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
