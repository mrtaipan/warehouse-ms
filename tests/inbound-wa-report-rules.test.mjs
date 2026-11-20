import test from 'node:test'
import assert from 'node:assert/strict'
import { inboundReportReady, parseGrnReportRequest } from '../utils/inbound-wa-report-rules.mjs'

test('SJ Qty is the target and Receiving Qty is used only when SJ is null', () => {
  assert.deepEqual(inboundReportReady({ total_claimed_qty: 3500, total_received_qty: 3400 }, 3480), {
    targetQty: 3500, intakeQty: 3480, ready: true,
  })
  assert.equal(inboundReportReady({ total_claimed_qty: 3500, total_received_qty: 3400 }, 3521).ready, false)
  assert.equal(inboundReportReady({ total_claimed_qty: 3500, total_received_qty: 3400 }, 3520).ready, true)
  assert.equal(inboundReportReady({ total_claimed_qty: 3500, total_received_qty: 3400 }, 3479).ready, false)
  assert.equal(inboundReportReady({ total_claimed_qty: null, total_received_qty: 3400 }, 3380).ready, true)
  assert.equal(inboundReportReady({ total_claimed_qty: 0, total_received_qty: 3400 }, 3390).ready, false)
  assert.equal(inboundReportReady({ total_claimed_qty: null, total_received_qty: null }, 0).ready, false)
})

test('GRN chat requests accept a complete or short number without interpreting other messages', () => {
  assert.equal(parseGrnReportRequest('Laporan GRN #035'), '#035')
  assert.equal(parseGrnReportRequest('laporan grn 35-XI2026'), '#035-XI2026')
  assert.equal(parseGrnReportRequest('Laporan GRN #1000-XI2026'), '#1000-XI2026')
  assert.equal(parseGrnReportRequest('Tolong hapus GRN #035'), null)
  assert.equal(parseGrnReportRequest('Laporan GRN #035 selain itu'), null)
})
