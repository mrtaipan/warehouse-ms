'use client'

import { useMemo, useState, useTransition } from 'react'

import { submitPublicRequest } from '../dashboard/human-resources/actions'
import styles from './page.module.css'

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

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export default function PublicRequestClient({ payload, signature, linkData, publicHolidayRows }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [leaveStartDate, setLeaveStartDate] = useState('')
  const [leaveEndDate, setLeaveEndDate] = useState('')
  const todayInputValue = getTodayInputValue()
  const isLeave = String(linkData?.type || '').toUpperCase() === 'LEAVE'

  const leaveWorkingDays = useMemo(
    () => calculateLeaveWorkingDays(leaveStartDate, leaveEndDate, publicHolidayRows),
    [leaveEndDate, leaveStartDate, publicHolidayRows],
  )

  function handleSubmit(formData) {
    setError('')
    startTransition(async () => {
      try {
        await submitPublicRequest(formData)
        setSubmitted(true)
      } catch (submitError) {
        setError(submitError?.message || 'Failed to submit request.')
      }
    })
  }

  if (submitted) {
    return (
      <div className={styles.card}>
        <div>
          <p className={styles.eyebrow}>People Request</p>
          <h1 className={styles.title}>Request Submitted</h1>
          <p className={styles.subtitle}>For {linkData.display_name || 'Guest User'}</p>
        </div>

        <div className={styles.emptyState}>
          Your request has been submitted and is currently being processed.
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div>
        <p className={styles.eyebrow}>People Request</p>
        <h1 className={styles.title}>{isLeave ? 'Leave Request' : 'Birthday Request'}</h1>
        <p className={styles.subtitle}>For {linkData.display_name || 'Guest User'}</p>
      </div>

      <div className={styles.metaRow}>
        <span className={styles.typePill}>{isLeave ? 'Leave' : 'Birthday'}</span>
        {isLeave && leaveStartDate && leaveEndDate && leaveWorkingDays != null ? (
          <span className={styles.dayBadge}>
            {leaveWorkingDays} day{leaveWorkingDays === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <form action={handleSubmit} className={styles.form}>
        <input type="hidden" name="payload" value={payload} />
        <input type="hidden" name="sig" value={signature} />
        <input type="hidden" name="request_type" value={linkData.type} />

        {isLeave ? (
          <>
            <div className={styles.grid}>
              <label className={styles.field}>
                <span className={styles.label}>Start Date</span>
                <input
                  className={styles.input}
                  type="date"
                  name="start_date"
                  min={todayInputValue}
                  required
                  value={leaveStartDate}
                  onChange={(event) => setLeaveStartDate(event.currentTarget.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>End Date</span>
                <input
                  className={styles.input}
                  type="date"
                  name="end_date"
                  min={leaveStartDate || todayInputValue}
                  required
                  value={leaveEndDate}
                  onChange={(event) => setLeaveEndDate(event.currentTarget.value)}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Reason</span>
              <textarea className={styles.textarea} name="reason" required />
            </label>
          </>
        ) : (
          <>
            <input type="hidden" name="request_date" value={todayInputValue} />
            <label className={styles.field}>
              <span className={styles.label}>Item Name</span>
              <input className={styles.input} type="text" name="item_name" placeholder="Enter gift item name" required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Size</span>
              <input className={styles.input} type="text" name="size" placeholder="S, M, L, XL" />
            </label>
          </>
        )}

        {isLeave ? <p className={styles.hint}>Saturday, Sunday, and registered public holidays are excluded.</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button type="submit" className={styles.primaryButton} disabled={pending}>
            {pending ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  )
}
