import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { canonicalURL } from '../src/lib/canonical-url.ts'

const origin = 'https://dashboard.keysy.net'

test('trailing slashes are removed and the query and hash are kept', () => {
  assert.equal(canonicalURL({ origin, pathname: '/signin/', search: '?next=1', hash: '#top' }), `${origin}/signin?next=1#top`)
  assert.equal(canonicalURL({ origin, pathname: '/account/sessions//', search: '', hash: '' }), `${origin}/account/sessions`)
})

// A relative //signin would name another host, and replaceState would throw before the app mounts.
test('a path with leading double slashes stays on the same origin', () => {
  assert.equal(new URL(canonicalURL({ origin, pathname: '//signin/', search: '', hash: '' })!).origin, origin)
})

test('canonical paths and the root need no change', () => {
  assert.equal(canonicalURL({ origin, pathname: '/signin', search: '?next=1', hash: '' }), undefined)
  assert.equal(canonicalURL({ origin, pathname: '/', search: '', hash: '' }), undefined)
})
