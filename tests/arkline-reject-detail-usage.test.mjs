import assert from 'node:assert/strict'
import test from 'node:test'
import { buildArklineRejectDetailUsage, clampArklineRejectDraftQty, getArklineRejectUsageBreakdown, mergeArklineRejectDraftRows } from '../utils/arkline-reject-detail-usage.mjs'

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
  assert.equal(usage.sentQtyByKey.get('B|||reason-2|||L'), 3)
  assert.equal(usage.storedQtyByKey.get('B|||reason-2|||L'), 4)
})

test('ignores usage rows that do not reference selected reject details', () => {
  const details = [{ id: 'detail-1', arkline_qc_id: 'task-1', grade: 'B', reject_reason_id: 'reason-2', size: 'L', qty: 10 }]
  const usage = buildArklineRejectDetailUsage(details, [{ reject_detail_id: 'other-detail', qty: 9 }], [])

  assert.equal(usage.usedQtyByDetailId.size, 0)
  assert.equal(usage.usedQtyByKey.size, 0)
  assert.equal(usage.sentQtyByKey.size, 0)
})

test('merges duplicate draft keys before subtracting sent quantity once', () => {
  const rows = mergeArklineRejectDraftRows([
    { grade: 'C', rejectReasonId: 'reason-1', size: 'm', qty: 2 },
    { grade: 'C', rejectReasonId: 'reason-1', size: 'M', qty: 3 },
    { grade: 'C', rejectReasonId: 'reason-2', size: 'M', qty: 4 },
  ])

  assert.deepEqual(rows.map((row) => row.qty), [5, 4])
  assert.equal(rows[0].qty - 3, 2)
})

test('clamps edited reject qty to the sent or stored quantity', () => {
  assert.equal(clampArklineRejectDraftQty('', 6), '6')
  assert.equal(clampArklineRejectDraftQty('0', 6), '6')
  assert.equal(clampArklineRejectDraftQty('5', 6), '6')
  assert.equal(clampArklineRejectDraftQty('28', 6), '28')
  assert.equal(clampArklineRejectDraftQty('0', 0), '0')
})

test('historical return reduces availability even when the reason is now unrepairable', () => {
  assert.deepEqual(getArklineRejectUsageBreakdown(5, 2, 0), {
    sentQty: 2,
    storedQty: 0,
    processedQty: 2,
    availableQty: 3,
  })
  assert.deepEqual(getArklineRejectUsageBreakdown(50, 6, 0), {
    sentQty: 6,
    storedQty: 0,
    processedQty: 6,
    availableQty: 44,
  })
})
