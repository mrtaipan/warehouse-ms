export function normalizeDeliverySku(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isArklineDeliveryProduct(row, directorySkus = new Set()) {
  if (String(row?.group_code || '').trim().toUpperCase() === 'ARKLINE') return true

  const sku = normalizeDeliverySku(row?.sku)
  if (!sku) return false

  return /^ARK[0-9]{2}[A-Z]{3}[0-9]{3}/.test(sku) || directorySkus.has(sku)
}
