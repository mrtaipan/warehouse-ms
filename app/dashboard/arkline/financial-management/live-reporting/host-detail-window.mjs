export function hasHostDetailFilters(filters) {
  return filters.channel !== 'ALL' || filters.type !== 'ALL' || filters.partner !== 'ALL' ||
    Boolean(filters.date_from || filters.date_to || filters.time_from || filters.time_to)
}

export function showHostDetailCredits(rows, filters, today) {
  if (hasHostDetailFilters(filters)) return rows
  const firstDay = new Date(`${today}T00:00:00Z`)
  firstDay.setUTCDate(firstDay.getUTCDate() - 6)
  const cutoff = firstDay.toISOString().slice(0, 10)
  return rows.filter((row) => row.session_date >= cutoff && row.session_date <= today)
}
