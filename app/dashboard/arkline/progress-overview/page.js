'use client'
import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'

import shellStyles from '../arkline.module.css'
import styles from './progress-overview.module.css'

const supabase = createClient()

const BOARD_STATUSES = ['Initiated', 'On Progress', 'Completed']

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.calendarIcon}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 3.8v3.4M17 3.8v3.4M3.8 9.2h16.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function KanbanIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.calendarIcon}>
      <rect x="4" y="5" width="7" height="5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="5" width="7" height="8" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4" y="12" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="15" width="7" height="4" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function parseIso(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date)
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
}

function normalizeBoardStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'COMPLETED') return 'Completed'
  if (normalized === 'ON PROGRESS' || normalized === 'IN PROGRESS' || normalized === 'ONGOING') return 'On Progress'
  return 'Initiated'
}

function getStatusKey(status) {
  if (status === 'On Progress') return 'OnProgress'
  return status
}

function getDelayDays(targetDate, updatedDate) {
  const target = parseIso(targetDate)
  const updated = parseIso(updatedDate)
  if (!target || !updated) return 0
  const diff = Math.round((updated - target) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

function getDelayTone(targetDate, updatedDate) {
  const delayDays = getDelayDays(targetDate, updatedDate)
  if (delayDays > 14) return 'late'
  if (delayDays > 0) return 'watch'
  return 'ontime'
}

function getLaterIsoDate(...values) {
  let latestValue = ''
  let latestTime = -Infinity

  values.forEach((value) => {
    const normalized = String(value || '').slice(0, 10)
    if (!normalized) return
    const parsed = parseIso(normalized)
    if (!parsed) return
    const nextTime = parsed.getTime()
    if (nextTime > latestTime) {
      latestTime = nextTime
      latestValue = normalized
    }
  })

  return latestValue
}

function buildMonthDays(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const totalDays = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: totalDays }, (_, index) => new Date(year, month, index + 1))
}

function sameMonth(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
}

function sameDay(left, right) {
  return sameMonth(left, right) && left.getDate() === right.getDate()
}

function getLineRange(item, monthDate) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const start = parseIso(item.startDate)
  const end = parseIso(item.completionDate || item.updatedDate || item.targetDate)
  if (!start || !end) return null

  const visibleStart = start < monthStart ? monthStart : start
  const visibleEnd = end > monthEnd ? monthEnd : end
  if (visibleEnd < monthStart || visibleStart > monthEnd) return null

  const totalDays = monthEnd.getDate()
  const startOffset = visibleStart.getDate() - 1
  const spanDays = visibleEnd.getDate() - visibleStart.getDate() + 1

  return {
    left: `${(startOffset / totalDays) * 100}%`,
    width: `${Math.max((spanDays / totalDays) * 100, 4)}%`,
  }
}

function normalizePoRow(row) {
  const poId = String(row?.po_id || '').trim().toUpperCase()
  const supplier = String(row?.supplier_name || '').trim().toUpperCase()
  const method = String(row?.method || 'FOB').trim().toUpperCase()
  const notes = String(row?.notes || '').trim()
  const startDate = String(row?.created_at || '').slice(0, 10)
  const targetDate = String(row?.request_delivery_date || '').slice(0, 10)
  const status = normalizeBoardStatus(row?.status)

  return {
    id: String(row?.id || poId).trim(),
    poId,
    supplier,
    method,
    status,
    startDate,
    targetDate,
    updatedDate: '',
    displayDate: targetDate,
    completionDate: '',
    notes,
    subtitle: notes,
    productNames: [],
    productEntries: [],
    totalQty: 0,
  }
}

async function loadSnapshotRows() {
  const [{ data: poData, error: poError }, { data: itemData, error: itemError }] = await Promise.all([
    supabase
      .from('arkline_pos')
      .select('id, po_id, supplier_name, method, status, request_delivery_date, notes, created_at, updated_at')
      .not('po_id', 'is', null)
      .order('created_at', { ascending: false }),
    supabase.from('arkline_po_items').select('po_id, nama_produk, total_qty, updated_delivery_date, status'),
  ])

  if (poError) {
    throw new Error(poError.message)
  }

  if (itemError) {
    throw new Error(itemError.message)
  }

  const itemSummaryByPoId = (itemData || []).reduce((accumulator, row) => {
    const poId = String(row?.po_id || '').trim().toUpperCase()
    if (!poId) return accumulator

    const productName = String(row?.nama_produk || '').trim().toUpperCase()
    const totalQty = Number(row?.total_qty || 0)
    const updatedDeliveryDate = String(row?.updated_delivery_date || '').slice(0, 10)
    const itemStatus = normalizeBoardStatus(row?.status)

    if (!accumulator[poId]) {
      accumulator[poId] = {
        productNames: [],
        productEntries: [],
        totalQty: 0,
        latestUpdatedDeliveryDate: '',
      }
    }

    if (productName && !accumulator[poId].productNames.includes(productName)) {
      accumulator[poId].productNames.push(productName)
    }

    accumulator[poId].productEntries.push({
      id: `${poId}::${productName || 'NO PRODUCT'}::${accumulator[poId].productEntries.length}`,
      productName: productName || 'NO PRODUCT',
      qty: Number.isFinite(totalQty) ? totalQty : 0,
      updatedDeliveryDate,
      status: itemStatus,
    })

    accumulator[poId].totalQty += Number.isFinite(totalQty) ? totalQty : 0
    accumulator[poId].latestUpdatedDeliveryDate = getLaterIsoDate(accumulator[poId].latestUpdatedDeliveryDate, updatedDeliveryDate)
    return accumulator
  }, {})

  return (poData || [])
    .map((row) => {
      const normalized = normalizePoRow(row)
      const summary = itemSummaryByPoId[normalized.poId]
      const latestUpdatedDeliveryDate = summary?.latestUpdatedDeliveryDate || ''
      const actualDate = getLaterIsoDate(normalized.targetDate, latestUpdatedDeliveryDate)
      return {
        ...normalized,
        productNames: summary?.productNames || [],
        productEntries: (summary?.productEntries || []).map((entry) => ({
          ...entry,
          targetDate: normalized.targetDate,
          displayDate: getLaterIsoDate(normalized.targetDate, entry.updatedDeliveryDate),
        })),
        totalQty: summary?.totalQty || 0,
        updatedDate: actualDate,
        displayDate: actualDate || normalized.targetDate || normalized.startDate,
        completionDate: normalized.status === 'Completed' ? actualDate : '',
        latestUpdatedDeliveryDate,
      }
    })
    .filter((item) => item.poId)
}

function getStatusSymbol(status) {
  if (status === 'Completed') return '●'
  if (status === 'On Progress') return '◐'
  return '○'
}

function getPoSortNumber(poId) {
  const match = String(poId || '').trim().toUpperCase().match(/^PO-(\d+)-/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function comparePoItems(left, right) {
  const leftNumber = getPoSortNumber(left?.poId)
  const rightNumber = getPoSortNumber(right?.poId)
  if (leftNumber !== rightNumber) return leftNumber - rightNumber
  return String(left?.poId || '').localeCompare(String(right?.poId || ''), undefined, { numeric: true })
}

export default function ArklineProgressOverviewPage() {
  const [view, setView] = useState('kanban')
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [lastRefresh, setLastRefresh] = useState(() => new Date())
  const [productFilter, setProductFilter] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [poRows, setPoRows] = useState([])
  const [selectedPoDetail, setSelectedPoDetail] = useState(null)

  useEffect(() => {
    void refreshRows()
  }, [])

  async function refreshRows() {
    setLoading(true)
    setLoadError('')

    try {
      const rows = await loadSnapshotRows()
      setPoRows(rows)
      setLastRefresh(new Date())
    } catch (error) {
      setLoadError(error.message || 'Failed to load Arkline progress snapshot.')
    } finally {
      setLoading(false)
    }
  }

  const monthDays = useMemo(() => buildMonthDays(monthDate), [monthDate])

  const filteredRows = useMemo(() => {
    const keyword = productFilter.trim().toUpperCase()
    return poRows.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [item.poId, item.supplier, item.method, item.status, item.notes, ...(item.productNames || [])]
          .join(' ')
          .toUpperCase()
          .includes(keyword)
      return matchesKeyword
    })
  }, [poRows, productFilter])

  const productItemsInMonth = useMemo(
    () =>
      filteredRows.filter((item) => {
        if (item.status === 'Completed') {
          return false
        }
        const display = parseIso(item.displayDate || item.updatedDate || item.targetDate)
        const created = parseIso(item.startDate)
        return (display && sameMonth(display, monthDate)) || (created && sameMonth(created, monthDate))
      }),
    [filteredRows, monthDate]
  )
  const calendarItemsInMonth = useMemo(
    () =>
      filteredRows.flatMap((item) => {
        if (item.status === 'Completed') {
          return []
        }

        const entries = (item.productEntries || []).length
          ? item.productEntries
          : [
              {
                id: `${item.id}::fallback`,
                productName: item.productNames?.[0] || 'NO PRODUCT',
                qty: item.totalQty || 0,
                displayDate: item.displayDate || item.updatedDate || item.targetDate,
                status: item.status,
              },
            ]

        return entries.filter((entry) => {
          if (entry.status === 'Completed') {
            return false
          }
          const display = parseIso(entry.displayDate)
          return Boolean(display && sameMonth(display, monthDate))
        }).map((entry) => ({
          id: entry.id,
          poId: item.poId,
          supplier: item.supplier,
          productName: entry.productName,
          qty: entry.qty,
          displayDate: entry.displayDate,
          targetDate: item.targetDate,
          updatedDate: entry.displayDate,
        }))
      }),
    [filteredRows, monthDate]
  )

  const boardItemsByStatus = useMemo(
    () =>
      BOARD_STATUSES.reduce((accumulator, status) => {
        accumulator[status] = filteredRows.filter((item) => item.status === status).sort(comparePoItems)
        return accumulator
      }, {}),
    [filteredRows]
  )

  function handleClearFilters() {
    setProductFilter('')
    setMessage(`Refreshed at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`)
  }

  async function handleRefresh() {
    await refreshRows()
    setMessage(`Refreshed at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`)
  }

  return (
    <div className={`${shellStyles.page} ${styles.page}`.trim()}>
      <section className={view === 'kanban' ? styles.scheduleShell : styles.timelineShell}>
        <div className={styles.scheduleHeader}>
          <div className={styles.scheduleTitleWrap}>
            <div>
              <p className={styles.eyebrow}>Arkline</p>
              <h2 className={styles.scheduleTitle}>Progress Snapshot</h2>
            </div>
            <div className={styles.segmented}>
              <button
                type="button"
                aria-label="Kanban view"
                className={`${styles.segmentButton} ${view === 'kanban' ? styles.segmentButtonActive : ''}`.trim()}
                onClick={() => setView('kanban')}
              >
                <KanbanIcon />
              </button>
              <button
                type="button"
                aria-label="Calendar view"
                className={`${styles.segmentButton} ${view === 'calendar' ? styles.segmentButtonActive : ''}`.trim()}
                onClick={() => setView('calendar')}
              >
                <CalendarIcon />
              </button>
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.filterCluster}>
              <div className={styles.filterField}>
                <span>Product / PO</span>
                <input
                  className={styles.input}
                  value={productFilter}
                  onChange={(event) => setProductFilter(event.target.value.toUpperCase())}
                  placeholder="Type PO / supplier / notes"
                />
              </div>
              <div className={styles.scheduleActions}>
                <button type="button" className={styles.secondaryButton} onClick={handleClearFilters}>
                  Clear
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => void handleRefresh()} disabled={loading}>
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              <div className={styles.messageText}>
                {loadError || message || `Refreshed at ${lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className={styles.emptyColumn}>Loading progress snapshot...</div>
        ) : view === 'kanban' ? (
          <div className={styles.boardGrid}>
            {BOARD_STATUSES.map((status) => (
              <section key={status} className={`${styles.boardColumn} ${styles[`boardColumn${getStatusKey(status)}`]}`.trim()}>
                <div className={styles.boardColumnHead}>
                  <div className={styles.boardColumnTitleWrap}>
                    <span className={styles.boardColumnDot}>{getStatusSymbol(status)}</span>
                    <h3>{status}</h3>
                  </div>
                  <span>{boardItemsByStatus[status]?.length || 0}</span>
                </div>
                <div className={styles.boardDropzone}>
                  {(boardItemsByStatus[status] || []).length ? (
                    boardItemsByStatus[status].map((item) => {
                      const tone = getDelayTone(item.targetDate, item.updatedDate)
                      return (
                        <article key={item.id} className={styles.boardCard}>
                          <div className={styles.boardCardTop}>
                            <div className={styles.boardCardIdentity}>
                              <button type="button" className={styles.poLinkButton} onClick={() => setSelectedPoDetail(item)}>
                                {item.poId}
                              </button>
                              <span className={styles.boardSupplierLine}>{item.supplier || '-'}</span>
                            </div>
                            <span className={styles.boardMethod}>{item.method}</span>
                          </div>
                          <div className={styles.boardProductSummary}>
                            <p className={styles.boardProductLine}>
                              {item.productNames?.length ? item.productNames.slice(0, 3).join(' / ') : 'NO PRODUCT'}
                            </p>
                            {item.productNames?.length > 3 ? <p className={styles.boardProductExtra}>+{item.productNames.length - 3} more products</p> : null}
                          </div>
                          <div className={styles.boardFooter}>
                            <span className={styles.boardQty}>Qty {item.totalQty || 0}</span>
                            <span className={styles.boardQty}>
                              Actual {item.updatedDate || item.targetDate || '-'}
                            </span>
                          </div>
                        </article>
                      )
                    })
                  ) : (
                    <div className={styles.emptyColumn}>No PO in this column.</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : view === 'calendar' ? (
          <>
            <div className={styles.legendRow}>
              <div className={styles.legendGroup}>
                <span className={`${styles.legendDot} ${styles.legendOnTime}`.trim()} />
                <span>On time</span>
              </div>
              <div className={styles.legendGroup}>
                <span className={`${styles.legendDot} ${styles.legendWatch}`.trim()} />
                <span>Delay 1-14 days</span>
              </div>
              <div className={styles.legendGroup}>
                <span className={`${styles.legendDot} ${styles.legendLate}`.trim()} />
                <span>Delay &gt; 14 days</span>
              </div>
              <div className={styles.legendMeta}>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                >
                  {'<'}
                </button>
                <div className={styles.monthPill}>{formatMonthLabel(monthDate)}</div>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                >
                  {'>'}
                </button>
              </div>
            </div>
            <div className={styles.calendarShell}>
              <div className={styles.calendarGrid}>
                {monthDays.map((day) => {
                  const dayItems = calendarItemsInMonth.filter((item) => {
                    const display = parseIso(item.displayDate || item.updatedDate || item.targetDate)
                    return Boolean(display && sameDay(display, day))
                  })

                  return (
                    <div key={day.toISOString()} className={styles.calendarCell}>
                      <div className={styles.calendarCellHeader}>
                        <span className={styles.calendarWeekday}>{formatDayLabel(day)}</span>
                        <strong>{day.getDate()}</strong>
                      </div>

                      <div className={styles.calendarEvents}>
                        {dayItems.length ? (
                          dayItems.map((item) => {
                            const tone = getDelayTone(item.targetDate, item.updatedDate)
                            return (
                              <article key={item.id} className={`${styles.eventCard} ${styles[`eventCard${tone[0].toUpperCase()}${tone.slice(1)}`]}`.trim()}>
                                <div className={styles.eventTitle}>{item.productName || 'NO PRODUCT'}</div>
                                <p className={styles.eventText}>{item.poId}</p>
                                <p className={styles.eventMetaText}>Qty {item.qty || 0}</p>
                              </article>
                            )
                          })
                        ) : (
                          <div className={styles.emptyMini}>No entries</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        ) : null}
      </section>

      {selectedPoDetail ? (
        <div className={styles.modalOverlay} onClick={() => setSelectedPoDetail(null)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>PO Detail</p>
                <h3 className={styles.modalTitle}>{selectedPoDetail.poId}</h3>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={() => setSelectedPoDetail(null)}>
                Close
              </button>
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.modalMetric}>
                <span>Supplier</span>
                <strong>{selectedPoDetail.supplier || '-'}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Status</span>
                <strong>{selectedPoDetail.status}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Method</span>
                <strong>{selectedPoDetail.method || '-'}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Total Qty</span>
                <strong>{selectedPoDetail.totalQty || 0}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Request Delivery</span>
                <strong>{selectedPoDetail.targetDate || '-'}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Actual Snapshot</span>
                <strong>{selectedPoDetail.updatedDate || selectedPoDetail.targetDate || '-'}</strong>
              </div>
            </div>

            <div className={styles.modalSection}>
              <h4 className={styles.modalSectionTitle}>Products</h4>
              <div className={styles.modalList}>
                {(selectedPoDetail.productEntries || []).length ? (
                  selectedPoDetail.productEntries.map((entry) => (
                    <div key={entry.id} className={styles.modalListRow}>
                      <strong>{entry.productName || 'NO PRODUCT'}</strong>
                      <span>Qty {entry.qty || 0}</span>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyMini}>No product lines.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
