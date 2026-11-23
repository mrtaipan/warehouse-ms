import assert from 'node:assert/strict'
import test from 'node:test'
import { getGrnRejectionRemaining } from '../utils/grn-rejection-remaining.mjs'

function qcRow(overrides = {}) {
  return {
    id: 1,
    status: 'done',
    model_name: 'Jacket',
    variant_name: 'Black',
    qty_b: 8,
    qty_c: 5,
    inbound_unload: { id: 11, brand_id: 2, category_id: 3, is_sample: false },
    ...overrides,
  }
}

function processedRow(overrides = {}) {
  return { brand_id: 2, category_id: 3, model_name: 'Jacket', variant_name: 'Black', ...overrides }
}

test('subtracts confirmed and returned rejection quantities per grade', () => {
  const result = getGrnRejectionRemaining({
    qcRows: [qcRow()],
    qcConfirmRows: [processedRow({ grade: 'A', source_grade: 'B', adjustment_type: 'TRANSFER', is_adjustment: true, qty: 3 })],
    returnRows: [processedRow({ source_phase: 'qc', grade: 'C', qty: 2 })],
  })

  assert.deepEqual(result, { byGrade: { A: 0, B: 5, C: 3 }, total: 8 })
})

test('does not hide pending stock from another model or return a negative remaining', () => {
  const result = getGrnRejectionRemaining({
    qcRows: [qcRow({ qty_b: 2, qty_c: 0 }), qcRow({ id: 2, model_name: 'Pants', qty_b: 4, qty_c: 0 })],
    returnRows: [processedRow({ source_phase: 'qc', grade: 'B', qty: 5 })],
  })

  assert.deepEqual(result, { byGrade: { A: 0, B: 4, C: 0 }, total: 4 })
})

test('returns no pending grades once every rejection has been processed', () => {
  const result = getGrnRejectionRemaining({
    qcRows: [qcRow({ qty_b: 2, qty_c: 1 })],
    qcConfirmRows: [processedRow({ grade: 'B', qty: 2 })],
    returnRows: [processedRow({ source_phase: 'qc', grade: 'C', qty: 1 })],
  })

  assert.deepEqual(result, { byGrade: { A: 0, B: 0, C: 0 }, total: 0 })
})

test('matches a renamed variant by product variant id', () => {
  const result = getGrnRejectionRemaining({
    qcRows: [qcRow({ product_model_variant_id: 1535, variant_name: 'Sage Green', qty_b: 0, qty_c: 14 })],
    returnRows: [processedRow({ product_model_variant_id: 1535, source_variant_code: 'BKM01LSS001-003', variant_name: 'Blue Grey', source_phase: 'qc', grade: 'C', qty: 14 })],
  })

  assert.deepEqual(result, { byGrade: { A: 0, B: 0, C: 0 }, total: 0 })
})

test('keeps identical labels with different variant ids separate', () => {
  const result = getGrnRejectionRemaining({
    qcRows: [
      qcRow({ id: 1, product_model_variant_id: 10, qty_b: 0, qty_c: 2 }),
      qcRow({ id: 2, product_model_variant_id: 11, qty_b: 0, qty_c: 3 }),
    ],
    returnRows: [processedRow({ product_model_variant_id: 10, source_phase: 'qc', grade: 'C', qty: 2 })],
  })

  assert.deepEqual(result, { byGrade: { A: 0, B: 0, C: 3 }, total: 3 })
})

test('counts resolved sample breakdowns without temporary sample task duplication', () => {
  const result = getGrnRejectionRemaining({
    qcRows: [qcRow({ inbound_unload: { id: 11, is_sample: true, is_product_temporary: true }, qty_b: 20, qty_c: 0 })],
    sampleBreakdownRows: [{ id: 20, inbound_unload_id: 11, brand_id: 2, category_id: 3, model_name: 'Jacket', variant_name: 'Black', resolution_status: 'resolved' }],
    qcSampleRows: [{ qc_item_id: 1, sample_breakdown_id: 20, qty_b: 3, qty_c: 1 }],
  })

  assert.deepEqual(result, { byGrade: { A: 0, B: 3, C: 1 }, total: 4 })
})

test('includes Grade A only when an entire sample source is marked full return', () => {
  const result = getGrnRejectionRemaining({
    qcRows: [qcRow({ inbound_unload: { id: 11, brand_id: 2, category_id: 3, is_sample: true }, qty_a: 2, qty_b: 1, qty_c: 0 })],
    sampleBreakdownRows: [{ id: 20, inbound_unload_id: 11, resolution_status: 'full_return' }],
  })

  assert.deepEqual(result, { byGrade: { A: 2, B: 1, C: 0 }, total: 3 })
})
