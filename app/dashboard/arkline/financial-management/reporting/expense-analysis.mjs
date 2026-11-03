export function monthKey(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).formatToParts(date)
  return `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`
}

export function shiftMonth(key, offset) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthsBetween(start, end) {
  const keys = []
  if (!start || !end || start > end) return keys
  for (let key = start; key <= end; key = shiftMonth(key, 1)) keys.push(key)
  return keys
}

export function analyzeExpenses(rows, start, end, category = 'ALL', source = 'ALL') {
  const months = monthsBetween(start, end)
  const scoped = rows.filter(row => (category === 'ALL' || row.category_name === category) && (source === 'ALL' || row.source === source))
  const selected = scoped.filter(row => row.month >= start && row.month <= end)
  const previousStart = shiftMonth(start, -months.length)
  const previous = scoped.filter(row => row.month >= previousStart && row.month < start)
  const sum = values => values.reduce((total, row) => total + row.amount, 0)
  const series = months.map(month => {
    const records = selected.filter(row => row.month === month)
    return { month, payment: sum(records.filter(row => row.source === 'PAYMENT')), reimbursement: sum(records.filter(row => row.source === 'REIMBURSEMENT')), total: sum(records), count: records.length }
  })
  const categories = Array.from(new Set(selected.map(row => row.category_name))).map(name => {
    const records = selected.filter(row => row.category_name === name)
    return { name, total: sum(records), count: records.length, months: months.map(month => sum(records.filter(row => row.month === month))) }
  }).sort((a, b) => b.total - a.total)
  return { months, selected, series, categories, total: sum(selected), previous: sum(previous), previousStart, previousEnd: shiftMonth(start, -1) }
}
