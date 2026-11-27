export const DELIVERY_ACCESS_CONFIGURED = 'delivery_report.configured.visible'
export const DELIVERY_PERMISSION_ITEMS = [
  ['summary', 'Delivery Summary'],
  ['summary.metrics', 'Scan Metrics & Progress'],
  ['summary.matrix', 'Shortage & Delivery Matrix'],
  ['summary.courier', 'Courier Composition'],
  ['summary.order_chart', 'Order Chart'],
  ['orders', 'Delivery Order'],
  ['scanner', 'Barcode Scanner'],
  ['resolution', 'Resolution Center'],
  ['waybill', 'Manual Waybill'],
].map(([key, label]) => ({ key, label, code: `delivery_report.${key}.view` }))

export function getDeliveryAccessCodes(permissions = [], isAdmin = false) {
  const codes = new Set(permissions)
  if (!isAdmin && !codes.has('delivery_report.view')) return []
  // Existing roles retain their current access until granular settings are saved.
  const legacy = isAdmin || !codes.has(DELIVERY_ACCESS_CONFIGURED)
  return DELIVERY_PERMISSION_ITEMS.filter(({ key, code }) =>
    legacy || (codes.has(code) && (!key.startsWith('summary.') || codes.has('delivery_report.summary.view')))
  ).map(({ code }) => code)
}

export function getDeliveryAccess(permissions = [], isAdmin = false) {
  const codes = new Set(getDeliveryAccessCodes(permissions, isAdmin))
  return Object.fromEntries(DELIVERY_PERMISSION_ITEMS.map(({ key, code }) => [key, codes.has(code)]))
}
