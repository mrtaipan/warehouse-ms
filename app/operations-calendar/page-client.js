'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
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

function buildTimelineMap(entries = []) {
  return new Map(entries.map((entry) => [entry.key, entry]))
}

function buildDaySummaryMap(daySummaries = []) {
  return new Map(daySummaries.map((item) => [item.dateKey, item.divisions || []]))
}

function sumItemQty(items) {
  return items.reduce((total, item) => total + Number(item.qty || 0), 0)
}

function getCompactDivisionValue(division) {
  const items = division?.items || []

  if (division.key === 'inbound') {
    const sortedItems = items.filter((item) => item.label === 'Sorting Process')
    const sortedQty = sumItemQty(sortedItems)
    if (sortedQty > 0) return `${sortedQty} qty`

    const arklineItems = items.filter((item) => item.label === 'Arkline Inbound')
    const arklineQty = sumItemQty(arklineItems)
    if (arklineQty > 0) return `${arklineQty} qty`

    const grnItems = items.filter((item) => item.label === 'GRN Received')
    return grnItems.map((item) => item.detail || item.note).filter(Boolean).join(', ')
  }

  if (division.key === 'qc') {
    const completedItems = items.filter((item) => item.label === 'Reguler Grading' || item.label === 'Arkline Grading')
    const completedQty = sumItemQty(completedItems)
    return completedQty > 0 ? `${completedQty} qty` : ''
  }

  if (division.key === 'packing') {
    const breakdownItems = items.filter((item) => item.label === 'PL Breakdown')
    const breakdownQty = sumItemQty(breakdownItems)
    return breakdownQty > 0 ? `${breakdownQty} qty` : ''
  }

  if (division.key === 'storage') {
    const storedItems = items.filter((item) => item.label === 'Stored to Rack')
    const storedQty = sumItemQty(storedItems)
    return storedQty > 0 ? `${storedQty} qty` : ''
  }

  return ''
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
    item.tone === 'arkline' ? styles.timelineItemCardArkline : '',
    item.tone === 'target' ? styles.timelineItemCardTarget : '',
    item.tone === 'manual' ? styles.timelineItemCardManual : '',
  ].filter(Boolean).join(' ')
}

function TimelineItemCard({ item, division, itemKey, canEdit = false, onEdit }) {
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
  ].filter(Boolean).join(' ')

  return (
    <article key={itemKey} className={className}>
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

function MobileAgendaView({ monthDays, currentDateKey, timelineMap, daySummaryMap, canEditItem, onEditItem }) {
  return (
    <div className={styles.mobileAgenda}>
      {monthDays.map((day) => {
        const divisions = daySummaryMap
          ? daySummaryMap.get(day.key) || []
          : getTimelineDayDivisions(day, timelineMap)
        const isToday = day.key === currentDateKey

        return (
          <section key={day.key} className={`${styles.agendaDay} ${isToday ? styles.agendaToday : ''}`}>
            <div className={`${styles.agendaDayHeader} ${day.weekday === 'Sun' ? styles.sundayBlockSoft : ''}`}>
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

function TimelineView({ monthDays, timelineMap, currentDateKey, canEditItem, onEditItem }) {
  return (
    <div className={styles.timelineCard}>
      <div className={styles.timelineScroller}>
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
              className={`${styles.timelineDateHeader} ${day.key === currentDateKey ? styles.timelineToday : ''} ${day.weekday === 'Sun' ? styles.sundayColumn : ''}`}
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
            />
          ))}
        </div>
      </div>
      <MobileAgendaView monthDays={monthDays} timelineMap={timelineMap} currentDateKey={currentDateKey} canEditItem={canEditItem} onEditItem={onEditItem} />
    </div>
  )
}

function FragmentTimelineRow({ division, monthDays, timelineMap, currentDateKey, canEditItem, onEditItem }) {
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
            className={`${styles.timelineDayCell} ${day.key === currentDateKey ? styles.timelineToday : ''} ${hasItems ? styles.timelineDayCellActive : ''} ${day.weekday === 'Sun' ? styles.sundayColumn : ''}`}
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

function CalendarView({ monthDays, daySummaryMap, currentDateKey, onOpenDetail, canEditItem, onEditItem }) {
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
          <div key={label} className={`${styles.calendarWeekdayCell} ${label === 'Sun' ? styles.sundayBlock : ''}`}>{label}</div>
        ))}
      </div>

      <div className={styles.calendarGrid}>
        {calendarCells.map((cell) => {
          if (cell.type === 'empty') {
            return <div key={cell.key} className={styles.calendarEmptyCell} />
          }

          const divisions = daySummaryMap.get(cell.day.key) || []

          return (
            <section key={cell.key} className={`${styles.calendarDayCell} ${cell.day.key === currentDateKey ? styles.calendarToday : ''} ${cell.day.weekday === 'Sun' ? styles.sundayBlockSoft : ''}`}>
              <div className={styles.calendarDayHeader}>
                <strong className={cell.day.weekday === 'Sun' ? styles.sundayText : ''}>{cell.day.dayNumber}</strong>
                <span className={cell.day.weekday === 'Sun' ? styles.sundayText : ''}>{cell.day.weekday}</span>
              </div>

              <div className={styles.calendarDivisionCompactList}>
                {divisions.length ? (
                  divisions.slice(0, 4).map((division) => {
                    const compactValue = getCompactDivisionValue(division)

                    return (
                      <button
                        key={`${cell.day.key}-${division.key}`}
                        type="button"
                        className={`${styles.calendarCompactDivision} ${styles[`calendarCompactDivision${division.accent}`]}`}
                        onClick={() => onOpenDetail(cell.day, division)}
                      >
                        <span>{division.label}</span>
                        <strong>{compactValue}</strong>
                      </button>
                    )
                  })
                ) : (
                  <div className={styles.calendarEmptyState}>-</div>
                )}
              </div>
            </section>
          )
        })}
      </div>
      <MobileAgendaView monthDays={monthDays} daySummaryMap={daySummaryMap} currentDateKey={currentDateKey} canEditItem={canEditItem} onEditItem={onEditItem} />
    </div>
  )
}

function DetailModal({ detail, onClose, canEditItem, onEditItem }) {
  if (!detail) return null

  return (
    <div className={styles.detailModalOverlay} onClick={onClose}>
      <div className={styles.detailModalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.detailModalHeader}>
          <div>
            <h2>{detail.division.label}</h2>
            <p>{detail.day.key}</p>
          </div>
          <button type="button" className={styles.detailModalClose} onClick={onClose}>Close</button>
        </div>

        <div className={styles.detailModalList}>
          {(detail.division.items || []).map((item, index) => {
            const canEdit = Boolean(canEditItem?.(item, detail.division))

            return (
              <article
                key={`${item.recordId || item.label}-${index}`}
                className={`${styles.detailModalItem} ${item.tone === 'target' ? styles.detailModalItemTarget : ''} ${item.tone === 'manual' ? styles.detailModalItemManual : ''} ${canEdit ? styles.detailModalItemEditable : ''}`.trim()}
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
  daySummaries,
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

  const timelineMap = useMemo(() => buildTimelineMap(timelineEntries), [timelineEntries])
  const daySummaryMap = useMemo(() => buildDaySummaryMap(daySummaries), [daySummaries])

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

  return (
    <>
      <section className={styles.singlePanel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelHeaderLeft}>
            <Link href="/dashboard" className={styles.iconOnlyButton} aria-label="Back to dashboard" title="Back">
              <BackIcon />
            </Link>
            <h1 className={styles.pageTitle}>Operations Calendar</h1>
          </div>

          <div className={styles.panelHeaderRight}>
            <div className={styles.headerActions}>
              {canAddTarget ? (
                <button type="button" className={styles.headerTargetButton} onClick={() => handleOpenEntryModal('target')}>
                  Add Target
                </button>
              ) : null}
              {manualDivisionKey ? (
                <button type="button" className={styles.headerManualButton} onClick={() => handleOpenEntryModal('manual')}>
                  Add Manual
                </button>
              ) : null}
            </div>
            <label className={styles.monthPickerWrap}>
              <span className={styles.monthPickerLabel}>{monthLabel}</span>
              <input type="month" value={initialMonth} onChange={handleMonthChange} className={styles.monthPicker} />
            </label>
            <button
              type="button"
              className={`${styles.iconOnlyButton} ${initialView === 'timeline' ? styles.iconOnlyButtonActive : ''}`}
              onClick={() => handleViewChange('timeline')}
              aria-label="Timeline view"
              title="Timeline"
            >
              <TimelineIcon />
            </button>
            <button
              type="button"
              className={`${styles.iconOnlyButton} ${initialView === 'calendar' ? styles.iconOnlyButtonActive : ''}`}
              onClick={() => handleViewChange('calendar')}
              aria-label="Calendar view"
              title="Calendar"
            >
              <GridIcon />
            </button>
          </div>
        </div>

        <div className={styles.panelBody}>
          {statusMessage?.type && statusMessage?.text ? (
            <div className={`${styles.statusBanner} ${statusMessage.type === 'error' ? styles.statusBannerError : styles.statusBannerSaved}`}>
              {statusMessage.text}
            </div>
          ) : null}
          {initialView === 'timeline' ? (
            <TimelineView monthDays={monthDays} timelineMap={timelineMap} currentDateKey={currentDateKey} canEditItem={canEditItem} onEditItem={handleEditItem} />
          ) : (
            <CalendarView
              monthDays={monthDays}
              daySummaryMap={daySummaryMap}
              currentDateKey={currentDateKey}
              onOpenDetail={(day, division) => setDetail({ day, division })}
              canEditItem={canEditItem}
              onEditItem={handleEditItem}
            />
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
