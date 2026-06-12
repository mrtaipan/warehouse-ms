'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'

import useArklineAccess from '../../use-arkline-access'
import shellStyles from '../../arkline.module.css'
import styles from '../financial-management.module.css'

const supabase = createClient()

function EntryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.3-5.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4l2.6 1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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
    source: 'PAYMENT',
    category_name: row?.category?.name || row?.supplier_name_snapshot || 'Manual / Unlinked',
    amount: Number(row?.amount || 0),
    paid_at: row?.paid_at || '',
  }
}

function normalizeReimbursementRow(row) {
  return {
    id: row?.id || '',
    source: 'REIMBURSEMENT',
    group: String(row?.group || '').trim(),
    category_name: row?.category?.name || 'Reimbursement',
    amount: Number(row?.total_amount || 0),
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
    wearing_product_sku: row?.wearing_product_sku || '',
    partner_wearing_product_sku: row?.partner_wearing_product_sku || '',
    gross_amount: Number(row?.gross_amount || 0),
    host_display_name_snapshot: row?.host_display_name_snapshot || '-',
    partner_display_name_snapshot: row?.partner_display_name_snapshot || '',
  }
}

function normalizeCredit(row) {
  return {
    id: row?.id || '',
    host_display_name: row?.host_profile?.display_name || row?.host_display_name_snapshot || '-',
    credited_amount: Number(row?.credited_amount || 0),
    session_date: row?.session?.session_date || '',
  }
}

function getDateMatch(dateValue, monthFilter, yearFilter) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  const matchesMonth = monthFilter === 'all' ? true : String(date.getMonth() + 1).padStart(2, '0') === monthFilter
  const matchesYear = yearFilter === 'all' ? true : String(date.getFullYear()) === yearFilter
  return matchesMonth && matchesYear
}

export default function ArklineFinancialReportingPage() {
  const { loading: accessLoading, access } = useArklineAccess()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [yearFilter, setYearFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [trendGroup, setTrendGroup] = useState('MONTH')
  const [hoveredTrendKey, setHoveredTrendKey] = useState('')
  const [paidRequests, setPaidRequests] = useState([])
  const [paidReimbursements, setPaidReimbursements] = useState([])
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
            paid_at
          `
        )
        .eq('status', 'PAID')
        .order('paid_at', { ascending: false }),
      supabase
        .from('hrga_reimbursement_claims')
        .select(
          `
            id,
            "group",
            total_amount,
            paid_at,
            category:dir_reimbursement_categories(name)
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
            wearing_product_sku,
            partner_wearing_product_sku,
            gross_amount,
            host_display_name_snapshot,
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
            host_display_name_snapshot,
            host_profile:dir_user_profiles!arkline_live_reporting_credits_host_profile_id_fkey(display_name),
            session:arkline_live_reporting_sessions!arkline_live_reporting_credits_session_id_fkey(
              session_date
            )
          `
        ),
    ]).then(([paymentResult, reimbursementResult, sessionResult, creditResult]) => {
      if (!active) return

      if (paymentResult.error || reimbursementResult.error || sessionResult.error || creditResult.error) {
        setError(
          paymentResult.error?.message ||
            reimbursementResult.error?.message ||
            sessionResult.error?.message ||
            creditResult.error?.message ||
            'Failed to load financial reporting.'
        )
        setLoading(false)
        return
      }

      setPaidRequests((paymentResult.data || []).map(normalizePaidRow))
      setPaidReimbursements((reimbursementResult.data || []).map(normalizeReimbursementRow))
      setSessions((sessionResult.data || []).map(normalizeSession))
      setCredits((creditResult.data || []).map(normalizeCredit))
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [])

  const allTimelineDates = useMemo(() => {
    return [
      ...paidRequests.map((item) => item.paid_at),
      ...paidReimbursements.map((item) => item.paid_at),
      ...sessions.map((item) => item.session_date),
    ]
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
  }, [paidRequests, paidReimbursements, sessions])

  const monthOptions = useMemo(() => {
    const values = Array.from(new Set(allTimelineDates.map((date) => String(date.getMonth() + 1).padStart(2, '0')))).sort((a, b) => Number(a) - Number(b))

    return values.map((value) => ({
      value,
      label: new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2026, Number(value) - 1, 1)),
    }))
  }, [allTimelineDates])

  const yearOptions = useMemo(() => {
    const values = Array.from(new Set(allTimelineDates.map((date) => String(date.getFullYear())))).sort((a, b) => Number(b) - Number(a))
    return values.map((value) => ({ value, label: value }))
  }, [allTimelineDates])

  const filteredSessions = useMemo(
    () => sessions.filter((item) => getDateMatch(item.session_date, monthFilter, yearFilter)),
    [sessions, monthFilter, yearFilter]
  )

  const filteredCredits = useMemo(
    () => credits.filter((item) => getDateMatch(item.session_date, monthFilter, yearFilter)),
    [credits, monthFilter, yearFilter]
  )

  const filteredPaidRequests = useMemo(
    () => paidRequests.filter((item) => getDateMatch(item.paid_at, monthFilter, yearFilter)),
    [paidRequests, monthFilter, yearFilter]
  )

  const filteredPaidReimbursements = useMemo(
    () =>
      paidReimbursements.filter(
        (item) => String(item.group || '').trim().toUpperCase() === 'ARKLINE' && getDateMatch(item.paid_at, monthFilter, yearFilter)
      ),
    [paidReimbursements, monthFilter, yearFilter]
  )

  const totalLiveNominal = useMemo(
    () => filteredSessions.reduce((sum, item) => sum + Number(item.gross_amount || 0), 0),
    [filteredSessions]
  )

  const totalExpenditure = useMemo(
    () =>
      filteredPaidRequests.reduce((sum, item) => sum + Number(item.amount || 0), 0) +
      filteredPaidReimbursements.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [filteredPaidRequests, filteredPaidReimbursements]
  )

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

  const categoryBreakdown = useMemo(() => {
    const grouped = new Map()

    filteredPaidRequests.forEach((item) => {
      const key = item.category_name || 'Manual / Unlinked'
      const existing = grouped.get(key) || { key, paymentAmount: 0, reimbursementAmount: 0, totalAmount: 0, totalCount: 0 }
      existing.paymentAmount += Number(item.amount || 0)
      existing.totalAmount += Number(item.amount || 0)
      existing.totalCount += 1
      grouped.set(key, existing)
    })

    filteredPaidReimbursements.forEach((item) => {
      const key = item.category_name || 'Reimbursement'
      const existing = grouped.get(key) || { key, paymentAmount: 0, reimbursementAmount: 0, totalAmount: 0, totalCount: 0 }
      existing.reimbursementAmount += Number(item.amount || 0)
      existing.totalAmount += Number(item.amount || 0)
      existing.totalCount += 1
      grouped.set(key, existing)
    })

    const rows = Array.from(grouped.values()).sort((a, b) => b.totalAmount - a.totalAmount)
    const maxAmount = rows[0]?.totalAmount || 0

    return rows.map((item) => ({
      ...item,
      totalWidthPercent: maxAmount > 0 ? Math.max((item.totalAmount / maxAmount) * 100, 8) : 0,
      paymentWidthPercent: item.totalAmount > 0 ? (item.paymentAmount / item.totalAmount) * 100 : 0,
      reimbursementWidthPercent: item.totalAmount > 0 ? (item.reimbursementAmount / item.totalAmount) * 100 : 0,
    }))
  }, [filteredPaidRequests, filteredPaidReimbursements])

  const trendSeries = useMemo(() => {
    const grouped = new Map()
    const rows = [...filteredPaidRequests, ...filteredPaidReimbursements]

    rows.forEach((item) => {
      const date = new Date(item.paid_at)
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
        label = formatMonthLabel(key)
      }

      const existing = grouped.get(key) || { key, label, value: 0 }
      existing.value += Number(item.amount || 0)
      grouped.set(key, existing)
    })

    return Array.from(grouped.values()).sort((a, b) => a.key.localeCompare(b.key))
  }, [filteredPaidRequests, filteredPaidReimbursements, trendGroup])

  const trendChart = useMemo(() => {
    if (!trendSeries.length) return { points: '', labels: [] }

    const width = 640
    const height = 220
    const paddingX = 18
    const paddingY = 18
    const maxValue = Math.max(...trendSeries.map((item) => item.value), 1)
    const stepX = trendSeries.length > 1 ? (width - paddingX * 2) / (trendSeries.length - 1) : 0

    const points = trendSeries.map((item, index) => {
      const x = trendSeries.length === 1 ? width / 2 : paddingX + stepX * index
      const y = height - paddingY - (item.value / maxValue) * (height - paddingY * 2)
      return { ...item, x, y }
    })

    return {
      points: points.map((item) => `${item.x},${item.y}`).join(' '),
      labels: points,
    }
  }, [trendSeries])

  const hoveredTrendPoint = useMemo(
    () => trendChart.labels.find((item) => item.key === hoveredTrendKey) || null,
    [trendChart.labels, hoveredTrendKey]
  )

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <div className={`${styles.header} ${styles.reportingHeader}`.trim()}>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.title}>Financial Reporting</h1>
          </div>

          <div className={styles.reportingFilters}>
            {access.financialManagementLiveReportingView ? (
              <Link href="/mobile/arkline/live-reporting" className={styles.iconActionButton} aria-label="Open live entry">
                <EntryIcon />
              </Link>
            ) : (
              <span />
            )}
            {access.financialManagementLiveReportingView ? (
              <Link href="/mobile/arkline/live-reporting/history" className={`${styles.iconActionButton} ${styles.iconActionButtonPrimary}`.trim()} aria-label="Open history">
                <HistoryIcon />
              </Link>
            ) : (
              <span />
            )}
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
                            <p className={styles.reportingRowTitle}>{item.wearing_product_sku || 'No product'}</p>
                            <p className={styles.reportingRowMeta}>
                              {formatDate(item.session_date)} | {item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)} | {item.session_type === 'PAIRING' ? `Pairing with ${item.partner_display_name_snapshot || '-'}` : 'Standalone'}
                            </p>
                            <p className={styles.reportingRowMeta}>
                              Host {item.host_display_name_snapshot || '-'}{item.session_type === 'PAIRING' ? ` | Partner SKU ${item.partner_wearing_product_sku || '-'}` : ''}
                            </p>
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
                    <h2 className={styles.columnTitle}>Expenditure Trend</h2>
                  </div>

                  <div className={styles.segmentedControl}>
                    {['DAY', 'MONTH', 'YEAR'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`${styles.segmentButton} ${styles.reportingSegmentButton} ${trendGroup === item ? styles.segmentButtonActive : ''}`.trim()}
                        onClick={() => setTrendGroup(item)}
                      >
                        {item === 'DAY' ? 'Day' : item === 'MONTH' ? 'Month' : 'Year'}
                      </button>
                    ))}
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
                          <g key={point.key} onMouseEnter={() => setHoveredTrendKey(point.key)} onMouseLeave={() => setHoveredTrendKey('')}>
                            <circle cx={point.x} cy={point.y} r={hoveredTrendKey === point.key ? '7' : '5'} fill="#2563eb" />
                            <text x={point.x} y="212" textAnchor="middle" className={styles.trendAxisLabel}>
                              {point.label}
                            </text>
                          </g>
                        ))}
                        {hoveredTrendPoint ? (
                          <g className={styles.trendTooltipGroup}>
                            <rect
                              x={Math.max(10, Math.min(640 - 130, hoveredTrendPoint.x - 65))}
                              y={Math.max(10, hoveredTrendPoint.y - 38)}
                              rx="12"
                              ry="12"
                              width="130"
                              height="28"
                              className={styles.trendTooltipBox}
                            />
                            <text
                              x={Math.max(10, Math.min(640 - 130, hoveredTrendPoint.x - 65)) + 65}
                              y={Math.max(10, hoveredTrendPoint.y - 38) + 18}
                              textAnchor="middle"
                              className={styles.trendTooltipText}
                            >
                              {formatCurrency(hoveredTrendPoint.value)}
                            </text>
                          </g>
                        ) : null}
                      </svg>
                    </div>
                    <div className={styles.reportingTable}>
                      {trendChart.labels.map((point) => (
                        <div key={point.key} className={styles.trendTableRow}>
                          <div className={styles.reportingTableCell}>
                            <span className={styles.trendLegendLabel}>{point.label}</span>
                          </div>
                          <div className={styles.reportingTableCellAmount}>
                            <strong className={styles.reportingAmount}>{formatCurrency(point.value)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className={styles.reportingCard}>
                <div className={styles.reportingCardHead}>
                  <div>
                    <p className={styles.columnEyebrow}>Combined Spend</p>
                    <h2 className={styles.columnTitle}>Expense Category</h2>
                  </div>
                </div>

                {!categoryBreakdown.length ? (
                  <div className={styles.emptyColumn}>No category expenditure found for the selected period.</div>
                ) : (
                  <div className={styles.chartList}>
                    {categoryBreakdown.map((item) => (
                      <div key={item.key} className={styles.chartRow}>
                        <div className={styles.chartHead}>
                          <div className={styles.reportingRowCopy}>
                            <p className={styles.reportingRowTitle}>{item.key}</p>
                            <p className={styles.reportingRowMeta}>
                              Payment {formatCurrency(item.paymentAmount)} | Reimbursement {formatCurrency(item.reimbursementAmount)}
                            </p>
                          </div>
                          <strong className={styles.reportingAmount}>{formatCurrency(item.totalAmount)}</strong>
                        </div>
                        <div className={styles.chartTrack} style={{ width: `${item.totalWidthPercent}%` }}>
                          <div className={styles.chartStack}>
                            <div className={`${styles.chartFill} ${styles.chartFillBlue}`.trim()} style={{ width: `${item.paymentWidthPercent}%` }} />
                            <div className={`${styles.chartFill} ${styles.chartFillGreen}`.trim()} style={{ width: `${item.reimbursementWidthPercent}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
