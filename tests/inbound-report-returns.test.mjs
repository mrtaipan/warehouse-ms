import test from 'node:test'
import assert from 'node:assert/strict'
import { loadInboundReturnSummary, summarizeInboundReturns } from '../utils/inbound-report-returns.mjs'

test('only inbound returns contribute to the total and reasons are grouped', () => {
  assert.deepEqual(summarizeInboundReturns([
    { source_phase: 'inbound', qty: 3, return_reason: 'Damaged' },
    { source_phase: 'inbound', qty: 2, return_reason: ' damaged ' },
    { source_phase: 'inbound', qty: 1, return_reason: null },
    { source_phase: 'qc', qty: 40, return_reason: 'Failed QC' },
  ]), {
    inboundReturnQty: 6,
    returnReasons: [{ reason: 'Damaged', qty: 5 }, { reason: 'Not specified', qty: 1 }],
  })
})

test('return summary loads every page for the selected GRN', async () => {
  const rows = Array.from({ length: 1001 }, () => ({ source_phase: 'inbound', qty: 1, return_reason: 'Wrong item' }))
  const calls = []
  const client = {
    from(table) {
      assert.equal(table, 'warehouse_returns')
      return {
        select() { return this },
        eq(field, value) { calls.push([field, value]); return this },
        order() { return this },
        async range(from, to) { return { data: rows.slice(from, to + 1), error: null } },
      }
    },
  }

  assert.deepEqual(await loadInboundReturnSummary(client, 35), {
    inboundReturnQty: 1001,
    returnReasons: [{ reason: 'Wrong item', qty: 1001 }],
  })
  assert.deepEqual(calls, [
    ['inbound_id', 35], ['source_phase', 'inbound'],
    ['inbound_id', 35], ['source_phase', 'inbound'],
  ])
})
