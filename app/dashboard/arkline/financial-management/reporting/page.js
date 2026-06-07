'use client'

import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'

import useArklineAccess from '../../use-arkline-access'
import shellStyles from '../../arkline.module.css'
import styles from '../financial-management.module.css'

const supabase = createClient()

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatMonthLabel(value) {
  if (!value) return '-'
  const [year, month] = String(value).split('-')
  if (!year || !month) return value
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1, 1))
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

function normalizePaidRow(row) {
  return {
    id: row?.id || '',
    supplier_name_snapshot: row?.supplier_name_snapshot || '',
    category_name: row?.category?.name || '',
    amount: Number(row?.amount || 0),
    account_name: row?.account_name || '',
    bank_name: row?.bank_name || '',
    account_number: row?.account_number || '',
    paid_at: row?.paid_at || '',
  }
}

function normalizeSession(row) {
  return {
    id: row?.id || '',
    session_date: row?.session_date || '',
    start_time: row?.start_time || '',
    end_time: row?.end_time || '',
    session_type: row?.session_type || 'STANDALONE',
    hero_product_name_snapshot: row?.hero_product_name_snapshot || '',
    gross_amount: Number(row?.gross_amount || 0),
    submitted_by_display_name_snapshot: row?.submitted_by_display_name_snapshot || '-',
    partner_display_name_snapshot: row?.partner_display_name_snapshot || '',
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

export default function ArklineFinancialReportingPage() {
  const { loading: accessLoading, access } = useArklineAccess()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [yearFilter, setYearFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [paidRequests, setPaidRequests] = useState([])
  const [sessions, setSessions] = useState([])
  const [credits, setCredits] = useState([])

  useEffect(() => {
    let active = true

    Promise.all([
      supabase
        .from('arkline_payment')
        .select(
        `
          id,
          supplier_name_snapshot,
          category:dir_reimbursement_categories(name),
          amount,
          account_name,
          bank_name,
          account_number,
          paid_at
        `
        )
        .eq('status', 'PAID')
        .order('paid_at', { ascending: false }),
      supabase
        .from('arkline_live_reporting_sessions')
        .select(
          `
            id,
            session_date,
            start_time,
            end_time,
            session_type,
            hero_product_name_snapshot,
            gross_amount,
            submitted_by_display_name_snapshot,
            partner_display_name_snapshot
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
    ]).then(([paymentResult, sessionResult, creditResult]) => {
        if (!active) return

        if (paymentResult.error || sessionResult.error || creditResult.error) {
          setError(paymentResult.error?.message || sessionResult.error?.message || creditResult.error?.message || 'Failed to load financial reporting.')
          setLoading(false)
          return
        }

        setPaidRequests((paymentResult.data || []).map(normalizePaidRow))
        setSessions((sessionResult.data || []).map(normalizeSession))
        setCredits((creditResult.data || []).map(normalizeCredit))
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

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

  const totalLiveNominal = useMemo(
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

  const monthOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        paidRequests
          .map((item) => {
            if (!item.paid_at) return ''
            const date = new Date(item.paid_at)
            if (Number.isNaN(date.getTime())) return ''
            return String(date.getMonth() + 1).padStart(2, '0')
          })
          .filter(Boolean)
      )
    ).sort((a, b) => Number(a) - Number(b))

    return values.map((value) => ({
      value,
      label: new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2026, Number(value) - 1, 1)),
    }))
  }, [paidRequests])

  const yearOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        paidRequests
          .map((item) => {
            if (!item.paid_at) return ''
            const date = new Date(item.paid_at)
            if (Number.isNaN(date.getTime())) return ''
            return String(date.getFullYear())
          })
          .filter(Boolean)
      )
    ).sort((a, b) => Number(b) - Number(a))

    return values.map((value) => ({ value, label: value }))
  }, [paidRequests])

  const filteredPaidRequests = useMemo(() => {
    return paidRequests.filter((item) => {
      if (!item.paid_at) return false
      const date = new Date(item.paid_at)
      if (Number.isNaN(date.getTime())) return false
      const matchesMonth = monthFilter === 'all' ? true : String(date.getMonth() + 1).padStart(2, '0') === monthFilter
      const matchesYear = yearFilter === 'all' ? true : String(date.getFullYear()) === yearFilter
      return matchesMonth && matchesYear
    })
  }, [monthFilter, paidRequests, yearFilter])

  const totalExpenditure = useMemo(
    () => filteredPaidRequests.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [filteredPaidRequests]
  )

  const payeeBreakdown = useMemo(() => {
    const grouped = Array.from(
      filteredPaidRequests.reduce((map, item) => {
        const key = item.account_name || 'Unknown account'
        const existing = map.get(key) || { key, totalAmount: 0, totalPayments: 0, banks: new Set() }
        existing.totalAmount += Number(item.amount || 0)
        existing.totalPayments += 1
        if (item.bank_name || item.account_number) {
          existing.banks.add([item.bank_name || 'Bank', item.account_number || '-'].join(' - '))
        }
        map.set(key, existing)
        return map
      }, new Map()).values()
    )
      .map((item) => ({ ...item, bankLabels: Array.from(item.banks) }))
      .sort((a, b) => b.totalAmount - a.totalAmount)

    const maxAmount = grouped[0]?.totalAmount || 0
    return grouped.map((item) => ({
      ...item,
      widthPercent: maxAmount > 0 ? Math.max((item.totalAmount / maxAmount) * 100, 8) : 0,
    }))
  }, [filteredPaidRequests])

  const categoryBreakdown = useMemo(() => {
    const grouped = Array.from(
      filteredPaidRequests.reduce((map, item) => {
        const key = item.category_name || item.supplier_name_snapshot || 'Manual / Unlinked'
        const existing = map.get(key) || { key, totalAmount: 0, totalPayments: 0 }
        existing.totalAmount += Number(item.amount || 0)
        existing.totalPayments += 1
        map.set(key, existing)
        return map
      }, new Map()).values()
    ).sort((a, b) => b.totalAmount - a.totalAmount)

    const maxAmount = grouped[0]?.totalAmount || 0
    return grouped.map((item) => ({
      ...item,
      widthPercent: maxAmount > 0 ? Math.max((item.totalAmount / maxAmount) * 100, 8) : 0,
    }))
  }, [filteredPaidRequests])

  const trendSeries = useMemo(() => {
    const grouped = Array.from(
      filteredPaidRequests.reduce((map, item) => {
        if (!item.paid_at) return map
        const date = new Date(item.paid_at)
        if (Number.isNaN(date.getTime())) return map
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        map.set(key, (map.get(key) || 0) + Number(item.amount || 0))
        return map
      }, new Map())
    )
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({
        key,
        label: formatMonthLabel(key),
        value,
      }))

    return grouped
  }, [filteredPaidRequests])

  const trendChart = useMemo(() => {
    if (!trendSeries.length) return { points: '', labels: [] }

    const width = 640
    const height = 220
    const paddingX = 18
    const paddingY = 18
    const maxValue = Math.max(...trendSeries.map((item) => item.value), 1)
    const stepX = trendSeries.length > 1 ? (width - paddingX * 2) / (trendSeries.length - 1) : 0

    const points = trendSeries
      .map((item, index) => {
        const x = trendSeries.length === 1 ? width / 2 : paddingX + stepX * index
        const y = height - paddingY - (item.value / maxValue) * (height - paddingY * 2)
        return { ...item, x, y }
      })

    return {
      points: points.map((item) => `${item.x},${item.y}`).join(' '),
      labels: points,
    }
  }, [trendSeries])

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <div className={`${styles.header} ${styles.reportingHeader}`.trim()}>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.title}>Financial Reporting</h1>
          </div>

          <div className={styles.reportingFilters}>
            <a href="/mobile/arkline/live-reporting" className={styles.secondaryButton}>
              Live Entry
            </a>
            <a href="/mobile/arkline/live-reporting/history" className={styles.primaryButton}>
              History
            </a>
            <div className={styles.filterField}>
              <span>Month</span>
              <select className={styles.select} value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                <option value="all">All months</option>
                {monthOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterField}>
              <span>Year</span>
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
        </div>

        {error ? <p className={shellStyles.errorText}>{error}</p> : null}

        {loading || accessLoading ? (
          <div className={styles.emptyState}>Loading financial reporting...</div>
        ) : !access.financialReporting ? (
          <div className={styles.emptyState}>Your account does not have Arkline financial reporting access yet.</div>
        ) : (
          <>
            <div className={styles.summaryRow}>
              <div className={styles.summaryCard}>
                <span>Live GMV</span>
                <strong>{formatCurrency(totalLiveNominal)}</strong>
              </div>
              <div className={styles.summaryCard}>
                <span>Total Expenditure</span>
                <strong>{formatCurrency(totalExpenditure)}</strong>
              </div>
            </div>

            <div className={styles.reportingSplit}>
              <section className={styles.reportingCard}>
                <div className={styles.reportingCardHead}>
                  <div>
                    <p className={styles.columnEyebrow}>Live Dashboard</p>
                    <h2 className={styles.columnTitle}>User Total</h2>
                  </div>
                </div>

                {!ranking.length ? (
                  <div className={styles.emptyColumn}>No live reporting data found for the selected period.</div>
                ) : (
                  <div className={styles.chartList}>
                    {ranking.map((item, index) => (
                      <div key={item.name} className={styles.chartRow}>
                        <div className={styles.chartHead}>
                          <div className={styles.reportingRowCopy}>
                            <p className={styles.reportingRowTitle}>
                              {index + 1}. {item.name}
                            </p>
                            <p className={styles.reportingRowMeta}>Total user credit for the filtered period.</p>
                          </div>
                          <strong className={styles.reportingAmount}>{formatCurrency(item.amount)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.reportingCard}>
                <div className={styles.reportingCardHead}>
                  <div>
                    <p className={styles.columnEyebrow}>Recent Live Session</p>
                    <h2 className={styles.columnTitle}>Latest Entry</h2>
                  </div>
                </div>

                {!filteredSessions.length ? (
                  <div className={styles.emptyColumn}>No live session found for the selected period.</div>
                ) : (
                  <div className={styles.chartList}>
                    {filteredSessions.slice(0, 5).map((item) => (
                      <div key={item.id} className={styles.chartRow}>
                        <div className={styles.chartHead}>
                          <div className={styles.reportingRowCopy}>
                            <p className={styles.reportingRowTitle}>{item.hero_product_name_snapshot || 'No product'}</p>
                            <p className={styles.reportingRowMeta}>
                              {formatDate(item.session_date)} | {item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)} | {item.session_type === 'PAIRING' ? `Pairing with ${item.partner_display_name_snapshot || '-'}` : 'Standalone'}
                            </p>
                            <p className={styles.reportingRowMeta}>Submitted by {item.submitted_by_display_name_snapshot || '-'}</p>
                          </div>
                          <strong className={styles.reportingAmount}>{formatCurrency(item.gross_amount)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className={styles.reportingSplit}>
              <section className={`${styles.reportingCard} ${styles.trendPanel}`.trim()}>
                <div className={styles.reportingCardHead}>
                  <div>
                    <p className={styles.columnEyebrow}>Trend</p>
                    <h2 className={styles.columnTitle}>Expenditure Over Time</h2>
                  </div>
                </div>

                {!trendChart.labels.length ? (
                  <div className={styles.emptyColumn}>No expenditure trend found for the selected period.</div>
                ) : (
                  <div className={styles.trendCard}>
                    <div className={styles.trendChartWrap}>
                      <svg viewBox="0 0 640 220" className={styles.trendChart} aria-hidden="true">
                        <polyline
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={trendChart.points}
                        />
                        {trendChart.labels.map((point) => (
                          <g key={point.key}>
                            <circle cx={point.x} cy={point.y} r="5" fill="#2563eb" />
                          </g>
                        ))}
                      </svg>
                    </div>
                    <div className={styles.trendLegend}>
                      {trendChart.labels.map((point) => (
                        <div key={point.key} className={styles.trendLegendItem}>
                          <span className={styles.trendLegendLabel}>{point.label}</span>
                          <strong className={styles.reportingAmount}>{formatCurrency(point.value)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <div className={styles.reportingStack}>
                <section className={styles.reportingCard}>
                  <div className={styles.reportingCardHead}>
                    <div>
                      <p className={styles.columnEyebrow}>Breakdown</p>
                      <h2 className={styles.columnTitle}>By Payee</h2>
                    </div>
                  </div>

                  {!payeeBreakdown.length ? (
                    <div className={styles.emptyColumn}>No paid submissions for the selected period.</div>
                  ) : (
                    <div className={styles.chartList}>
                      {payeeBreakdown.map((item) => (
                        <div key={item.key} className={styles.chartRow}>
                          <div className={styles.chartHead}>
                            <div className={styles.reportingRowCopy}>
                              <p className={styles.reportingRowTitle}>{item.key}</p>
                              <p className={styles.reportingRowMeta}>
                                {item.totalPayments} payment{item.totalPayments > 1 ? 's' : ''} | {item.bankLabels.join(' | ') || 'No account info'}
                              </p>
                            </div>
                            <strong className={styles.reportingAmount}>{formatCurrency(item.totalAmount)}</strong>
                          </div>
                          <div className={styles.chartTrack}>
                            <div className={`${styles.chartFill} ${styles.chartFillBlue}`.trim()} style={{ width: `${item.widthPercent}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className={styles.reportingCard}>
                  <div className={styles.reportingCardHead}>
                    <div>
                      <p className={styles.columnEyebrow}>Category Split</p>
                      <h2 className={styles.columnTitle}>By Category / Supplier Source</h2>
                    </div>
                  </div>

                  {!categoryBreakdown.length ? (
                    <div className={styles.emptyColumn}>No expenditure found for the selected period.</div>
                  ) : (
                    <div className={styles.chartList}>
                      {categoryBreakdown.map((item) => (
                        <div key={item.key} className={styles.chartRow}>
                          <div className={styles.chartHead}>
                            <div className={styles.reportingRowCopy}>
                              <p className={styles.reportingRowTitle}>{item.key}</p>
                              <p className={styles.reportingRowMeta}>{item.totalPayments} payment record{item.totalPayments > 1 ? 's' : ''}</p>
                            </div>
                            <strong className={styles.reportingAmount}>{formatCurrency(item.totalAmount)}</strong>
                          </div>
                          <div className={styles.chartTrack}>
                            <div className={`${styles.chartFill} ${styles.chartFillGreen}`.trim()} style={{ width: `${item.widthPercent}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
