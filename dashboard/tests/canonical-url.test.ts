import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { canonicalURL } from '../src/lib/canonical-url.ts'

test('trailing slashes are removed and the query and hash are kept', () => {
  assert.equal(canonicalURL({ pathname: '/signin/', search: '?next=1', hash: '#top' }), '/signin?next=1#top')
  assert.equal(canonicalURL({ pathname: '/account/sessions//', search: '', hash: '' }), '/account/sessions')
})

test('canonical paths and the root need no change', () => {
  assert.equal(canonicalURL({ pathname: '/signin', search: '?next=1', hash: '' }), undefined)
  assert.equal(canonicalURL({ pathname: '/', search: '', hash: '' }), undefined)
})
