'use client'

import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'

import useArklineAccess from '../../use-arkline-access'
import shellStyles from '../../arkline.module.css'
import styles from '../financial-management.module.css'

const supabase = createClient()

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

function normalizePaidRow(row) {
  return {
    id: row?.id || '',
    source: 'PAYMENT',
    category_name: row?.category?.name || row?.supplier_name_snapshot || 'Manual / Unlinked',
    amount: Number(row?.amount || 0),
    paid_at: row?.paid_at || '',
  }
}

function normalizeAccountPayableRow(row) {
  return {
    id: row?.id || '',
    amount: Number(row?.amount || 0),
    created_at: row?.created_at || '',
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
  const [accountPayables, setAccountPayables] = useState([])

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
        .from('arkline_payment')
        .select('id, amount, created_at')
        .eq('payment_basis', 'PO_BASED')
        .neq('status', 'PAID')
        .order('created_at', { ascending: false }),
    ]).then(([paymentResult, reimbursementResult, accountPayableResult]) => {
      if (!active) return

      if (paymentResult.error || reimbursementResult.error || accountPayableResult.error) {
        setError(
          paymentResult.error?.message ||
            reimbursementResult.error?.message ||
            accountPayableResult.error?.message ||
            'Failed to load financial reporting.'
        )
        setLoading(false)
        return
      }

      setPaidRequests((paymentResult.data || []).map(normalizePaidRow))
      setPaidReimbursements((reimbursementResult.data || []).map(normalizeReimbursementRow))
      setAccountPayables((accountPayableResult.data || []).map(normalizeAccountPayableRow))
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
      ...accountPayables.map((item) => item.created_at),
    ]
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
  }, [accountPayables, paidRequests, paidReimbursements])

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

  const selectedPeriodLabel = useMemo(() => {
    const monthLabel = monthFilter === 'all' ? 'All months' : monthOptions.find((item) => item.value === monthFilter)?.label || 'Selected month'
    const yearLabel = yearFilter === 'all' ? 'All years' : yearOptions.find((item) => item.value === yearFilter)?.label || yearFilter
    return `${monthLabel} • ${yearLabel}`
  }, [monthFilter, monthOptions, yearFilter, yearOptions])

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

  const filteredAccountPayables = useMemo(
    () => accountPayables.filter((item) => getDateMatch(item.created_at, monthFilter, yearFilter)),
    [accountPayables, monthFilter, yearFilter]
  )

  const totalExpenditure = useMemo(
    () =>
      filteredPaidRequests.reduce((sum, item) => sum + Number(item.amount || 0), 0) +
      filteredPaidReimbursements.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [filteredPaidRequests, filteredPaidReimbursements]
  )

  const totalAccountPayable = useMemo(
    () => filteredAccountPayables.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [filteredAccountPayables]
  )

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
    const height = 176
    const paddingX = 46
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
      <section className={`${styles.panel} ${styles.reportingPanel}`.trim()}>
        <div className={`${styles.header} ${styles.reportingHeader}`.trim()}>
          <div className={styles.headerCopy}>
            <div className={styles.reportingTitleBlock}>
              <p className={styles.eyebrow}>Arkline</p>
              <h1 className={styles.title}>Financial Reporting</h1>
            </div>

            <div className={styles.reportingFiltersInline}>
              <button
                type="button"
                className={`${styles.iconActionButton} ${styles.iconActionButtonPrimary}`.trim()}
                onClick={() => {
                  setMonthFilter('all')
                  setYearFilter('all')
                  setTrendGroup('MONTH')
                }}
                aria-label="Reset reporting filters"
              >
                <HistoryIcon />
              </button>
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
        </div>

        {error ? <p className={shellStyles.errorText}>{error}</p> : null}

        {loading || accessLoading ? (
          <div className={styles.emptyState}>Loading financial reporting...</div>
        ) : !access.financialReporting ? (
          <div className={styles.emptyState}>Your account does not have Arkline financial reporting access yet.</div>
        ) : (
          <>
            <div className={styles.reportingSummaryGrid}>
              <div className={styles.reportingMetricCard}>
                <div className={styles.reportingMetricIcon}>E</div>
                <div>
                  <span>Total Expenditure</span>
                  <strong>{formatCurrency(totalExpenditure)}</strong>
                  <p>{selectedPeriodLabel}</p>
                </div>
              </div>
              <div className={styles.reportingMetricCard}>
                <div className={styles.reportingMetricIcon}>A</div>
                <div>
                  <span>Account Payable</span>
                  <strong>{formatCurrency(totalAccountPayable)}</strong>
                  <p>Unpaid PO-based requests • {selectedPeriodLabel}</p>
                </div>
              </div>
            </div>

            <div className={styles.reportingDashboardGrid}>
              <section className={`${styles.reportingCard} ${styles.trendPanel} ${styles.reportingTrendCard}`.trim()}>
                <div className={styles.reportingCardHead}>
                  <div>
                    <p className={styles.columnEyebrow}>Trend</p>
                    <h2 className={styles.columnTitle}>Expenditure Trend</h2>
                    <p className={styles.reportingCardNote}>Paid payment and reimbursement totals by the selected grouping.</p>
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
                      <svg viewBox="0 0 640 176" className={styles.trendChart} aria-hidden="true">
                        {[32, 68, 104, 140].map((y) => (
                          <line key={y} x1="46" y1={y} x2="594" y2={y} className={styles.trendGridLine} />
                        ))}
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
                            <circle cx={point.x} cy={point.y} r="16" className={styles.trendPointHit} />
                            <circle cx={point.x} cy={point.y} r={hoveredTrendKey === point.key ? '7' : '5'} fill="#2563eb" />
                            <text x={point.x} y="166" textAnchor="middle" className={styles.trendAxisLabel}>
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
                    <div className={styles.reportingMiniTable}>
                      <div className={styles.reportingMiniTableHead}>
                        <span>Date</span>
                        <span>Expense</span>
                      </div>
                      {trendChart.labels.map((point) => (
                        <div key={point.key} className={styles.reportingMiniTableRow}>
                          <span className={styles.reportingMiniTableLabel}>{point.label}</span>
                          <strong className={styles.reportingMiniTableAmount}>{formatCurrency(point.value)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className={`${styles.reportingCard} ${styles.reportingCategoryCard}`.trim()}>
                <div className={styles.reportingCardHead}>
                  <div>
                    <p className={styles.columnEyebrow}>Payment + Reimbursement</p>
                    <h2 className={styles.columnTitle}>Expense Category</h2>
                    <p className={styles.reportingCardNote}>Combined paid spend across both sources for the selected period.</p>
                  </div>
                </div>

                {!categoryBreakdown.length ? (
                  <div className={styles.emptyColumn}>No category expenditure found for the selected period.</div>
                ) : (
                  <div className={styles.chartList}>
                    <div className={styles.categoryLegend}>
                      <span className={styles.categoryLegendItem}>
                        <span className={`${styles.categoryLegendSwatch} ${styles.categoryLegendSwatchPayment}`.trim()} />
                        Payment
                      </span>
                      <span className={styles.categoryLegendItem}>
                        <span className={`${styles.categoryLegendSwatch} ${styles.categoryLegendSwatchReimbursement}`.trim()} />
                        Reimbursement
                      </span>
                    </div>
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
                        <div className={styles.chartTrack}>
                          <div className={styles.chartMeter} style={{ width: `${item.totalWidthPercent}%` }}>
                            <div className={styles.chartStack}>
                              <div className={`${styles.chartFill} ${styles.chartFillBlue}`.trim()} style={{ width: `${item.paymentWidthPercent}%` }} />
                              <div className={`${styles.chartFill} ${styles.chartFillGreen}`.trim()} style={{ width: `${item.reimbursementWidthPercent}%` }} />
                            </div>
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
