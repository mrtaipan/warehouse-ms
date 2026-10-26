// Use ISO keys, not display labels, so different years never share a bucket.
export function buildOrderTrend(orders, period, groups) {
  const buckets = new Map()
  const options = period === 'YEAR' ? { year: 'numeric' }
    : period === 'MONTH' ? { month: 'short', year: '2-digit' }
      : { day: '2-digit', month: 'short', year: '2-digit' }
  const formatter = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' })

  for (const row of orders) {
    const isoDate = String(row.delivery_date || '').slice(0, 10)
    if (!groups.includes(row.group_order) || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue
    const date = new Date(`${isoDate}T00:00:00Z`)
    if (!Number.isFinite(date.getTime())) continue
    const key = isoDate.slice(0, period === 'YEAR' ? 4 : period === 'MONTH' ? 7 : 10)
    if (!buckets.has(key)) {
      buckets.set(key, { label: formatter.format(date), TOTAL: 0, ...Object.fromEntries(groups.map((group) => [group, 0])) })
    }
    const bucket = buckets.get(key)
    const quantity = Number(row.quantity) || 0
    bucket[row.group_order] += quantity
    bucket.TOTAL += quantity
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value)
}
