import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { loadAccessContext } from '@/utils/access-control'
import OperationsCalendarClient from './page-client'
import styles from './page.module.css'

const DIVISIONS = [
  { key: 'inbound', label: 'Inbound', accent: 'blue' },
  { key: 'qc', label: 'Quality Control', accent: 'amber' },
  { key: 'packing', label: 'Packing List', accent: 'rose' },
  { key: 'storage', label: 'Stockkeeping', accent: 'emerald' },
]

function canAccessOperationsCalendar(role, isAdmin) {
  if (isAdmin) return true
  if (role === 'warehouse_leader') return true
  return String(role || '').endsWith('_coordinator')
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

async function loadOperationsCalendarData(supabase, monthValue) {
  const { start, end } = getMonthBounds(monthValue)
  const timelineMap = createDivisionDayMap()

  const [
    { data: inboundRows, error: inboundError },
    { data: inboundReceivingRows, error: inboundReceivingError },
    { data: inboundUnloadRows, error: inboundUnloadError },
    { data: qcItemRows, error: qcItemError },
    { data: qcConfirmRows, error: qcConfirmError },
    { data: arklineQcRows, error: arklineQcError },
    { data: plReceivingRows, error: plReceivingError },
    { data: plBreakdownRows, error: plBreakdownError },
    { data: warehouseStorageRows, error: warehouseStorageError },
    { data: restockRows, error: restockError },
  ] = await Promise.all([
    supabase
      .from('inbound')
      .select('id, grn_number, inbound_date, total_koli, total_claimed_qty, total_received_qty, item_name')
      .gte('inbound_date', start)
      .lt('inbound_date', end)
      .order('inbound_date', { ascending: true }),
    supabase
      .from('inbound_receiving')
      .select('id, inbound_id, actual_qty, sample_qty, koli_sequence, created_at, updated_at')
      .gte('updated_at', `${start}T00:00:00`)
      .lt('updated_at', `${end}T00:00:00`)
      .order('updated_at', { ascending: true }),
    supabase
      .from('inbound_unload')
      .select('id, inbound_id, qty, created_at')
      .gte('created_at', `${start}T00:00:00`)
      .lt('created_at', `${end}T00:00:00`)
      .order('created_at', { ascending: true }),
    supabase
      .from('qc_items')
      .select('id, inbound_id, allocated_qty, qty_in, qty_a, qty_b, qty_c, created_at, updated_at')
      .gte('created_at', `${start}T00:00:00`)
      .lt('created_at', `${end}T00:00:00`)
      .order('created_at', { ascending: true }),
    supabase
      .from('qc_confirm')
      .select('id, inbound_id, qty, created_at')
      .gte('created_at', `${start}T00:00:00`)
      .lt('created_at', `${end}T00:00:00`)
      .order('created_at', { ascending: true }),
    supabase
      .from('arkline_qc')
      .select('id, po_id, sku_induk, allocated_qty, qty_a, qty_b, qty_c, created_at, finished_at, updated_at')
      .or(`created_at.gte.${start}T00:00:00,updated_at.gte.${start}T00:00:00`)
      .lt('created_at', `${end}T00:00:00`)
      .order('created_at', { ascending: true }),
    supabase
      .from('pl_receiving')
      .select('*')
      .gte('created_at', `${start}T00:00:00`)
      .lt('created_at', `${end}T00:00:00`)
      .order('created_at', { ascending: true }),
    supabase
      .from('pl_size_breakdown')
      .select('*')
      .gte('updated_at', `${start}T00:00:00`)
      .lt('updated_at', `${end}T00:00:00`)
      .order('updated_at', { ascending: true }),
    supabase
      .from('warehouse_storage')
      .select('id, item_name, qty, created_at')
      .gte('created_at', `${start}T00:00:00`)
      .lt('created_at', `${end}T00:00:00`)
      .order('created_at', { ascending: true }),
    supabase
      .from('restock_request')
      .select('id, item_name, qty, request_status, completed_at, created_at')
      .gte('completed_at', `${start}T00:00:00`)
      .lt('completed_at', `${end}T00:00:00`)
      .order('completed_at', { ascending: true }),
  ])

  const error =
    inboundError ||
    inboundReceivingError ||
    inboundUnloadError ||
    qcItemError ||
    qcConfirmError ||
    arklineQcError ||
    plReceivingError ||
    plBreakdownError ||
    warehouseStorageError ||
    restockError

  if (error) {
    throw error
  }

  const inboundById = new Map((inboundRows || []).map((row) => [String(row.id), row]))

  groupRowsByDate(inboundRows || [], (row) => extractDateKey(row.inbound_date)).forEach((rows, dateKey) => {
    pushTimelineItem(timelineMap, 'inbound', dateKey, {
      label: 'GRN Received',
      count: rows.length,
      qty: sumBy(rows, 'total_received_qty'),
      note: `${rows.length} GRN masuk | ${formatNumber(sumBy(rows, 'total_koli'))} koli | SJ ${formatNumber(sumBy(rows, 'total_claimed_qty'))}`,
      detail: rows.slice(0, 3).map((row) => row.grn_number).filter(Boolean).join(', '),
    })
  })

  groupRowsByDate(inboundReceivingRows || [], (row) => extractDateKey(row.updated_at || row.created_at)).forEach((rows, dateKey) => {
    pushTimelineItem(timelineMap, 'inbound', dateKey, {
      label: 'Receiving Input',
      count: rows.length,
      qty: sumBy(rows, 'actual_qty'),
      note: `${formatNumber(sumBy(rows, 'actual_qty'))} qty actual | Sample ${formatNumber(sumBy(rows, 'sample_qty'))}`,
      detail: `${rows.length} baris receiving diperbarui`,
    })
  })

  groupRowsByDate(inboundUnloadRows || [], (row) => extractDateKey(row.created_at)).forEach((rows, dateKey) => {
    const inboundIds = new Set(rows.map((row) => String(row.inbound_id || '')).filter(Boolean))
    const grnList = Array.from(inboundIds)
      .map((id) => inboundById.get(id)?.grn_number)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ')

    pushTimelineItem(timelineMap, 'inbound', dateKey, {
      label: 'Sorting & Unload',
      count: rows.length,
      qty: sumBy(rows, 'qty'),
      note: `${formatNumber(sumBy(rows, 'qty'))} qty tersortir`,
      detail: grnList || `${rows.length} baris unload`,
    })
  })

  groupRowsByDate(
    (qcItemRows || []).filter((row) => Number(row.qty_a || 0) + Number(row.qty_b || 0) + Number(row.qty_c || 0) > 0),
    (row) => extractDateKey(row.updated_at || row.created_at)
  ).forEach((rows, dateKey) => {
    const totalQty = rows.reduce((total, row) => total + Number(row.qty_a || 0) + Number(row.qty_b || 0) + Number(row.qty_c || 0), 0)
    pushTimelineItem(timelineMap, 'qc', dateKey, {
      label: 'QC Grading',
      count: rows.length,
      qty: totalQty,
      note: `Total qty ${formatNumber(totalQty)}`,
      detail: `${rows.length} task selesai grading`,
    })
  })

  groupRowsByDate(qcConfirmRows || [], (row) => extractDateKey(row.created_at)).forEach((rows, dateKey) => {
    pushTimelineItem(timelineMap, 'qc', dateKey, {
      label: 'QC Confirmation',
      count: rows.length,
      qty: sumBy(rows, 'qty'),
      note: `${formatNumber(sumBy(rows, 'qty'))} qty terverifikasi`,
      detail: `${rows.length} baris confirm QC`,
    })
  })

  groupRowsByDate(arklineQcRows || [], (row) => extractDateKey(row.created_at)).forEach((rows, dateKey) => {
    pushTimelineItem(timelineMap, 'qc', dateKey, {
      label: 'Arkline QC Start',
      count: rows.length,
      qty: sumBy(rows, 'allocated_qty'),
      note: `Total qty ${formatNumber(sumBy(rows, 'allocated_qty'))}`,
      detail: `${rows.length} task Arkline dibuat`,
    })
  })

  groupRowsByDate(
    (arklineQcRows || []).filter((row) => Number(row.qty_a || 0) + Number(row.qty_b || 0) + Number(row.qty_c || 0) > 0),
    (row) => extractDateKey(row.finished_at || row.updated_at || row.created_at)
  ).forEach((rows, dateKey) => {
    const totalQty = rows.reduce((total, row) => total + Number(row.qty_a || 0) + Number(row.qty_b || 0) + Number(row.qty_c || 0), 0)
    pushTimelineItem(timelineMap, 'qc', dateKey, {
      label: 'Arkline QC Finish',
      count: rows.length,
      qty: totalQty,
      note: `Total qty ${formatNumber(totalQty)}`,
      detail: `${rows.length} task Arkline selesai`,
    })
  })

  groupRowsByDate(plReceivingRows || [], (row) => extractDateKey(row.created_at)).forEach((rows, dateKey) => {
    pushTimelineItem(timelineMap, 'packing', dateKey, {
      label: 'PL Receiving',
      count: rows.length,
      qty: sumBy(rows, ['received_qty', 'qty', 'qc_confirm_qty']),
      note: `${formatNumber(sumBy(rows, ['received_qty', 'qty', 'qc_confirm_qty']))} qty diterima`,
      detail: `${rows.length} baris PL receiving`,
    })
  })

  groupRowsByDate(
    (plReceivingRows || []).filter((row) => row.validated_at),
    (row) => extractDateKey(row.validated_at)
  ).forEach((rows, dateKey) => {
    pushTimelineItem(timelineMap, 'packing', dateKey, {
      label: 'PL Validation',
      count: rows.length,
      qty: sumBy(rows, ['received_qty', 'qty']),
      note: `${rows.length} koli/baris tervalidasi`,
      detail: `Qty valid ${formatNumber(sumBy(rows, ['received_qty', 'qty']))}`,
    })
  })

  groupRowsByDate(plBreakdownRows || [], (row) => extractDateKey(row.updated_at || row.created_at)).forEach((rows, dateKey) => {
    pushTimelineItem(timelineMap, 'packing', dateKey, {
      label: 'Size Breakdown',
      count: rows.length,
      qty: sumBy(rows, ['qty', 'received_qty']),
      note: `${rows.length} detail size diproses`,
      detail: `Qty breakdown ${formatNumber(sumBy(rows, ['qty', 'received_qty']))}`,
    })
  })

  groupRowsByDate(warehouseStorageRows || [], (row) => extractDateKey(row.created_at)).forEach((rows, dateKey) => {
    pushTimelineItem(timelineMap, 'storage', dateKey, {
      label: 'Stored to Rack',
      count: rows.length,
      qty: sumBy(rows, 'qty'),
      note: `${formatNumber(sumBy(rows, 'qty'))} qty disimpan`,
      detail: `${rows.length} entry storage masuk`,
    })
  })

  groupRowsByDate(
    (restockRows || []).filter((row) => String(row.request_status || '').toLowerCase() === 'completed'),
    (row) => extractDateKey(row.completed_at || row.created_at)
  ).forEach((rows, dateKey) => {
    pushTimelineItem(timelineMap, 'storage', dateKey, {
      label: 'Restock / Take',
      count: rows.length,
      qty: sumBy(rows, 'qty'),
      note: `${formatNumber(sumBy(rows, 'qty'))} qty diambil untuk restock`,
      detail: `${rows.length} request selesai`,
    })
  })

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

  const { role, isAdmin } = await loadAccessContext(supabase, user, 'role, display_name')

  if (!canAccessOperationsCalendar(role, isAdmin)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const month = normalizeMonthValue(params?.month)
  const view = String(params?.view || 'timeline').toLowerCase() === 'calendar' ? 'calendar' : 'timeline'
  const monthDays = getMonthDays(month)
  const currentDateKey = extractDateKey(new Date().toISOString())
  const timelineMap = await loadOperationsCalendarData(supabase, month)
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
      />
    </div>
  )
}
