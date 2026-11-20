export function getPackagingReorderAlerts(items, outboundRows) {
  const outboundByItem = new Map((outboundRows || []).map((row) => [String(row.item_id), Number(row.out_qty) || 0]))

  return (items || []).filter((item) => item.active).map((item) => {
    const qty = Number(item.qty)
    const fixed = item.reorder_point_qty == null ? null : Number(item.reorder_point_qty)
    const consumption = Math.ceil((outboundByItem.get(String(item.id)) || 0) / 30 * Number(item.coverage_days || 14))
    const reasons = []
    if (fixed !== null && qty <= fixed) reasons.push(`Fixed ${fixed.toLocaleString()}`)
    if (consumption > 0 && qty <= consumption) reasons.push(`Consumption ${consumption.toLocaleString()}`)
    return { ...item, reasons }
  }).filter((item) => item.reasons.length)
    .sort((left, right) => left.qty - right.qty || left.name.localeCompare(right.name))
}

export function getPackagingReorderAnnouncement(items, outboundRows) {
  const alerts = getPackagingReorderAlerts(items, outboundRows)
  if (!alerts.length) return null
  const listed = alerts.slice(0, 3).map((item) => `${item.name}: ${item.qty.toLocaleString()} ${item.unit} (${item.reasons.join(', ')})`)
  return {
    id: 'packaging-reorder-alert',
    title: `${alerts.length} packaging ${alerts.length === 1 ? 'item needs' : 'items need'} reorder`,
    message: `${listed.join('; ')}${alerts.length > listed.length ? `; +${alerts.length - listed.length} more` : ''}.`,
    dateLabel: 'Packaging Supplies',
    href: '/dashboard/storage/overview?mode=packaging-supplies',
  }
}
