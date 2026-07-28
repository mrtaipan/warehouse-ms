'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import styles from './page.module.css'

const DIVISIONS = [
  { key: 'inbound', label: 'Inbound', accent: 'blue' },
  { key: 'qc', label: 'Quality Control', accent: 'amber' },
  { key: 'packing', label: 'Packing List', accent: 'rose' },
  { key: 'storage', label: 'Stockkeeping', accent: 'emerald' },
]

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
    const sortedItems = items.filter((item) => item.label === 'Sorting & Unload')
    const sortedQty = sumItemQty(sortedItems)
    if (sortedQty > 0) return `${sortedQty} qty`

    const grnItems = items.filter((item) => item.label === 'GRN Received')
    return grnItems.map((item) => item.detail || item.note).filter(Boolean).join(', ')
  }

  if (division.key === 'qc') {
    const completedItems = items.filter((item) => item.label === 'QC Grading' || item.label === 'Arkline QC Finish')
    const completedQty = sumItemQty(completedItems)
    return completedQty > 0 ? `${completedQty} qty` : ''
  }

  if (division.key === 'packing') {
    const breakdownItems = items.filter((item) => item.label === 'Size Breakdown')
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

function TimelineView({ monthDays, timelineMap, currentDateKey }) {
  return (
    <div className={styles.timelineCard}>
      <div className={styles.timelineScroller}>
        <div className={styles.timelineGrid} style={{ gridTemplateColumns: `220px repeat(${monthDays.length}, minmax(152px, 1fr))` }}>
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
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function FragmentTimelineRow({ division, monthDays, timelineMap, currentDateKey }) {
  const activeDays = monthDays.reduce((count, day) => {
    const entry = timelineMap.get(`${division.key}::${day.key}`)
    return entry?.items?.length ? count + 1 : count
  }, 0)

  return (
    <>
      <div className={`${styles.timelineDivisionCell} ${styles.timelineStickyLeft} ${styles[`timelineDivisionCell${division.accent}`]}`}>
        <div className={styles.timelineDivisionContent}>
          <strong>{division.label}</strong>
          <span>{activeDays ? `${activeDays} hari aktif` : 'Belum ada aktivitas'}</span>
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
                  <article
                    key={`${division.key}-${day.key}-${index}`}
                    className={`${styles.timelineItemCard} ${styles[`timelineItemCard${division.accent}`]}`}
                  >
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

function CalendarView({ monthDays, daySummaryMap, currentDateKey, onOpenDetail }) {
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
    </div>
  )
}

function DetailModal({ detail, onClose }) {
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
          {(detail.division.items || []).map((item, index) => (
            <article key={`${item.label}-${index}`} className={styles.detailModalItem}>
              <strong>{item.label}</strong>
              <span>{item.note}</span>
              {item.detail ? <small>{item.detail}</small> : null}
            </article>
          ))}
        </div>
      </div>
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
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [detail, setDetail] = useState(null)

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
          {initialView === 'timeline' ? (
            <TimelineView monthDays={monthDays} timelineMap={timelineMap} currentDateKey={currentDateKey} />
          ) : (
            <CalendarView monthDays={monthDays} daySummaryMap={daySummaryMap} currentDateKey={currentDateKey} onOpenDetail={(day, division) => setDetail({ day, division })} />
          )}
        </div>
      </section>

      <DetailModal detail={detail} onClose={() => setDetail(null)} />
    </>
  )
}
