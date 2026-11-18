import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { validateName } from '../src/lib/name-validation.ts'

test('empty and whitespace-only names are required', () => {
  assert.deepEqual(validateName(''), { kind: 'required' })
  assert.deepEqual(validateName('   '), { kind: 'required' })
})

test('name validation counts up to 32 code points after trimming', () => {
  assert.equal(validateName(' a '), null)
  assert.equal(validateName(`  ${'a'.repeat(32)}  `), null)
  assert.deepEqual(validateName(`  ${'a'.repeat(33)}  `), { kind: 'too-long', count: 33 })
})

test('surrogate pairs count as one code point and combining marks count separately', () => {
  assert.equal(validateName('😀'.repeat(32)), null)
  assert.deepEqual(validateName('😀'.repeat(33)), { kind: 'too-long', count: 33 })
  assert.deepEqual(validateName('a\u0301'.repeat(17)), { kind: 'too-long', count: 34 })
})
