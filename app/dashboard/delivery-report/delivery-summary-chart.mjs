// Use ISO keys, not display labels, so different years never share a bucket.
export function buildOrderTrend(orders, period, groups, fromDate, toDate) {
  if (!orders.length) return []
  const buckets = new Map()
  const options = period === 'YEAR' ? { year: 'numeric' }
    : period === 'MONTH' ? { month: 'short', year: '2-digit' }
      : { day: '2-digit', month: 'short', year: '2-digit' }
  const formatter = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' })

  const rangeStart = String(fromDate || '').slice(0, 10)
  const rangeEnd = String(toDate || '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(rangeStart) && /^\d{4}-\d{2}-\d{2}$/.test(rangeEnd)) {
    let cursor = new Date(`${rangeStart}T00:00:00Z`)
    const end = new Date(`${rangeEnd}T00:00:00Z`)
    if (period === 'MONTH') cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1))
    if (period === 'YEAR') cursor = new Date(Date.UTC(cursor.getUTCFullYear(), 0, 1))
    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10)
      const key = date.slice(0, period === 'YEAR' ? 4 : period === 'MONTH' ? 7 : 10)
      buckets.set(key, { dateKey: key, label: formatter.format(cursor), TOTAL: 0, ...Object.fromEntries(groups.map((group) => [group, 0])) })
      if (period === 'YEAR') cursor = new Date(Date.UTC(cursor.getUTCFullYear() + 1, 0, 1))
      else if (period === 'MONTH') cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
      else cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1))
    }
  }

  for (const row of orders) {
    const isoDate = String(row.delivery_date || '').slice(0, 10)
    if (!groups.includes(row.group_order) || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue
    const date = new Date(`${isoDate}T00:00:00Z`)
    if (!Number.isFinite(date.getTime())) continue
    const key = isoDate.slice(0, period === 'YEAR' ? 4 : period === 'MONTH' ? 7 : 10)
    if (!buckets.has(key)) {
      buckets.set(key, { dateKey: key, label: formatter.format(date), TOTAL: 0, ...Object.fromEntries(groups.map((group) => [group, 0])) })
    }
    const bucket = buckets.get(key)
    const quantity = Number(row.quantity) || 0
    bucket[row.group_order] += quantity
    bucket.TOTAL += quantity
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value)
}
