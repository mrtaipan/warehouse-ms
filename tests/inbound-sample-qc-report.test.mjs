import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSampleQcRows, groupSampleQcByCategory, sampleQcGradePercentage } from '../utils/inbound-sample-qc-report.mjs'

test('prints only sample QC and keeps partial grade progress', () => {
  const rows = buildSampleQcRows({
    sampleRows: [
      { id: 1, is_sample: true, qty: 12, model_name: 'MODEL A', variant_name: 'BLUE', koli_sequence: 2 },
      { id: 2, is_sample: false, qty: 9, model_name: 'MODEL B' },
    ],
    qcItems: [
      { id: 10, inbound_unload_id: 1, qc_type: 'INITIAL', qty_a: 4, qty_b: 1, qty_c: 0 },
      { id: 11, inbound_unload_id: 1, qc_type: 'RE_QC', qty_a: 2, qty_b: 0, qty_c: 0 },
      { id: 12, inbound_unload_id: 2, qc_type: 'INITIAL', qty_a: 9, qty_b: 0, qty_c: 0 },
    ],
  })

  assert.equal(rows.length, 1)
  assert.deepEqual(
    { model: rows[0].model_name, sample: rows[0].sampleQty, checked: rows[0].checkedQty, a: rows[0].a, b: rows[0].b },
    { model: 'MODEL A', sample: 12, checked: 5, a: 4, b: 1 }
  )
})

test('QC sample splits replace parent grades instead of doubling them', () => {
  const rows = buildSampleQcRows({
    sampleRows: [{ id: 3, is_sample: true, is_product_temporary: true, qty: 10, koli_sequence: 1 }],
    qcItems: [{ id: 20, inbound_unload_id: 3, qc_type: 'INITIAL', qty_a: 7, qty_b: 2, qty_c: 1 }],
    sampleBreakdowns: [
      { id: 30, inbound_unload_id: 3, product_model_variant_id: 101, model_name: 'MODEL A', variant_name: 'BLUE', qty: 6 },
      { id: 31, inbound_unload_id: 3, product_model_variant_id: 102, model_name: 'MODEL A', variant_name: 'RED', qty: 4 },
    ],
    qcSplits: [
      { sample_breakdown_id: 30, qc_item_id: 20, qty_a: 4, qty_b: 1, qty_c: 1 },
      { sample_breakdown_id: 31, qc_item_id: 20, qty_a: 3, qty_b: 1, qty_c: 0 },
      { sample_breakdown_id: 31, qc_item_id: 99, qty_a: 100, qty_b: 0, qty_c: 0 },
    ],
  })

  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((row) => [row.variant_name, row.sampleQty, row.checkedQty]), [
    ['BLUE', 6, 6],
    ['RED', 4, 4],
  ])
  assert.equal(rows.reduce((sum, row) => sum + row.checkedQty, 0), 10)
})

test('unassigned QC grades remain visible when only part of a sample is split', () => {
  const rows = buildSampleQcRows({
    sampleRows: [{ id: 4, is_sample: true, is_product_temporary: true, qty: 10 }],
    qcItems: [{ id: 21, inbound_unload_id: 4, qty_a: 7, qty_b: 1, qty_c: 0 }],
    sampleBreakdowns: [{ id: 32, inbound_unload_id: 4, model_name: 'MODEL C', variant_name: 'GREEN', qty: 6 }],
    qcSplits: [{ sample_breakdown_id: 32, qc_item_id: 21, qty_a: 5, qty_b: 0, qty_c: 0 }],
  })

  assert.deepEqual(rows.map((row) => [row.sampleQty, row.checkedQty]), [[6, 5], [4, 3]])
  assert.equal(rows[1].model_name, 'Sample not split by model')
})

test('sample without QC is still shown with zero checked', () => {
  const rows = buildSampleQcRows({
    sampleRows: [{ id: 5, is_sample: true, qty: 8, is_product_temporary: true }],
  })

  assert.equal(rows[0].sampleQty, 8)
  assert.equal(rows[0].checkedQty, 0)
})

test('legacy sample with model breakdown uses the split grades', () => {
  const rows = buildSampleQcRows({
    sampleRows: [{ id: 6, is_sample: true, is_product_temporary: false, qty: 3, model_name: 'OLD MODEL' }],
    qcItems: [{ id: 22, inbound_unload_id: 6, qc_type: 'INITIAL', qty_a: 2, qty_b: 0, qty_c: 1 }],
    sampleBreakdowns: [
      { id: 33, inbound_unload_id: 6, model_name: 'CORRECT MODEL', variant_name: 'BLACK', qty: 3 },
    ],
    qcSplits: [{ sample_breakdown_id: 33, qc_item_id: 22, qty_a: 2, qty_b: 0, qty_c: 1 }],
  })

  assert.equal(rows.length, 1)
  assert.equal(rows[0].model_name, 'CORRECT MODEL')
  assert.equal(rows[0].checkedQty, 3)
})

test('groups sample QC by brand and category with percentages from each row total', () => {
  const rows = groupSampleQcByCategory([
    { brand_id: 1, category_id: 10, a: 12, b: 0, c: 8 },
    { brand_id: 1, category_id: 10, a: 10, b: 0, c: 20 },
    { brand_id: 2, category_id: 11, a: 14, b: 0, c: 16 },
  ])

  assert.deepEqual(rows, [
    { brand_id: 1, category_id: 10, a: 22, b: 0, c: 28 },
    { brand_id: 2, category_id: 11, a: 14, b: 0, c: 16 },
  ])
  assert.equal(sampleQcGradePercentage(rows[0].a, rows[0]), 44)
  assert.equal(sampleQcGradePercentage(rows[0].c, rows[0]), 56)
  assert.equal(sampleQcGradePercentage(rows[1].a, rows[1]), 46.7)
  assert.equal(sampleQcGradePercentage(0, { a: 0, b: 0, c: 0 }), 0)
})
