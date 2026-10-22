import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildArklineImportPreview,
  parseArklineSku,
  parseArklineWorkbookRows,
} from '../app/dashboard/storage/arkline-upload.js'

const day = '2026-10-09'
const line = (qty = 5) => ({
  rowNumber: 2,
  orderNumber: 'ORDER-1',
  orderStatus: 'PROCESSING',
  skuId: 'ARK01SSP019',
  productName: 'Gentle Polo Shirt',
  variationRaw: 'ARK01SSP019LOWHITE',
  size: 'L',
  orderDate: day,
  qty,
  included: true,
  exclusionReason: '',
})
const shelf = (qty, group = 'ARKLINE', type = 'SHELVING') => ({
  sku_id: 'ARK01SSP019',
  size: 'L',
  qty,
  location: { group_code: group, location_type: type },
})
const pick = (requested = 1, fulfilled = 4) => ({
  request_status: 'completed',
  source_sku_id: 'ARK01SSP019',
  size: 'L',
  qty: requested,
  fulfilled_qty: fulfilled,
  rejected_qty: 0,
  sales_upload_credited_qty: 0,
  completed_at: '2026-10-09T05:00:00Z',
})

test('Arkline export SKU is split into product SKU and size', () => {
  assert.deepEqual(parseArklineSku('ARK01SSP019LOWHITE'), {
    sku: 'ARK01SSP019', size: 'L', color: 'OWHITE',
  })
  assert.equal(parseArklineSku('invalid'), null)
  assert.deepEqual(parseArklineSku('ARK01LSP022LCREAM'), {
    sku: 'ARK01LSP022', size: 'L', color: 'CREAM',
  })
})

test('Arkline workbook rows accept processing and preserve transaction date', () => {
  const rows = parseArklineWorkbookRows([
    ['SKU', 'Nama Barang', 'No Pesanan', 'Tanggal', 'QTY', 'Status'],
    ['ARK01SSP019LOWHITE', 'Gentle Polo Shirt', 'ORDER-1', new Date('2026-10-09T03:00:00Z'), 1, 'PROCESSING'],
  ])
  assert.equal(rows[0].skuId, 'ARK01SSP019')
  assert.equal(rows[0].size, 'L')
  assert.equal(rows[0].orderDate, day)
  assert.equal(rows[0].included, true)
})

test('Arkline Orders count unique invoice numbers when invoice and order columns exist', () => {
  const rows = parseArklineWorkbookRows([
    ['SKU', 'Nama Barang', 'No Pesanan', 'Nomor Invoice', 'Tanggal', 'QTY', 'Status'],
    ['ARK01SSP019LOWHITE', 'Gentle Polo Shirt', 'ORDER-1', 'INV-1', day, 1, 'PROCESSING'],
    ['ARK01SSP019LOWHITE', 'Gentle Polo Shirt', 'ORDER-2', 'INV-1', day, 1, 'PROCESSING'],
    ['ARK01SSP019LOWHITE', 'Gentle Polo Shirt', 'ORDER-3', 'INV-2', day, 1, 'SHIPPED'],
  ])
  assert.deepEqual(rows.map((row) => row.orderNumber), ['INV-1', 'INV-1', 'INV-2'])
  assert.equal(buildArklineImportPreview(rows, [shelf(3)]).orderCount, 2)
})

test('picker handoff is credited once, excess putaway remains on the shelf', () => {
  const beforePutaway = buildArklineImportPreview([line()], [shelf(4)], [pick()])
  assert.equal(beforePutaway.pickOffsetQty, 1)
  assert.equal(beforePutaway.appliedQty, 4)
  assert.equal(beforePutaway.lines[0].balanceAfter, 0)

  const afterPutaway = buildArklineImportPreview([line()], [shelf(7)], [pick()])
  assert.equal(afterPutaway.lines[0].balanceAfter, 3)
})

test('six sales with one completed pick settle an eight-piece shelf balance to three', () => {
  const preview = buildArklineImportPreview([line(6)], [shelf(5 + (4 - 1))], [pick(1, 4)])
  assert.equal(preview.pickOffsetQty, 1)
  assert.equal(preview.appliedQty, 5)
  assert.equal(preview.lines[0].balanceAfter, 3)
})

test('credits only the actually fulfilled picker quantity', () => {
  const preview = buildArklineImportPreview([line()], [shelf(7)], [pick(3, 1)])
  assert.equal(preview.pickOffsetQty, 1)
  assert.equal(preview.appliedQty, 4)
})

test('reject from pallet restock is not credited against sales upload', () => {
  const preview = buildArklineImportPreview([line(12)], [shelf(13)], [
    { ...pick(2, 5), rejected_qty: 1 },
  ])
  assert.equal(preview.pickOffsetQty, 1)
  assert.equal(preview.appliedQty, 11)
  assert.equal(preview.lines[0].balanceAfter, 2)
})

test('one picker handoff cannot credit two sales lines', () => {
  const second = { ...line(1), rowNumber: 3, orderNumber: 'ORDER-2' }
  const preview = buildArklineImportPreview([line(1), second], [shelf(4)], [pick()])
  assert.deepEqual(preview.lines.map((entry) => entry.pickOffsetQty), [1, 0])
})

test('only Arkline shelving counts, and negative balances remain visible', () => {
  const preview = buildArklineImportPreview(
    [line()],
    [shelf(2), shelf(20, 'ARKLINE', 'PALLET'), shelf(20, 'MOB')],
    [pick()]
  )
  assert.equal(preview.appliedQty, 4)
  assert.equal(preview.lines[0].balanceAfter, -2)
})

test('missing Arkline shelving row is skipped, but an existing zero row may go negative', () => {
  const missing = buildArklineImportPreview([line()], [], [pick()])
  assert.equal(missing.pickOffsetQty, 1)
  assert.equal(missing.appliedQty, 0)
  assert.equal(missing.skippedQty, 4)
  assert.equal(missing.lines[0].balanceAfter, null)

  const zeroRow = buildArklineImportPreview([line()], [shelf(0)], [pick()])
  assert.equal(zeroRow.appliedQty, 4)
  assert.equal(zeroRow.skippedQty, 0)
  assert.equal(zeroRow.lines[0].balanceAfter, -4)
})
