'use client'

import { useMemo, useState, useTransition } from 'react'
import { submitBirthdayGiftRequest, submitLeaveRequest } from '../human-resources/actions'
import { updateOwnProfile } from '../profile/actions'
import MyArklifeReimbursementClient from './myarklife-reimbursement-client'
import styles from './myarklife.module.css'

function toProperCase(value = '') {
  return String(value || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDateValue(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(parsed)
}

function formatLongDate(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
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

function formatNumber(value) {
  if (value == null || value === '') return '-'
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return String(value)
  return new Intl.NumberFormat('en-US').format(parsed)
}

function buildInitials(name) {
  return String(name || 'Team')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function getStatusTone(value) {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'APPROVED') return styles.statusApproved
  if (normalized === 'REJECTED') return styles.statusRejected
  if (normalized === 'PAID') return styles.statusPaid
  return styles.statusPending
}

function getBirthdayDateValue(profile = {}) {
  return profile?.date_of_birth || profile?.birthdate || profile?.birth_date || null
}

function getBirthdayClaimState(profile, giftRows) {
  const rawBirthDate = getBirthdayDateValue(profile)
  if (!rawBirthDate) {
    return { eligible: false, message: 'Birthday date is not available yet.' }
  }

  const parsed = new Date(rawBirthDate)
  if (Number.isNaN(parsed.getTime())) {
    return { eligible: false, message: 'Birthday date is not available yet.' }
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let birthday = new Date(today.getFullYear(), parsed.getMonth(), parsed.getDate())
  let windowEnd = new Date(birthday)
  windowEnd.setDate(windowEnd.getDate() + 7)

  if (today < birthday) {
    const previousBirthday = new Date(today.getFullYear() - 1, parsed.getMonth(), parsed.getDate())
    const previousWindowEnd = new Date(previousBirthday)
    previousWindowEnd.setDate(previousWindowEnd.getDate() + 7)
    if (today <= previousWindowEnd) {
      birthday = previousBirthday
      windowEnd = previousWindowEnd
    }
  }

  const hasClaimed = (giftRows || []).some((item) => {
    const requestDate = new Date(item.request_date)
    if (Number.isNaN(requestDate.getTime())) return false
    const day = new Date(requestDate.getFullYear(), requestDate.getMonth(), requestDate.getDate())
    return day >= birthday && day <= windowEnd
  })

  if (hasClaimed) {
    return {
      eligible: false,
      message: 'Already claimed for this birthday period.',
      windowLabel: `${formatLongDate(birthday)} - ${formatLongDate(windowEnd)}`,
    }
  }

  if (today < birthday) {
    return {
      eligible: false,
      message: `Available on ${formatLongDate(birthday)}.`,
      windowLabel: `${formatLongDate(birthday)} - ${formatLongDate(windowEnd)}`,
    }
  }

  if (today > windowEnd) {
    return {
      eligible: false,
      message: 'Birthday gift claim window is not applicable right now.',
      windowLabel: `${formatLongDate(birthday)} - ${formatLongDate(windowEnd)}`,
    }
  }

  return {
    eligible: true,
    message: 'You can claim your birthday gift now.',
    windowLabel: `${formatLongDate(birthday)} - ${formatLongDate(windowEnd)}`,
  }
}

function ModalFrame({ title, headerAddon = null, children, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderTitleWrap}>
            <h2 className={styles.modalTitle}>{title}</h2>
            {headerAddon}
          </div>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  )
}

function LeaveItem({ item }) {
  return (
    <div className={styles.requestItem}>
      <div className={styles.requestIcon}>*</div>
      <div className={styles.requestCopy}>
        <p className={styles.requestTitle}>{toProperCase(item.request_type || 'Leave')}</p>
        <p className={styles.requestSubtitle}>
          {formatDateValue(item.start_date)}
          {item.end_date && item.end_date !== item.start_date ? ` - ${formatDateValue(item.end_date)}` : ''}
        </p>
      </div>
      <span className={`${styles.statusBadge} ${getStatusTone(item.status)}`.trim()}>{toProperCase(item.status || 'Submitted')}</span>
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.metricSvg}>
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function LeaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.metricSvg}>
      <path d="M12 3c4.5 0 8 3.2 8 7.5S16.5 21 12 21 4 17.8 4 13.5 7.5 3 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 12h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.metricSvg}>
      <path d="M12 4 3 20h18L12 4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 9v4M12 17h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.metricSvg}>
      <rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 7V5h6v2M3 12h18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function MetricCard({ icon, label, value }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricIcon}>{icon}</div>
      <div>
        <p className={styles.metricLabel}>{label}</p>
        <p className={styles.metricValue}>{value}</p>
      </div>
    </div>
  )
}

export default function MyArklifeClient({ profile, leaveRows, giftRows, publicHolidayRows, leaveMissing, giftMissing, canOpenPeopleManagement }) {
  const [openLeaveModal, setOpenLeaveModal] = useState(false)
  const [openGiftModal, setOpenGiftModal] = useState(false)
  const [openProfileModal, setOpenProfileModal] = useState(false)
  const [pending, startTransition] = useTransition()
  const [profileError, setProfileError] = useState('')
  const [leaveError, setLeaveError] = useState('')
  const [giftError, setGiftError] = useState('')
  const [leaveStartDate, setLeaveStartDate] = useState('')
  const [leaveEndDate, setLeaveEndDate] = useState('')

  const displayName = toProperCase(profile?.display_name || profile?.email?.split('@')[0] || 'Team Member')
  const leaveCount = Array.isArray(leaveRows) ? leaveRows.length : 0
  const bankLabel =
    profile?.reimbursement_bank_name && profile?.reimbursement_account_number
      ? `${profile.reimbursement_bank_name} (Payroll)`
      : 'Payroll account not set'
  const bankCaption = profile?.reimbursement_account_number ? `Ending in ${profile.reimbursement_account_number.slice(-4)}` : 'Update in profile'
  const birthdayClaimState = useMemo(() => getBirthdayClaimState(profile, giftRows), [profile, giftRows])
  const leaveBalance = Math.max(0, Number(profile?.leave_allocation || 0) - Number(profile?.leave_used || 0))
  const todayInputValue = getTodayInputValue()
  const leaveWorkingDays = useMemo(
    () => calculateLeaveWorkingDays(leaveStartDate, leaveEndDate, publicHolidayRows),
    [leaveEndDate, leaveStartDate, publicHolidayRows],
  )

  async function handleServerAction(action, formData, { onSuccess, setModalError, clearOthers = [] } = {}) {
    setModalError?.('')
    clearOthers.forEach((clearError) => clearError(''))
    startTransition(async () => {
      try {
        await action(formData)
        onSuccess?.()
      } catch (actionError) {
        setModalError?.(actionError?.message || 'Something went wrong.')
      }
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.portalGrid}>
        <aside className={styles.sidebar}>
          <section className={styles.profileCard}>
            <div className={styles.profileTop}>
              <div className={styles.avatarWrap}>
                <div className={styles.avatar}>{buildInitials(displayName)}</div>
                <span className={styles.avatarStatus} />
              </div>
              <div className={styles.profileInfo}>
                <h2 className={styles.profileName}>{displayName}</h2>
                <p className={styles.profileRole}>{toProperCase(profile?.group || 'Employee')}</p>
              </div>
              <button type="button" className={styles.editButton} onClick={() => setOpenProfileModal(true)} aria-label="Edit profile">
                Edit
              </button>
            </div>

            <div className={styles.profileDetails}>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}>@</span>
                <span className={styles.detailText}>{profile?.email || '-'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}>#</span>
                <div>
                  <p className={styles.detailText}>{bankLabel}</p>
                  <p className={styles.detailHint}>{bankCaption}</p>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.sideCard}>
            <div className={styles.sideHeader}>
              <h3 className={styles.sideTitle}>Leave Requests</h3>
              <button
                type="button"
                className={styles.leaveActionButton}
                onClick={() => setOpenLeaveModal(true)}
                aria-label="New request"
                title="New request"
              >
                <span>+</span>
              </button>
            </div>

            {leaveMissing ? (
              <p className={styles.emptyText}>Leave request table belum tersedia.</p>
            ) : leaveCount ? (
              <div className={styles.requestList}>
                {leaveRows.slice(0, 2).map((item) => (
                  <LeaveItem key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <p className={styles.emptyText}>No leave request yet.</p>
            )}
          </section>

          <section className={styles.giftCard}>
            <p className={styles.sideTitleLight}>Birthday Gift Request</p>
            <div className={styles.giftBanner}>
              <div>
                <p className={styles.giftTitle}>{birthdayClaimState.eligible ? 'Claim Available' : 'Not Applicable'}</p>
                <p className={styles.giftText}>{birthdayClaimState.message}</p>
                {birthdayClaimState.windowLabel ? <p className={styles.giftSubtext}>Window: {birthdayClaimState.windowLabel}</p> : null}
              </div>
              <button type="button" className={styles.giftButton} onClick={() => setOpenGiftModal(true)} disabled={!birthdayClaimState.eligible}>
                Claim Gift
              </button>
            </div>
          </section>
        </aside>

        <main className={styles.mainPanel}>
          <MyArklifeReimbursementClient profile={profile} />
        </main>
      </div>

      <section className={styles.metricsGrid}>
        <MetricCard icon={<CalendarIcon />} label="Join Date" value={formatLongDate(profile?.join_date)} />
        <MetricCard icon={<LeaveIcon />} label="Leave Balance" value={formatNumber(leaveBalance)} />
        <MetricCard icon={<WarningIcon />} label="Penalty Points" value={formatNumber(profile?.penalty_points || 0)} />
        <MetricCard icon={<BriefcaseIcon />} label="Working Days" value={formatNumber(profile?.working_days || 0)} />
      </section>

      {openProfileModal ? (
        <ModalFrame title="Edit Profile" onClose={() => setOpenProfileModal(false)}>
          <form
            className={styles.modalForm}
            action={(formData) =>
              handleServerAction(updateOwnProfile, formData, {
                onSuccess: () => {
                  setOpenProfileModal(false)
                },
                setModalError: setProfileError,
                clearOthers: [setLeaveError, setGiftError],
              })
            }
          >
            <label className={styles.field}>
              <span className={styles.label}>Display Name</span>
              <input className={styles.input} type="text" name="display_name" defaultValue={displayName} required />
            </label>
            <div className={styles.formGridThree}>
              <label className={styles.field}>
                <span className={styles.label}>Bank Name</span>
                <input className={styles.input} type="text" name="reimbursement_bank_name" defaultValue={profile?.reimbursement_bank_name || ''} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Account Name</span>
                <input className={styles.input} type="text" name="reimbursement_account_name" defaultValue={profile?.reimbursement_account_name || ''} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Account Number</span>
                <input
                  className={styles.input}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="reimbursement_account_number"
                  defaultValue={profile?.reimbursement_account_number || ''}
                  onInput={(event) => {
                    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '')
                  }}
                />
              </label>
            </div>
            <label className={styles.field}>
              <span className={styles.label}>Address</span>
              <textarea className={styles.textarea} name="address" defaultValue={profile?.address || ''} />
            </label>
            {profileError ? <p className={styles.errorText}>{profileError}</p> : null}
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelButton} onClick={() => setOpenProfileModal(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.primaryButton} disabled={pending}>
                {pending ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </ModalFrame>
      ) : null}

      {openLeaveModal ? (
        <ModalFrame
          title="Request Leave"
          headerAddon={
            leaveStartDate && leaveEndDate && leaveWorkingDays != null ? (
              <span className={styles.leaveDaysBadge}>
                {leaveWorkingDays} day{leaveWorkingDays === 1 ? '' : 's'}
              </span>
            ) : null
          }
          onClose={() => setOpenLeaveModal(false)}
        >
          <form
            className={styles.modalForm}
            action={(formData) =>
              handleServerAction(submitLeaveRequest, formData, {
                onSuccess: () => {
                  setLeaveStartDate('')
                  setLeaveEndDate('')
                  setOpenLeaveModal(false)
                },
                setModalError: setLeaveError,
                clearOthers: [setProfileError, setGiftError],
              })
            }
          >
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
            <label className={styles.field}>
              <span className={styles.label}>Reason</span>
              <textarea className={styles.textarea} name="reason" required />
            </label>
            <div className={`${styles.detailSection} ${styles.leaveNotesSection}`.trim()}>
              <p className={`${styles.detailLabel} ${styles.leaveNotesLabel}`.trim()}>Leave Request Notes</p>
              <p className={`${styles.detailParagraph} ${styles.leaveNotesText}`.trim()}>
                KEWAJIBAN SEBELUM MENGAJUKAN CUTI = Memastikan seluruh tanggung jawab pekerjaan dan kelancaran operasional perusahaan tetap berjalan
                dengan baik dan sesuai arahan user. Jika didapati pelanggaran kewajiban pekerjaan yang tidak terselesaikan dengan baik maka cuti
                dianggap hangus dan terhitung unpaid leave (memotong gaji).
              </p>
            </div>
            {leaveError ? <p className={styles.errorText}>{leaveError}</p> : null}
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelDangerButton} onClick={() => setOpenLeaveModal(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.primaryButton} disabled={pending}>
                {pending ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </ModalFrame>
      ) : null}

      {openGiftModal ? (
        <ModalFrame title="Birthday Gift Request" onClose={() => setOpenGiftModal(false)}>
          <form
            className={styles.modalForm}
            action={(formData) =>
              handleServerAction(submitBirthdayGiftRequest, formData, {
                onSuccess: () => {
                  setOpenGiftModal(false)
                },
                setModalError: setGiftError,
                clearOthers: [setProfileError, setLeaveError],
              })
            }
          >
            <input type="hidden" name="request_date" value={new Date().toISOString().slice(0, 10)} />
            <label className={styles.field}>
              <span className={styles.label}>Item Name</span>
              <input className={styles.input} type="text" name="item_name" placeholder="Enter gift item name" required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Size</span>
              <input className={styles.input} type="text" name="size" placeholder="S, M, L, XL" />
            </label>
            {giftError ? <p className={styles.errorText}>{giftError}</p> : null}
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelButton} onClick={() => setOpenGiftModal(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.primaryButton} disabled={pending || !birthdayClaimState.eligible}>
                {pending ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </ModalFrame>
      ) : null}
    </div>
  )
}
