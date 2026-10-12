const ARKLINE_SKU_PATTERN = /^(ARK\d{2}[A-Z]{3}\d{3})(8XL|7XL|6XL|5XL|4XL|3XL|XXXL|2XL|XXL|XXS|XL|XS|L|M|S)([A-Z0-9]*)$/
const ARKLINE_ORDER_STATUSES = new Set(['PROCESSING', 'SHIPPED'])

export function parseArklineSku(value) {
  const raw = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const match = raw.match(ARKLINE_SKU_PATTERN)
  return match ? { sku: match[1], size: match[2], color: match[3] } : null
}

export function parseArklineDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const raw = String(value ?? '').trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const local = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (local) return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`
  return ''
}

export function parseArklineWorkbookRows(rows) {
  if (!rows?.length) throw new Error('Arkline file is empty.')
  const [headers, ...body] = rows
  const map = new Map(headers.map((header, index) => [String(header ?? '').trim().toUpperCase(), index]))
  const required = ['SKU', 'NAMA BARANG', 'NO PESANAN', 'TANGGAL', 'QTY', 'STATUS']
  const missing = required.filter((name) => !map.has(name))
  if (missing.length) throw new Error(`Arkline file is missing: ${missing.join(', ')}.`)

  const value = (row, name) => row[map.get(name)]
  return body.map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim()))
    .map(({ row, rowNumber }) => {
    const parsed = parseArklineSku(value(row, 'SKU'))
    const status = String(value(row, 'STATUS') ?? '').trim().toUpperCase()
    const qty = Number(value(row, 'QTY'))
    const orderDate = parseArklineDate(value(row, 'TANGGAL'))
    const orderNumber = String(value(row, 'NO PESANAN') ?? '').trim()
    const exclusionReason = !parsed ? 'Invalid Arkline SKU or size'
      : !orderDate ? 'Missing order date'
        : !orderNumber ? 'Missing order number'
          : !Number.isInteger(qty) || qty <= 0 ? 'Qty must be a whole number greater than 0'
            : !ARKLINE_ORDER_STATUSES.has(status) ? `Status ${status || '-'} is not included` : ''

    return {
      rowNumber,
      orderNumber,
      orderStatus: status,
      skuId: parsed?.sku || String(value(row, 'SKU') ?? '').trim().toUpperCase(),
      productName: String(value(row, 'NAMA BARANG') ?? '').trim(),
      variationRaw: String(value(row, 'SKU') ?? '').trim(),
      size: parsed?.size || '-',
      orderDate,
      qty: Number.isInteger(qty) && qty > 0 ? qty : 0,
      included: !exclusionReason,
      exclusionReason,
    }
  })
}

function normalizeKey(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function arklineKey(sku, size, day) {
  return `${normalizeKey(sku)}::${normalizeKey(size)}::${day}`
}

function jakartaDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function baseSku(value) {
  const normalized = normalizeKey(value)
  return normalized.match(/^ARK\d{2}[A-Z]{3}\d{3}/)?.[0] || ''
}

export function buildArklineImportPreview(parsedLines, storageRows = [], pickRows = []) {
  const stock = new Map()
  const shelvingKeys = new Set()
  storageRows.forEach((row) => {
    const location = row.location || {}
    if (normalizeKey(location.group_code || row.group_code) !== 'ARKLINE') return
    if (normalizeKey(location.location_type || row.location_type) !== 'SHELVING') return
    const sku = baseSku(row.sku_id || row.source_variant_code || row.item_name)
    if (!sku) return
    const key = arklineKey(sku, row.size || '-', '')
    shelvingKeys.add(key)
    stock.set(key, Number(stock.get(key) || 0) + Number(row.qty || 0))
  })

  const picks = new Map()
  pickRows.filter((row) => row.request_status === 'completed').forEach((row) => {
    const sku = baseSku(row.source_sku_id) || baseSku(row.search_term)
    const day = jakartaDate(row.completed_at)
    if (!sku || !day) return
    const handoff = Math.min(Number(row.qty || 0), Number(row.fulfilled_qty ?? row.qty ?? 0))
    const credit = Math.max(0, handoff - Number(row.sales_upload_credited_qty || 0))
    if (credit <= 0) return
    const key = arklineKey(sku, row.size || '-', day)
    picks.set(key, Number(picks.get(key) || 0) + credit)
  })

  const duplicateKeys = new Map()
  const lines = parsedLines.map((line) => {
    const result = { ...line, pickOffsetQty: 0, appliedQty: 0, skippedQty: 0, availableQtySnapshot: 0, balanceAfter: 0 }
    if (!line.included) return result
    const pickKey = arklineKey(line.skuId, line.size, line.orderDate)
    const stockKey = arklineKey(line.skuId, line.size, '')
    const pickOffsetQty = Math.min(line.qty, Number(picks.get(pickKey) || 0))
    const deduction = line.qty - pickOffsetQty
    const available = Number(stock.get(stockKey) || 0)
    picks.set(pickKey, Number(picks.get(pickKey) || 0) - pickOffsetQty)
    const hasShelving = shelvingKeys.has(stockKey)
    if (hasShelving) stock.set(stockKey, available - deduction)
    const duplicateKey = `${line.orderNumber}::${line.skuId}::${line.size}`
    duplicateKeys.set(duplicateKey, Number(duplicateKeys.get(duplicateKey) || 0) + 1)
    return {
      ...result,
      pickOffsetQty,
      appliedQty: hasShelving ? deduction : 0,
      skippedQty: hasShelving ? 0 : deduction,
      availableQtySnapshot: Math.max(0, available),
      balanceAfter: hasShelving ? available - deduction : null,
    }
  })

  const included = lines.filter((line) => line.included)
  return {
    lines,
    totalCsvRows: lines.length,
    orderCount: new Set(lines.map((line) => line.orderNumber).filter(Boolean)).size,
    totalOrderLines: lines.filter((line) => line.qty > 0).length,
    includedLines: included.length,
    excludedLines: lines.length - included.length,
    requestedQty: included.reduce((sum, line) => sum + line.qty, 0),
    pickOffsetQty: included.reduce((sum, line) => sum + line.pickOffsetQty, 0),
    appliedQty: included.reduce((sum, line) => sum + line.appliedQty, 0),
    skippedQty: included.reduce((sum, line) => sum + line.skippedQty, 0),
    duplicateOrderCount: Array.from(duplicateKeys.values()).reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    shortageLineCount: included.filter((line) => typeof line.balanceAfter === 'number' && line.balanceAfter < 0).length,
    missingSkuCount: lines.filter((line) => line.exclusionReason === 'Invalid Arkline SKU or size').length,
  }
}
