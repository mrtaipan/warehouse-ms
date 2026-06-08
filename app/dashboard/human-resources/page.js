import { redirect } from 'next/navigation'
import { Inter } from 'next/font/google'
import { createClient } from '@/utils/supabase/server'
import { canAccessPeopleManagement, hasPermission } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'
import HumanResourcesAutoRefreshClient from './auto-refresh-client'
import PeopleDirectoryClient from './people-directory-client'
import PublicHolidayClient from './public-holiday-client'
import PaymentArrangementClient from './payment-arrangement-client'
import { approveBirthdayGiftRequest, approveLeaveRequest } from './actions'
import RequestPanelsClient from './request-panels-client.js'
import ReimbursementPanelClient from './reimbursement-panel-client'
import styles from '../arkline/arkline.module.css'

const inter = Inter({ subsets: ['latin'] })

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

function RequestCard({ title, eyebrow, meta, note, actions }) {
  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        background: '#ffffff',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{title}</p>
          {eyebrow ? <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>{eyebrow}</p> : null}
        </div>
        <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{meta}</span>
      </div>

      <p style={{ margin: 0, fontSize: '13px', color: '#475569', fontStyle: 'italic' }}>{note}</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>
    </div>
  )
}

function getQueryData(result) {
  if (result.error?.code === '42P01') {
    return { rows: [], missing: true }
  }

  return { rows: result.data || [], missing: false }
}

function filterActiveLeaveRows(rows) {
  const today = new Date()
  const todayValue = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  return (rows || []).filter((item) => {
    const status = String(item?.status || '').toUpperCase()
    if (status === 'REJECTED') return false

    const endDate = new Date(item?.end_date || item?.start_date || '')
    if (Number.isNaN(endDate.getTime())) return false
    const endValue = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime()
    return endValue >= todayValue
  })
}

function filterVisibleBirthdayGiftRows(rows) {
  const today = new Date()
  const todayValue = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  return (rows || []).filter((item) => {
    const status = String(item?.status || '').toUpperCase()
    if (status === 'SUBMITTED') return true
    if (status !== 'APPROVED') return false

    const approvedAt = new Date(item?.approved_at || '')
    if (Number.isNaN(approvedAt.getTime())) return false
    const expiry = new Date(approvedAt.getFullYear(), approvedAt.getMonth(), approvedAt.getDate())
    expiry.setDate(expiry.getDate() + 3)
    return expiry.getTime() >= todayValue
  })
}

function normalizeGenderValue(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (['M', 'MALE', 'MAN'].includes(normalized)) return 'Male'
  if (['F', 'FEMALE', 'WOMAN'].includes(normalized)) return 'Female'
  return ''
}

function getGroupLabel(row = {}) {
  const source =
    row.group_name ||
    row.group ||
    row.department ||
    row.division ||
    row.team ||
    row.company_group ||
    row.entity ||
    row.office ||
    ''

  const normalized = String(source || '').trim().toUpperCase()
  if (!normalized) return ''
  if (normalized.includes('ARK')) return 'Arkline'
  if (normalized.includes('MOB')) return 'MOB'
  if (normalized.includes(' OI') || normalized === 'OI' || normalized.includes('OFFICE')) return 'OI'
  if (normalized.includes('WARE')) return 'Warehouse'
  if (normalized.includes('HQ') || normalized.includes('HEAD')) return 'HQ'
  return ''
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M12 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default async function HumanResourcesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { permissions, isAdmin, role } = await loadAccessContext(supabase, user, 'role')

  if (!canAccessPeopleManagement(permissions, isAdmin)) {
    redirect('/dashboard')
  }

  const [peopleResult, leaveResult, giftResult, holidayResult] = await Promise.all([
    supabase.from('dir_user_profiles').select('*').order('id', { ascending: true }),
    supabase.from('hrga_leave_requests').select('*').order('submitted_at', { ascending: false }),
    supabase.from('hrga_birthday_gift').select('*').order('submitted_at', { ascending: false }),
    supabase.from('hrga_public_holidays').select('*').order('holiday_date', { ascending: true }),
  ])

  const { rows: peopleRows } = getQueryData(peopleResult)
  const { rows: leaveRowsRaw, missing: leaveMissing } = getQueryData(leaveResult)
  const { rows: giftRowsRaw, missing: giftMissing } = getQueryData(giftResult)
  const { rows: publicHolidayRows, missing: holidayMissing } = getQueryData(holidayResult)
  const leaveRows = filterActiveLeaveRows(leaveRowsRaw)
  const giftRows = filterVisibleBirthdayGiftRows(giftRowsRaw)

  const maleCount = peopleRows.filter((person) => normalizeGenderValue(person.gender || person.jenis_kelamin) === 'Male').length
  const femaleCount = peopleRows.filter((person) => normalizeGenderValue(person.gender || person.jenis_kelamin) === 'Female').length
  const peopleCount = peopleRows.length
  const groupCounters = { Arkline: 0, MOB: 0, OI: 0, Warehouse: 0, HQ: 0 }

  for (const row of peopleRows) {
    const label = getGroupLabel(row)
    if (label && label in groupCounters) {
      groupCounters[label] += 1
    }
  }

  const malePercent = peopleCount ? Math.round((maleCount / peopleCount) * 100) : 0
  const femalePercent = peopleCount ? Math.max(0, 100 - malePercent) : 0
  const topActionStyle = {
    minHeight: '42px',
    minWidth: '168px',
    borderRadius: '999px',
    padding: '0 18px',
    whiteSpace: 'nowrap',
    justifyContent: 'center',
  }
  const canViewArklinePaymentArrangement =
    role === 'hrga' ||
    role === 'leader' ||
    hasPermission(permissions, 'arkline.financial_management.view', isAdmin) ||
    hasPermission(permissions, 'arkline.financial_management.payment_submission.view', isAdmin)
  return (
    <div className={`${styles.page} ${inter.className}`.trim()}>
      <HumanResourcesAutoRefreshClient />
      <section
        style={{
          background: '#f7f9fb',
          border: '1px solid #e2e8f0',
          borderRadius: '22px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
              HRGA
            </p>
            <h1 style={{ margin: '4px 0 0', fontSize: '28px', lineHeight: 1.05, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>People Management</h1>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#475569' }}>
              Overview and administrative controls for the entire organization.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <PublicHolidayClient
              isAdmin={isAdmin}
              triggerClassName={styles.secondaryButton}
              triggerStyle={topActionStyle}
            />
            <PaymentArrangementClient
              triggerClassName={styles.secondaryButton}
              triggerStyle={topActionStyle}
              canViewArkline={canViewArklinePaymentArrangement}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' }}>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '18px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#64748b',
                  }}
                >
                  Number of People
                </p>
                <strong style={{ display: 'block', marginTop: '8px', fontSize: '54px', lineHeight: 0.95, color: '#0f172a', letterSpacing: '-0.04em' }}>
                  {peopleCount}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <PeopleDirectoryClient
                  people={peopleRows}
                  isAdmin={isAdmin}
                  showSummary={false}
                  openCreateOnTrigger
                  triggerClassName={styles.primaryButton}
                  triggerStyle={{ ...topActionStyle, minWidth: '140px' }}
                  triggerLabel="+ New People"
                />
                <PeopleDirectoryClient people={peopleRows} isAdmin={isAdmin} showSummary={false} />
              </div>
            </div>

            <details
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                background: '#f8fafc',
                padding: '10px 12px',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                <span>People Breakdown</span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>▾</span>
              </summary>

              <div
                style={{
                  marginTop: '12px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '10px',
                }}
              >
                {Object.entries(groupCounters).map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      background: '#ffffff',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>{label}</span>
                    <strong style={{ fontSize: '18px', color: '#0f172a' }}>{value}</strong>
                  </div>
                ))}
              </div>
            </details>

            <div style={{ height: '24px', borderRadius: '999px', overflow: 'hidden', background: '#e2e8f0', display: 'flex' }}>
              <div style={{ width: `${malePercent}%`, background: '#111827' }} />
              <div style={{ width: `${femalePercent}%`, background: '#94a3b8' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#111827' }} />
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{maleCount} Male</p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>{malePercent}% of workforce</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#94a3b8' }} />
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{femaleCount} Female</p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>{femalePercent}% of workforce</p>
                </div>
              </div>
            </div>
          </div>
          <RequestPanelsClient
            leaveRows={leaveRows}
            leaveRowsAll={leaveRowsRaw}
            leaveMissing={leaveMissing}
            giftRows={giftRows}
            giftRowsAll={giftRowsRaw}
            giftMissing={giftMissing}
            peopleRows={peopleRows}
            publicHolidayRows={publicHolidayRows}
            holidayMissing={holidayMissing}
            canCreatePublicRequest={hasPermission(permissions, 'hrga.public_request_links.edit', isAdmin)}
          />
        </div>

        {false ? (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden' }}>
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
              <h2 style={{ margin: 0, fontSize: '18px', lineHeight: 1.1, fontWeight: 700, color: '#0f172a' }}>Leave Requests</h2>
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
                {submittedLeaveCount}
              </span>
            </div>

            <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
              {leaveMissing ? (
                <div className={styles.materialFulfillmentNote}>
                  Table <strong>hrga_leave_requests</strong> is not available yet. Run the HRGA request SQL first.
                </div>
              ) : leaveRows.length ? (
                leaveRows.map((item) => (
                  <RequestCard
                    key={item.id}
                    title={item.employee_name_snapshot || item.employee_email_snapshot || '-'}
                    eyebrow="Leave"
                    meta={`${formatDateValue(item.start_date)} - ${formatDateValue(item.end_date)}`}
                    note={item.reason || '-'}
                    detailRows={[
                      { label: 'Status', value: item.status || '-' },
                      { label: 'Employee Email', value: item.employee_email_snapshot || '-' },
                      { label: 'Start Date', value: formatDateValue(item.start_date) },
                      { label: 'End Date', value: formatDateValue(item.end_date) },
                      { label: 'Submitted At', value: formatDateValue(item.submitted_at) },
                      { label: 'Approved At', value: formatDateValue(item.approved_at) },
                      { label: 'Approved By', value: item.approved_by || '-' },
                    ]}
                    actions={
                      item.status === 'SUBMITTED' ? (
                        <>
                          <form action={approveLeaveRequest}>
                            <input type="hidden" name="request_id" value={item.id} />
                            <input type="hidden" name="next_status" value="APPROVED" />
                            <button type="submit" className={styles.primaryButton} style={{ minHeight: '30px', borderRadius: '999px', fontSize: '11px' }}>
                              Approve
                            </button>
                          </form>
                          <form action={approveLeaveRequest}>
                            <input type="hidden" name="request_id" value={item.id} />
                            <input type="hidden" name="next_status" value="REJECTED" />
                            <button type="submit" className={styles.secondaryButton} style={{ minHeight: '30px', borderRadius: '999px', fontSize: '11px' }}>
                              Reject
                            </button>
                          </form>
                          <StatusPill value={item.status} />
                        </>
                      ) : (
                        <StatusPill value={item.status} />
                      )
                    }
                  />
                ))
              ) : (
                <div className={styles.emptyState} style={{ minHeight: '180px' }}>
                  No leave or permit request yet.
                </div>
              )}
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden' }}>
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
              <h2 style={{ margin: 0, fontSize: '18px', lineHeight: 1.1, fontWeight: 700, color: '#0f172a' }}>Birthday Gift Requests</h2>
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
                {submittedGiftCount}
              </span>
            </div>

            <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
              {giftMissing ? (
                <div className={styles.materialFulfillmentNote}>
                  Table <strong>hrga_birthday_gift</strong> is not available yet. Run the HRGA request SQL first.
                </div>
              ) : giftRows.length ? (
                giftRows.map((item) => (
                  <RequestCard
                    key={item.id}
                    title={item.employee_name_snapshot || item.employee_email_snapshot || '-'}
                    eyebrow={item.status === 'SUBMITTED' ? 'Birthday Gift' : `Birthday Gift · ${item.status}`}
                    meta={`Requested: ${formatDateValue(item.request_date)}`}
                    note={item.notes || 'Standard corporate gift set'}
                    detailRows={[
                      { label: 'Status', value: item.status || '-' },
                      { label: 'Employee Email', value: item.employee_email_snapshot || '-' },
                      { label: 'Request Date', value: formatDateValue(item.request_date) },
                      { label: 'Submitted At', value: formatDateValue(item.submitted_at) },
                      { label: 'Approved At', value: formatDateValue(item.approved_at) },
                      { label: 'Approved By', value: item.approved_by || '-' },
                    ]}
                    actions={
                      item.status === 'SUBMITTED' ? (
                        <>
                          <form action={approveBirthdayGiftRequest}>
                            <input type="hidden" name="request_id" value={item.id} />
                            <input type="hidden" name="next_status" value="APPROVED" />
                            <button type="submit" className={styles.primaryButton} style={{ minHeight: '30px', borderRadius: '999px', fontSize: '11px' }}>
                              Approve
                            </button>
                          </form>
                          <form action={approveBirthdayGiftRequest}>
                            <input type="hidden" name="request_id" value={item.id} />
                            <input type="hidden" name="next_status" value="REJECTED" />
                            <button type="submit" className={styles.secondaryButton} style={{ minHeight: '30px', borderRadius: '999px', fontSize: '11px' }}>
                              Reject
                            </button>
                          </form>
                          <StatusPill value={item.status} />
                        </>
                      ) : (
                        <StatusPill value={item.status} />
                      )
                    }
                  />
                ))
              ) : (
                <div className={styles.emptyState} style={{ minHeight: '180px' }}>
                  No birthday gift request yet.
                </div>
              )}
            </div>
          </div>
        </section>
        ) : null}
        <ReimbursementPanelClient />
      </section>
    </div>
  )
}

