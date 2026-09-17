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

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.homeIcon}>
      <path d="M4 12a8 8 0 1 0 2.3-5.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4l2.6 1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.homeIcon}>
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function getTodayDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDraft() {
  return {
    session_date: getTodayDateValue(),
    start_time: '',
    end_time: '',
    session_type: 'STANDALONE',
    sales_channel: 'TIKTOK',
    partner_profile_id: '',
    partner_profile_query: '',
    wearing_product_id: '',
    wearing_product_query: '',
    partner_wearing_product_id: '',
    partner_wearing_product_query: '',
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

function formatSalesChannel(value) {
  if (value === 'SHOPEE') return 'Shopee'
  return 'TikTok'
}

function buildLiveTrendChart(series) {
  if (!series.length) return { area: '', points: '', labels: [] }

  const width = 720
  const height = 224
  const paddingX = 52
  const paddingTop = 24
  const paddingBottom = 42
  const maxValue = Math.max(...series.map((item) => item.value), 1)
  const stepX = series.length > 1 ? (width - paddingX * 2) / (series.length - 1) : 0

  const labels = series.map((item, index) => {
    const x = series.length === 1 ? width / 2 : paddingX + stepX * index
    const y = height - paddingBottom - (item.value / maxValue) * (height - paddingTop - paddingBottom)
    return { ...item, x, y }
  })

  const points = labels.map((item) => `${item.x},${item.y}`).join(' ')
  const firstPoint = labels[0]
  const lastPoint = labels[labels.length - 1]
  const area = firstPoint && lastPoint ? `${firstPoint.x},${height - paddingBottom} ${points} ${lastPoint.x},${height - paddingBottom}` : ''

  return { area, points, labels }
}

function getProductOptionLabel(product) {
  if (!product) return ''
  return [product.sku, product.name].filter(Boolean).join(' - ')
}

function findProductByInput(products, value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (!normalized) return null

  return (
    products.find((item) => item.sku === normalized) ||
    products.find((item) => getProductOptionLabel(item).toUpperCase() === normalized) ||
    null
  )
}

function getProfileOptionLabel(profile) {
  if (!profile) return ''
  return profile.display_name || profile.email || ''
}

function findProfileByInput(profiles, value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null

  return (
    profiles.find((item) => String(item.display_name || '').trim().toLowerCase() === normalized) ||
    profiles.find((item) => String(item.email || '').trim().toLowerCase() === normalized) ||
    null
  )
}

function normalizeSession(row) {
  return {
    id: row?.id || '',
    host_profile_id: row?.host_profile_id || '',
    session_date: row?.session_date || '',
    start_time: row?.start_time || '',
    end_time: row?.end_time || '',
    session_type: row?.session_type || 'STANDALONE',
    sales_channel: row?.sales_channel || 'TIKTOK',
    wearing_product_sku: row?.wearing_product_sku || '',
    partner_wearing_product_sku: row?.partner_wearing_product_sku || '',
    gross_amount: Number(row?.gross_amount || 0),
    host_display_name: row?.host_profile?.display_name || row?.host_display_name_snapshot || '-',
    partner_display_name_snapshot: row?.partner_profile?.display_name || row?.partner_display_name_snapshot || '',
    created_at: row?.created_at || '',
  }
}

function normalizeCredit(row) {
  return {
    id: row?.id || '',
    host_display_name: row?.host_profile?.display_name || row?.host_display_name_snapshot || '-',
    credited_amount: Number(row?.credited_amount || 0),
    session_date: row?.session?.session_date || '',
    session_start_time: row?.session?.start_time || '',
    session_end_time: row?.session?.end_time || '',
    session_type: row?.session?.session_type || 'STANDALONE',
    sales_channel: row?.session?.sales_channel || 'TIKTOK',
    wearing_product_sku: row?.session?.wearing_product_sku || '',
    partner_wearing_product_sku: row?.session?.partner_wearing_product_sku || '',
    host_display_name_snapshot: row?.session?.host_display_name_snapshot || '',
    partner_display_name_snapshot: row?.session?.partner_display_name_snapshot || '',
  }
}

export default function LiveReportingClient({ mobile = false, mobileView = 'entry' }) {
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
  const [trendGroup, setTrendGroup] = useState('MONTH')
  const [hoveredTrendKey, setHoveredTrendKey] = useState('')
  const [selectedRanking, setSelectedRanking] = useState(null)

  const canView = access.financialManagementLiveReportingView
  const canSubmit = access.financialManagementLiveReportingAdd

  function updateProductDraft(fieldPrefix, value) {
    const matched = findProductByInput(products, value)
    setDraft((prev) => ({
      ...prev,
      [`${fieldPrefix}_query`]: value,
      [`${fieldPrefix}_id`]: matched?.sku || '',
    }))
  }

  function updatePartnerDraft(value) {
    const matched = findProfileByInput(profiles, value)
    setDraft((prev) => ({
      ...prev,
      partner_profile_query: value,
      partner_profile_id: matched?.id || '',
    }))
  }

  function clearDraftField(fieldPrefix) {
    setDraft((prev) => ({
      ...prev,
      [`${fieldPrefix}_query`]: '',
      [`${fieldPrefix}_id`]: '',
    }))
  }

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
      supabase
        .from('dir_user_profiles')
        .select('id, email, display_name, role')
        .eq('role', 'arkline_host')
        .order('display_name', { ascending: true }),
      supabase.from('arkline_dir_products').select('sku_induk, nama_produk').order('nama_produk', { ascending: true }),
      supabase
        .from('arkline_live_reporting_sessions')
        .select(
          `
            id,
            host_profile_id,
            session_date,
            start_time,
            end_time,
            session_type,
            sales_channel,
            wearing_product_sku,
            partner_wearing_product_sku,
            gross_amount,
            host_display_name_snapshot,
            partner_display_name_snapshot,
            created_at,
            host_profile:dir_user_profiles!arkline_live_reporting_sessions_host_profile_id_fkey(display_name),
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
            host_display_name_snapshot,
            host_profile:dir_user_profiles!arkline_live_reporting_credits_host_profile_id_fkey(display_name),
            session:arkline_live_reporting_sessions!arkline_live_reporting_credits_session_id_fkey(
              session_date,
              start_time,
              end_time,
              session_type,
              sales_channel,
              wearing_product_sku,
              partner_wearing_product_sku,
              host_display_name_snapshot,
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
    setProfiles(
      (profileRows || [])
        .map((item) => ({
          id: String(item.id),
          email: String(item.email || '').trim().toLowerCase(),
          display_name: String(item.display_name || '').trim(),
          role: String(item.role || '').trim().toLowerCase(),
        }))
        .filter((item) => item.role === 'arkline_host')
    )
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

  const periodFilter = monthFilter !== 'all' && yearFilter !== 'all' ? `${yearFilter}-${monthFilter}` : ''

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

  const personalSessions = useMemo(() => {
    const profileId = String(profile?.id || '').trim()
    return filteredSessions.filter((item) => {
      if (!profileId) return false
      return String(item.host_profile_id || '').trim() === profileId
    })
  }, [filteredSessions, profile])

  const ranking = useMemo(() => {
    return Array.from(
      filteredCredits.reduce((map, item) => {
        const key = item.host_display_name || 'Unknown'
        map.set(key, (map.get(key) || 0) + Number(item.credited_amount || 0))
        return map
      }, new Map())
    )
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount)
  }, [filteredCredits])

  const trendSeries = useMemo(() => {
    const grouped = new Map()

    filteredSessions.forEach((item) => {
      const date = new Date(`${item.session_date}T00:00:00`)
      if (Number.isNaN(date.getTime())) return

      let key = ''
      let label = ''

      if (trendGroup === 'DAY') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        label = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date)
      } else if (trendGroup === 'YEAR') {
        key = String(date.getFullYear())
        label = key
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        label = formatMonthLabel(date.getFullYear(), date.getMonth() + 1)
      }

      const existing = grouped.get(key) || { key, label, value: 0, count: 0 }
      existing.value += Number(item.gross_amount || 0)
      existing.count += 1
      grouped.set(key, existing)
    })

    return Array.from(grouped.values()).sort((left, right) => left.key.localeCompare(right.key))
  }, [filteredSessions, trendGroup])

  const trendChart = useMemo(() => {
    return buildLiveTrendChart(trendSeries)
  }, [trendSeries])

  const hoveredTrendPoint = useMemo(
    () => trendChart.labels.find((item) => item.key === hoveredTrendKey) || null,
    [trendChart.labels, hoveredTrendKey]
  )

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!canSubmit) {
      setError('You do not have permission to submit live reporting.')
      return
    }

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
      setError('Partner must be selected from the dropdown list.')
      return
    }

    if (draft.session_type === 'PAIRING' && !draft.partner_wearing_product_id) {
      setError('Choose the partner wearing product first.')
      return
    }

    if (!draft.wearing_product_id) {
      setError('Choose the wearing product first.')
      return
    }

    const partner = profiles.find((item) => item.id === draft.partner_profile_id)
    const grossAmount = Number(normalizeDigits(draft.amount))
    const creditedAmount = draft.session_type === 'PAIRING' ? grossAmount / 2 : grossAmount

    setSaving(true)

    try {
      const sessionPayload = {
        session_date: draft.session_date,
        start_time: `${draft.start_time}:00`,
        end_time: `${draft.end_time}:00`,
        session_type: draft.session_type,
        sales_channel: draft.sales_channel,
        host_profile_id: profile.id,
        host_display_name_snapshot: profile.display_name || profile.email,
        partner_profile_id: draft.session_type === 'PAIRING' ? draft.partner_profile_id : null,
        partner_display_name_snapshot: draft.session_type === 'PAIRING' ? partner?.display_name || null : null,
        wearing_product_sku: draft.wearing_product_id,
        partner_wearing_product_sku: draft.session_type === 'PAIRING' ? draft.partner_wearing_product_id : null,
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
          host_profile_id: profile.id,
          host_display_name_snapshot: profile.display_name || profile.email,
          credited_amount: creditedAmount,
        },
      ]

      if (draft.session_type === 'PAIRING' && partner) {
        creditPayload.push({
          session_id: insertedSession.id,
          host_profile_id: partner.id,
          host_display_name_snapshot: partner.display_name || partner.email,
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
        {!mobile ? (
          <div className={styles.header}>
            <div className={styles.titleBlock}>
              <p className={styles.sectionEyebrow}>Arkline</p>
              <h1 className={styles.title}>Live Reporting</h1>
            </div>
            <div className={styles.headerActions}>
              <input
                type="month"
                className={styles.periodInput}
                value={periodFilter}
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    setMonthFilter('all')
                    setYearFilter('all')
                    return
                  }
                  const [year, month] = value.split('-')
                  setYearFilter(year || 'all')
                  setMonthFilter(month || 'all')
                }}
                aria-label="Filter live reporting period"
              />
              <Link href="/mobile/arkline/live-reporting" className={styles.iconLinkButton} aria-label="Open live entry">
                <AddIcon />
              </Link>
            </div>
          </div>
        ) : null}

        {error ? <p className={shellStyles.errorText}>{error}</p> : null}
        {success ? <p className={shellStyles.successText}>{success}</p> : null}

        {loading || accessLoading ? (
          <div className={styles.emptyState}>Loading live reporting...</div>
        ) : !canView ? (
          <div className={styles.emptyState}>Your account does not have Arkline live reporting access yet.</div>
        ) : (
          <>
            {!mobile ? (
              <div className={styles.reportingColumns}>
              <section className={styles.liveTrendPanel}>
                <div className={styles.sectionHead}>
                  <div>
                    <h2 className={styles.sectionTitle}>GMV Trend</h2>
                  </div>
                  <div className={styles.segmentedControl}>
                    {['DAY', 'MONTH', 'YEAR'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`${styles.segmentButton} ${trendGroup === item ? styles.segmentButtonActive : ''}`.trim()}
                        onClick={() => setTrendGroup(item)}
                        aria-pressed={trendGroup === item}
                      >
                        {item === 'DAY' ? 'Day' : item === 'MONTH' ? 'Month' : 'Year'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.liveTrendChartWrap}>
                  {!trendChart.labels.length ? (
                    <div className={styles.emptyState}>No GMV trend data found for the selected period.</div>
                  ) : (
                    <svg viewBox="0 0 720 224" className={styles.liveTrendChart} aria-label="Live GMV trend chart">
                      {[40, 78, 116, 154].map((y) => (
                        <line key={y} x1="52" y1={y} x2="668" y2={y} className={styles.liveTrendGridLine} />
                      ))}
                      <polygon points={trendChart.area} className={styles.liveTrendArea} />
                      <polyline points={trendChart.points} className={styles.liveTrendLine} />
                      {trendChart.labels.map((point, index) => {
                        const labelStep = Math.max(Math.ceil(trendChart.labels.length / 6), 1)
                        const shouldShowLabel = index === 0 || index === trendChart.labels.length - 1 || index % labelStep === 0

                        return (
                          <g key={point.key} onMouseEnter={() => setHoveredTrendKey(point.key)} onMouseLeave={() => setHoveredTrendKey('')}>
                            <circle cx={point.x} cy={point.y} r="16" className={styles.liveTrendPointHit} />
                            <circle cx={point.x} cy={point.y} r={hoveredTrendKey === point.key ? '7' : '5'} className={styles.liveTrendPoint} />
                            {shouldShowLabel ? (
                              <text x={point.x} y="204" textAnchor="middle" className={styles.liveTrendAxisLabel}>
                                {point.label}
                              </text>
                            ) : null}
                          </g>
                        )
                      })}
                      {hoveredTrendPoint ? (
                        <g>
                          <rect
                            x={Math.max(12, Math.min(720 - 154, hoveredTrendPoint.x - 77))}
                            y={Math.max(12, hoveredTrendPoint.y - 42)}
                            width="154"
                            height="32"
                            rx="14"
                            className={styles.liveTrendTooltipBox}
                          />
                          <text
                            x={Math.max(12, Math.min(720 - 154, hoveredTrendPoint.x - 77)) + 77}
                            y={Math.max(12, hoveredTrendPoint.y - 42) + 21}
                            textAnchor="middle"
                            className={styles.liveTrendTooltipText}
                          >
                            {formatCurrency(hoveredTrendPoint.value)}
                          </text>
                        </g>
                      ) : null}
                    </svg>
                  )}
                </div>
              </section>
              <section className={`${styles.panelCard} ${styles.rankingPanel}`.trim()}>
                <div className={styles.leaderboardHead}>
                  <h2 className={styles.sectionTitle}>Leaderboard</h2>
                  <div className={styles.totalPill}>
                    <span>Total Nominal</span>
                    <strong>{formatCurrency(totalNominal)}</strong>
                  </div>
                </div>

                {!ranking.length ? (
                  <div className={styles.emptyState}>No host live data found for the selected period.</div>
                ) : (
                  <>
                    <div className={styles.podium} aria-label="Top three hosts">
                      {[1, 0, 2].filter((index) => ranking[index]).map((index) => {
                        const item = ranking[index]
                        return (
                          <button
                            key={item.name}
                            type="button"
                            className={`${styles.podiumHost} ${index === 0 ? styles.podiumWinner : ''}`.trim()}
                            style={{ '--podium-height': `${[136, 104, 80][index]}px` }}
                            onClick={() => setSelectedRanking(item.name)}
                            aria-label={`Rank ${index + 1}: ${item.name}, ${formatCurrency(item.amount)}. View detail`}
                            title={`View ${item.name}'s sessions`}
                          >
                            <strong className={styles.podiumName}>{item.name}</strong>
                            <span className={styles.podiumAmount}>{formatCurrency(item.amount)}</span>
                            <span className={styles.podiumStep}><span>{String(index + 1).padStart(2, '0')}</span></span>
                          </button>
                        )
                      })}
                    </div>
                    <div className={styles.leaderboardList}>
                      {ranking.slice(3).map((item, index) => (
                        <button
                          key={item.name}
                          type="button"
                          className={styles.leaderboardRow}
                          onClick={() => setSelectedRanking(item.name)}
                          title={`View ${item.name}'s sessions`}
                        >
                          <span className={styles.leaderboardRank}>{String(index + 4).padStart(2, '0')}</span>
                          <span className={styles.leaderboardName}>{item.name}</span>
                          <strong className={styles.leaderboardAmount}>{formatCurrency(item.amount)}</strong>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </section>
              </div>
            ) : null}

          {mobile ? (
            <section className={`${styles.formCard} ${styles.mobileFormCard}`.trim()}>
              <div className={styles.mobilePanelHead}>
                <div>
                  <p className={styles.sectionEyebrow}>Arkline</p>
                  <h2 className={styles.title}>{mobileView === 'history' ? 'History' : 'Live Reporting'}</h2>
                </div>
                <div className={styles.mobilePanelActions}>
                  <Link href="/dashboard" className={styles.mobileHomeButton} aria-label="Go to dashboard home">
                    <HomeIcon />
                  </Link>
                  {mobileView === 'history' ? (
                    <Link href="/mobile/arkline/live-reporting" className={styles.mobileHomeButton} aria-label="Open live reporting entry">
                      <AddIcon />
                    </Link>
                  ) : (
                    <Link href="/mobile/arkline/live-reporting/history" className={styles.mobileHomeButton} aria-label="Open live reporting history">
                      <HistoryIcon />
                    </Link>
                  )}
                </div>
              </div>

              {mobileView === 'history' ? (
                <div className={styles.form}>
                  <div className={styles.sectionHead}>
                    <div>
                      <p className={styles.sectionEyebrow}>Recent Entries</p>
                      <h2 className={styles.sectionTitle}>Your History</h2>
                    </div>
                  </div>

                  {!personalSessions.length ? (
                    <div className={styles.emptyState}>No live reporting entry has been submitted from your account yet.</div>
                  ) : (
                    <div className={styles.sessionList}>
                      {personalSessions.map((item) => (
                        <div key={item.id} className={styles.sessionRow}>
                          <div className={styles.sessionMain}>
                            <strong>{item.wearing_product_sku || 'No product'}</strong>
                            <span>
                              {formatDate(item.session_date)} • {item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)}
                            </span>
                            <span>
                              {item.session_type === 'PAIRING'
                                ? `${formatSalesChannel(item.sales_channel)} | Pairing with ${item.partner_display_name_snapshot || '-'} | Partner SKU ${item.partner_wearing_product_sku || '-'}`
                                : `${formatSalesChannel(item.sales_channel)} | Standalone | ${item.host_display_name || '-'}`
                              }
                            </span>
                          </div>
                          <div className={styles.sessionAmount}>{formatCurrency(item.gross_amount)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={mobile ? styles.mobileSegment : styles.formRowThree}>
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
                            partner_profile_query: '',
                            partner_wearing_product_id: '',
                            partner_wearing_product_query: '',
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
                    <label className={styles.label}>Sales Channel *</label>
                    <select
                      className={styles.select}
                      value={draft.sales_channel || 'TIKTOK'}
                      onChange={(event) => setDraft((prev) => ({ ...prev, sales_channel: event.target.value }))}
                    >
                      <option value="TIKTOK">TikTok</option>
                      <option value="SHOPEE">Shopee</option>
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Nominal *</label>
                      <input
                        className={styles.input}
                        inputMode="numeric"
                        value={draft.amount || ''}
                        onChange={(event) => setDraft((prev) => ({ ...prev, amount: formatNumberInput(event.target.value) }))}
                        placeholder="0"
                      />
                  </div>
                </div>

                <div className={`${styles.formRowThree} ${styles.dateTimeRow}`.trim()}>
                  <div className={styles.field}>
                    <label className={styles.label}>Date *</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={draft.session_date || ''}
                      onChange={(event) => setDraft((prev) => ({ ...prev, session_date: event.target.value }))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Start Time *</label>
                    <input
                      className={styles.input}
                      type="time"
                      value={draft.start_time || ''}
                      onChange={(event) => setDraft((prev) => ({ ...prev, start_time: event.target.value }))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End Time *</label>
                    <input
                      className={styles.input}
                      type="time"
                      value={draft.end_time || ''}
                      onChange={(event) => setDraft((prev) => ({ ...prev, end_time: event.target.value }))}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Wearing Product *</label>
                  <input
                    className={styles.input}
                    list="wearing-product-options"
                    value={draft.wearing_product_query || ''}
                    onFocus={() => clearDraftField('wearing_product')}
                    onChange={(event) => updateProductDraft('wearing_product', event.target.value)}
                    placeholder="Type SKU or product name"
                  />
                  <datalist id="wearing-product-options">
                    {products.map((item) => (
                      <option key={item.id} value={getProductOptionLabel(item)} />
                    ))}
                  </datalist>
                </div>

                {draft.session_type === 'PAIRING' ? (
                  <>
                    <div className={styles.field}>
                      <label className={styles.label}>Who is your partner? *</label>
                      <input
                        className={styles.input}
                        list="partner-profile-options"
                        value={draft.partner_profile_query || ''}
                        onFocus={() => updatePartnerDraft('')}
                        onChange={(event) => updatePartnerDraft(event.target.value)}
                        placeholder="Type partner display name"
                      />
                      <datalist id="partner-profile-options">
                        {profiles
                          .filter((item) => item.id !== profile?.id)
                          .map((item) => (
                            <option key={item.id} value={getProfileOptionLabel(item)} />
                          ))}
                      </datalist>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Partner Wearing Product *</label>
                      <input
                        className={styles.input}
                        list="partner-wearing-product-options"
                        value={draft.partner_wearing_product_query || ''}
                        onFocus={() => clearDraftField('partner_wearing_product')}
                        onChange={(event) => updateProductDraft('partner_wearing_product', event.target.value)}
                        placeholder="Type SKU or product name"
                      />
                      <datalist id="partner-wearing-product-options">
                        {products.map((item) => (
                          <option key={item.id} value={getProductOptionLabel(item)} />
                        ))}
                      </datalist>
                    </div>
                  </>
                ) : null}

                <div className={`${styles.buttonRow} ${mobile ? styles.mobileButtonRow : ''}`.trim()}>
                  {mobile ? (
                    <>
                      <button type="button" className={styles.ghostButton} onClick={() => setDraft(createDraft())} disabled={saving}>
                        Clear
                      </button>
                      <button type="submit" className={styles.primaryButton} disabled={saving || !canSubmit}>
                        {saving ? 'Saving...' : 'Add'}
                      </button>
                    </>
                  ) : (
                    <button type="submit" className={styles.primaryButton} disabled={saving || !canSubmit}>
                      {saving ? 'Saving...' : 'Save Session'}
                    </button>
                  )}
                </div>
              </form>
              )}
            </section>
          ) : null}

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
                    <th>Channel</th>
                    <th>Type</th>
                    <th>Host</th>
                    <th>Pairing</th>
                    <th>Wearing Product</th>
                    <th>Partner Product</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCredits
                    .filter((item) => item.host_display_name === selectedRanking)
                    .map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.session_date)}</td>
                        <td>
                          {item.session_start_time?.slice(0, 5)} - {item.session_end_time?.slice(0, 5)}
                        </td>
                        <td>{formatSalesChannel(item.sales_channel)}</td>
                        <td>{item.session_type === 'PAIRING' ? 'Pairing' : 'Standalone'}</td>
                        <td>{item.host_display_name_snapshot || '-'}</td>
                        <td>{item.partner_display_name_snapshot || '-'}</td>
                        <td>{item.wearing_product_sku || '-'}</td>
                        <td>{item.partner_wearing_product_sku || '-'}</td>
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


