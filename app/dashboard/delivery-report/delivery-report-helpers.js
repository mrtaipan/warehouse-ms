export const GROUPS = ['ARKLINE', 'MOB', 'OI']

export const COURIER_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#ea580c', '#475569']

export function todayIso() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

export function jakartaStart(date) {
  return new Date(`${date}T00:00:00+07:00`).toISOString()
}

export function jakartaEnd(date) {
  return new Date(`${date}T23:59:59.999+07:00`).toISOString()
}

export function formatDate(value, options = {}) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(options.locale || 'id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: options.short ? 'short' : '2-digit',
    year: 'numeric',
    ...(options.time ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : {}),
  }).format(date)
}

export function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function pct(value, target) {
  return target > 0 ? Math.round((value / target) * 100) : 0
}

export function inferCourier(barcode, rules = []) {
  const normalized = String(barcode || '').trim().toUpperCase()
  const ordered = [...rules]
    .filter((rule) => rule.is_active !== false && rule.rule_type === 'COURIER')
    .sort((a, b) => safeNumber(a.priority) - safeNumber(b.priority))

  for (const rule of ordered) {
    const pattern = String(rule.pattern || '').toUpperCase()
    if (!pattern) continue
    if (rule.match_type === 'PREFIX' && normalized.startsWith(pattern)) return rule.result_value
    if (rule.match_type === 'SUFFIX' && normalized.endsWith(pattern)) return rule.result_value
    if (rule.match_type === 'CONTAINS' && normalized.includes(pattern)) return rule.result_value
    if (rule.match_type === 'EXACT' && normalized === pattern) return rule.result_value
  }
  return null
}

export function groupBy(items, keyFn) {
  return items.reduce((result, item) => {
    const key = keyFn(item)
    result[key] = result[key] || []
    result[key].push(item)
    return result
  }, {})
}

export function romanMonth(date = new Date()) {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][date.getMonth()]
}

export function manualWaybillPrefix(group, date = new Date()) {
  const groupPrefix = group === 'MOB' ? 'M' : group === 'OI' ? 'O' : 'A'
  return `${groupPrefix}MAN${romanMonth(date)}${date.getFullYear()}-`
}

export function classNames(...items) {
  return items.filter(Boolean).join(' ')
}
