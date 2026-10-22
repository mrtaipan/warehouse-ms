import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMovementScope,
  combineWarehouseMovements,
  getJakartaDateOffset,
  getJakartaDateRange,
  getMovementTotals,
  getWarehouseLocationLabel,
} from '../app/dashboard/storage/warehouse-map/warehouse-map-movements.mjs'

const location = { id: 42, location_type: 'SHELVING', location_id: 'A8', location_code: '6', sub_location: 'A' }
const label = 'SHELVING / A8 / 6 / A'

test('defaults to the previous Jakarta day and filters its exact timezone range', () => {
  assert.equal(getJakartaDateOffset(-1, new Date('2026-10-20T17:30:00Z')), '2026-10-20')
  const range = getJakartaDateRange('2026-10-20')
  assert.deepEqual(range, {
    start: '2026-10-20T00:00:00+07:00',
    end: '2026-10-21T00:00:00+07:00',
  })
  assert.equal(new Date(range.start).toISOString(), '2026-10-19T17:00:00.000Z')
  assert.equal(new Date(range.end).toISOString(), '2026-10-20T17:00:00.000Z')
})

test('inbound and outbound badges sum quantity, not movement count', () => {
  assert.deepEqual(getMovementTotals([{ qty: 3 }, { qty: 2 }, { qty: -5 }, { qty: -1 }]), {
    inbound: 5,
    outbound: 6,
  })
})

test('builds exact movement scope from mapped location and current storage', () => {
  assert.equal(getWarehouseLocationLabel(location), label)
  assert.deepEqual(buildMovementScope([location], [{ id: 5 }, { id: 5 }]), {
    locationIds: [42],
    labels: [label],
    storageIds: [5],
  })
})

test('combines movements, upload, reversal, and completed restock with location-relative signs', () => {
  const scope = buildMovementScope([location], [{ id: 5 }])
  const rows = combineWarehouseMovements({
    scope,
    movements: [
      { id: 1, movement_type: 'MOVE', qty: 3, from_location_label: label, to_location_label: 'SHELVING / A8 / 7 / A', created_at: '2026-10-20T10:00:00Z' },
      { id: 2, movement_type: 'CUSTOMER_RETURN_IN', qty: 2, from_location_label: 'Customer return', to_location_label: label, created_at: '2026-10-20T11:00:00Z', warehouse_storage_id: null },
      { id: 3, movement_type: 'MOVE', qty: 1, from_location_label: 'SHELVING / A8 / 7 / A', to_location_label: 'SHELVING / A8 / 8 / A' },
      { id: 4, movement_type: 'PUTAWAY_IN', qty: 4, from_location_label: label, to_location_label: label, created_at: '2026-10-20T15:00:00Z' },
    ],
    uploads: [
      { id: 'a', rack_location_id: 42, movement_type: 'OUT', qty_delta: -4, created_at: '2026-10-20T12:00:00Z' },
      { id: 'b', rack_location_id: 42, movement_type: 'REVERSE', qty_delta: 1, created_at: '2026-10-20T13:00:00Z' },
      { id: 'c', rack_location_id: 43, movement_type: 'OUT', qty_delta: -5 },
    ],
    restocks: [
      { id: 'r', take_from: label, qty: 1, fulfilled_qty: 5, completed_at: '2026-10-20T14:00:00Z' },
      { id: 'other', take_from: 'SHELVING / A8 / 7 / A', storage_id: 5, qty: 2 },
    ],
  })

  assert.deepEqual(rows.map((row) => [row.label, row.qty]), [
    ['Stored to shelving', 4],
    ['Restock', -5],
    ['Upload reversal', 1],
    ['Sales upload', -4],
    ['Customer return', 2],
    ['Move', -3],
  ])
})

test('groups sales uploads per Jakarta day, SKU, size, and location without order separation', () => {
  const scope = buildMovementScope([location])
  const rows = combineWarehouseMovements({
    scope,
    uploads: [
      { id: 'a', rack_location_id: 42, movement_type: 'OUT', sku_id: 'ARK01HDO001', size: 'M', qty_delta: -1, reference_number: 'ORDER-1', created_at: '2026-10-20T10:00:00Z' },
      { id: 'b', rack_location_id: 42, movement_type: 'OUT', sku_id: 'ARK01HDO001', size: 'M', qty_delta: -2, reference_number: 'ORDER-2', created_at: '2026-10-20T16:30:00Z' },
      { id: 'c', rack_location_id: 42, movement_type: 'OUT', sku_id: 'ARK01HDO001', size: 'M', qty_delta: -4, created_at: '2026-10-20T17:30:00Z' },
      { id: 'd', rack_location_id: 42, movement_type: 'OUT', sku_id: 'ARK01HDO001', size: 'L', qty_delta: -5, created_at: '2026-10-20T11:00:00Z' },
      { id: 'e', rack_location_id: 42, movement_type: 'REVERSE', sku_id: 'ARK01HDO001', size: 'M', qty_delta: 1, created_at: '2026-10-20T12:00:00Z' },
      { id: 'f', rack_location_id: 43, movement_type: 'OUT', sku_id: 'ARK01HDO001', size: 'M', qty_delta: -9, created_at: '2026-10-20T12:00:00Z' },
    ],
  })

  assert.deepEqual(rows.map((row) => [row.label, row.size, row.qty]), [
    ['Sales upload', 'M', -4],
    ['Sales upload', 'M', -3],
    ['Upload reversal', 'M', 1],
    ['Sales upload', 'L', -5],
  ])
  assert.equal(rows[1].entryCount, 2)
  assert.equal(rows[1].dateLabel, 'Oct 20, 2026')
  assert.doesNotMatch(rows[1].detail, /ORDER-/)
})

test('restock source records fulfilled quantity while excess putaway only increases destination', () => {
  const pallet = { id: 10, location_type: 'PALLET', location_id: 'Warehouse LV 83', location_code: 'ARK.5E', sub_location: null }
  const palletLabel = 'PALLET / Warehouse LV 83 / ARK.5E'
  const palletScope = buildMovementScope([pallet])
  assert.deepEqual(palletScope.labels, [palletLabel, `${palletLabel} / null`, `${palletLabel} / `])

  const putaway = { id: 9, movement_type: 'PUTAWAY_IN', qty: 3, from_location_label: palletLabel, to_location_label: label, created_at: '2026-10-20T12:00:00Z' }
  const restock = { id: 'r', take_from: palletLabel, qty: 2, fulfilled_qty: 5, completed_at: '2026-10-20T12:00:00Z' }
  const sourceRows = combineWarehouseMovements({ scope: palletScope, movements: [putaway], restocks: [restock] })
  const destinationRows = combineWarehouseMovements({ scope: buildMovementScope([location]), movements: [putaway], restocks: [restock] })

  assert.deepEqual(sourceRows.map((row) => row.qty), [-5])
  assert.deepEqual(destinationRows.map((row) => row.qty), [3])
})
