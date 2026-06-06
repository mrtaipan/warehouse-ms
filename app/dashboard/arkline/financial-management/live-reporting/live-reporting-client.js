'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

import shellStyles from '../../arkline.module.css'
import useArklineAccess from '../../use-arkline-access'
import styles from './live-reporting.module.css'

const supabase = createClient()

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.homeIcon}>
      <path d="M4 10.5 12 4l8 6.5V20H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 20v-5h6v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function createDraft() {
  return {
    session_date: '',
    start_time: '',
    end_time: '',
    session_type: 'STANDALONE',
    partner_profile_id: '',
    hero_product_id: '',
    amount: '',
  }
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function formatNumberInput(value) {
  const digits = normalizeDigits(value)
  if (!digits) return ''
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(digits))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatMonthLabel(year, month) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1, 1))
}

function normalizeSession(row) {
  return {
    id: row?.id || '',
    session_date: row?.session_date || '',
    start_time: row?.start_time || '',
    end_time: row?.end_time || '',
    session_type: row?.session_type || 'STANDALONE',
    hero_product_sku: row?.hero_product_sku || '',
    hero_product_name_snapshot: row?.hero_product_name_snapshot || '',
    gross_amount: Number(row?.gross_amount || 0),
    submitted_by: row?.submitted_by || '',
    submitted_by_display_name: row?.submitted_by_profile?.display_name || row?.submitted_by_display_name_snapshot || row?.submitted_by || '-',
    partner_display_name_snapshot: row?.partner_profile?.display_name || row?.partner_display_name_snapshot || '',
    created_at: row?.created_at || '',
  }
}

function normalizeCredit(row) {
  return {
    id: row?.id || '',
    participant_display_name: row?.participant_profile?.display_name || row?.participant_display_name_snapshot || row?.participant_email || '-',
    credited_amount: Number(row?.credited_amount || 0),
    session_date: row?.session?.session_date || '',
    session_start_time: row?.session?.start_time || '',
    session_end_time: row?.session?.end_time || '',
    session_type: row?.session?.session_type || 'STANDALONE',
    hero_product_name_snapshot: row?.session?.hero_product_name_snapshot || '',
    submitted_by_display_name_snapshot: row?.session?.submitted_by_display_name_snapshot || '',
    partner_display_name_snapshot: row?.session?.partner_display_name_snapshot || '',
  }
}

export default function LiveReportingClient({ mobile = false }) {
  const { loading: accessLoading, access } = useArklineAccess()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [draft, setDraft] = useState(createDraft())
  const [profile, setProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [products, setProducts] = useState([])
  const [sessions, setSessions] = useState([])
  const [credits, setCredits] = useState([])
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [selectedRanking, setSelectedRanking] = useState(null)

  const canView = access.financialManagement

  async function loadWorkspace() {
    setLoading(true)
    setError('')

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!user) {
      setError('You need to sign in again to open live reporting.')
      setLoading(false)
      return
    }

    const { data: profileRow, error: profileError } = await getProfileByAuthenticatedUser(
      supabase,
      user,
      'id, email, display_name, role'
    )

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    const [
      { data: profileRows, error: profileRowsError },
      { data: productRows, error: productError },
      { data: sessionRows, error: sessionError },
      { data: creditRows, error: creditError },
    ] = await Promise.all([
      supabase.from('dir_user_profiles').select('id, email, display_name').order('display_name', { ascending: true }),
      supabase.from('arkline_dir_products').select('sku_induk, nama_produk').order('nama_produk', { ascending: true }),
      supabase
        .from('arkline_live_reporting_sessions')
        .select(
          `
            id,
            session_date,
            start_time,
            end_time,
            session_type,
            hero_product_sku,
            hero_product_name_snapshot,
            gross_amount,
            submitted_by,
            submitted_by_display_name_snapshot,
            partner_display_name_snapshot,
            created_at,
            submitted_by_profile:dir_user_profiles!arkline_live_reporting_sessions_submitted_by_profile_id_fkey(display_name),
            partner_profile:dir_user_profiles!arkline_live_reporting_sessions_partner_profile_id_fkey(display_name)
          `
        )
        .order('session_date', { ascending: false })
        .order('start_time', { ascending: false }),
      supabase
        .from('arkline_live_reporting_credits')
        .select(
          `
            id,
            credited_amount,
            participant_email,
            participant_display_name_snapshot,
            participant_profile:dir_user_profiles!arkline_live_reporting_credits_participant_profile_id_fkey(display_name),
            session:arkline_live_reporting_sessions!arkline_live_reporting_credits_session_id_fkey(
              session_date,
              start_time,
              end_time,
              session_type,
              hero_product_name_snapshot,
              submitted_by_display_name_snapshot,
              partner_display_name_snapshot
            )
          `
        ),
    ])

    if (profileRowsError || productError || sessionError || creditError) {
      setError(profileRowsError?.message || productError?.message || sessionError?.message || creditError?.message || 'Failed to load live reporting workspace.')
      setLoading(false)
      return
    }

    setProfile({
      id: profileRow?.id || '',
      email: user.email?.toLowerCase() || '',
      display_name:
        profileRow?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Team',
    })
    setProfiles((profileRows || []).map((item) => ({ id: String(item.id), email: String(item.email || '').trim().toLowerCase(), display_name: String(item.display_name || '').trim() })))
    setProducts(
      (productRows || []).map((item) => ({
        id: String(item.sku_induk || '').trim().toUpperCase(),
        name: String(item.nama_produk || '').trim(),
        sku: String(item.sku_induk || '').trim().toUpperCase(),
      }))
    )
    setSessions((sessionRows || []).map(normalizeSession))
    setCredits((creditRows || []).map(normalizeCredit))
    setLoading(false)
  }

  useEffect(() => {
    void loadWorkspace()
  }, [])

  const monthOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        sessions
          .map((item) => {
            if (!item.session_date) return ''
            const [year, month] = String(item.session_date).split('-')
            return year && month ? month : ''
          })
          .filter(Boolean)
      )
    ).sort((a, b) => Number(a) - Number(b))

    return values.map((value) => ({
      value,
      label: new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2026, Number(value) - 1, 1)),
    }))
  }, [sessions])

  const yearOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        sessions
          .map((item) => {
            if (!item.session_date) return ''
            return String(item.session_date).split('-')[0] || ''
          })
          .filter(Boolean)
      )
    ).sort((a, b) => Number(b) - Number(a))

    return values.map((value) => ({ value, label: value }))
  }, [sessions])

  const filteredSessions = useMemo(() => {
    return sessions.filter((item) => {
      if (!item.session_date) return false
      const [year, month] = String(item.session_date).split('-')
      const matchesMonth = monthFilter === 'all' ? true : month === monthFilter
      const matchesYear = yearFilter === 'all' ? true : year === yearFilter
      return matchesMonth && matchesYear
    })
  }, [sessions, monthFilter, yearFilter])

  const filteredCredits = useMemo(() => {
    return credits.filter((item) => {
      if (!item.session_date) return false
      const [year, month] = String(item.session_date).split('-')
      const matchesMonth = monthFilter === 'all' ? true : month === monthFilter
      const matchesYear = yearFilter === 'all' ? true : year === yearFilter
      return matchesMonth && matchesYear
    })
  }, [credits, monthFilter, yearFilter])

  const totalNominal = useMemo(
    () => filteredSessions.reduce((sum, item) => sum + Number(item.gross_amount || 0), 0),
    [filteredSessions]
  )

  const ranking = useMemo(() => {
    return Array.from(
      filteredCredits.reduce((map, item) => {
        const key = item.participant_display_name || 'Unknown'
        map.set(key, (map.get(key) || 0) + Number(item.credited_amount || 0))
        return map
      }, new Map())
    )
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount)
  }, [filteredCredits])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!profile?.email || !profile?.id) {
      setError('Your profile is not ready yet. Please refresh and try again.')
      return
    }

    if (!draft.session_date || !draft.start_time || !draft.end_time) {
      setError('Session date, start time, and end time are required.')
      return
    }

    if (!String(draft.amount || '').trim() || Number(normalizeDigits(draft.amount)) <= 0) {
      setError('Nominal must be above zero.')
      return
    }

    if (draft.session_type === 'PAIRING' && !draft.partner_profile_id) {
      setError('Choose the pairing partner first.')
      return
    }

    if (!draft.hero_product_id) {
      setError('Choose the hero product first.')
      return
    }

    const partner = profiles.find((item) => item.id === draft.partner_profile_id)
    const heroProduct = products.find((item) => item.id === draft.hero_product_id)
    const grossAmount = Number(normalizeDigits(draft.amount))
    const creditedAmount = draft.session_type === 'PAIRING' ? grossAmount / 2 : grossAmount

    setSaving(true)

    try {
      const sessionPayload = {
        session_date: draft.session_date,
        start_time: `${draft.start_time}:00`,
        end_time: `${draft.end_time}:00`,
        session_type: draft.session_type,
        submitted_by_profile_id: profile.id,
        submitted_by: profile.email,
        submitted_by_display_name_snapshot: profile.display_name || profile.email,
        partner_profile_id: draft.session_type === 'PAIRING' ? draft.partner_profile_id : null,
        partner_email: draft.session_type === 'PAIRING' ? partner?.email || null : null,
        partner_display_name_snapshot: draft.session_type === 'PAIRING' ? partner?.display_name || null : null,
        hero_product_sku: draft.hero_product_id,
        hero_product_name_snapshot: heroProduct?.name || null,
        gross_amount: grossAmount,
      }

      const { data: insertedSession, error: sessionError } = await supabase
        .from('arkline_live_reporting_sessions')
        .insert(sessionPayload)
        .select('id')
        .single()

      if (sessionError) throw new Error(sessionError.message)

      const creditPayload = [
        {
          session_id: insertedSession.id,
          participant_profile_id: profile.id,
          participant_email: profile.email,
          participant_display_name_snapshot: profile.display_name || profile.email,
          credited_amount: creditedAmount,
        },
      ]

      if (draft.session_type === 'PAIRING' && partner) {
        creditPayload.push({
          session_id: insertedSession.id,
          participant_profile_id: partner.id,
          participant_email: partner.email,
          participant_display_name_snapshot: partner.display_name || partner.email,
          credited_amount: creditedAmount,
        })
      }

      const { error: creditError } = await supabase.from('arkline_live_reporting_credits').insert(creditPayload)
      if (creditError) throw new Error(creditError.message)

      setDraft(createDraft())
      setSuccess('Live GMV session saved.')
      await loadWorkspace()
    } catch (submitError) {
      setError(submitError.message || 'Failed to save live GMV session.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.shell} ${mobile ? styles.mobileShell : ''}`.trim()}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.title}>Live Reporting</h1>
          </div>
          <div className={styles.headerActions}>
            {!mobile ? (
              <Link href="/mobile/arkline/live-reporting" className={styles.primaryButton}>
                Open Mobile App
              </Link>
            ) : null}
          </div>
        </div>

        {error ? <p className={shellStyles.errorText}>{error}</p> : null}
        {success ? <p className={shellStyles.successText}>{success}</p> : null}

        {loading || accessLoading ? (
          <div className={styles.emptyState}>Loading live reporting...</div>
        ) : !canView ? (
          <div className={styles.emptyState}>Your account does not have Arkline live reporting access yet.</div>
        ) : (
          <>
            {!mobile ? (
              <div className={styles.dashboardTop}>
                <section className={styles.metricCard}>
                  <div className={styles.metricHead}>
                    <div>
                      <p className={styles.sectionEyebrow}>Filter</p>
                      <h2 className={styles.sectionTitle}>Dashboard</h2>
                    </div>
                  </div>

                  <div className={styles.filterRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Month</label>
                      <select className={styles.select} value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                        <option value="all">All months</option>
                        {monthOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Year</label>
                      <select className={styles.select} value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                        <option value="all">All years</option>
                        {yearOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.totalCard}>
                    <span>Total Nominal</span>
                    <strong>{formatCurrency(totalNominal)}</strong>
                  </div>
                </section>

                <section className={styles.panelCard}>
                  <div className={styles.sectionHead}>
                    <div>
                      <p className={styles.sectionEyebrow}>Ranking</p>
                      <h2 className={styles.sectionTitle}>User Total</h2>
                    </div>
                  </div>

                  {!ranking.length ? (
                    <div className={styles.emptyState}>No ranking data for this period.</div>
                  ) : (
                    <div className={styles.rankingList}>
                      {ranking.map((item, index) => (
                        <div key={item.name} className={styles.rankingRow}>
                          <span className={styles.rankIndex}>{index + 1}</span>
                          <div className={styles.rankingCopy}>
                            <strong>{item.name}</strong>
                            <span>{formatCurrency(item.amount)}</span>
                          </div>
                          <button type="button" className={styles.inlineAction} onClick={() => setSelectedRanking(item.name)}>
                            View Detail
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : null}

          <section className={`${styles.formCard} ${mobile ? styles.mobileFormCard : ''}`.trim()}>
            {mobile ? (
              <div className={styles.mobilePanelHead}>
                <div>
                  <p className={styles.sectionEyebrow}>Arkline</p>
                  <h2 className={styles.sectionTitle}>Live Reporting</h2>
                </div>
                <Link href="/dashboard" className={styles.mobileHomeButton} aria-label="Go to dashboard home">
                  <HomeIcon />
                </Link>
              </div>
            ) : null}

            {!mobile ? (
              <div className={styles.sectionHead}>
                <div>
                  <p className={styles.sectionEyebrow}>Live GMV</p>
                  <h2 className={styles.sectionTitle}>Session Entry</h2>
                  </div>
                </div>
              ) : null}

              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={mobile ? styles.mobileSegment : styles.formRowTwo}>
                  <div className={styles.field}>
                    {!mobile ? <label className={styles.label}>Session Type *</label> : null}
                    <div className={styles.segmentedControl}>
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${draft.session_type === 'STANDALONE' ? styles.segmentButtonActive : ''}`.trim()}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            session_type: 'STANDALONE',
                            partner_profile_id: '',
                          }))
                        }
                      >
                        Standalone
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${draft.session_type === 'PAIRING' ? styles.segmentButtonActive : ''}`.trim()}
                        onClick={() => setDraft((prev) => ({ ...prev, session_type: 'PAIRING' }))}
                      >
                        Pairing
                      </button>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Nominal *</label>
                    <input
                      className={styles.input}
                      inputMode="numeric"
                      value={draft.amount}
                      onChange={(event) => setDraft((prev) => ({ ...prev, amount: formatNumberInput(event.target.value) }))}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className={styles.formRowThree}>
                  <div className={styles.field}>
                    <label className={styles.label}>Date *</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={draft.session_date}
                      onChange={(event) => setDraft((prev) => ({ ...prev, session_date: event.target.value }))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Start Time *</label>
                    <input
                      className={styles.input}
                      type="time"
                      value={draft.start_time}
                      onChange={(event) => setDraft((prev) => ({ ...prev, start_time: event.target.value }))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End Time *</label>
                    <input
                      className={styles.input}
                      type="time"
                      value={draft.end_time}
                      onChange={(event) => setDraft((prev) => ({ ...prev, end_time: event.target.value }))}
                    />
                  </div>
                </div>

                <div className={styles.formRowTwo}>
                  <div className={styles.field}>
                    <label className={styles.label}>Hero Product *</label>
                    <select
                      className={styles.select}
                      value={draft.hero_product_id}
                      onChange={(event) => setDraft((prev) => ({ ...prev, hero_product_id: event.target.value }))}
                    >
                      <option value="">Choose product</option>
                      {products.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {draft.session_type === 'PAIRING' ? (
                    <div className={styles.field}>
                      <label className={styles.label}>Pairing With *</label>
                      <select
                        className={styles.select}
                        value={draft.partner_profile_id}
                        onChange={(event) => setDraft((prev) => ({ ...prev, partner_profile_id: event.target.value }))}
                      >
                        <option value="">Choose display name</option>
                        {profiles
                          .filter((item) => item.id !== profile?.id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.display_name || item.email}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : mobile ? null : <div className={styles.field} />}
                </div>

                <div className={`${styles.buttonRow} ${mobile ? styles.mobileButtonRow : ''}`.trim()}>
                  {mobile ? (
                    <>
                      <button type="button" className={styles.ghostButton} onClick={() => setDraft(createDraft())} disabled={saving}>
                        Clear
                      </button>
                      <button type="submit" className={styles.primaryButton} disabled={saving}>
                        {saving ? 'Saving...' : 'Add'}
                      </button>
                    </>
                  ) : (
                    <button type="submit" className={styles.primaryButton} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Session'}
                    </button>
                  )}
                </div>
              </form>
            </section>

          </>
        )}
      </section>

      {selectedRanking ? (
        <div className={shellStyles.modalOverlay} onClick={() => setSelectedRanking(null)}>
          <div className={`${shellStyles.modalCard} ${styles.detailModal}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.sectionEyebrow}>User Detail</p>
                <h2 className={styles.sectionTitle}>{selectedRanking}</h2>
              </div>
              <button type="button" className={styles.ghostButton} onClick={() => setSelectedRanking(null)}>
                Close
              </button>
            </div>

            <div className={styles.detailTableWrap}>
              <table className={styles.detailTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Submitted By</th>
                    <th>Pairing</th>
                    <th>Hero Product</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCredits
                    .filter((item) => item.participant_display_name === selectedRanking)
                    .map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.session_date)}</td>
                        <td>
                          {item.session_start_time?.slice(0, 5)} - {item.session_end_time?.slice(0, 5)}
                        </td>
                        <td>{item.session_type === 'PAIRING' ? 'Pairing' : 'Standalone'}</td>
                        <td>{item.submitted_by_display_name_snapshot || '-'}</td>
                        <td>{item.partner_display_name_snapshot || '-'}</td>
                        <td>{item.hero_product_name_snapshot || '-'}</td>
                        <td>{formatCurrency(item.credited_amount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
