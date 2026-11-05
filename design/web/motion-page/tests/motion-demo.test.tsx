import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { MotionDemo } from '@/pages/reactbits/MotionDemo'

describe('motion demo', () => {
  const html = renderToString(<MotionDemo />)

  test('has a dot background behind the hero and behind the call-to-action card', () => {
    expect(html.match(/<canvas/g)).toHaveLength(2)
  })

  test('starts the hero story before the AI assistant moves the secrets', () => {
    expect(html).toContain('AI assistant')
    expect(html).toContain('production/payments/')
    expect(html).toContain('production/email/')
  })

  test('leaves out the landing page sections without these effects', () => {
    for (const text of ['One vault. Four ways in.', 'Locked by default.', 'Fetch secrets', '© 2026 Keysy']) {
      expect(html).not.toContain(text)
    }
  })
})
