import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../utils/inbound-overview-status.js', import.meta.url), 'utf8')
const { buildInboundOverviewStatusMap, INBOUND_OVERVIEW_STATUS } = await import(
  `data:text/javascript,${encodeURIComponent(source)}`
)

function statusFor({ qtyA = 0, qtyC = 145, returned = 145, packed = 0 } = {}) {
  return buildInboundOverviewStatusMap({
    inboundIds: [27],
    unloadRows: [{ inbound_id: 27, qty: 145, is_sample: true }],
    qcRows: [{ inbound_id: 27, qty_a: qtyA, qty_b: 0, qty_c: qtyC }],
    returnRows: [{ inbound_id: 27, qty: returned, source_phase: 'qc' }],
    packingRows: packed ? [{ inbound_id: 27, qty: packed }] : [],
  }).get(27)
}

test('fully returned QC result without Grade A is red in Inbound', () => {
  assert.equal(statusFor(), INBOUND_OVERVIEW_STATUS.FULL_RETURN)
})

test('partial QC return is not marked fully returned', () => {
  assert.notEqual(statusFor({ returned: 100 }), INBOUND_OVERVIEW_STATUS.FULL_RETURN)
})

test('Grade A or packed goods prevent a full-return status', () => {
  assert.notEqual(statusFor({ qtyA: 1 }), INBOUND_OVERVIEW_STATUS.FULL_RETURN)
  assert.notEqual(statusFor({ packed: 1 }), INBOUND_OVERVIEW_STATUS.FULL_RETURN)
})
