'use client'

import { useMemo, useState } from 'react'

import styles from '../arkline/arkline.module.css'
import { approveBirthdayGiftRequest, approveLeaveRequest } from './actions'
import PublicRequestLinkClient from './public-request-link-client'

function formatDateValue(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function StatusPill({ value }) {
  return (
    <span
      className={`${styles.status} ${
        value === 'APPROVED' ? styles.statusActive : value === 'REJECTED' ? styles.statusInactive : styles.accentButton
      }`.trim()}
      style={{ minHeight: '24px', padding: '0 10px', fontSize: '10px' }}
    >
      {value || 'SUBMITTED'}
    </span>
  )
}

function TypePill({ value }) {
  const isBirthday = value === 'BIRTHDAY'

  return (
    <span
      style={{
        minHeight: '22px',
        padding: '0 10px',
        borderRadius: '999px',
        border: `1px solid ${isBirthday ? '#c7d2fe' : '#cbd5e1'}`,
        background: isBirthday ? '#eef2ff' : '#f8fafc',
        color: isBirthday ? '#4338ca' : '#334155',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {isBirthday ? 'Birthday' : 'Leave'}
    </span>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function toDateOnlyValue(value) {
  if (!value) return null
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function calculateLeaveWorkingDays(startDateValue, endDateValue, publicHolidayRows = []) {
  const startDate = toDateOnlyValue(startDateValue)
  const endDate = toDateOnlyValue(endDateValue)

  if (!startDate || !endDate || endDate < startDate) {
    return null
  }

  const holidaySet = new Set(
    (publicHolidayRows || [])
      .map((item) => String(item?.holiday_date || '').trim())
      .filter(Boolean),
  )

  let totalDays = 0
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())

  while (cursor <= last) {
    const dayOfWeek = cursor.getDay()
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isPublicHoliday = holidaySet.has(iso)

    if (!isWeekend && !isPublicHoliday) {
      totalDays += 1
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return totalDays
}

function buildLeaveItem(row, publicHolidayRows) {
  const workingDays = calculateLeaveWorkingDays(row?.start_date, row?.end_date || row?.start_date, publicHolidayRows)
  const dayLabel = workingDays == null ? '' : ` • ${workingDays} day${workingDays === 1 ? '' : 's'}`

  return {
    id: `leave-${row.id}`,
    rawId: row.id,
    type: 'LEAVE',
    name: row.employee_name_snapshot || row.employee_email_snapshot || '-',
    primaryDate: formatDateValue(row.start_date),
    secondaryDate: formatDateValue(row.end_date),
    dateLabel: `${formatDateValue(row.start_date)} - ${formatDateValue(row.end_date)}${dayLabel}`,
    note: row.reason || '-',
    status: row.status || 'SUBMITTED',
    submittedAt: row.submitted_at || row.created_at || '',
    row,
  }
}

function buildBirthdayItem(row) {
  return {
    id: `birthday-${row.id}`,
    rawId: row.id,
    type: 'BIRTHDAY',
    name: row.employee_name_snapshot || row.employee_email_snapshot || '-',
    primaryDate: formatDateValue(row.request_date),
    secondaryDate: row.size || '-',
    dateLabel: formatDateValue(row.request_date),
    note: row.item_name || row.notes || '-',
    status: row.status || 'SUBMITTED',
    submittedAt: row.submitted_at || row.created_at || '',
    row,
  }
}

function CombinedRequestTableModal({ rows, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(15, 23, 42, 0.28)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(100%, 1180px)',
          maxHeight: '85vh',
          overflow: 'auto',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>All Leave-Birthday Requests</h2>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>

        {!rows.length ? (
          <div className={styles.emptyState}>No request data found.</div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b' }}>
                    Type
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b' }}>
                    Name
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b' }}>
                    Date
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b' }}>
                    Detail
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b' }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.id}-${index}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
                      <TypePill value={row.type} />
                    </td>
                    <td style={{ padding: '13px 14px', fontSize: '13px', fontWeight: 700, color: '#0f172a', verticalAlign: 'top' }}>{row.name}</td>
                    <td style={{ padding: '13px 14px', fontSize: '13px', color: '#0f172a', verticalAlign: 'top' }}>{row.dateLabel}</td>
                    <td style={{ padding: '13px 14px', fontSize: '13px', lineHeight: 1.45, color: '#475569', verticalAlign: 'top' }}>{row.note}</td>
                    <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
                      <StatusPill value={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function formatMonthKey(value) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function buildCalendarEvents({ leaveRowsAll, peopleRows, publicHolidayRows }) {
  const events = []

  for (const row of publicHolidayRows || []) {
    if (!row?.holiday_date) continue
    events.push({
      date: row.holiday_date,
      type: 'HOLIDAY',
      title: row.holiday_name || 'Public Holiday',
      subtitle: row.notes || '',
      status: '',
    })
  }

  for (const person of peopleRows || []) {
    const birthdayValue = person?.date_of_birth || person?.birthdate || person?.birth_date
    if (!birthdayValue) continue
    const parsed = new Date(birthdayValue)
    if (Number.isNaN(parsed.getTime())) continue

    const currentYear = new Date().getFullYear()
    for (const year of [currentYear - 1, currentYear, currentYear + 1]) {
      const date = new Date(year, parsed.getMonth(), parsed.getDate())
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      events.push({
        date: iso,
        type: 'BIRTHDAY',
        title: person.display_name || person.email || 'Birthday',
        subtitle: 'Birthday',
        status: '',
      })
    }
  }

  for (const row of leaveRowsAll || []) {
    const status = String(row?.status || '').toUpperCase()
    if (status === 'REJECTED') continue

    const startDate = new Date(row?.start_date || '')
    const endDate = new Date(row?.end_date || row?.start_date || '')
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) continue

    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())

    while (cursor <= last) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      events.push({
        date: iso,
        type: 'LEAVE',
        title: row.employee_name_snapshot || row.employee_email_snapshot || 'Leave',
        subtitle: row.reason || '-',
        status: row.status || 'SUBMITTED',
      })
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return events
}

function CalendarModal({ leaveRowsAll, peopleRows, publicHolidayRows, holidayMissing, onClose }) {
  const today = new Date()
  const [monthKey, setMonthKey] = useState(formatMonthKey(today))
  const calendarEvents = useMemo(() => buildCalendarEvents({ leaveRowsAll, peopleRows, publicHolidayRows }), [leaveRowsAll, peopleRows, publicHolidayRows])

  const [selectedYear, selectedMonth] = monthKey.split('-').map(Number)
  const monthDate = new Date(selectedYear, selectedMonth - 1, 1)
  const startDay = monthDate.getDay()
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const eventMap = new Map()

  for (const event of calendarEvents) {
    if (!eventMap.has(event.date)) {
      eventMap.set(event.date, [])
    }
    eventMap.get(event.date).push(event)
  }

  const visibleMonthLabel = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  function moveMonth(step) {
    const nextDate = new Date(selectedYear, selectedMonth - 1 + step, 1)
    setMonthKey(formatMonthKey(nextDate))
  }

  const cells = []
  for (let index = 0; index < startDay; index += 1) {
    cells.push(<div key={`blank-${index}`} style={{ minHeight: '132px', border: '1px solid #f1f5f9', borderRadius: '12px', background: '#f8fafc' }} />)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayEvents = eventMap.get(iso) || []
    const isSunday = new Date(selectedYear, selectedMonth - 1, day).getDay() === 0
    const hasHoliday = dayEvents.some((event) => event.type === 'HOLIDAY')
    const isToday = iso === todayKey

    cells.push(
      <div
        key={iso}
        style={{
          minHeight: '132px',
          border: isToday ? '1px solid #1d4ed8' : hasHoliday ? '1px solid #fecaca' : '1px solid #e2e8f0',
          borderRadius: '12px',
          background: hasHoliday || isSunday ? '#fff7f7' : isToday ? '#f8fbff' : '#ffffff',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <strong style={{ fontSize: '13px', color: hasHoliday || isSunday ? '#b91c1c' : '#0f172a' }}>{day}</strong>
          {isToday ? (
            <span
              style={{
                minHeight: '18px',
                padding: '0 7px',
                borderRadius: '999px',
                background: '#dbeafe',
                color: '#1d4ed8',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Today
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {dayEvents.length ? (
            dayEvents.slice(0, 4).map((event, index) => (
              (() => {
                const isHoliday = event.type === 'HOLIDAY'
                const isBirthday = event.type === 'BIRTHDAY'
                const isApprovedLeave = event.type === 'LEAVE' && String(event.status || '').toUpperCase() === 'APPROVED'

                return (
              <div
                key={`${iso}-${event.type}-${index}`}
                style={{
                  borderRadius: '10px',
                  padding: '6px 7px',
                  background:
                    isHoliday ? '#fee2e2' : isBirthday ? '#eef2ff' : isApprovedLeave ? '#dcfce7' : '#f8fafc',
                  border:
                    isHoliday
                      ? '1px solid #fca5a5'
                      : isBirthday
                        ? '1px solid #c7d2fe'
                        : isApprovedLeave
                          ? '1px solid #86efac'
                        : '1px solid #e2e8f0',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '10px',
                    fontWeight: 800,
                    color: isHoliday ? '#b91c1c' : isApprovedLeave ? '#166534' : '#0f172a',
                    textTransform: 'uppercase',
                  }}
                >
                  {event.type}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{event.title}</p>
                {event.subtitle ? <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>{event.subtitle}</p> : null}
                {event.status ? <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#475569' }}>{event.status}</p> : null}
              </div>
                )
              })()
            ))
          ) : (
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>No events</span>
          )}
          {dayEvents.length > 4 ? <span style={{ fontSize: '10px', color: '#64748b' }}>+{dayEvents.length - 4} more</span> : null}
        </div>
      </div>,
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        background: 'rgba(15, 23, 42, 0.28)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(100vw - 24px, 100%)',
          height: 'calc(100vh - 24px)',
          maxHeight: 'calc(100vh - 24px)',
          overflow: 'auto',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '24px',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Leave-Birthday Calendar</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" className={styles.secondaryButton} onClick={() => moveMonth(-1)} aria-label="Previous month">
              &lt;
            </button>
            <div
              style={{
                minWidth: '220px',
                minHeight: '40px',
                padding: '0 14px',
                borderRadius: '999px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {visibleMonthLabel}
            </div>
            <button type="button" className={styles.secondaryButton} onClick={() => moveMonth(1)} aria-label="Next month">
              &gt;
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setMonthKey(formatMonthKey(today))}>
              Today
            </button>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {holidayMissing ? (
          <div className={styles.materialFulfillmentNote}>
            Table <strong>hrga_public_holidays</strong> is not available yet. Run the public holiday SQL first to show holiday dates in the calendar.
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px', flex: '1 1 auto' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => (
            <div
              key={label}
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: index === 0 ? '#b91c1c' : '#64748b',
              }}
            >
              {label}
            </div>
          ))}
          {cells}
        </div>
      </div>
    </div>
  )
}

export default function RequestPanelsClient({
  leaveRows,
  leaveRowsAll,
  leaveMissing,
  giftRows,
  giftRowsAll,
  giftMissing,
  peopleRows,
  publicHolidayRows,
  holidayMissing,
  canCreatePublicRequest,
}) {
  const [openModal, setOpenModal] = useState(false)
  const [openCalendar, setOpenCalendar] = useState(false)

  const visibleRows = useMemo(() => {
    return [...(leaveRows || []).map((row) => buildLeaveItem(row, publicHolidayRows)), ...(giftRows || []).map(buildBirthdayItem)]
      .sort((a, b) => {
        const aValue = new Date(a.row?.submitted_at || a.row?.created_at || 0).getTime()
        const bValue = new Date(b.row?.submitted_at || b.row?.created_at || 0).getTime()
        return bValue - aValue
      })
  }, [giftRows, leaveRows, publicHolidayRows])

  const allRows = useMemo(() => {
    return [...(leaveRowsAll || []).map((row) => buildLeaveItem(row, publicHolidayRows)), ...(giftRowsAll || []).map(buildBirthdayItem)].sort((a, b) => {
      const aValue = new Date(a.row?.submitted_at || a.row?.created_at || 0).getTime()
      const bValue = new Date(b.row?.submitted_at || b.row?.created_at || 0).getTime()
      return bValue - aValue
    })
  }, [giftRowsAll, leaveRowsAll, publicHolidayRows])

  const submittedCount = visibleRows.filter((item) => item.status === 'SUBMITTED').length
  const hasMissing = leaveMissing || giftMissing
  const peopleOptions = useMemo(() => {
    return (peopleRows || [])
      .filter((person) => !String(person.email || '').trim())
      .map((person) => ({
        id: person.id,
        label: `${person.display_name || person.id}${person.group ? ` - ${person.group}` : ''}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [peopleRows])

  return (
    <>
      <section style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '18px', lineHeight: 1.1, fontWeight: 700, color: '#0f172a' }}>Leave-Birthday Requests</h2>
            <button
              type="button"
              className={styles.secondaryButton}
              style={{ minHeight: '28px', width: '28px', borderRadius: '999px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setOpenCalendar(true)}
              aria-label="Open calendar view"
              title="Calendar View"
            >
              <CalendarIcon />
            </button>
            <button type="button" className={styles.secondaryButton} style={{ minHeight: '28px', borderRadius: '999px', fontSize: '11px' }} onClick={() => setOpenModal(true)}>
              View Detail
            </button>
            <PublicRequestLinkClient canCreate={canCreatePublicRequest} peopleOptions={peopleOptions} />
          </div>
          <span
            style={{
              minWidth: '20px',
              height: '20px',
              borderRadius: '999px',
              padding: '0 7px',
              background: '#111827',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            {submittedCount}
          </span>
        </div>

        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {hasMissing ? (
            <div className={styles.materialFulfillmentNote}>
              Leave-birthday request table is not fully available yet. Check <strong>hrga_leave_requests</strong> and <strong>hrga_birthday_gift</strong>.
            </div>
          ) : visibleRows.length ? (
            visibleRows.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  background: '#ffffff',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <TypePill value={item.type} />
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{item.name}</p>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{item.dateLabel}</p>
                  </div>
                  <StatusPill value={item.status} />
                </div>

                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.45, color: '#475569' }}>{item.note}</p>

                {item.status === 'SUBMITTED' ? (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {item.type === 'LEAVE' ? (
                      <>
                        <form action={approveLeaveRequest}>
                          <input type="hidden" name="request_id" value={item.rawId} />
                          <input type="hidden" name="next_status" value="APPROVED" />
                          <button type="submit" className={styles.primaryButton} style={{ minHeight: '30px', borderRadius: '999px', fontSize: '11px' }}>
                            Approve
                          </button>
                        </form>
                        <form action={approveLeaveRequest}>
                          <input type="hidden" name="request_id" value={item.rawId} />
                          <input type="hidden" name="next_status" value="REJECTED" />
                          <button type="submit" className={styles.secondaryButton} style={{ minHeight: '30px', borderRadius: '999px', fontSize: '11px' }}>
                            Reject
                          </button>
                        </form>
                      </>
                    ) : (
                      <>
                        <form action={approveBirthdayGiftRequest}>
                          <input type="hidden" name="request_id" value={item.rawId} />
                          <input type="hidden" name="next_status" value="APPROVED" />
                          <button type="submit" className={styles.primaryButton} style={{ minHeight: '30px', borderRadius: '999px', fontSize: '11px' }}>
                            Approve
                          </button>
                        </form>
                        <form action={approveBirthdayGiftRequest}>
                          <input type="hidden" name="request_id" value={item.rawId} />
                          <input type="hidden" name="next_status" value="REJECTED" />
                          <button type="submit" className={styles.secondaryButton} style={{ minHeight: '30px', borderRadius: '999px', fontSize: '11px' }}>
                            Reject
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className={styles.emptyState} style={{ minHeight: '180px' }}>
              No leave or birthday request yet.
            </div>
          )}
        </div>
      </section>

      {openModal ? <CombinedRequestTableModal rows={allRows} onClose={() => setOpenModal(false)} /> : null}
      {openCalendar ? (
        <CalendarModal
          leaveRowsAll={leaveRowsAll}
          peopleRows={peopleRows}
          publicHolidayRows={publicHolidayRows}
          holidayMissing={holidayMissing}
          onClose={() => setOpenCalendar(false)}
        />
      ) : null}
    </>
  )
}
