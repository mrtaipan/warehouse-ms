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

function normalizePaidRow(row) {
  return {
    id: row?.id || '',
    source: 'PAYMENT',
    payment_basis: row?.payment_basis || 'NON_PO_BASED',
    po_source_type: row?.po_source_type || '',
    po_number: row?.po_number || '',
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

function getDateMatch(dateValue, monthFilter, yearFilter) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  const matchesMonth = monthFilter === 'all' ? true : String(date.getMonth() + 1).padStart(2, '0') === monthFilter
  const matchesYear = yearFilter === 'all' ? true : String(date.getFullYear()) === yearFilter
  return matchesMonth && matchesYear
}

function buildSmoothTrendPath(points) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const controlOffset = (point.x - previous.x) / 2
    return `${path} C ${previous.x + controlOffset} ${previous.y}, ${point.x - controlOffset} ${point.y}, ${point.x} ${point.y}`
  }, `M ${points[0].x} ${points[0].y}`)
}

function normalizePoNumber(value) {
  return String(value || '').trim().toUpperCase()
}

function toNumber(value) {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function getPaidAmountByPo(rows) {
  return (rows || []).reduce((map, row) => {
    if (row.payment_basis !== 'PO_BASED') return map
    const sourceType = String(row.po_source_type || '').trim().toUpperCase()
    const poNumber = normalizePoNumber(row.po_number)
    if (!sourceType || !poNumber) return map
    const key = `${sourceType}:${poNumber}`
    map.set(key, (map.get(key) || 0) + Number(row.amount || 0))
    return map
  }, new Map())
}

function buildOpenReturnQtyByItem(returnBatchRows) {
  return (returnBatchRows || []).reduce((map, row) => {
    const itemId = String(row.arkline_po_item_id || '').trim()
    if (!itemId) return map
    const sentQty = toNumber(row.sent_qty)
    const returnedQty = toNumber(row.returned_qty)
    const shortQty = toNumber(row.short_qty)
    const openReturnQty = Math.max(sentQty - returnedQty - shortQty, 0)
    if (openReturnQty <= 0) return map
    map.set(itemId, (map.get(itemId) || 0) + openReturnQty)
    return map
  }, new Map())
}

function getGarmentPayableQty(row, openReturnQty) {
  const status = normalizePoNumber(row.status)
  if (status !== 'COMPLETED') {
    return toNumber(row.total_qty)
  }

  return Math.max(toNumber(row.actual_qty) - openReturnQty, 0)
}

function buildAccountPayableRows({ garmentPoRows, garmentItemRows, materialPoRows, materialItemRows, paidRows, returnBatchRows }) {
  const paidByPo = getPaidAmountByPo(paidRows)
  const openReturnQtyByItem = buildOpenReturnQtyByItem(returnBatchRows)

  const garmentTotals = (garmentItemRows || []).reduce((map, row) => {
    const poNumber = normalizePoNumber(row.po_id)
    if (!poNumber) return map
    const itemId = String(row.id || '').trim()
    const openReturnQty = openReturnQtyByItem.get(itemId) || 0
    const qty = getGarmentPayableQty(row, openReturnQty)
    const price = toNumber(row.price ?? row.hpp)
    const existing = map.get(poNumber) || { amount: 0, hasOpenReturn: false }
    map.set(poNumber, {
      amount: existing.amount + qty * price,
      hasOpenReturn: existing.hasOpenReturn || openReturnQty > 0,
    })
    return map
  }, new Map())

  const materialTotals = (materialItemRows || []).reduce((map, row) => {
    const poNumber = normalizePoNumber(row.material_po_number)
    if (!poNumber) return map
    const amount = toNumber(row.amount) || toNumber(row.qty) * toNumber(row.price)
    map.set(poNumber, (map.get(poNumber) || 0) + amount)
    return map
  }, new Map())

  const garmentRows = (garmentPoRows || [])
    .filter((row) => normalizePoNumber(row.status) !== 'CANCELLED' && normalizePoNumber(row.status) !== 'CANCELED')
    .map((row) => {
      const poNumber = normalizePoNumber(row.po_id)
      const total = garmentTotals.get(poNumber) || { amount: 0, hasOpenReturn: false }
      const paidAmount = paidByPo.get(`GARMENT:${poNumber}`) || 0
      return {
        id: `GARMENT-${row.id || poNumber}`,
        amount: Math.max(total.amount - paidAmount, 0),
        hasOpenReturn: total.hasOpenReturn,
        created_at: row.created_at || '',
      }
    })

  const materialRows = (materialPoRows || [])
    .filter((row) => normalizePoNumber(row.status) !== 'CANCELLED' && normalizePoNumber(row.status) !== 'CANCELED')
    .map((row) => {
      const poNumber = normalizePoNumber(row.material_po_number)
      const totalAmount = materialTotals.get(poNumber) || 0
      const paidAmount = paidByPo.get(`MATERIAL:${poNumber}`) || 0
      return {
        id: `MATERIAL-${row.id || poNumber}`,
        amount: Math.max(totalAmount - paidAmount, 0),
        hasOpenReturn: false,
        created_at: row.created_at || '',
      }
    })

  return [...garmentRows, ...materialRows].filter((row) => Number(row.amount || 0) > 0)
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
            payment_basis,
            po_source_type,
            po_number,
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
        .from('arkline_pos')
        .select('id, po_id, status, created_at')
        .not('po_id', 'is', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('arkline_po_items')
        .select('id, po_id, total_qty, actual_qty, status, price, hpp'),
      supabase
        .from('arkline_po_material_ordered')
        .select('id, material_po_number, status, created_at')
        .not('material_po_number', 'is', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('arkline_po_material_ordered_items')
        .select('material_po_number, qty, price, amount'),
      supabase
        .from('arkline_qc_return_batches')
        .select('arkline_po_item_id, sent_qty, returned_qty, short_qty'),
    ]).then(([paymentResult, reimbursementResult, garmentPoResult, garmentItemResult, materialPoResult, materialItemResult, returnBatchResult]) => {
      if (!active) return

      if (
        paymentResult.error ||
        reimbursementResult.error ||
        garmentPoResult.error ||
        garmentItemResult.error ||
        materialPoResult.error ||
        materialItemResult.error ||
        returnBatchResult.error
      ) {
        setError(
          paymentResult.error?.message ||
            reimbursementResult.error?.message ||
            garmentPoResult.error?.message ||
            garmentItemResult.error?.message ||
            materialPoResult.error?.message ||
            materialItemResult.error?.message ||
            returnBatchResult.error?.message ||
            'Failed to load financial reporting.'
        )
        setLoading(false)
        return
      }

      const normalizedPayments = (paymentResult.data || []).map(normalizePaidRow)
      setPaidRequests(normalizedPayments)
      setPaidReimbursements((reimbursementResult.data || []).map(normalizeReimbursementRow))
      setAccountPayables(
        buildAccountPayableRows({
          garmentPoRows: garmentPoResult.data || [],
          garmentItemRows: garmentItemResult.data || [],
          materialPoRows: materialPoResult.data || [],
          materialItemRows: materialItemResult.data || [],
          paidRows: normalizedPayments,
          returnBatchRows: returnBatchResult.data || [],
        })
      )
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [])

  const periodFilter = monthFilter !== 'all' && yearFilter !== 'all' ? `${yearFilter}-${monthFilter}` : ''

  const selectedPeriodLabel = useMemo(() => {
    if (!periodFilter) return 'All periods'
    return formatMonthLabel(periodFilter)
  }, [periodFilter])

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

  const totalExpenditureRecords = filteredPaidRequests.length + filteredPaidReimbursements.length

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
    if (!trendSeries.length) return { areaPath: '', linePath: '', labels: [] }

    const width = 640
    const height = 216
    const paddingX = 46
    const paddingTop = 28
    const paddingBottom = 42
    const maxValue = Math.max(...trendSeries.map((item) => item.value), 1)
    const stepX = trendSeries.length > 1 ? (width - paddingX * 2) / (trendSeries.length - 1) : 0

    const points = trendSeries.map((item, index) => {
      const x = trendSeries.length === 1 ? width / 2 : paddingX + stepX * index
      const y = height - paddingBottom - (item.value / maxValue) * (height - paddingTop - paddingBottom)
      return { ...item, x, y }
    })
    const linePath = buildSmoothTrendPath(points)
    const firstPoint = points[0]
    const lastPoint = points[points.length - 1]
    const areaPath = firstPoint && lastPoint ? `${linePath} L ${lastPoint.x} ${height - paddingBottom} L ${firstPoint.x} ${height - paddingBottom} Z` : ''

    return {
      areaPath,
      linePath,
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
              <div className={styles.filterField}>
                <span>Period</span>
                <input
                  type="month"
                  className={styles.select}
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
                  aria-label="Filter financial reporting period"
                />
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
                <div className={styles.reportingMetricIcon}>A</div>
                <div>
                  <span>Account Payable</span>
                  <strong>{formatCurrency(totalAccountPayable)}</strong>
                  <p>All unpaid PO outstanding • {selectedPeriodLabel}</p>
                </div>
              </div>
            </div>

            <div className={styles.reportingDashboardGrid}>
              <section className={`${styles.trendPanel} ${styles.reportingTrendCard}`.trim()}>
                {!trendChart.labels.length ? (
                  <div className={styles.emptyColumn}>No expenditure trend found for the selected period.</div>
                ) : (
                  <div className={styles.trendVisualCard}>
                    <div className={styles.trendVisualHeader}>
                      <div className={styles.trendVisualMetric}>
                        <strong>{totalExpenditureRecords}</strong>
                        <span>Invoices</span>
                      </div>
                      <div className={styles.trendVisualMetric}>
                        <strong>{formatCurrency(totalExpenditure)}</strong>
                        <span>Total Expenditure</span>
                      </div>
                      <div className={`${styles.segmentedControl} ${styles.trendVisualControl}`.trim()}>
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
                    <div className={styles.trendChartWrap}>
                      <svg viewBox="0 0 640 216" className={styles.trendChart} aria-label="Expenditure trend chart">
                        <defs>
                          <linearGradient id="arkline-expenditure-area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.38" />
                            <stop offset="58%" stopColor="#2563eb" stopOpacity="0.16" />
                            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                          </linearGradient>
                          <filter id="arkline-expenditure-glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        {[48, 84, 120, 156].map((y) => (
                          <line key={y} x1="46" y1={y} x2="594" y2={y} className={styles.trendGridLine} />
                        ))}
                        <path d={trendChart.areaPath} className={styles.trendArea} />
                        <path
                          d={trendChart.linePath}
                          className={styles.trendLine}
                          filter="url(#arkline-expenditure-glow)"
                        />
                        {trendChart.labels.map((point) => (
                          <g key={point.key} onMouseEnter={() => setHoveredTrendKey(point.key)} onMouseLeave={() => setHoveredTrendKey('')}>
                            <circle cx={point.x} cy={point.y} r="16" className={styles.trendPointHit} />
                            <circle cx={point.x} cy={point.y} r={hoveredTrendKey === point.key ? '7' : '5'} className={styles.trendPoint} />
                            <text x={point.x} y="202" textAnchor="middle" className={styles.trendAxisLabel}>
                              {point.label}
                            </text>
                          </g>
                        ))}
                        {hoveredTrendPoint ? (
                          <g className={styles.trendTooltipGroup}>
                            <rect
                              x={Math.max(10, Math.min(640 - 130, hoveredTrendPoint.x - 65))}
                              y={Math.max(10, hoveredTrendPoint.y - 40)}
                              rx="12"
                              ry="12"
                              width="130"
                              height="30"
                              className={styles.trendTooltipBox}
                            />
                            <text
                              x={Math.max(10, Math.min(640 - 130, hoveredTrendPoint.x - 65)) + 65}
                              y={Math.max(10, hoveredTrendPoint.y - 40) + 19}
                              textAnchor="middle"
                              className={styles.trendTooltipText}
                            >
                              {formatCurrency(hoveredTrendPoint.value)}
                            </text>
                          </g>
                        ) : null}
                      </svg>
                    </div>
                  </div>
                )}
              </section>

              <section className={`${styles.reportingCard} ${styles.reportingCategoryCard}`.trim()}>
                <div className={styles.reportingCardHead}>
                  <div>
                    <h2 className={styles.columnTitle}>Expense Category</h2>
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
