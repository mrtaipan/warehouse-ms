'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  createOperationsCalendarManualReport,
  createOperationsCalendarTarget,
  updateOperationsCalendarManualReport,
  updateOperationsCalendarTarget,
} from './actions'
import styles from './page.module.css'

const DIVISIONS = [
  { key: 'inbound', label: 'Inbound', accent: 'blue' },
  { key: 'qc', label: 'Quality Control', accent: 'amber' },
  { key: 'packing', label: 'Packing List', accent: 'rose' },
  { key: 'storage', label: 'Stockkeeping', accent: 'emerald' },
]

function getDivisionLabel(key) {
  return DIVISIONS.find((division) => division.key === key)?.label || 'Operations'
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r=".5" />
      <circle cx="3.5" cy="12" r=".5" />
      <circle cx="3.5" cy="18" r=".5" />
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

function formatListDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function getCalendarDayDifference(start, end) {
  if (!start || !end) return null
  const startTime = Date.parse(`${start}T00:00:00Z`)
  const endTime = Date.parse(`${end}T00:00:00Z`)
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null
  return Math.max(0, Math.round((endTime - startTime) / 86400000))
}

function formatProcessDate(value, inboundDate) {
  const formattedDate = formatListDate(value)
  const duration = getCalendarDayDifference(inboundDate, value)
  if (formattedDate === '-' || duration == null) return formattedDate
  return (
    <span className={styles.processDateValue}>
      <time dateTime={value}>{formattedDate}</time>
      <span>{duration} {duration === 1 ? 'day' : 'days'}</span>
    </span>
  )
}

function getAverageDuration(rows, dateKey) {
  const durations = rows
    .map((row) => getCalendarDayDifference(row.inboundDate, row[dateKey]))
    .filter((value) => value != null)
  if (!durations.length) return '-'
  const average = durations.reduce((total, value) => total + value, 0) / durations.length
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(average)} days`
}

function HistoryToggle({ rows, showHistory, onViewChange }) {
  const activeCount = rows.filter((row) => !row.isCompleted).length

  return (
    <div className={styles.historyToggle} role="group" aria-label="Processing records">
      <button type="button" className={!showHistory ? styles.historyToggleActive : ''} onClick={() => onViewChange(false)}>
        Active <span>{activeCount}</span>
      </button>
      <button type="button" className={showHistory ? styles.historyToggleActive : ''} onClick={() => onViewChange(true)}>
        All History <span>{rows.length}</span>
      </button>
    </div>
  )
}

function OperationsListView({ rows, showHistory }) {
  const visibleRows = showHistory ? rows : rows.filter((row) => !row.isCompleted)

  return (
    <div className={styles.operationsList}>
      {showHistory ? (
        <div className={styles.processingAverages} aria-label="Average processing time">
          <div className={styles.processingAverage}>
            <span>Inbound to QC</span>
            <strong>{getAverageDuration(rows, 'qcDate')}</strong>
          </div>
          <div className={styles.processingAverage}>
            <span>Inbound to Packing List</span>
            <strong>{getAverageDuration(rows, 'packingDate')}</strong>
          </div>
        </div>
      ) : null}

      {visibleRows.length ? (
        <div className={styles.operationsTableScroller}>
          <table className={styles.operationsTable}>
            <thead>
              <tr>
                <th scope="col">GRN</th>
                <th scope="col">Supplier Name</th>
                <th scope="col">Item Name</th>
                <th scope="col">Inbound Date</th>
                <th scope="col">QC Date <small>from inbound</small></th>
                <th scope="col">Packing List Date <small>from inbound</small></th>
                <th scope="col">Return Date</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.grnNumber}</th>
                  <td>{row.supplierName}</td>
                  <td>{row.itemName}</td>
                  <td><time dateTime={row.inboundDate || undefined}>{formatListDate(row.inboundDate)}</time></td>
                  <td>{formatProcessDate(row.qcDate, row.inboundDate)}</td>
                  <td>{formatProcessDate(row.packingDate, row.inboundDate)}</td>
                  <td><time dateTime={row.returnDate || undefined}>{formatListDate(row.returnDate)}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.listEmptyState}>
          {showHistory ? 'No inbound processing history is available.' : 'There are no active inbound processes.'}
        </div>
      )}
    </div>
  )
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </svg>
  )
}

function ManualIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
      <rect x="4" y="4" width="16" height="16" rx="4" />
    </svg>
  )
}

function buildTimelineMap(entries = []) {
  return new Map(entries.map((entry) => [entry.key, entry]))
}

const MOVEMENT_ITEM_LABELS = new Set([
  'GRN Received',
  'Arkline Inbound',
  'Arkline Return Back',
  'Reguler Return',
  'Arkline Return',
])

function getTimelineItemGroup(item) {
  return MOVEMENT_ITEM_LABELS.has(item?.label) ? 'movement' : 'operations'
}

function shouldShowTimelineItem(item, filters) {
  const group = getTimelineItemGroup(item)
  return group === 'movement' ? filters.movement : filters.operations
}

function buildFilteredTimelineEntries(entries = [], filters) {
  return entries.map((entry) => {
    const items = (entry.items || []).filter((item) => shouldShowTimelineItem(item, filters))
    const totals = items.reduce((result, item) => ({
      activities: result.activities + 1,
      qty: result.qty + Number(item.qty || 0),
      count: result.count + Number(item.count || 0),
    }), { activities: 0, qty: 0, count: 0 })

    return { ...entry, items, totals }
  }).filter((entry) => entry.items.length > 0)
}

function getOptionsWithCurrent(options = [], currentValue = '') {
  const current = String(currentValue || '').trim()
  const normalized = new Set(options.map((item) => String(item || '').trim()).filter(Boolean))

  if (current && current.toUpperCase() !== 'ALL') {
    normalized.add(current)
  }

  return Array.from(normalized).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

function getTimelineItemClassName(item, division) {
  return [
    styles.timelineItemCard,
    styles[`timelineItemCard${division.accent}`],
    item.tone === 'received' ? styles.timelineItemCardReceived : '',
    item.tone === 'inbound' ? styles.timelineItemCardInbound : '',
    item.tone === 'arkline' ? styles.timelineItemCardArkline : '',
    item.tone === 'target' ? styles.timelineItemCardTarget : '',
    item.tone === 'estimate' ? styles.timelineItemCardEstimate : '',
    item.tone === 'manual' ? styles.timelineItemCardManual : '',
    item.tone === 'return' ? styles.timelineItemCardReturn : '',
    item.tone === 'returnBack' ? styles.timelineItemCardReturnBack : '',
  ].filter(Boolean).join(' ')
}

function TimelineItemCard({ item, division, itemKey, canEdit = false, onEdit, onOpenDetail }) {
  const content = (
    <>
      {item.eyebrow ? <em className={styles.timelineItemEyebrow}>{item.eyebrow}</em> : null}
      <strong>{item.label}</strong>
      <span>{item.note}</span>
      {item.detail ? <small>{item.detail}</small> : null}
    </>
  )
  const className = [
    getTimelineItemClassName(item, division),
    canEdit ? styles.timelineItemCardEditable : '',
    onOpenDetail ? styles.timelineItemCardInteractive : '',
  ].filter(Boolean).join(' ')

  function handleOpenDetail() {
    onOpenDetail?.(item, division)
  }

  function handleKeyDown(event) {
    if (!onOpenDetail) return
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    handleOpenDetail()
  }

  return (
    <article
      key={itemKey}
      className={className}
      role={onOpenDetail ? 'button' : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      onClick={handleOpenDetail}
      onKeyDown={handleKeyDown}
    >
      {content}
      {canEdit ? (
        <button
          type="button"
          className={styles.timelineItemEditButton}
          aria-label={`Edit ${item.label}`}
          title="Edit"
          onClick={(event) => {
            event.stopPropagation()
            onEdit?.(item)
          }}
        >
          <EditIcon />
        </button>
      ) : null}
    </article>
  )
}

function getTimelineDayDivisions(day, timelineMap) {
  return DIVISIONS.map((division) => {
    const entry = timelineMap.get(`${division.key}::${day.key}`)
    return {
      ...division,
      items: entry?.items || [],
      totals: entry?.totals || { activities: 0, qty: 0, count: 0 },
    }
  }).filter((division) => division.items.length > 0)
}

function MobileAgendaView({ monthDays, currentDateKey, timelineMap, canEditItem, onEditItem, onOpenItemDetail, focusTodaySignal = 0 }) {
  const todayRef = useRef(null)

  useEffect(() => {
    if (!monthDays.some((day) => day.key === currentDateKey)) return
    if (!window.matchMedia('(max-width: 767px)').matches) return

    window.requestAnimationFrame(() => {
      todayRef.current?.scrollIntoView({ block: 'start' })
    })
  }, [currentDateKey, focusTodaySignal, monthDays])

  return (
    <div className={styles.mobileAgenda}>
      {monthDays.map((day) => {
        const divisions = getTimelineDayDivisions(day, timelineMap)
        const isToday = day.key === currentDateKey
        const isHoliday = day.weekday === 'Sun' || day.isWarehouseHoliday

        return (
          <section
            key={day.key}
            ref={isToday ? todayRef : null}
            className={`${styles.agendaDay} ${isToday ? styles.agendaToday : ''}`}
          >
            <div className={`${styles.agendaDayHeader} ${isHoliday ? styles.sundayBlockSoft : ''}`}>
              <div>
                <span>{day.weekday}</span>
                <strong>{day.dayNumber}</strong>
              </div>
              <small>{day.key}</small>
            </div>

            <div className={styles.agendaDivisionStack}>
              {divisions.length ? (
                divisions.map((division) => (
                  <section key={`${day.key}-${division.key}`} className={styles.agendaDivision}>
                    <div className={`${styles.agendaDivisionHeader} ${styles[`agendaDivisionHeader${division.accent}`]}`}>
                      <span>{division.label}</span>
                      <strong>{division.items.length} task</strong>
                    </div>
                    <div className={styles.timelineItemStack}>
                      {division.items.map((item, index) => (
                        <TimelineItemCard
                          key={`${division.key}-${day.key}-${index}`}
                          itemKey={`${division.key}-${day.key}-${index}`}
                          item={item}
                          division={division}
                          canEdit={Boolean(canEditItem?.(item, division))}
                          onEdit={onEditItem}
                          onOpenDetail={(selectedItem, selectedDivision) => onOpenItemDetail?.(day, selectedDivision, selectedItem)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className={styles.agendaEmptyState}>No activity recorded.</div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function TimelineView({ monthDays, timelineMap, currentDateKey, canEditItem, onEditItem, onOpenItemDetail, focusTodaySignal = 0 }) {
  const scrollerRef = useRef(null)

  useEffect(() => {
    const todayIndex = monthDays.findIndex((day) => day.key === currentDateKey)
    if (todayIndex < 0) return

    window.requestAnimationFrame(() => {
      const scroller = scrollerRef.current
      const todayHeader = scroller?.querySelector(`[data-date-key="${currentDateKey}"]`)
      if (!scroller || !todayHeader) return

      const centeredLeft = todayHeader.offsetLeft - (scroller.clientWidth / 2) + (todayHeader.offsetWidth / 2)
      scroller.scrollLeft = Math.max(0, centeredLeft)
    })
  }, [currentDateKey, focusTodaySignal, monthDays])

  return (
    <div className={styles.timelineCard}>
      <div className={styles.timelineScroller} ref={scrollerRef}>
        <div
          className={styles.timelineGrid}
          style={{
            gridTemplateColumns: `var(--timeline-division-width) repeat(${monthDays.length}, var(--timeline-day-width))`,
            gridTemplateRows: `var(--timeline-header-height) repeat(${DIVISIONS.length}, var(--timeline-row-height))`,
          }}
        >
          <div className={`${styles.timelineCorner} ${styles.timelineStickyLeft}`}>Division</div>

          {monthDays.map((day) => (
            <div
              key={day.key}
              data-date-key={day.key}
              className={`${styles.timelineDateHeader} ${day.key === currentDateKey ? styles.timelineToday : ''} ${day.weekday === 'Sun' || day.isWarehouseHoliday ? styles.sundayColumn : ''}`}
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
              canEditItem={canEditItem}
              onEditItem={onEditItem}
              onOpenItemDetail={onOpenItemDetail}
            />
          ))}
        </div>
      </div>
      <MobileAgendaView
        monthDays={monthDays}
        timelineMap={timelineMap}
        currentDateKey={currentDateKey}
        canEditItem={canEditItem}
        onEditItem={onEditItem}
        onOpenItemDetail={onOpenItemDetail}
        focusTodaySignal={focusTodaySignal}
      />
    </div>
  )
}

function FragmentTimelineRow({ division, monthDays, timelineMap, currentDateKey, canEditItem, onEditItem, onOpenItemDetail }) {
  const activeDays = monthDays.reduce((count, day) => {
    const entry = timelineMap.get(`${division.key}::${day.key}`)
    return entry?.items?.length ? count + 1 : count
  }, 0)

  return (
    <>
      <div className={`${styles.timelineDivisionCell} ${styles.timelineStickyLeft} ${styles[`timelineDivisionCell${division.accent}`]}`}>
        <div className={styles.timelineDivisionContent}>
          <strong>{division.label}</strong>
          <span>{activeDays ? `${activeDays} active day(s)` : 'No activity'}</span>
        </div>
      </div>

      {monthDays.map((day) => {
        const entry = timelineMap.get(`${division.key}::${day.key}`)
        const hasItems = Boolean(entry?.items?.length)

        return (
          <div
            key={`${division.key}-${day.key}`}
            className={`${styles.timelineDayCell} ${day.key === currentDateKey ? styles.timelineToday : ''} ${hasItems ? styles.timelineDayCellActive : ''} ${day.weekday === 'Sun' || day.isWarehouseHoliday ? styles.sundayColumn : ''}`}
          >
            {hasItems ? (
              <div className={styles.timelineItemStack}>
                {entry.items.map((item, index) => (
                  <TimelineItemCard
                    key={`${division.key}-${day.key}-${index}`}
                    itemKey={`${division.key}-${day.key}-${index}`}
                    item={item}
                    division={division}
                    canEdit={Boolean(canEditItem?.(item, division))}
                    onEdit={onEditItem}
                    onOpenDetail={(selectedItem, selectedDivision) => onOpenItemDetail?.(day, selectedDivision, selectedItem)}
                  />
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

function DetailModal({ detail, onClose, canEditItem, onEditItem }) {
  if (!detail) return null

  const isItemDetail = Boolean(detail.item)
  const detailItems = isItemDetail ? [detail.item] : (detail.division.items || [])
  const modalRows = Array.isArray(detail.item?.modalRows) ? detail.item.modalRows : []

  return (
    <div className={styles.detailModalOverlay} onClick={onClose}>
      <div className={styles.detailModalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.detailModalHeader}>
          <div>
            <h2>{isItemDetail ? detail.item.label : detail.division.label}</h2>
            <p>{isItemDetail ? `${detail.day.key} · ${detail.division.label}` : detail.day.key}</p>
          </div>
          <button type="button" className={styles.detailModalClose} onClick={onClose}>Close</button>
        </div>

        {isItemDetail && modalRows.length ? (
          <div className={styles.detailMetaGrid}>
            {modalRows.map((row, index) => (
              <div key={`${row.label}-${index}`} className={styles.detailMetaItem}>
                <span>{row.label}</span>
                <strong>{row.value || '-'}</strong>
              </div>
            ))}
          </div>
        ) : null}

        <div className={styles.detailModalList}>
          {detailItems.map((item, index) => {
            const canEdit = Boolean(canEditItem?.(item, detail.division))

            return (
              <article
                key={`${item.recordId || item.label}-${index}`}
                className={[
                  styles.detailModalItem,
                  item.tone === 'received' ? styles.detailModalItemReceived : '',
                  item.tone === 'inbound' ? styles.detailModalItemInbound : '',
                  item.tone === 'arkline' ? styles.detailModalItemArkline : '',
                  item.tone === 'target' ? styles.detailModalItemTarget : '',
                  item.tone === 'estimate' ? styles.detailModalItemEstimate : '',
                  item.tone === 'manual' ? styles.detailModalItemManual : '',
                  item.tone === 'return' ? styles.detailModalItemReturn : '',
                  item.tone === 'returnBack' ? styles.detailModalItemReturnBack : '',
                  canEdit ? styles.detailModalItemEditable : '',
                ].filter(Boolean).join(' ')}
              >
                {item.eyebrow ? <em className={styles.timelineItemEyebrow}>{item.eyebrow}</em> : null}
                <strong>{item.label}</strong>
                <span>{item.note}</span>
                {item.detail ? <small>{item.detail}</small> : null}
                {canEdit ? (
                  <button
                    type="button"
                    className={styles.timelineItemEditButton}
                    aria-label={`Edit ${item.label}`}
                    title="Edit"
                    onClick={(event) => {
                      event.stopPropagation()
                      onEditItem?.(item)
                    }}
                  >
                    <EditIcon />
                  </button>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function OptionList({ id, options = [] }) {
  return (
    <datalist id={id}>
      {options.map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
  )
}

function TargetModal({ onClose, month, view, currentDateKey, options = {}, record }) {
  const isEditing = Boolean(record?.recordId)
  const initialGrn = record?.grnNumber || ''
  const initialBrand = record?.brandName || 'ALL'
  const [selectedGrn, setSelectedGrn] = useState(initialGrn)
  const [selectedBrand, setSelectedBrand] = useState(initialBrand)
  const targetOptionPairs = useMemo(() => options.targetOptionPairs || [], [options.targetOptionPairs])

  const filteredGrnOptions = useMemo(() => {
    if (!selectedBrand || selectedBrand === 'ALL') {
      return getOptionsWithCurrent(options.grnOptions, selectedGrn)
    }

    const grnOptions = targetOptionPairs
      .filter((pair) => pair.brandName === selectedBrand)
      .map((pair) => pair.grnNumber)

    return getOptionsWithCurrent(grnOptions, selectedGrn)
  }, [options.grnOptions, selectedBrand, selectedGrn, targetOptionPairs])

  const filteredBrandOptions = useMemo(() => {
    const hasExactGrn = targetOptionPairs.some((pair) => pair.grnNumber === selectedGrn)

    if (!selectedGrn || !hasExactGrn) {
      return getOptionsWithCurrent(options.brandOptions, selectedBrand)
    }

    const brandOptions = targetOptionPairs
      .filter((pair) => pair.grnNumber === selectedGrn)
      .map((pair) => pair.brandName)

    return getOptionsWithCurrent(brandOptions, selectedBrand)
  }, [options.brandOptions, selectedBrand, selectedGrn, targetOptionPairs])

  function handleGrnChange(event) {
    const nextGrn = event.target.value
    setSelectedGrn(nextGrn)

    if (selectedBrand !== 'ALL' && nextGrn) {
      const isKnownGrn = targetOptionPairs.some((pair) => pair.grnNumber === nextGrn)
      const hasMatch = targetOptionPairs.some((pair) => pair.grnNumber === nextGrn && pair.brandName === selectedBrand)
      if (isKnownGrn && !hasMatch) setSelectedBrand('ALL')
    }
  }

  function handleBrandChange(event) {
    const nextBrand = event.target.value || 'ALL'
    setSelectedBrand(nextBrand)

    if (nextBrand !== 'ALL' && selectedGrn) {
      const hasMatch = targetOptionPairs.some((pair) => pair.grnNumber === selectedGrn && pair.brandName === nextBrand)
      if (!hasMatch) setSelectedGrn('')
    }
  }

  return (
    <div className={styles.detailModalOverlay} onClick={onClose}>
      <form action={isEditing ? updateOperationsCalendarTarget : createOperationsCalendarTarget} className={styles.entryModalCard} onClick={(event) => event.stopPropagation()}>
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="view" value={view} />
        {isEditing ? <input type="hidden" name="target_id" value={record.recordId} /> : null}
        <div className={styles.entryModalHeader}>
          <div>
            <p>{isEditing ? 'Edit Target' : 'Add Target'}</p>
            <h2>GRN target</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>

        <div className={styles.entryFormGrid}>
          <label>
            Date
            <input type="date" name="target_date" defaultValue={record?.targetDate || currentDateKey} required />
          </label>
          <label>
            Division
            <select name="division_key" defaultValue={record?.divisionKey || 'inbound'} required>
              {DIVISIONS.map((division) => (
                <option key={division.key} value={division.key}>{division.label}</option>
              ))}
            </select>
          </label>
          <label>
            GRN
            <input name="grn_number" list="ops-target-grn-options" value={selectedGrn} onChange={handleGrnChange} placeholder="Choose or type GRN" required />
          </label>
          <label>
            Brand
            <select name="brand_name" value={selectedBrand || 'ALL'} onChange={handleBrandChange}>
              <option value="ALL">All Brands</option>
              {filteredBrandOptions.map((brandName) => (
                <option key={brandName} value={brandName}>{brandName}</option>
              ))}
            </select>
          </label>
        </div>

        <OptionList id="ops-target-grn-options" options={filteredGrnOptions} />

        <div className={styles.entryModalActions}>
          <button type="button" className={styles.secondaryActionButton} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.dangerActionButton}>{isEditing ? 'Update Target' : 'Save Target'}</button>
        </div>
      </form>
    </div>
  )
}

function ManualReportModal({ open, onClose, month, view, currentDateKey, divisionKey, record }) {
  if (!open) return null
  const isEditing = Boolean(record?.recordId)
  const displayDivisionKey = record?.divisionKey || divisionKey

  return (
    <div className={styles.detailModalOverlay} onClick={onClose}>
      <form action={isEditing ? updateOperationsCalendarManualReport : createOperationsCalendarManualReport} className={styles.entryModalCard} onClick={(event) => event.stopPropagation()}>
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="view" value={view} />
        {isEditing ? <input type="hidden" name="manual_report_id" value={record.recordId} /> : null}
        <div className={styles.entryModalHeader}>
          <div>
            <p>{isEditing ? 'Edit Manual' : 'Add Manual'}</p>
            <h2>{getDivisionLabel(displayDivisionKey)} report</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>

        <div className={styles.entryFormGrid}>
          <label>
            Date
            <input type="date" name="report_date" defaultValue={record?.reportDate || currentDateKey} required />
          </label>
          <label>
            Division
            <input value={getDivisionLabel(displayDivisionKey)} readOnly />
          </label>
        </div>

        <label className={styles.entryTextareaLabel}>
          Title
          <input name="title" defaultValue={record?.title || ''} placeholder="Bold title shown on the card" required />
        </label>
        <label className={styles.entryTextareaLabel}>
          Description
          <textarea name="description" rows={4} defaultValue={record?.description || ''} placeholder="Free notes shown below the title" />
        </label>

        <div className={styles.entryModalActions}>
          <button type="button" className={styles.secondaryActionButton} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.primaryActionButton}>{isEditing ? 'Update Manual' : 'Save Manual'}</button>
        </div>
      </form>
    </div>
  )
}

export default function OperationsCalendarClient({
  initialMonth,
  initialView,
  monthLabel,
  monthDays,
  currentDateKey,
  timelineEntries,
  listRows = [],
  formOptions,
  canAddTarget,
  manualDivisionKey,
  statusMessage,
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [detail, setDetail] = useState(null)
  const [entryModal, setEntryModal] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const [focusTodaySignal, setFocusTodaySignal] = useState(0)
  const [timelineFilters, setTimelineFilters] = useState({ movement: true, operations: true })
  const [showListHistory, setShowListHistory] = useState(false)
  const monthInputRef = useRef(null)

  const filteredTimelineEntries = useMemo(
    () => buildFilteredTimelineEntries(timelineEntries, timelineFilters),
    [timelineEntries, timelineFilters]
  )
  const timelineMap = useMemo(() => buildTimelineMap(filteredTimelineEntries), [filteredTimelineEntries])
  const todayMonth = currentDateKey.slice(0, 7)
  const pageTitle = 'Operations Calendar'

  function updateQuery(nextMonth, nextView) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', nextMonth)
    params.set('view', nextView)
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleMonthChange(event) {
    updateQuery(event.target.value || initialMonth, initialView)
  }

  function handleViewChange(nextView) {
    updateQuery(initialMonth, nextView)
  }

  function handleOpenMonthPicker() {
    const monthInput = monthInputRef.current
    if (!monthInput) return

    try {
      if (typeof monthInput.showPicker === 'function') {
        monthInput.showPicker()
        return
      }
    } catch {
      // Some browsers reject showPicker unless the input itself receives the gesture.
    }

    monthInput.focus()
    try {
      monthInput.click()
      return
    } catch {
      monthInput.focus()
    }
  }

  function handleTodayClick() {
    if (initialMonth !== todayMonth) {
      updateQuery(todayMonth, initialView)
      return
    }

    setFocusTodaySignal((value) => value + 1)
  }

  function handleOpenEntryModal(type) {
    setEditingItem(null)
    setEntryModal(type)
  }

  function handleCloseEntryModal() {
    setEditingItem(null)
    setEntryModal('')
  }

  function handleEditItem(item) {
    if (item?.tone !== 'target' && item?.tone !== 'manual') return

    setEditingItem(item)
    setEntryModal(item.tone)
    setDetail(null)
  }

  function canEditItem(item, division) {
    if (item?.tone === 'target') return Boolean(canAddTarget)
    if (item?.tone === 'manual') return Boolean(canAddTarget || (manualDivisionKey && (item.divisionKey || division?.key) === manualDivisionKey))
    return false
  }

  function handleFilterChange(filterKey) {
    setTimelineFilters((current) => ({
      ...current,
      [filterKey]: !current[filterKey],
    }))
  }

  return (
    <>
      <section className={styles.singlePanel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelHeaderLeft}>
            <Link href="/dashboard" className={styles.iconOnlyButton} aria-label="Back to dashboard" title="Back">
              <BackIcon />
            </Link>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
            <div className={styles.viewToggle} aria-label="Operations calendar view">
              <button
                type="button"
                className={initialView === 'timeline' ? styles.viewToggleActive : ''}
                onClick={() => handleViewChange('timeline')}
              >
                <TimelineIcon />
                <span>Timeline</span>
              </button>
              <button
                type="button"
                className={initialView === 'list' ? styles.viewToggleActive : ''}
                onClick={() => handleViewChange('list')}
              >
                <ListIcon />
                <span>List</span>
              </button>
            </div>
          </div>

          <div className={styles.panelHeaderRight}>
            <div className={styles.headerActions}>
              {initialView === 'list' ? (
                <HistoryToggle rows={listRows} showHistory={showListHistory} onViewChange={setShowListHistory} />
              ) : null}
              {canAddTarget ? (
                <button type="button" className={styles.headerTargetButton} onClick={() => handleOpenEntryModal('target')} aria-label="Add Target" title="Add Target">
                  <TargetIcon />
                </button>
              ) : null}
              {manualDivisionKey ? (
                <button type="button" className={styles.headerManualButton} onClick={() => handleOpenEntryModal('manual')} aria-label="Add Manual" title="Add Manual">
                  <ManualIcon />
                </button>
              ) : null}
            </div>
            {initialView === 'timeline' ? (
              <>
                <div className={styles.quickFilterStack} aria-label="Timeline filters">
                  <label className={styles.quickFilterOption}>
                    <input
                      type="checkbox"
                      checked={timelineFilters.movement}
                      onChange={() => handleFilterChange('movement')}
                    />
                    <span>Inbound / Outbound</span>
                  </label>
                  <label className={styles.quickFilterOption}>
                    <input
                      type="checkbox"
                      checked={timelineFilters.operations}
                      onChange={() => handleFilterChange('operations')}
                    />
                    <span>Operational Work</span>
                  </label>
                </div>
                <button type="button" className={styles.todayButton} onClick={handleTodayClick}>
                  Today
                </button>
                <button type="button" className={styles.monthPickerWrap} onClick={handleOpenMonthPicker}>
                  <span className={styles.monthPickerLabel}>{monthLabel}</span>
                  <input ref={monthInputRef} type="month" value={initialMonth} onChange={handleMonthChange} className={styles.monthPicker} />
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className={styles.panelBody}>
          {statusMessage?.type && statusMessage?.text ? (
            <div className={`${styles.statusBanner} ${statusMessage.type === 'error' ? styles.statusBannerError : styles.statusBannerSaved}`}>
              {statusMessage.text}
            </div>
          ) : null}
          {initialView === 'timeline' ? (
            <TimelineView
              monthDays={monthDays}
              timelineMap={timelineMap}
              currentDateKey={currentDateKey}
              canEditItem={canEditItem}
              onEditItem={handleEditItem}
              onOpenItemDetail={(day, division, item) => setDetail({ day, division, item })}
              focusTodaySignal={focusTodaySignal}
            />
          ) : (
            <OperationsListView rows={listRows} showHistory={showListHistory} />
          )}
        </div>
      </section>

      <DetailModal detail={detail} onClose={() => setDetail(null)} canEditItem={canEditItem} onEditItem={handleEditItem} />
      {entryModal === 'target' ? (
        <TargetModal
          key={`target-${editingItem?.recordId || 'new'}`}
          onClose={handleCloseEntryModal}
          month={initialMonth}
          view={initialView}
          currentDateKey={currentDateKey}
          options={formOptions || {}}
          record={editingItem}
        />
      ) : null}
      {entryModal === 'manual' ? (
        <ManualReportModal
          key={`manual-${editingItem?.recordId || 'new'}`}
          open
          onClose={handleCloseEntryModal}
          month={initialMonth}
          view={initialView}
          currentDateKey={currentDateKey}
          divisionKey={manualDivisionKey}
          record={editingItem}
        />
      ) : null}
    </>
  )
}
