import { redirect } from 'next/navigation'
import { Inter } from 'next/font/google'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, canAccessPeopleManagement } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import { approveBirthdayGiftRequest, approveLeaveRequest } from './actions'
import PeopleDirectoryClient from './people-directory-client'
import ReimbursementClaimPage from '../reimbursement/reimbursement-claim-page'
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

function getQueryData(result) {
  if (result.error?.code === '42P01') {
    return { rows: [], missing: true }
  }

  return { rows: result.data || [], missing: false }
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

function SummaryCard({ label, value }) {
  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        background: '#ffffff',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '18px',
        minHeight: '124px',
      }}
    >
      <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
        {label}
      </span>
      <strong style={{ fontSize: '38px', lineHeight: 1, color: '#0f172a', letterSpacing: '-0.03em' }}>{value}</strong>
    </div>
  )
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
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>{eyebrow}</p>
        </div>
        <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{meta}</span>
      </div>

      <p style={{ margin: 0, fontSize: '13px', color: '#475569', fontStyle: 'italic' }}>{note}</p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>
    </div>
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

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')
  const role = isAdmin ? 'admin' : profile?.role || 'storage_staff'

  if (!canAccessPeopleManagement(role, isAdmin)) {
    redirect('/dashboard')
  }

  const [peopleResult, leaveResult, giftResult] = await Promise.all([
    supabase.from('dir_user_profiles').select('*').order('id', { ascending: true }),
    supabase.from('hrd_leave_requests').select('*').order('submitted_at', { ascending: false }),
    supabase.from('hrd_birthday_gift_requests').select('*').order('submitted_at', { ascending: false }),
  ])

  const { rows: peopleRows } = getQueryData(peopleResult)
  const { rows: leaveRows, missing: leaveMissing } = getQueryData(leaveResult)
  const { rows: giftRows, missing: giftMissing } = getQueryData(giftResult)

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
  const submittedLeaveCount = leaveRows.filter((item) => item.status === 'SUBMITTED').length
  const submittedGiftCount = giftRows.filter((item) => item.status === 'SUBMITTED').length

  return (
    <div className={`${styles.page} ${inter.className}`.trim()}>
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

          <div className={styles.buttonRow}>
            <button type="button" className={styles.primaryButton} style={{ minHeight: '42px', borderRadius: '999px', gap: '8px', padding: '0 20px' }}>
              <PlusIcon />
              <span>New Record</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.75fr) minmax(300px, 0.95fr)', gap: '18px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '12px',
            }}
          >
            <SummaryCard label="Number of People" value={peopleCount} />
            <SummaryCard label="Arkline" value={groupCounters.Arkline} />
            <SummaryCard label="MOB" value={groupCounters.MOB} />
            <SummaryCard label="OI" value={groupCounters.OI} />
            <SummaryCard label="Warehouse" value={groupCounters.Warehouse} />
            <SummaryCard label="HQ" value={groupCounters.HQ} />
          </div>

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
              <h2 style={{ margin: 0, fontSize: '18px', lineHeight: 1.1, fontWeight: 700, color: '#0f172a' }}>Gender Snapshot</h2>
              <PeopleDirectoryClient people={peopleRows} isAdmin={isAdmin} showSummary={false} />
            </div>

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
        </div>

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
              <h2 style={{ margin: 0, fontSize: '18px', lineHeight: 1.1, fontWeight: 700, color: '#0f172a' }}>Leave / Permit Requests</h2>
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

            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {leaveMissing ? (
                <div className={styles.materialFulfillmentNote}>
                  Table <strong>hrd_leave_requests</strong> is not available yet. Run the HRGA request SQL first.
                </div>
              ) : leaveRows.length ? (
                leaveRows.slice(0, 4).map((item) => (
                  <RequestCard
                    key={item.id}
                    title={item.employee_name_snapshot || item.employee_email_snapshot || '-'}
                    eyebrow={item.request_type || '-'}
                    meta={`${formatDateValue(item.start_date)} - ${formatDateValue(item.end_date)}`}
                    note={item.reason || '-'}
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

            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {giftMissing ? (
                <div className={styles.materialFulfillmentNote}>
                  Table <strong>hrd_birthday_gift_requests</strong> is not available yet. Run the HRGA request SQL first.
                </div>
              ) : giftRows.length ? (
                giftRows.slice(0, 4).map((item) => (
                  <RequestCard
                    key={item.id}
                    title={item.employee_name_snapshot || item.employee_email_snapshot || '-'}
                    eyebrow={item.status === 'SUBMITTED' ? 'Birthday Gift' : `Birthday Gift · ${item.status}`}
                    meta={`Requested: ${formatDateValue(item.request_date)}`}
                    note={item.notes || 'Standard corporate gift set'}
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

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '18px', lineHeight: 1.1, fontWeight: 700, color: '#0f172a' }}>Reimbursement Claims</h2>
          </div>

          <div style={{ padding: '14px' }}>
            <ReimbursementClaimPage
              title="Reimbursement Claims"
              showSummary={false}
              allowBatchCreation={false}
              allowHrgaApproverView
              showHeader={false}
              showToolbar={false}
              showAccountInfo={false}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
