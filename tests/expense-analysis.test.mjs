import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeExpenses, monthKey, monthsBetween } from '../app/dashboard/arkline/financial-management/reporting/expense-analysis.mjs'

test('paid date uses Jakarta month at UTC boundary', () => {
  assert.equal(monthKey('2026-09-30T18:00:00Z'), '2026-10')
  assert.equal(monthKey('invalid'), '')
})
test('category and source filters affect monthly totals and equal-length comparison', () => {
  const rows = [
    { month: '2025-12', category_name: 'Shipping', source: 'PAYMENT', amount: 50 },
    { month: '2026-02', category_name: 'Shipping', source: 'PAYMENT', amount: 100 },
    { month: '2026-02', category_name: 'Shipping', source: 'REIMBURSEMENT', amount: 20 },
    { month: '2026-02', category_name: 'Production', source: 'PAYMENT', amount: 900 },
  ]
  const result = analyzeExpenses(rows, '2026-01', '2026-02', 'Shipping', 'PAYMENT')
  assert.equal(result.total, 100)
  assert.equal(result.previous, 50)
  assert.deepEqual(result.series.map(row => row.total), [0, 100])
  assert.deepEqual(result.categories[0].months, [0, 100])
  assert.equal(result.previousStart, '2025-11')
  assert.deepEqual(monthsBetween('2026-02', '2026-01'), [])
})
