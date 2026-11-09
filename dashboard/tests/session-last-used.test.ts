import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { formatLastUsed } from '../src/lib/session-last-used.ts'

// Local time, so calendar-day rules hold in any test time zone.
const now = new Date(2026, 10, 8, 15, 30)
const ago = (milliseconds: number) => new Date(now.getTime() - milliseconds).toISOString()
const at = (year: number, month: number, day: number, hours: number) => new Date(year, month, day, hours).toISOString()

test('the current session is always used now', () => {
  assert.equal(formatLastUsed(at(2025, 0, 1, 9), true, now), 'Now')
})

test('recent use shows relative minutes and hours', () => {
  assert.equal(formatLastUsed(ago(59_999), false, now), 'Now')
  assert.equal(formatLastUsed(ago(-5_000), false, now), 'Now')
  assert.equal(formatLastUsed(ago(60_000), false, now), '1 minute ago')
  assert.equal(formatLastUsed(ago(119_999), false, now), '1 minute ago')
  assert.equal(formatLastUsed(ago(59 * 60_000), false, now), '59 minutes ago')
  assert.equal(formatLastUsed(ago(60 * 60_000), false, now), '1 hour ago')
  assert.equal(formatLastUsed(ago(2 * 60 * 60_000), false, now), '2 hours ago')
  assert.equal(formatLastUsed(ago(24 * 60 * 60_000 - 1), false, now), '23 hours ago')
})

test('older use shows Yesterday or the date', () => {
  assert.equal(formatLastUsed(at(2026, 10, 7, 9), false, now), 'Yesterday')
  assert.equal(formatLastUsed(at(2026, 10, 6, 23), false, now), 'Nov 6')
  assert.equal(formatLastUsed(at(2026, 9, 12, 9), false, now), 'Oct 12')
  assert.equal(formatLastUsed(at(2025, 9, 12, 9), false, now), 'Oct 12, 2025')
})

test('Yesterday follows the calendar across a year boundary', () => {
  const newYear = new Date(2027, 0, 1, 12)
  assert.equal(formatLastUsed(new Date(2026, 11, 31, 8).toISOString(), false, newYear), 'Yesterday')
  assert.equal(formatLastUsed(new Date(2026, 11, 30, 8).toISOString(), false, newYear), 'Dec 30, 2026')
})
