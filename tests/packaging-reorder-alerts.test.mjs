import test from 'node:test'
import assert from 'node:assert/strict'
import { getPackagingReorderAlerts, getPackagingReorderAnnouncement } from '../utils/packaging-reorder-alerts.mjs'

test('warns at either fixed or consumption threshold without treating unused zero as an alert', () => {
  const items = [
    { id: 1, name: 'Tape', unit: 'roll', active: true, qty: 5, reorder_point_qty: 5, coverage_days: 14 },
    { id: 2, name: 'Card', unit: 'pcs', active: true, qty: 3, reorder_point_qty: 1, coverage_days: 14 },
    { id: 3, name: 'Bag', unit: 'pcs', active: true, qty: 0, reorder_point_qty: null, coverage_days: 14 },
    { id: 4, name: 'Sticker', unit: 'sheet', active: false, qty: 0, reorder_point_qty: 10, coverage_days: 14 },
  ]
  const outbound = [{ item_id: 2, out_qty: 9 }]
  const alerts = getPackagingReorderAlerts(items, outbound)
  assert.deepEqual(alerts.map((item) => [item.name, item.reasons]), [
    ['Card', ['Consumption 5']], ['Tape', ['Fixed 5']],
  ])
  assert.match(getPackagingReorderAnnouncement(items, outbound).message, /Card: 3 pcs.*Tape: 5 roll/)
  assert.equal(getPackagingReorderAnnouncement(items.slice(2, 3), []), null)
})
