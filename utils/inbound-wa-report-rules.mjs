export function inboundReportTarget(inbound) {
  const sj = inbound?.total_claimed_qty
  const received = inbound?.total_received_qty
  const raw = sj == null ? received : sj
  const value = Number(raw)
  return raw == null || !Number.isFinite(value) || value <= 0 ? null : value
}

export function inboundReportReady(inbound, intakeQty, tolerance = 20) {
  const targetQty = inboundReportTarget(inbound)
  const currentQty = Number(intakeQty)
  return {
    targetQty,
    intakeQty: Number.isFinite(currentQty) ? currentQty : 0,
    ready: targetQty != null && Number.isFinite(currentQty) && currentQty > 0 &&
      Math.abs(currentQty - targetQty) <= tolerance,
  }
}

export function parseGrnReportRequest(message) {
  const match = /^\s*laporan\s+grn\s+#?(\d{1,4})(?:-([IVX]+)(\d{4}))?\s*[.!]?\s*$/i.exec(String(message || ''))
  if (!match) return null
  return match[2]
    ? `#${match[1].padStart(3, '0')}-${match[2].toUpperCase()}${match[3]}`
    : `#${match[1].padStart(3, '0')}`
}
