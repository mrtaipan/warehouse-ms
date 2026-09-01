import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { loadAccessContext } from '@/utils/access-control'
import { canAccessOperationsCalendar } from '@/utils/permissions'
import OperationsCalendarClient from './page-client'
import styles from './page.module.css'

const DIVISIONS = [
  { key: 'inbound', label: 'Inbound', accent: 'blue' },
  { key: 'qc', label: 'Quality Control', accent: 'amber' },
  { key: 'packing', label: 'Packing List', accent: 'rose' },
  { key: 'storage', label: 'Stockkeeping', accent: 'emerald' },
]

const TARGET_MANAGER_ROLES = new Set([
  'admin',
  'leader',
  'warehouse_leader',
])

const ROLE_DIVISION_MAP = {
  admin: 'storage',
  warehouse_leader: 'storage',
  inbound_coordinator: 'inbound',
  inbound_staff: 'inbound',
  qc_coordinator: 'qc',
  qc_staff: 'qc',
  qc_inspector: 'qc',
  packing_coordinator: 'packing',
  packing_staff: 'packing',
  storage_coordinator: 'storage',
  storage_staff: 'storage',
}

const OPERATIONS_TIME_ZONE = 'Asia/Jakarta'
const JAKARTA_UTC_OFFSET_HOURS = 7
const WORKDAY_SHIFT_START_HOUR = 9
const WORKDAY_SHIFT_START_MINUTE = 0
const WORKDAY_SHIFT_HOURS = 7
const DEFAULT_WORKDAY_PRODUCTIVE_HOURS = 7
const INBOUND_WORKDAY_PRODUCTIVE_HOURS = 6.5
const MIN_WORKDAY_PRODUCTIVE_HOURS = 1
const WORKDAY_SHIFT_END_MINUTE =
  WORKDAY_SHIFT_START_HOUR * 60 +
  WORKDAY_SHIFT_START_MINUTE +
  WORKDAY_SHIFT_HOURS * 60
const WORKDAY_SHIFT_END_HOUR = Math.floor(WORKDAY_SHIFT_END_MINUTE / 60)
const WORKDAY_SHIFT_END_MINUTE_PART = WORKDAY_SHIFT_END_MINUTE % 60

function getRoleDivision(role) {
  return ROLE_DIVISION_MAP[String(role || '').trim()] || ''
}

function canManageOperationsTargets(role, isAdmin) {
  return Boolean(isAdmin || TARGET_MANAGER_ROLES.has(role))
}

function getTodayMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function normalizeMonthValue(value) {
  return /^\d{4}-\d{2}$/.test(String(value || '')) ? String(value) : getTodayMonthValue()
}

function getMonthBounds(monthValue) {
  const normalized = normalizeMonthValue(monthValue)
  const [year, month] = normalized.split('-').map(Number)
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonthYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const end = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`

  return { start, end, year, month }
}

function getMonthLabel(monthValue) {
  const { year, month } = getMonthBounds(monthValue)
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function shiftMonth(monthValue, diff) {
  const { year, month } = getMonthBounds(monthValue)
  const shifted = new Date(Date.UTC(year, month - 1 + diff, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

function getMonthDays(monthValue) {
  const { year, month } = getMonthBounds(monthValue)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index + 1))
    return {
      key: `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
      dayNumber: index + 1,
      weekday: new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        timeZone: 'UTC',
      }).format(date),
    }
  })
}

function extractDateKey(value) {
  const text = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ''
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatDecimal(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits }).format(Number(value || 0))
}

function safeDate(value) {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? null : date
}

function getJakartaDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    timeZone: OPERATIONS_TIME_ZONE,
  }).formatToParts(date)

  const values = parts.reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value
    return result
  }, {})

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function getJakartaDateKey(date) {
  const parts = getJakartaDateParts(date)

  return [
    parts.year,
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-')
}

function createJakartaDate(year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
  return new Date(Date.UTC(
    year,
    month - 1,
    day,
    hour - JAKARTA_UTC_OFFSET_HOURS,
    minute,
    second,
    millisecond
  ))
}

function getJakartaWorkdayStart(date) {
  const parts = getJakartaDateParts(date)

  return createJakartaDate(
    parts.year,
    parts.month,
    parts.day,
    WORKDAY_SHIFT_START_HOUR,
    WORKDAY_SHIFT_START_MINUTE
  )
}

function getJakartaWorkdayEnd(date) {
  const parts = getJakartaDateParts(date)

  return createJakartaDate(
    parts.year,
    parts.month,
    parts.day,
    WORKDAY_SHIFT_END_HOUR,
    WORKDAY_SHIFT_END_MINUTE_PART
  )
}

function addJakartaCalendarDays(date, days) {
  const parts = getJakartaDateParts(date)

  return createJakartaDate(
    parts.year,
    parts.month,
    parts.day + days,
    WORKDAY_SHIFT_START_HOUR,
    WORKDAY_SHIFT_START_MINUTE
  )
}

function isJakartaSunday(date) {
  const parts = getJakartaDateParts(date)

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() === 0
}

function isNonWorkingJakartaDate(date, nonWorkingDateSet = new Set()) {
  return isJakartaSunday(date) || nonWorkingDateSet.has(getJakartaDateKey(date))
}

function getNextJakartaWorkdayStart(date, nonWorkingDateSet = new Set()) {
  let cursor = addJakartaCalendarDays(date, 1)

  for (let index = 0; index < 370; index += 1) {
    if (!isNonWorkingJakartaDate(cursor, nonWorkingDateSet)) return getJakartaWorkdayStart(cursor)
    cursor = addJakartaCalendarDays(cursor, 1)
  }

  return getJakartaWorkdayStart(cursor)
}

function normalizeToJakartaWorkday(date, nonWorkingDateSet = new Set()) {
  let cursor = date

  for (let index = 0; index < 370; index += 1) {
    if (isNonWorkingJakartaDate(cursor, nonWorkingDateSet)) {
      cursor = getNextJakartaWorkdayStart(cursor, nonWorkingDateSet)
      continue
    }

    const workdayStart = getJakartaWorkdayStart(cursor)
    const workdayEnd = getJakartaWorkdayEnd(cursor)

    if (cursor.getTime() < workdayStart.getTime()) return workdayStart
    if (cursor.getTime() >= workdayEnd.getTime()) {
      cursor = getNextJakartaWorkdayStart(cursor, nonWorkingDateSet)
      continue
    }

    return cursor
  }

  return cursor
}

function getProductiveHoursPerShiftHour(productiveHoursPerDay = DEFAULT_WORKDAY_PRODUCTIVE_HOURS) {
  const productiveHours = Math.max(
    MIN_WORKDAY_PRODUCTIVE_HOURS,
    Math.min(WORKDAY_SHIFT_HOURS, Number(productiveHoursPerDay || DEFAULT_WORKDAY_PRODUCTIVE_HOURS))
  )

  return productiveHours / WORKDAY_SHIFT_HOURS
}

function addProductiveWorkHours(startDate, hours, nonWorkingDateSet = new Set(), productiveHoursPerDay = DEFAULT_WORKDAY_PRODUCTIVE_HOURS) {
  let remainingHours = Number(hours || 0)
  let cursor = normalizeToJakartaWorkday(startDate, nonWorkingDateSet)
  const productiveHoursPerShiftHour = getProductiveHoursPerShiftHour(productiveHoursPerDay)

  if (!Number.isFinite(remainingHours) || remainingHours <= 0) return cursor

  for (let index = 0; index < 370 && remainingHours > 0; index += 1) {
    const workdayEnd = getJakartaWorkdayEnd(cursor)
    const availableShiftHours = Math.max(0, (workdayEnd.getTime() - cursor.getTime()) / 36e5)
    const availableProductiveHours = availableShiftHours * productiveHoursPerShiftHour

    if (availableProductiveHours <= 0) {
      cursor = getNextJakartaWorkdayStart(cursor, nonWorkingDateSet)
      continue
    }

    if (remainingHours <= availableProductiveHours) {
      const calendarHours = remainingHours / productiveHoursPerShiftHour
      return new Date(cursor.getTime() + calendarHours * 36e5)
    }

    remainingHours -= availableProductiveHours
    cursor = getNextJakartaWorkdayStart(cursor, nonWorkingDateSet)
  }

  return cursor
}

function calculateProductiveWorkHoursBetween(startDate, endDate, nonWorkingDateSet = new Set(), productiveHoursPerDay = DEFAULT_WORKDAY_PRODUCTIVE_HOURS) {
  if (!startDate || !endDate || endDate.getTime() <= startDate.getTime()) return 0

  let cursor = normalizeToJakartaWorkday(startDate, nonWorkingDateSet)
  const endTime = endDate.getTime()
  let totalHours = 0
  const productiveHoursPerShiftHour = getProductiveHoursPerShiftHour(productiveHoursPerDay)

  for (let index = 0; index < 370 && cursor.getTime() < endTime; index += 1) {
    const workdayEnd = getJakartaWorkdayEnd(cursor)
    const segmentEndTime = Math.min(endTime, workdayEnd.getTime())

    if (segmentEndTime > cursor.getTime()) {
      const segmentShiftHours = (segmentEndTime - cursor.getTime()) / 36e5
      totalHours += segmentShiftHours * productiveHoursPerShiftHour
    }

    if (endTime <= workdayEnd.getTime()) break
    cursor = getNextJakartaWorkdayStart(cursor, nonWorkingDateSet)
  }

  return totalHours
}

function formatDurationHours(hours, productiveHoursPerDay = DEFAULT_WORKDAY_PRODUCTIVE_HOURS) {
  const safeHours = Number(hours || 0)
  if (!Number.isFinite(safeHours) || safeHours <= 0) return '-'
  if (safeHours < 1) return `${Math.max(1, Math.round(safeHours * 60))} min`
  if (safeHours <= productiveHoursPerDay) return `${formatDecimal(safeHours)} hr`
  return `${formatDecimal(safeHours / productiveHoursPerDay)} work day`
}

function formatDateTimeLabel(date) {
  if (!date || Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: OPERATIONS_TIME_ZONE,
  }).format(date)
}

function getRowsTimeBounds(rows = [], getDateValue) {
  return rows.reduce((result, row) => {
    const date = safeDate(getDateValue(row))
    if (!date) return result

    const time = date.getTime()
    if (!result.first || time < result.first.getTime()) result.first = date
    if (!result.last || time > result.last.getTime()) result.last = date
    return result
  }, { first: null, last: null })
}

function calculateProjectedFinish({
  targetQty,
  completedQty,
  activityRows,
  getDateValue,
  now = new Date(),
  nonWorkingDateSet = new Set(),
  productiveHoursPerDay = DEFAULT_WORKDAY_PRODUCTIVE_HOURS,
}) {
  const target = Number(targetQty || 0)
  const completed = Number(completedQty || 0)
  const remainingQty = Math.max(0, target - completed)

  if (target <= 0 || completed <= 0 || remainingQty <= 0 || !activityRows?.length) {
    return null
  }

  const bounds = getRowsTimeBounds(activityRows, getDateValue)
  if (!bounds.first) return null

  const baseTime = Math.max(now.getTime(), bounds.last?.getTime() || 0)
  const baseDate = new Date(baseTime)
  const elapsedHours = Math.max(
    0.25,
    calculateProductiveWorkHoursBetween(bounds.first, baseDate, nonWorkingDateSet, productiveHoursPerDay)
  )
  const speedPerHour = completed / elapsedHours
  if (!Number.isFinite(speedPerHour) || speedPerHour <= 0) return null

  const remainingHours = remainingQty / speedPerHour
  const projectedAt = addProductiveWorkHours(baseDate, remainingHours, nonWorkingDateSet, productiveHoursPerDay)

  return {
    projectedAt,
    remainingQty,
    speedPerHour,
    remainingHours,
    productiveHoursPerDay,
  }
}

function getPauseDurationHours(row = {}, now = new Date()) {
  const pausedAt = safeDate(row.paused_at)
  const resumedAt = safeDate(row.resumed_at) || now
  if (!pausedAt || !resumedAt || resumedAt.getTime() <= pausedAt.getTime()) return 0

  return (resumedAt.getTime() - pausedAt.getTime()) / 36e5
}

function calculateProductiveHoursFromPauseRows(activityRows = [], pauseRows = [], now = new Date()) {
  const activeDateKeys = new Set(
    activityRows
      .map((row) => getJakartaDateKey(safeDate(row.updated_at || row.created_at) || now))
      .filter(Boolean)
  )
  const dayCount = Math.max(1, activeDateKeys.size)
  const unproductiveHours = pauseRows.reduce((total, row) => total + getPauseDurationHours(row, now), 0)
  const averageUnproductiveHours = Math.min(WORKDAY_SHIFT_HOURS - MIN_WORKDAY_PRODUCTIVE_HOURS, unproductiveHours / dayCount)
  const productiveHoursPerDay = Math.max(MIN_WORKDAY_PRODUCTIVE_HOURS, WORKDAY_SHIFT_HOURS - averageUnproductiveHours)

  return {
    productiveHoursPerDay,
    averageUnproductiveHours,
    unproductiveHours,
  }
}

function isDateKeyInRange(dateKey, start, end) {
  return Boolean(dateKey && dateKey >= start && dateKey < end)
}

function normalizeStorageKoliLabel(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''

  const segment = text.split('|')[0].split('/')[0].trim()
  const match = segment.match(/\b(?:koli|k)\s*[-:#]?\s*([a-z0-9]+)/i)

  if (match) {
    return `K${String(match[1] || '').toUpperCase()}`
  }

  return segment.toUpperCase().replace(/\s+/g, ' ')
}

function getStorageKoliKey(row = {}) {
  const note = String(row.notes || '')
  const queueMatch = note.match(/Stored from\s+([^|]+)/i)
  const queueLabel = normalizeStorageKoliLabel(queueMatch?.[1] || note)

  return queueLabel
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function TimelineIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h10" />
      <path d="M4 18h16" />
      <circle cx="18" cy="12" r="2.5" />
    </svg>
  )
}

function createDivisionDayMap() {
  return new Map()
}

function getDivisionDayEntry(map, divisionKey, dateKey) {
  const compositeKey = `${divisionKey}::${dateKey}`
  const existing = map.get(compositeKey)

  if (existing) return existing

  const next = {
    divisionKey,
    dateKey,
    items: [],
    totals: {
      activities: 0,
      qty: 0,
      count: 0,
    },
  }

  map.set(compositeKey, next)
  return next
}

function pushTimelineItem(map, divisionKey, dateKey, item) {
  if (!dateKey) return

  const entry = getDivisionDayEntry(map, divisionKey, dateKey)
  entry.items.push(item)
  entry.items.sort((left, right) => {
    const priority = {
      Target: -10,
      'GRN Received': 0,
      'Arkline Inbound': 1,
      'Arkline Return': 2,
      'Reguler Return': 3,
      'Arkline Return Back': 4,
      'Inbound Estimated Finish': 5,
      'QC Estimated Finish': 6,
    }
    const leftPriority = left.tone === 'target' ? -10 : priority[left.label] ?? 10
    const rightPriority = right.tone === 'target' ? -10 : priority[right.label] ?? 10
    return leftPriority - rightPriority || String(left.label || '').localeCompare(String(right.label || ''))
  })
  entry.totals.activities += 1
  entry.totals.qty += Number(item.qty || 0)
  entry.totals.count += Number(item.count || 0)
}

function sumBy(rows, fieldNames) {
  return rows.reduce((total, row) => {
    const fieldList = Array.isArray(fieldNames) ? fieldNames : [fieldNames]
    const value = fieldList.reduce((found, fieldName) => {
      if (found !== null) return found
      if (row?.[fieldName] == null || row?.[fieldName] === '') return null
      return Number(row[fieldName] || 0)
    }, null)
    return total + Number(value || 0)
  }, 0)
}

function groupRowsByDate(rows, getDateKey) {
  return rows.reduce((grouped, row) => {
    const dateKey = getDateKey(row)
    if (!dateKey) return grouped
    const current = grouped.get(dateKey) || []
    current.push(row)
    grouped.set(dateKey, current)
    return grouped
  }, new Map())
}

function groupRowsByValue(rows, getKey) {
  return rows.reduce((grouped, row) => {
    const key = getKey(row)
    if (!key) return grouped
    const current = grouped.get(key) || []
    current.push(row)
    grouped.set(key, current)
    return grouped
  }, new Map())
}

function buildCalendarTimestampFilter(fields, start, end) {
  const startStamp = `${start}T00:00:00`
  const endStamp = `${end}T00:00:00`

  return fields.map((field) => `and(${field}.gte.${startStamp},${field}.lt.${endStamp})`).join(',')
}

function getDistinctOptions(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

const NON_BLOCKING_CALENDAR_ERROR_CODES = new Set(['42P01', '42703', '42501', 'PGRST100', 'PGRST200', 'PGRST204'])

function isNonBlockingCalendarError(error) {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()

  return (
    NON_BLOCKING_CALENDAR_ERROR_CODES.has(code) ||
    message.includes('does not exist') ||
    message.includes('could not find') ||
    message.includes('schema cache') ||
    message.includes('permission denied')
  )
}

function normalizeCalendarResult(result, sourceName = 'calendar source') {
  if (!result?.error) return result
  if (!isNonBlockingCalendarError(result.error)) return result

  console.warn(`Operations Calendar skipped ${sourceName}: ${result.error.message}`)
  return { data: [], error: null }
}

function createDaySummaryMap(monthDays, timelineMap) {
  return monthDays.reduce((result, day) => {
    const divisions = DIVISIONS.map((division) => {
      const entry = timelineMap.get(`${division.key}::${day.key}`)
      return {
        ...division,
        items: entry?.items || [],
        totals: entry?.totals || { activities: 0, qty: 0, count: 0 },
      }
    }).filter((division) => division.items.length > 0)

    result.set(day.key, divisions)
    return result
  }, new Map())
}

async function loadInboundRowsForCalendar(supabase, start, end) {
  const selectOptions = [
    'id, grn_number, inbound_date, total_koli, total_claimed_qty, total_received_qty, item_name',
    'id, grn_number, inbound_date, total_koli, total_claimed_qty, item_name',
    'id, grn_number, inbound_date, total_koli, item_name',
    'id, grn_number, inbound_date',
  ]

  let lastError = null

  for (const selectColumns of selectOptions) {
    const result = await supabase
      .from('inbound')
      .select(selectColumns)
      .gte('inbound_date', start)
      .lt('inbound_date', end)
      .order('inbound_date', { ascending: true })

    if (!result.error) {
      return result
    }

    lastError = result.error
    if (!isNonBlockingCalendarError(result.error)) {
      return result
    }

    if (result.error.code !== '42703' && result.error.code !== 'PGRST204') {
      return normalizeCalendarResult(result, 'inbound')
    }
  }

  return normalizeCalendarResult({ data: null, error: lastError }, 'inbound')
}

async function loadInboundUnloadRowsForCalendar(supabase, start, end) {
  const selectOptions = [
    'id, inbound_id, product_model_id, product_model_variant_id, model_name, variant_name, variant_label, variant_code, qty, created_at',
    'id, inbound_id, product_model_id, model_name, variant_name, variant_label, variant_code, qty, created_at',
    'id, inbound_id, model_name, variant_name, variant_label, variant_code, qty, created_at',
    'id, inbound_id, model_name, variant_name, qty, created_at',
    'id, inbound_id, model_name, qty, created_at',
    'id, inbound_id, qty, created_at',
  ]

  let lastError = null

  for (const selectColumns of selectOptions) {
    const result = await supabase
      .from('inbound_unload')
      .select(selectColumns)
      .gte('created_at', `${start}T00:00:00`)
      .lt('created_at', `${end}T00:00:00`)
      .order('created_at', { ascending: true })

    if (!result.error) {
      return result
    }

    lastError = result.error
    if (!isNonBlockingCalendarError(result.error)) {
      return result
    }

    if (result.error.code !== '42703' && result.error.code !== 'PGRST204') {
      return normalizeCalendarResult(result, 'inbound sorting')
    }
  }

  return normalizeCalendarResult({ data: null, error: lastError }, 'inbound sorting')
}

async function loadArklineReceiptRowsForCalendar(supabase, start, end) {
  const result = await supabase
    .from('arkline_po_item_receipts')
    .select('id, po_id, received_qty, receive_date, receipt_type')
    .eq('receipt_type', 'INITIAL')
    .gte('receive_date', start)
    .lt('receive_date', end)
    .order('receive_date', { ascending: true })

  if (!result.error) {
    return result
  }

  if (!isNonBlockingCalendarError(result.error)) {
    return result
  }

  if (result.error.code !== '42703' && result.error.code !== 'PGRST204') {
    return normalizeCalendarResult(result, 'Arkline inbound')
  }

  const fallbackResult = await supabase
    .from('arkline_po_item_receipts')
    .select('id, po_id, received_qty, receive_date')
    .gte('receive_date', start)
    .lt('receive_date', end)
    .order('receive_date', { ascending: true })

  return normalizeCalendarResult(fallbackResult, 'Arkline inbound')
}

async function loadQcItemRowsForCalendar(supabase, start, end) {
  const selectOptions = [
    `
      id,
      inbound_id,
      inbound_unload_id,
      allocated_qty,
      qty_in,
      qty_a,
      qty_b,
      qty_c,
      model_name,
      variant_name,
      assigned_to,
      created_at,
      updated_at,
      inbound:inbound_id (
        grn_number
      ),
      inbound_unload:inbound_unload_id (
        brand_id,
        category_id,
        model_name,
        variant_name,
        brands:dir_brands!brand_id (
          brand_name
        ),
        categories:dir_categories!category_id (
          category_name,
          full_name
        )
      )
    `,
    `
      id,
      inbound_id,
      inbound_unload_id,
      allocated_qty,
      qty_in,
      qty_a,
      qty_b,
      qty_c,
      model_name,
      variant_name,
      assigned_to,
      created_at,
      updated_at,
      inbound:inbound_id (
        grn_number
      ),
      inbound_unload:inbound_unload_id (
        brand_id,
        category_id,
        model_name,
        variant_name,
        brands:dir_brands!brand_id (
          brand_name
        ),
        categories:dir_categories!category_id (
          category_name
        )
      )
    `,
    `
      id,
      inbound_id,
      inbound_unload_id,
      allocated_qty,
      qty_in,
      qty_a,
      qty_b,
      qty_c,
      model_name,
      variant_name,
      assigned_to,
      created_at,
      updated_at,
      inbound:inbound_id (
        grn_number
      ),
      inbound_unload:inbound_unload_id (
        model_name,
        variant_name
      )
    `,
    'id, inbound_id, inbound_unload_id, allocated_qty, qty_in, qty_a, qty_b, qty_c, model_name, variant_name, assigned_to, created_at, updated_at',
    'id, inbound_id, allocated_qty, qty_in, qty_a, qty_b, qty_c, model_name, variant_name, assigned_to, created_at, updated_at',
    'id, inbound_id, allocated_qty, qty_in, qty_a, qty_b, qty_c, created_at, updated_at',
  ]

  let lastError = null

  for (const selectColumns of selectOptions) {
    const result = await supabase
      .from('qc_items')
      .select(selectColumns)
      .or(buildCalendarTimestampFilter(['created_at', 'updated_at'], start, end))
      .order('created_at', { ascending: true })

    if (!result.error) {
      return result
    }

    lastError = result.error
    if (!isNonBlockingCalendarError(result.error)) {
      return result
    }

    if (result.error.code !== '42703' && result.error.code !== 'PGRST200' && result.error.code !== 'PGRST204') {
      return normalizeCalendarResult(result, 'regular QC grading')
    }
  }

  return normalizeCalendarResult({ data: null, error: lastError }, 'regular QC grading')
}

async function loadQcConfirmRowsForInboundIds(supabase, inboundIds = []) {
  const ids = Array.from(new Set(inboundIds.map((id) => Number(id || 0)).filter(Boolean)))
  if (!ids.length) return { data: [], error: null }

  const selectOptions = [
    'id, inbound_id, qty, grade, source_grade, adjustment_type, is_adjustment, created_at',
    'id, inbound_id, qty, grade, source_grade, adjustment_type, created_at',
    'id, inbound_id, qty, grade, created_at',
  ]

  let lastError = null

  for (const selectColumns of selectOptions) {
    const result = await supabase
      .from('qc_confirm')
      .select(selectColumns)
      .in('inbound_id', ids)
      .order('created_at', { ascending: true })

    if (!result.error) {
      return result
    }

    lastError = result.error
    if (!isNonBlockingCalendarError(result.error)) {
      return result
    }

    if (result.error.code !== '42703' && result.error.code !== 'PGRST204') {
      return normalizeCalendarResult(result, 'QC confirmation')
    }
  }

  return normalizeCalendarResult({ data: null, error: lastError }, 'QC confirmation')
}

async function loadQcPauseRowsForTaskIds(supabase, qcItemIds = []) {
  const ids = Array.from(new Set(qcItemIds.map((id) => Number(id || 0)).filter(Boolean)))
  if (!ids.length) return { data: [], error: null }

  const result = await supabase
    .from('qc_pause_logs')
    .select('id, qc_item_id, paused_at, resumed_at')
    .in('qc_item_id', ids)
    .order('paused_at', { ascending: true })

  if (!result.error) {
    return result
  }

  return normalizeCalendarResult(result, 'QC pause logs')
}

async function loadArklineQcRowsForCalendar(supabase, start, end) {
  const selectOptions = [
    `
      id,
      po_id,
      arkline_po_item_id,
      sku_induk,
      allocated_qty,
      qty_a,
      qty_b,
      qty_c,
      model_name,
      created_at,
      finished_at,
      updated_at,
      arkline_po_items:arkline_po_item_id (
        nama_produk,
        sku_induk
      )
    `,
    'id, po_id, arkline_po_item_id, sku_induk, allocated_qty, qty_a, qty_b, qty_c, model_name, created_at, finished_at, updated_at',
  ]

  let lastError = null

  for (const selectColumns of selectOptions) {
    const result = await supabase
      .from('arkline_qc')
      .select(selectColumns)
      .or(buildCalendarTimestampFilter(['created_at', 'updated_at', 'finished_at'], start, end))
      .order('created_at', { ascending: true })

    if (!result.error) {
      return result
    }

    lastError = result.error
    if (!isNonBlockingCalendarError(result.error)) {
      return result
    }

    if (result.error.code !== '42703' && result.error.code !== 'PGRST200' && result.error.code !== 'PGRST204') {
      return normalizeCalendarResult(result, 'Arkline grading')
    }
  }

  return normalizeCalendarResult({ data: null, error: lastError }, 'Arkline grading')
}

async function loadRegularReturnRowsForCalendar(supabase, start, end) {
  const selectOptions = [
    'id, inbound_id, qty, status, updated_at, inbound:inbound_id(id, grn_number)',
    'id, inbound_id, qty, status, updated_at',
    'id, qty, status, updated_at',
  ]

  let lastError = null

  for (const selectColumns of selectOptions) {
    const result = await supabase
      .from('warehouse_returns')
      .select(selectColumns)
      .gte('updated_at', start)
      .lt('updated_at', end)
      .ilike('status', 'completed')
      .order('updated_at', { ascending: true })

    if (!result.error) {
      return result
    }

    lastError = result.error
    if (!isNonBlockingCalendarError(result.error)) {
      return result
    }

    if (result.error.code !== '42703' && result.error.code !== 'PGRST204') {
      return normalizeCalendarResult(result, 'regular return')
    }
  }

  return normalizeCalendarResult({ data: null, error: lastError }, 'regular return')
}

async function loadArklineReturnBatchRowsForCalendar(supabase, start, end) {
  const selectOptions = [
    'id, return_number, po_id, sku_induk, model_name_snapshot, sent_qty, returned_qty, status, return_date',
    'id, return_number, po_id, sku_induk, model_name_snapshot, sent_qty, status, return_date',
    'id, return_number, po_id, sent_qty, return_date',
  ]

  let lastError = null

  for (const selectColumns of selectOptions) {
    const result = await supabase
      .from('arkline_qc_return_batches')
      .select(selectColumns)
      .gte('return_date', start)
      .lt('return_date', end)
      .order('return_date', { ascending: true })

    if (!result.error) {
      return result
    }

    lastError = result.error
    if (!isNonBlockingCalendarError(result.error)) {
      return result
    }

    if (result.error.code !== '42703' && result.error.code !== 'PGRST204') {
      return normalizeCalendarResult(result, 'Arkline return')
    }
  }

  return normalizeCalendarResult({ data: null, error: lastError }, 'Arkline return')
}

async function loadArklineReworkReceiptRowsForCalendar(supabase, start, end) {
  const selectOptions = [
    'id, po_id, received_qty, receive_date, receipt_type, source_return_batch_id, source_return_batch_line_id',
    'id, po_id, received_qty, receive_date, receipt_type, source_return_batch_id',
    'id, po_id, received_qty, receive_date, receipt_type',
  ]

  let lastError = null

  for (const selectColumns of selectOptions) {
    const result = await supabase
      .from('arkline_po_item_receipts')
      .select(selectColumns)
      .eq('receipt_type', 'REWORK_RETURN')
      .gte('receive_date', start)
      .lt('receive_date', end)
      .order('receive_date', { ascending: true })

    if (!result.error) {
      return result
    }

    lastError = result.error
    if (!isNonBlockingCalendarError(result.error)) {
      return result
    }

    if (result.error.code !== '42703' && result.error.code !== 'PGRST204') {
      return normalizeCalendarResult(result, 'Arkline return back')
    }
  }

  return normalizeCalendarResult({ data: null, error: lastError }, 'Arkline return back')
}

async function loadOperationsCalendarTargets(supabase, start, end) {
  const result = await supabase
    .from('operations_calendar_targets')
    .select('id, target_date, division_key, grn_number, brand_name, status, created_by, updated_by, created_at, updated_at')
    .gte('target_date', start)
    .lt('target_date', end)
    .order('target_date', { ascending: true })
    .order('created_at', { ascending: true })

  return normalizeCalendarResult(result, 'manual targets')
}

async function loadOperationsCalendarManualReports(supabase, start, end) {
  const result = await supabase
    .from('operations_calendar_manual_reports')
    .select('id, report_date, division_key, title, description, pic_name, created_by, updated_by, created_at, updated_at')
    .gte('report_date', start)
    .lt('report_date', end)
    .order('report_date', { ascending: true })
    .order('created_at', { ascending: true })

  return normalizeCalendarResult(result, 'manual reports')
}

async function loadWarehouseHolidayDateSet(supabase, monthValue) {
  const { start, end } = getMonthBounds(monthValue)
  const { data, error } = await supabase
    .from('hrga_public_holidays')
    .select('holiday_date, warehouse_holiday')
    .gte('holiday_date', start)
    .lt('holiday_date', end)
    .eq('warehouse_holiday', true)

  if (error) {
    if (isNonBlockingCalendarError(error)) {
      return new Set()
    }

    throw error
  }

  return new Set((data || []).map((row) => extractDateKey(row.holiday_date)).filter(Boolean))
}

async function loadPlReceivingRowsForCalendar(supabase, start, end) {
  const summaryResult = await supabase
    .from('operations_calendar_pl_receiving_daily_summary')
    .select('event_date, received_qty, validated_qty, received_rows, validated_rows')
    .gte('event_date', start)
    .lt('event_date', end)
    .order('event_date', { ascending: true })

  if (!summaryResult.error) {
    return summaryResult
  }

  if (!isNonBlockingCalendarError(summaryResult.error)) {
    return summaryResult
  }

  const withValidatedAt = await supabase
    .from('pl_receiving')
    .select('id, received_qty, created_at, validated_at')
    .or(buildCalendarTimestampFilter(['created_at', 'validated_at'], start, end))
    .order('created_at', { ascending: true })

  if (!withValidatedAt.error) {
    return withValidatedAt
  }

  if (!isNonBlockingCalendarError(withValidatedAt.error)) {
    return withValidatedAt
  }

  if (withValidatedAt.error.code !== '42703' && withValidatedAt.error.code !== 'PGRST204') {
    return normalizeCalendarResult(withValidatedAt, 'packing receiving')
  }

  const byCreatedAt = await supabase
    .from('pl_receiving')
    .select('id, received_qty, created_at')
    .gte('created_at', `${start}T00:00:00`)
    .lt('created_at', `${end}T00:00:00`)
    .order('created_at', { ascending: true })

  return normalizeCalendarResult(byCreatedAt, 'packing receiving')
}

async function loadPlBreakdownRowsForCalendar(supabase, start, end) {
  const summaryResult = await supabase
    .from('operations_calendar_pl_breakdown_daily_summary')
    .select('event_date, line_count, breakdown_qty, grn_count, grn_numbers, item_names')
    .gte('event_date', start)
    .lt('event_date', end)
    .order('event_date', { ascending: true })

  if (!summaryResult.error) {
    return summaryResult
  }

  if (!isNonBlockingCalendarError(summaryResult.error)) {
    return summaryResult
  }

  const byUpdatedAt = await supabase
    .from('pl_size_breakdown')
    .select('id, inbound_id, qty, updated_at, created_at')
    .gte('updated_at', `${start}T00:00:00`)
    .lt('updated_at', `${end}T00:00:00`)
    .order('updated_at', { ascending: true })

  if (!byUpdatedAt.error) {
    return byUpdatedAt
  }

  if (!isNonBlockingCalendarError(byUpdatedAt.error)) {
    return byUpdatedAt
  }

  if (byUpdatedAt.error.code !== '42703' && byUpdatedAt.error.code !== 'PGRST204') {
    return normalizeCalendarResult(byUpdatedAt, 'packing breakdown')
  }

  const byCreatedAt = await supabase
    .from('pl_size_breakdown')
    .select('id, inbound_id, qty, created_at')
    .gte('created_at', `${start}T00:00:00`)
    .lt('created_at', `${end}T00:00:00`)
    .order('created_at', { ascending: true })

  return normalizeCalendarResult(byCreatedAt, 'packing breakdown')
}

async function loadWarehouseStorageRowsForCalendar(supabase, start, end) {
  const summaryResult = await supabase
    .from('operations_calendar_storage_daily_summary')
    .select('event_date, storage_line_count, stored_qty, storage_k_count')
    .gte('event_date', start)
    .lt('event_date', end)
    .order('event_date', { ascending: true })

  if (!summaryResult.error) {
    return summaryResult
  }

  if (!isNonBlockingCalendarError(summaryResult.error)) {
    return summaryResult
  }

  const selectOptions = [
    'id, item_name, qty, notes, created_at',
    'id, item_name, qty, created_at',
    'id, qty, created_at',
  ]

  let lastError = null

  for (const selectColumns of selectOptions) {
    const result = await supabase
      .from('warehouse_storage')
      .select(selectColumns)
      .gte('created_at', `${start}T00:00:00`)
      .lt('created_at', `${end}T00:00:00`)
      .order('created_at', { ascending: true })

    if (!result.error) {
      return result
    }

    lastError = result.error
    if (!isNonBlockingCalendarError(result.error)) {
      return result
    }

    if (result.error.code !== '42703' && result.error.code !== 'PGRST204') {
      return normalizeCalendarResult(result, 'storage rack')
    }
  }

  return normalizeCalendarResult({ data: null, error: lastError }, 'storage rack')
}

async function loadRestockRowsForCalendar(supabase, start, end) {
  const summaryResult = await supabase
    .from('operations_calendar_restock_daily_summary')
    .select('event_date, completed_request_count, picked_qty')
    .gte('event_date', start)
    .lt('event_date', end)
    .order('event_date', { ascending: true })

  if (!summaryResult.error) {
    return summaryResult
  }

  if (!isNonBlockingCalendarError(summaryResult.error)) {
    return summaryResult
  }

  const byCompletedAt = await supabase
    .from('restock_request')
    .select('id, item_name, qty, request_status, completed_at, created_at')
    .gte('completed_at', `${start}T00:00:00`)
    .lt('completed_at', `${end}T00:00:00`)
    .order('completed_at', { ascending: true })

  if (!byCompletedAt.error) {
    return byCompletedAt
  }

  if (!isNonBlockingCalendarError(byCompletedAt.error)) {
    return byCompletedAt
  }

  if (byCompletedAt.error.code !== '42703' && byCompletedAt.error.code !== 'PGRST204') {
    return normalizeCalendarResult(byCompletedAt, 'restock')
  }

  const byCreatedAt = await supabase
    .from('restock_request')
    .select('id, item_name, qty, request_status, created_at')
    .gte('created_at', `${start}T00:00:00`)
    .lt('created_at', `${end}T00:00:00`)
    .order('created_at', { ascending: true })

  return normalizeCalendarResult(byCreatedAt, 'restock')
}

async function loadOperationsCalendarFormOptions(supabase) {
  const [{ data: inboundRows }, { data: unloadRows }] = await Promise.all([
    supabase
      .from('inbound')
      .select('id, grn_number')
      .order('inbound_date', { ascending: false })
      .limit(500),
    supabase
      .from('inbound_unload')
      .select(`
        inbound_id,
        brands:dir_brands!brand_id (
          brand_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1500),
  ])
  const inboundById = new Map((inboundRows || []).map((row) => [String(row.id), String(row.grn_number || '').trim()]))
  const targetPairMap = new Map()

  ;(unloadRows || []).forEach((row) => {
    const grnNumber = inboundById.get(String(row.inbound_id || '')) || ''
    const brandName = String(row.brands?.brand_name || '').trim()

    if (!grnNumber || !brandName) return
    targetPairMap.set(`${grnNumber}::${brandName}`, { grnNumber, brandName })
  })

  return {
    grnOptions: getDistinctOptions((inboundRows || []).map((row) => row.grn_number)),
    brandOptions: getDistinctOptions((unloadRows || []).map((row) => row.brands?.brand_name)),
    targetOptionPairs: Array.from(targetPairMap.values()).sort((left, right) => (
      left.grnNumber.localeCompare(right.grnNumber, undefined, { numeric: true }) ||
      left.brandName.localeCompare(right.brandName, undefined, { numeric: true })
    )),
  }
}

async function loadOperationsCalendarData(supabase, monthValue, nonWorkingDateSet = new Set()) {
  const { start, end } = getMonthBounds(monthValue)
  const timelineMap = createDivisionDayMap()

  const [
    { data: inboundRows, error: inboundError },
    { data: inboundUnloadRows, error: inboundUnloadError },
    { data: arklineReceiptRows, error: arklineReceiptError },
    { data: qcItemRows, error: qcItemError },
    { data: arklineQcRows, error: arklineQcError },
    { data: regularReturnRows, error: regularReturnError },
    { data: arklineReturnRows, error: arklineReturnError },
    { data: arklineReworkReceiptRows, error: arklineReworkReceiptError },
    { data: plReceivingRows, error: plReceivingError },
    { data: plBreakdownRows, error: plBreakdownError },
    { data: warehouseStorageRows, error: warehouseStorageError },
    { data: restockRows, error: restockError },
    { data: targetRows, error: targetError },
    { data: manualReportRows, error: manualReportError },
  ] = await Promise.all([
    loadInboundRowsForCalendar(supabase, start, end),
    loadInboundUnloadRowsForCalendar(supabase, start, end),
    loadArklineReceiptRowsForCalendar(supabase, start, end),
    loadQcItemRowsForCalendar(supabase, start, end),
    loadArklineQcRowsForCalendar(supabase, start, end),
    loadRegularReturnRowsForCalendar(supabase, start, end),
    loadArklineReturnBatchRowsForCalendar(supabase, start, end),
    loadArklineReworkReceiptRowsForCalendar(supabase, start, end),
    loadPlReceivingRowsForCalendar(supabase, start, end),
    loadPlBreakdownRowsForCalendar(supabase, start, end),
    loadWarehouseStorageRowsForCalendar(supabase, start, end),
    loadRestockRowsForCalendar(supabase, start, end),
    loadOperationsCalendarTargets(supabase, start, end),
    loadOperationsCalendarManualReports(supabase, start, end),
  ])

  const error =
    inboundError ||
    inboundUnloadError ||
    arklineReceiptError ||
    qcItemError ||
    arklineQcError ||
    regularReturnError ||
    arklineReturnError ||
    arklineReworkReceiptError ||
    plReceivingError ||
    plBreakdownError ||
    warehouseStorageError ||
    restockError ||
    targetError ||
    manualReportError

  if (error) {
    throw error
  }

  groupRowsByDate(targetRows || [], (row) => extractDateKey(row.target_date)).forEach((rows, dateKey) => {
    rows.forEach((row) => {
      const brandName = String(row.brand_name || '').trim()

      pushTimelineItem(timelineMap, row.division_key, dateKey, {
        label: 'Target',
        eyebrow: 'Urgent',
        count: 1,
        qty: 0,
        note: `${row.grn_number || 'GRN'} | ${brandName || 'All Brands'}`,
        detail: '',
        tone: 'target',
        recordId: row.id,
        targetDate: dateKey,
        divisionKey: row.division_key,
        grnNumber: row.grn_number,
        brandName,
      })
    })
  })

  groupRowsByDate(manualReportRows || [], (row) => extractDateKey(row.report_date)).forEach((rows, dateKey) => {
    rows.forEach((row) => {
      pushTimelineItem(timelineMap, row.division_key, dateKey, {
        label: row.title || 'Manual Report',
        eyebrow: 'Manual',
        count: 1,
        qty: 0,
        note: row.description || row.pic_name || '',
        detail: row.pic_name ? `PIC ${row.pic_name}` : '',
        tone: 'manual',
        recordId: row.id,
        reportDate: dateKey,
        divisionKey: row.division_key,
        title: row.title || '',
        description: row.description || '',
      })
    })
  })

  const plReceivingSummaryRows = (plReceivingRows || []).filter((row) => row.event_date)
  const plReceivingRawRows = (plReceivingRows || []).filter((row) => !row.event_date)
  const plBreakdownSummaryRows = (plBreakdownRows || []).filter((row) => row.event_date)
  const plBreakdownRawRows = (plBreakdownRows || []).filter((row) => !row.event_date)
  const warehouseStorageSummaryRows = (warehouseStorageRows || []).filter((row) => row.event_date)
  const warehouseStorageRawRows = (warehouseStorageRows || []).filter((row) => !row.event_date)
  const restockSummaryRows = (restockRows || []).filter((row) => row.event_date)
  const restockRawRows = (restockRows || []).filter((row) => !row.event_date)

  const inboundById = new Map((inboundRows || []).map((row) => [String(row.id), row]))
  const missingInboundIds = Array.from(
    new Set(
      [
        ...(inboundUnloadRows || []),
        ...plBreakdownRawRows,
      ]
        .map((row) => String(row.inbound_id || '').trim())
        .filter((id) => id && !inboundById.has(id))
    )
  )

  if (missingInboundIds.length) {
    const { data: missingInboundRows, error: missingInboundError } = await supabase
      .from('inbound')
      .select('id, grn_number, inbound_date, total_koli, total_claimed_qty, total_received_qty, item_name')
      .in('id', missingInboundIds)

    if (missingInboundError) {
      throw missingInboundError
    }

    ;(missingInboundRows || []).forEach((row) => {
      inboundById.set(String(row.id), row)
    })
  }

  const { data: qcConfirmRows, error: qcConfirmError } = await loadQcConfirmRowsForInboundIds(
    supabase,
    Array.from(inboundById.keys())
  )

  if (qcConfirmError) {
    throw qcConfirmError
  }

  const now = new Date()
  const unloadRowsByInbound = groupRowsByValue(inboundUnloadRows || [], (row) => String(row.inbound_id || '').trim())
  const qcRowsByInbound = groupRowsByValue(qcItemRows || [], (row) => String(row.inbound_id || '').trim())
  const { data: qcPauseRows, error: qcPauseError } = await loadQcPauseRowsForTaskIds(
    supabase,
    (qcItemRows || []).map((row) => row.id)
  )

  if (qcPauseError) {
    throw qcPauseError
  }

  const qcPauseRowsByTaskId = groupRowsByValue(qcPauseRows || [], (row) => String(row.qc_item_id || '').trim())
  const confirmedPassingQtyByInbound = (qcConfirmRows || []).reduce((result, row) => {
    const inboundId = String(row.inbound_id || '').trim()
    if (!inboundId) return result

    const grade = String(row.grade || '').trim().toUpperCase()
    const sourceGrade = String(row.source_grade || grade).trim().toUpperCase()
    const isPassingGrade = grade === 'A' || sourceGrade === 'A'
    if (!isPassingGrade) return result

    result.set(inboundId, (result.get(inboundId) || 0) + Number(row.qty || 0))
    return result
  }, new Map())

  inboundById.forEach((inbound, inboundId) => {
    const sortingRows = unloadRowsByInbound.get(inboundId) || []
    const targetQty = Number(inbound.total_claimed_qty || inbound.total_received_qty || 0)
    const sortedQty = sumBy(sortingRows, 'qty')
    const qcRows = qcRowsByInbound.get(inboundId) || []
    const inboundCapacity = {
      productiveHoursPerDay: INBOUND_WORKDAY_PRODUCTIVE_HOURS,
      averageUnproductiveHours: 0,
    }
    const qcPassingQty = qcRows.reduce((total, row) => total + Number(row.qty_a || 0), 0)
    const passingPendingQty = Math.max(0, qcPassingQty - Number(confirmedPassingQtyByInbound.get(inboundId) || 0))
    const isPassingGradeClosed = qcPassingQty > 0 && passingPendingQty <= 0

    if (isPassingGradeClosed) return

    const inboundEstimate = calculateProjectedFinish({
      targetQty,
      completedQty: sortedQty,
      activityRows: sortingRows,
      getDateValue: (row) => row.created_at,
      now,
      nonWorkingDateSet,
      productiveHoursPerDay: inboundCapacity.productiveHoursPerDay,
    })
    const inboundEstimateDateKey = extractDateKey(inboundEstimate?.projectedAt?.toISOString())

    if (inboundEstimate && isDateKeyInRange(inboundEstimateDateKey, start, end)) {
      pushTimelineItem(timelineMap, 'inbound', inboundEstimateDateKey, {
        label: 'Inbound Estimated Finish',
        count: 1,
        qty: inboundEstimate.remainingQty,
        note: `${inbound.grn_number || 'GRN'} | Remaining ${formatNumber(inboundEstimate.remainingQty)}`,
        detail: `Projected ${formatDateTimeLabel(inboundEstimate.projectedAt)}`,
        tone: 'estimate',
        modalRows: [
          { label: 'GRN Number', value: inbound.grn_number || '-' },
          { label: 'Item Name', value: inbound.item_name || '-' },
          { label: 'Target Qty', value: formatNumber(targetQty) },
          { label: 'Sorted Qty', value: formatNumber(sortedQty) },
          { label: 'Remaining Qty', value: formatNumber(inboundEstimate.remainingQty) },
          { label: 'Pending Passing Grade', value: formatNumber(passingPendingQty) },
          { label: 'Average Sorting Speed', value: `${formatDecimal(inboundEstimate.speedPerHour)} pcs/hr` },
          { label: 'Normal Work Hours', value: `${formatDecimal(WORKDAY_SHIFT_HOURS)} hr/day` },
          { label: 'Avg Unproductive', value: `${formatDecimal(inboundCapacity.averageUnproductiveHours)} hr/day` },
          { label: 'Remaining Work', value: formatDurationHours(inboundEstimate.remainingHours, inboundEstimate.productiveHoursPerDay) },
          { label: 'Daily Work Capacity', value: `${formatDecimal(inboundEstimate.productiveHoursPerDay)} hr/day` },
          { label: 'Estimated Finish', value: formatDateTimeLabel(inboundEstimate.projectedAt) },
        ],
      })
    }

    const qcDoneQty = qcRows.reduce((total, row) => (
      total + Number(row.qty_a || 0) + Number(row.qty_b || 0) + Number(row.qty_c || 0)
    ), 0)
    const qcTargetQty = sortedQty || targetQty
    const qcActivityRows = qcRows.filter((row) => Number(row.qty_a || 0) + Number(row.qty_b || 0) + Number(row.qty_c || 0) > 0)
    const qcPauseRowsForInbound = qcRows.flatMap((row) => qcPauseRowsByTaskId.get(String(row.id || '')) || [])
    const qcCapacity = calculateProductiveHoursFromPauseRows(qcActivityRows, qcPauseRowsForInbound, now)
    const qcEstimate = calculateProjectedFinish({
      targetQty: qcTargetQty,
      completedQty: qcDoneQty,
      activityRows: qcActivityRows,
      getDateValue: (row) => row.updated_at || row.created_at,
      now,
      nonWorkingDateSet,
      productiveHoursPerDay: qcCapacity.productiveHoursPerDay,
    })
    const qcEstimateDateKey = extractDateKey(qcEstimate?.projectedAt?.toISOString())

    if (qcEstimate && isDateKeyInRange(qcEstimateDateKey, start, end)) {
      pushTimelineItem(timelineMap, 'qc', qcEstimateDateKey, {
        label: 'QC Estimated Finish',
        count: 1,
        qty: qcEstimate.remainingQty,
        note: `${inbound.grn_number || 'GRN'} | Remaining ${formatNumber(qcEstimate.remainingQty)}`,
        detail: `Projected ${formatDateTimeLabel(qcEstimate.projectedAt)}`,
        tone: 'estimate',
        modalRows: [
          { label: 'GRN Number', value: inbound.grn_number || '-' },
          { label: 'Item Name', value: inbound.item_name || '-' },
          { label: 'Target Qty', value: formatNumber(qcTargetQty) },
          { label: 'QC Qty', value: formatNumber(qcDoneQty) },
          { label: 'Remaining Qty', value: formatNumber(qcEstimate.remainingQty) },
          { label: 'Pending Passing Grade', value: formatNumber(passingPendingQty) },
          { label: 'Average QC Speed', value: `${formatDecimal(qcEstimate.speedPerHour)} pcs/hr` },
          { label: 'Normal Work Hours', value: `${formatDecimal(WORKDAY_SHIFT_HOURS)} hr/day` },
          { label: 'Avg Unproductive', value: `${formatDecimal(qcCapacity.averageUnproductiveHours)} hr/day` },
          { label: 'Remaining Work', value: formatDurationHours(qcEstimate.remainingHours, qcEstimate.productiveHoursPerDay) },
          { label: 'Daily Work Capacity', value: `${formatDecimal(qcEstimate.productiveHoursPerDay)} hr/day` },
          { label: 'Estimated Finish', value: formatDateTimeLabel(qcEstimate.projectedAt) },
        ],
      })
    }
  })

  groupRowsByDate(inboundRows || [], (row) => extractDateKey(row.inbound_date)).forEach((rows, dateKey) => {
    rows.forEach((row) => {
      pushTimelineItem(timelineMap, 'inbound', dateKey, {
        label: 'GRN Received',
        count: 1,
        qty: Number(row.total_received_qty || 0),
        note: `${row.grn_number || 'GRN'} | ${formatNumber(row.total_koli)} koli | SJ ${formatNumber(row.total_claimed_qty)}`,
        detail: row.item_name || '',
        tone: 'inbound',
        modalRows: [
          { label: 'GRN Number', value: row.grn_number || '-' },
          { label: 'Item', value: row.item_name || '-' },
          { label: 'Koli', value: formatNumber(row.total_koli) },
          { label: 'SJ Qty', value: formatNumber(row.total_claimed_qty) },
          { label: 'Inbound Qty', value: formatNumber(row.total_received_qty) },
        ],
      })
    })
  })

  groupRowsByDate(inboundUnloadRows || [], (row) => extractDateKey(row.created_at)).forEach((rows, dateKey) => {
    const summary = rows.reduce((result, row) => {
      const inbound = inboundById.get(String(row.inbound_id || ''))
      const grnNumber = String(inbound?.grn_number || row.inbound_id || '').trim()
      const modelKey = String(row.product_model_id || row.model_name || '').trim()
      const variantKey = [
        row.product_model_variant_id,
        row.variant_code,
        row.variant_label,
        row.variant_name,
        row.model_name,
      ].map((value) => String(value || '').trim()).find(Boolean)

      result.qty += Number(row.qty || 0)
      result.count += 1
      if (grnNumber) result.grnKeys.add(grnNumber)
      if (modelKey) result.modelKeys.add(modelKey)
      if (variantKey) result.variantKeys.add(variantKey)
      return result
    }, { qty: 0, count: 0, grnKeys: new Set(), modelKeys: new Set(), variantKeys: new Set() })

    pushTimelineItem(timelineMap, 'inbound', dateKey, {
      label: 'Sorting Process',
      count: summary.count,
      qty: summary.qty,
      note: `${formatNumber(summary.grnKeys.size)} GRN | Sorted Qty ${formatNumber(summary.qty)}`,
      detail: `${formatNumber(summary.modelKeys.size)} model | ${formatNumber(summary.variantKeys.size)} variant`,
      modalRows: [
        { label: 'GRN', value: Array.from(summary.grnKeys).join(', ') || '-' },
        { label: 'Sorted Qty', value: formatNumber(summary.qty) },
        { label: 'Model', value: formatNumber(summary.modelKeys.size) },
        { label: 'Variant', value: formatNumber(summary.variantKeys.size) },
      ],
    })
  })

  groupRowsByDate(arklineReceiptRows || [], (row) => extractDateKey(row.receive_date)).forEach((rows, dateKey) => {
    groupRowsByValue(rows, (row) => String(row.po_id || '').trim()).forEach((poRows, poId) => {
      if (!poId) return

      pushTimelineItem(timelineMap, 'inbound', dateKey, {
        label: 'Arkline Inbound',
        count: poRows.length,
        qty: sumBy(poRows, 'received_qty'),
        note: `${poId} | Qty ${formatNumber(sumBy(poRows, 'received_qty'))}`,
        detail: `${poRows.length} receipt line`,
        tone: 'inbound',
        modalRows: [
          { label: 'PO Number', value: poId },
          { label: 'Inbound Qty', value: formatNumber(sumBy(poRows, 'received_qty')) },
          { label: 'Receipt Line', value: formatNumber(poRows.length) },
        ],
      })
    })
  })

  groupRowsByDate(
    (qcItemRows || []).filter((row) => Number(row.qty_a || 0) + Number(row.qty_b || 0) + Number(row.qty_c || 0) > 0),
    (row) => extractDateKey(row.updated_at || row.created_at)
  ).forEach((rows, dateKey) => {
    const summary = rows.reduce((result, row) => {
      const brandName = String(row.inbound_unload?.brands?.brand_name || 'Unbranded').trim()
      const categoryName = String(row.inbound_unload?.categories?.full_name || row.inbound_unload?.categories?.category_name || 'Uncategorized').trim()
      const grnNumber = String(row.inbound?.grn_number || '').trim()
      const sourceKey = grnNumber || String(row.inbound_id || '').trim()

      result.qty += Number(row.qty_a || 0) + Number(row.qty_b || 0) + Number(row.qty_c || 0)
      result.count += 1
      if (sourceKey) result.grnKeys.add(sourceKey)
      result.categoryKeys.add(`${brandName}::${categoryName}`)
      return result
    }, { qty: 0, count: 0, grnKeys: new Set(), categoryKeys: new Set() })

    pushTimelineItem(timelineMap, 'qc', dateKey, {
      label: 'Reguler Grading',
      count: summary.count,
      qty: summary.qty,
      note: `${formatNumber(summary.grnKeys.size)} GRN | Qty ${formatNumber(summary.qty)}`,
      detail: `${formatNumber(summary.categoryKeys.size)} brand/category group`,
      modalRows: [
        { label: 'GRN', value: Array.from(summary.grnKeys).join(', ') || '-' },
        { label: 'QC Qty', value: formatNumber(summary.qty) },
        { label: 'Brand / Category Group', value: formatNumber(summary.categoryKeys.size) },
      ],
    })
  })

  groupRowsByDate(
    (arklineQcRows || []).filter((row) => Number(row.allocated_qty || 0) + Number(row.qty_a || 0) + Number(row.qty_b || 0) + Number(row.qty_c || 0) > 0),
    (row) => extractDateKey(row.finished_at || row.updated_at || row.created_at)
  ).forEach((rows, dateKey) => {
    const groupedRows = rows.reduce((result, row) => {
      const poId = String(row.po_id || '').trim()
      const skuInduk = String(row.sku_induk || row.arkline_po_items?.sku_induk || '').trim()
      const itemName = String(row.arkline_po_items?.nama_produk || row.model_name || 'Arkline item').trim()
      const key = `${poId}::${skuInduk || itemName}`
      const gradedQty = Number(row.qty_a || 0) + Number(row.qty_b || 0) + Number(row.qty_c || 0)
      const current = result.get(key) || {
        poId,
        skuInduk,
        itemName,
        qty: 0,
        count: 0,
      }

      current.qty += gradedQty || Number(row.allocated_qty || 0)
      current.count += 1
      result.set(key, current)
      return result
    }, new Map())

    Array.from(groupedRows.values()).forEach((group) => {
      pushTimelineItem(timelineMap, 'qc', dateKey, {
        label: 'Arkline Grading',
        count: group.count,
        qty: group.qty,
        note: `${group.poId || 'PO'} | ${group.skuInduk ? `${group.skuInduk} - ` : ''}${group.itemName}`,
        detail: `Qty ${formatNumber(group.qty)}`,
        modalRows: [
          { label: 'PO Number', value: group.poId || '-' },
          { label: 'SKU', value: group.skuInduk || '-' },
          { label: 'Item', value: group.itemName || '-' },
          { label: 'QC Qty', value: formatNumber(group.qty) },
          { label: 'Task Line', value: formatNumber(group.count) },
        ],
      })
    })
  })

  const completedRegularReturnRows = (regularReturnRows || []).filter((row) => String(row.status || '').trim().toLowerCase() === 'completed')

  groupRowsByDate(completedRegularReturnRows, (row) => extractDateKey(row.updated_at)).forEach((rows, dateKey) => {
    const returnQty = sumBy(rows, 'qty')
    const inboundLabels = new Set(rows.map((row) => String(row.inbound?.grn_number || row.inbound_id || '').trim()).filter(Boolean))

    pushTimelineItem(timelineMap, 'qc', dateKey, {
      label: 'Reguler Return',
      count: rows.length,
      qty: returnQty,
      note: `${Array.from(inboundLabels).join(', ') || 'Inbound -'} | Total Qty ${formatNumber(returnQty)}`,
      detail: `Total Qty ${formatNumber(returnQty)}`,
      tone: 'return',
      modalRows: [
        { label: 'Nomor Inbound', value: Array.from(inboundLabels).join(', ') || '-' },
        { label: 'Total Qty', value: formatNumber(returnQty) },
      ],
    })
  })

  groupRowsByDate(arklineReturnRows || [], (row) => extractDateKey(row.return_date)).forEach((rows, dateKey) => {
    const returnQty = sumBy(rows, 'sent_qty')
    const poKeys = new Set(rows.map((row) => String(row.po_id || '').trim()).filter(Boolean))

    pushTimelineItem(timelineMap, 'qc', dateKey, {
      label: 'Arkline Return',
      count: rows.length,
      qty: returnQty,
      note: `${formatNumber(poKeys.size)} PO | Sent Qty ${formatNumber(returnQty)}`,
      detail: `${formatNumber(rows.length)} return batch`,
      tone: 'return',
      modalRows: [
        { label: 'PO Number', value: Array.from(poKeys).join(', ') || '-' },
        { label: 'Sent Qty', value: formatNumber(returnQty) },
        { label: 'Return Batch', value: formatNumber(rows.length) },
      ],
    })
  })

  groupRowsByDate(arklineReworkReceiptRows || [], (row) => extractDateKey(row.receive_date)).forEach((rows, dateKey) => {
    const returnedQty = sumBy(rows, 'received_qty')
    const poKeys = new Set(rows.map((row) => String(row.po_id || '').trim()).filter(Boolean))

    pushTimelineItem(timelineMap, 'qc', dateKey, {
      label: 'Arkline Return Back',
      count: rows.length,
      qty: returnedQty,
      note: `${formatNumber(poKeys.size)} PO | Returned Qty ${formatNumber(returnedQty)}`,
      detail: `${formatNumber(rows.length)} rework receipt`,
      tone: 'returnBack',
      modalRows: [
        { label: 'PO Number', value: Array.from(poKeys).join(', ') || '-' },
        { label: 'Returned Back Qty', value: formatNumber(returnedQty) },
        { label: 'Rework Receipt', value: formatNumber(rows.length) },
      ],
    })
  })

  if (plReceivingSummaryRows.length) {
    plReceivingSummaryRows.forEach((row) => {
      const dateKey = extractDateKey(row.event_date)
      const receivedQty = Number(row.received_qty || 0)
      const validatedQty = Number(row.validated_qty || 0)
      const receivedRows = Number(row.received_rows || 0)
      const validatedRows = Number(row.validated_rows || 0)

      pushTimelineItem(timelineMap, 'packing', dateKey, {
        label: 'PL Receiving',
        count: receivedRows + validatedRows,
        qty: receivedQty,
        note: `Received Qty ${formatNumber(receivedQty)} | Validated Qty ${formatNumber(validatedQty)}`,
        detail: `${formatNumber(validatedRows)} validated row(s)`,
      })
    })
  } else {
    const plReceivingByDate = new Map()
    const getPlReceivingSummary = (dateKey) => {
      const current = plReceivingByDate.get(dateKey) || {
        receivedQty: 0,
        validatedQty: 0,
        receivedRows: 0,
        validatedRows: 0,
      }
      plReceivingByDate.set(dateKey, current)
      return current
    }

    plReceivingRawRows.forEach((row) => {
      const rowQty = Number(row.received_qty ?? row.qty ?? row.qc_confirm_qty ?? 0)
      const receivedDateKey = extractDateKey(row.created_at)
      const validatedDateKey = extractDateKey(row.validated_at)

      if (receivedDateKey) {
        const summary = getPlReceivingSummary(receivedDateKey)
        summary.receivedQty += rowQty
        summary.receivedRows += 1
      }

      if (validatedDateKey) {
        const summary = getPlReceivingSummary(validatedDateKey)
        summary.validatedQty += rowQty
        summary.validatedRows += 1
      }
    })

    plReceivingByDate.forEach((summary, dateKey) => {
      pushTimelineItem(timelineMap, 'packing', dateKey, {
        label: 'PL Receiving',
        count: summary.receivedRows + summary.validatedRows,
        qty: summary.receivedQty,
        note: `Received Qty ${formatNumber(summary.receivedQty)} | Validated Qty ${formatNumber(summary.validatedQty)}`,
        detail: `${formatNumber(summary.validatedRows)} validated row(s)`,
      })
    })
  }

  if (plBreakdownSummaryRows.length) {
    plBreakdownSummaryRows.forEach((row) => {
      const dateKey = extractDateKey(row.event_date)
      const grnNumbers = Array.isArray(row.grn_numbers) ? row.grn_numbers.filter(Boolean) : []
      const itemNames = Array.isArray(row.item_names) ? row.item_names.filter(Boolean) : []
      const lineCount = Number(row.line_count || 0)
      const breakdownQty = Number(row.breakdown_qty || 0)

      pushTimelineItem(timelineMap, 'packing', dateKey, {
        label: 'PL Breakdown',
        count: lineCount,
        qty: breakdownQty,
        note: `${formatNumber(row.grn_count || grnNumbers.length)} GRN | Breakdown Qty ${formatNumber(breakdownQty)}`,
        detail: `${formatNumber(lineCount)} breakdown line(s)`,
        modalRows: [
          { label: 'GRN Number', value: grnNumbers.join(', ') || '-' },
          { label: 'Item Name', value: itemNames.join(', ') || '-' },
          { label: 'Breakdown Qty', value: formatNumber(breakdownQty) },
          { label: 'Breakdown Line', value: formatNumber(lineCount) },
        ],
      })
    })
  } else {
    groupRowsByDate(plBreakdownRawRows, (row) => extractDateKey(row.updated_at || row.created_at)).forEach((rows, dateKey) => {
      const grnKeys = new Set(rows.map((row) => {
        const inbound = inboundById.get(String(row.inbound_id || ''))
        return String(inbound?.grn_number || row.grn_number || row.inbound_id || '').trim()
      }).filter(Boolean))
      const itemNames = new Set(rows.map((row) => {
        const inbound = inboundById.get(String(row.inbound_id || ''))
        return String(inbound?.item_name || '').trim()
      }).filter(Boolean))
      const breakdownQty = sumBy(rows, ['qty', 'received_qty', 'breakdown_qty'])

      pushTimelineItem(timelineMap, 'packing', dateKey, {
        label: 'PL Breakdown',
        count: rows.length,
        qty: breakdownQty,
        note: `${formatNumber(grnKeys.size)} GRN | Breakdown Qty ${formatNumber(breakdownQty)}`,
        detail: `${formatNumber(rows.length)} breakdown line(s)`,
        modalRows: [
          { label: 'GRN Number', value: Array.from(grnKeys).join(', ') || '-' },
          { label: 'Item Name', value: Array.from(itemNames).join(', ') || '-' },
          { label: 'Breakdown Qty', value: formatNumber(breakdownQty) },
          { label: 'Breakdown Line', value: formatNumber(rows.length) },
        ],
      })
    })
  }

  if (warehouseStorageSummaryRows.length) {
    warehouseStorageSummaryRows.forEach((row) => {
      const dateKey = extractDateKey(row.event_date)
      const storedQty = Number(row.stored_qty || 0)
      const storageLineCount = Number(row.storage_line_count || 0)
      const storageKoliCount = Number(row.storage_k_count || 0)

      pushTimelineItem(timelineMap, 'storage', dateKey, {
        label: 'Stored to Rack',
        count: storageLineCount,
        qty: storedQty,
        note: `Stored Qty ${formatNumber(storedQty)} | ${formatNumber(storageKoliCount)} K`,
        detail: `${formatNumber(storageLineCount)} storage line(s)`,
      })
    })
  } else {
    groupRowsByDate(warehouseStorageRawRows, (row) => extractDateKey(row.created_at)).forEach((rows, dateKey) => {
      const storedQty = sumBy(rows, 'qty')
      const storageKoliCount = new Set(rows.map(getStorageKoliKey).filter(Boolean)).size

      pushTimelineItem(timelineMap, 'storage', dateKey, {
        label: 'Stored to Rack',
        count: rows.length,
        qty: storedQty,
        note: `Stored Qty ${formatNumber(storedQty)} | ${formatNumber(storageKoliCount)} K`,
        detail: `${formatNumber(rows.length)} storage line(s)`,
      })
    })
  }

  if (restockSummaryRows.length) {
    restockSummaryRows.forEach((row) => {
      const dateKey = extractDateKey(row.event_date)
      const restockQty = Number(row.picked_qty || 0)
      const completedCount = Number(row.completed_request_count || 0)

      pushTimelineItem(timelineMap, 'storage', dateKey, {
        label: 'Restock',
        count: completedCount,
        qty: restockQty,
        note: `Picked Qty ${formatNumber(restockQty)}`,
        detail: `${formatNumber(completedCount)} completed request(s)`,
      })
    })
  } else {
    groupRowsByDate(
      restockRawRows.filter((row) => String(row.request_status || '').toLowerCase() === 'completed'),
      (row) => extractDateKey(row.completed_at || row.created_at)
    ).forEach((rows, dateKey) => {
      const restockQty = sumBy(rows, 'qty')

      pushTimelineItem(timelineMap, 'storage', dateKey, {
        label: 'Restock',
        count: rows.length,
        qty: restockQty,
        note: `Picked Qty ${formatNumber(restockQty)}`,
        detail: `${formatNumber(rows.length)} completed request(s)`,
      })
    })
  }

  return timelineMap
}

function TimelineView({ monthDays, timelineMap, currentDateKey }) {
  return (
    <div className={styles.timelineCard}>
      <div className={styles.timelineScroller}>
        <div
          className={styles.timelineGrid}
          style={{ gridTemplateColumns: `220px repeat(${monthDays.length}, minmax(128px, 1fr))` }}
        >
          <div className={`${styles.timelineCorner} ${styles.timelineStickyLeft}`}>
            <span>Division</span>
            <strong>Daily Timeline</strong>
          </div>

          {monthDays.map((day) => (
            <div
              key={day.key}
              className={`${styles.timelineDateHeader} ${day.key === currentDateKey ? styles.timelineToday : ''} ${day.weekday === 'Sun' ? styles.sundayText : ''}`}
            >
              <span>{day.weekday}</span>
              <strong>{day.dayNumber}</strong>
            </div>
          ))}

          {DIVISIONS.map((division) => (
            <FragmentTimelineRow
              key={division.key}
              division={division}
              monthDays={monthDays}
              timelineMap={timelineMap}
              currentDateKey={currentDateKey}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function FragmentTimelineRow({ division, monthDays, timelineMap, currentDateKey }) {
  return (
    <>
      <div className={`${styles.timelineDivisionCell} ${styles.timelineStickyLeft}`}>
        <span className={`${styles.divisionPill} ${styles[`divisionPill${division.accent}`]}`}>{division.label}</span>
        <small>{monthDays.filter((day) => (timelineMap.get(`${division.key}::${day.key}`)?.items || []).length > 0).length} active day(s)</small>
      </div>

      {monthDays.map((day) => {
        const entry = timelineMap.get(`${division.key}::${day.key}`)
        const hasItems = Boolean(entry?.items?.length)

        return (
          <div
            key={`${division.key}-${day.key}`}
            className={`${styles.timelineDayCell} ${day.key === currentDateKey ? styles.timelineToday : ''} ${hasItems ? styles.timelineDayCellActive : ''}`}
          >
            {hasItems ? (
              <div className={styles.timelineItemStack}>
                {entry.items.map((item, index) => (
                  <article key={`${item.label}-${index}`} className={`${styles.timelineItemCard} ${styles[`timelineItemCard${division.accent}`]}`}>
                    <strong>{item.label}</strong>
                    <span>{item.note}</span>
                    {item.detail ? <small>{item.detail}</small> : null}
                  </article>
                ))}
              </div>
            ) : (
              <span className={styles.timelineEmptyMark}>-</span>
            )}
          </div>
        )
      })}
    </>
  )
}

function CalendarView({ monthDays, daySummaryMap, currentDateKey }) {
  const firstDayDate = new Date(`${monthDays[0].key}T00:00:00Z`)
  const leadingEmptyCells = (firstDayDate.getUTCDay() + 6) % 7
  const calendarCells = [
    ...Array.from({ length: leadingEmptyCells }, (_, index) => ({ type: 'empty', key: `empty-${index}` })),
    ...monthDays.map((day) => ({ type: 'day', key: day.key, day })),
  ]

  return (
    <div className={styles.calendarCard}>
      <div className={styles.calendarWeekdays}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <div key={label} className={`${styles.calendarWeekdayCell} ${label === 'Sun' ? styles.sundayText : ''}`}>{label}</div>
        ))}
      </div>

      <div className={styles.calendarGrid}>
        {calendarCells.map((cell) => {
          if (cell.type === 'empty') {
            return <div key={cell.key} className={styles.calendarEmptyCell} />
          }

          const divisions = daySummaryMap.get(cell.day.key) || []

          return (
            <section
              key={cell.key}
              className={`${styles.calendarDayCell} ${cell.day.key === currentDateKey ? styles.calendarToday : ''}`}
            >
              <div className={styles.calendarDayHeader}>
                <strong className={cell.day.weekday === 'Sun' ? styles.sundayText : ''}>{cell.day.dayNumber}</strong>
                <span className={cell.day.weekday === 'Sun' ? styles.sundayText : ''}>{cell.day.weekday}</span>
              </div>

              {divisions.length ? (
                <div className={styles.calendarDivisionStack}>
                  {divisions.map((division) => (
                    <article key={`${cell.day.key}-${division.key}`} className={styles.calendarDivisionCard}>
                      <div className={styles.calendarDivisionHead}>
                        <span className={`${styles.divisionPill} ${styles[`divisionPill${division.accent}`]}`}>{division.label}</span>
                        <small>{division.totals.activities} item</small>
                      </div>
                      <div className={styles.calendarDivisionItems}>
                        {division.items.slice(0, 3).map((item, index) => (
                          <div key={`${item.label}-${index}`} className={styles.calendarDivisionItem}>
                            <strong>{item.label}</strong>
                            <span>{item.note}</span>
                          </div>
                        ))}
                        {division.items.length > 3 ? (
                          <div className={styles.calendarMore}>+{division.items.length - 3} more activity</div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.calendarEmptyState}>No activity recorded.</div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Operations Calendar | Warehouse MS',
}

export default async function OperationsCalendarPage({ searchParams }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, permissions, isAdmin } = await loadAccessContext(supabase, user, 'role, display_name')

  if (!canAccessOperationsCalendar(role, permissions, isAdmin)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const month = normalizeMonthValue(params?.month)
  const view = String(params?.view || 'timeline').toLowerCase() === 'calendar' ? 'calendar' : 'timeline'
  const warehouseHolidayDateSet = await loadWarehouseHolidayDateSet(supabase, month)
  const monthDays = getMonthDays(month).map((day) => ({
    ...day,
    isWarehouseHoliday: warehouseHolidayDateSet.has(day.key),
  }))
  const currentDateKey = extractDateKey(new Date().toISOString())
  const timelineMap = await loadOperationsCalendarData(supabase, month, warehouseHolidayDateSet)
  const formOptions = await loadOperationsCalendarFormOptions(supabase)
  const manualDivisionKey = getRoleDivision(isAdmin ? 'admin' : role)
  const daySummaryMap = createDaySummaryMap(monthDays, timelineMap)
  const timelineEntries = Array.from(timelineMap.entries()).map(([key, value]) => ({
    key,
    ...value,
  }))
  const daySummaries = monthDays.map((day) => ({
    dateKey: day.key,
    divisions: daySummaryMap.get(day.key) || [],
  }))

  return (
    <div className={styles.pageShell}>
      <OperationsCalendarClient
        initialMonth={month}
        initialView={view}
        monthLabel={getMonthLabel(month)}
        monthDays={monthDays}
        currentDateKey={currentDateKey}
        timelineEntries={timelineEntries}
        daySummaries={daySummaries}
        formOptions={formOptions}
        canAddTarget={canManageOperationsTargets(role, isAdmin)}
        manualDivisionKey={manualDivisionKey}
        statusMessage={{
          type: String(params?.status || ''),
          text: String(params?.message || ''),
        }}
      />
    </div>
  )
}
