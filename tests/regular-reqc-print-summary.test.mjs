import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRegularReQcSizeBreakdown } from '../utils/regular-reqc-print-summary.mjs'

test('print breakdown groups selected Re-QC results by grade, product, and size', () => {
  const queues = new Map([
    [1, { size: 'M' }], [2, { size: 'S' }], [3, { size: 'M' }],
    [4, { size: 'XS' }], [5, { size: 'M' }], [6, { size: 'XL' }],
  ])
  const groups = [
    { key: 'sku-1', sku: 'SKU-1', name: 'Shirt', rows: [
      { reqc_queue_id: 1, grade: 'A', qty: 2 },
      { reqc_queue_id: 3, grade: 'A', qty: 3 },
      { reqc_queue_id: 2, grade: 'A', qty: 1 },
      { reqc_queue_id: 4, grade: 'B', qty: 4 },
      { reqc_queue_id: 5, grade: 'C', qty: 5 },
    ] },
    { key: 'sku-2', sku: 'SKU-2', name: 'Tee', rows: [
      { reqc_queue_id: 6, grade: 'A', qty: 6 },
    ] },
  ]

  const breakdown = buildRegularReQcSizeBreakdown(groups, queues)
  assert.deepEqual(breakdown.A, [
    { sku: 'SKU-1', name: 'Shirt', size: 'S', qty: 1 },
    { sku: 'SKU-1', name: 'Shirt', size: 'M', qty: 5 },
    { sku: 'SKU-2', name: 'Tee', size: 'XL', qty: 6 },
  ])
  assert.deepEqual(breakdown.B, [{ sku: 'SKU-1', name: 'Shirt', size: 'XS', qty: 4 }])
  assert.deepEqual(breakdown.C, [{ sku: 'SKU-1', name: 'Shirt', size: 'M', qty: 5 }])
  assert.deepEqual(Object.fromEntries(Object.entries(breakdown).map(([grade, rows]) => [grade, rows.reduce((sum, row) => sum + row.qty, 0)])), {
    A: 12, B: 4, C: 5,
  })
})

test('print breakdown handles missing size and empty grades', () => {
  const breakdown = buildRegularReQcSizeBreakdown([
    { key: 'sku-1', sku: 'SKU-1', name: 'Shirt', rows: [{ reqc_queue_id: 1, grade: 'A', qty: 2 }] },
  ], new Map([[1, { size: '' }]]))

  assert.deepEqual(breakdown.A, [{ sku: 'SKU-1', name: 'Shirt', size: 'NO SIZE', qty: 2 }])
  assert.deepEqual(breakdown.B, [])
  assert.deepEqual(breakdown.C, [])
})
