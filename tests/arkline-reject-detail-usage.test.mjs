import assert from 'node:assert/strict'
import test from 'node:test'
import { buildArklineRejectDetailUsage } from '../utils/arkline-reject-detail-usage.mjs'

test('locks only the quantity actually sent for return or stored', () => {
  const details = [{ id: 'detail-1', arkline_qc_id: 'task-1', grade: 'C', reject_reason_id: 'reason-1', size: 'M', qty: 10 }]
  const usage = buildArklineRejectDetailUsage(details, [{ reject_detail_id: 'detail-1', qty: 8 }], [])

  assert.equal(usage.usedQtyByDetailId.get('detail-1'), 8)
  assert.equal(usage.usedQtyByKey.get('C|||reason-1|||M'), 8)
  assert.equal(usage.usedQtyByTaskGrade.get('task-1|||C'), 8)
})

test('adds return and reject-storage usage for the same detail', () => {
  const details = [{ id: 'detail-1', arkline_qc_id: 'task-1', grade: 'B', reject_reason_id: 'reason-2', size: 'L', qty: 10 }]
  const usage = buildArklineRejectDetailUsage(
    details,
    [{ reject_detail_id: 'detail-1', qty: 3 }],
    [{ reject_detail_id: 'detail-1', qty: 4 }]
  )

  assert.equal(usage.usedQtyByDetailId.get('detail-1'), 7)
  assert.equal(usage.usedQtyByKey.get('B|||reason-2|||L'), 7)
})

test('ignores usage rows that do not reference selected reject details', () => {
  const details = [{ id: 'detail-1', arkline_qc_id: 'task-1', grade: 'B', reject_reason_id: 'reason-2', size: 'L', qty: 10 }]
  const usage = buildArklineRejectDetailUsage(details, [{ reject_detail_id: 'other-detail', qty: 9 }], [])

  assert.equal(usage.usedQtyByDetailId.size, 0)
  assert.equal(usage.usedQtyByKey.size, 0)
})
