import assert from 'node:assert/strict'
import test from 'node:test'
import { hasHostDetailFilters, showHostDetailCredits } from '../app/dashboard/arkline/financial-management/live-reporting/host-detail-window.mjs'

const allFilters = () => ({ channel: 'ALL', type: 'ALL', partner: 'ALL', date_from: '', date_to: '', time_from: '', time_to: '' })
const rows = [
  { session_date: '2026-11-10' },
  { session_date: '2026-11-11' },
  { session_date: '2026-11-17' },
  { session_date: '2026-11-18' },
]

test('default Host Detail includes only today and the preceding six days', () => {
  assert.deepEqual(showHostDetailCredits(rows, allFilters(), '2026-11-17').map(row => row.session_date), ['2026-11-11', '2026-11-17'])
  assert.deepEqual(showHostDetailCredits([{ session_date: '2026-10-31' }, { session_date: '2026-11-01' }], allFilters(), '2026-11-06').map(row => row.session_date), ['2026-10-31', '2026-11-01'])
})

test('any Host Detail filter searches all historical rows', () => {
  for (const active of [
    { channel: 'SHOPEE' }, { type: 'PAIRING' }, { partner: 'Mike' },
    { date_from: '2026-11-01' }, { date_to: '2026-11-10' },
    { time_from: '12:00' }, { time_to: '18:00' },
  ]) {
    const filters = { ...allFilters(), ...active }
    assert.equal(hasHostDetailFilters(filters), true)
    assert.equal(showHostDetailCredits(rows, filters, '2026-11-17'), rows)
  }
})
