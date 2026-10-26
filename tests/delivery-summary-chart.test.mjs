import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOrderTrend } from '../app/dashboard/delivery-report/delivery-summary-chart.mjs'

const groups = ['ARKLINE', 'MOB', 'OI']
const orders = [
  { delivery_date: '2026-01-02', group_order: 'MOB', quantity: '5' },
  { delivery_date: '2025-01-01', group_order: 'ARKLINE', quantity: 2 },
  { delivery_date: '2026-01-01', group_order: 'ARKLINE', quantity: 3 },
  { delivery_date: '2026-02-01', group_order: 'OI', quantity: 7 },
]

test('daily buckets are sorted and never merge matching dates across years', () => {
  const values = buildOrderTrend(orders, 'DAY', groups)
  assert.deepEqual(values.map((row) => row.TOTAL), [2, 3, 5, 7])
  assert.notEqual(values[0].label, values[1].label)
})

test('month/year totals equal group sums and preserve total quantity', () => {
  for (const period of ['DAY', 'MONTH', 'YEAR']) {
    const values = buildOrderTrend(orders, period, groups)
    assert.equal(values.reduce((sum, row) => sum + row.TOTAL, 0), 17)
    for (const row of values) assert.equal(row.TOTAL, row.ARKLINE + row.MOB + row.OI)
  }
  assert.deepEqual(buildOrderTrend(orders, 'MONTH', groups).map((row) => row.TOTAL), [2, 8, 7])
  assert.deepEqual(buildOrderTrend(orders, 'YEAR', groups).map((row) => row.TOTAL), [2, 15])
})

test('locked-group chart excludes other groups and handles empty/invalid dates', () => {
  const values = buildOrderTrend([...orders, { delivery_date: null, group_order: 'ARKLINE', quantity: 99 }], 'YEAR', ['ARKLINE'])
  assert.deepEqual(values.map((row) => row.TOTAL), [2, 3])
  assert.equal(values.some((row) => 'MOB' in row), false)
  assert.deepEqual(buildOrderTrend([], 'DAY', groups), [])
})
