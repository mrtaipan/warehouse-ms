'use client'

import Link from 'next/link'
import { Chart as ChartJS, registerables } from 'chart.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { deliverySupabase } from '@/lib/delivery-supabase'
import { EmptyState, Modal, StatusMessage } from './delivery-report-client'
import { buildOrderTrend } from './delivery-summary-chart.mjs'
import {
  GROUPS,
  formatDate,
  jakartaEnd,
  jakartaStart,
  pct,
  safeNumber,
  todayIso,
} from './delivery-report-helpers'
import styles from './delivery-report.module.css'

ChartJS.register(...registerables)

const PROGRESS_COLORS = {
  danger: '#dc2626',
  warning: '#f59e0b',
  success: '#16a34a',
}
const SUMMARY_PAGE_SIZE = 1000
const SUMMARY_ORDER_COLUMNS = 'id,delivery_date,delivery_category,group_order,courier,quantity'
const SUMMARY_BARCODE_COLUMNS = 'barcode,timestamp_delivery,timestamp_packing,group_order,courier,is_defined,is_packed,is_delivered,packing_team'
const SERIES_COLORS = { TOTAL: '#2563eb', ARKLINE: '#2563eb', MOB: '#0f766e', OI: '#d97706' }
const TOTAL_SERIES = ['TOTAL']

function getProgressColor(percentage) {
  if (percentage > 80) return PROGRESS_COLORS.success
  if (percentage >= 50) return PROGRESS_COLORS.warning
  return PROGRESS_COLORS.danger
}

function formatCount(value) {
  return safeNumber(value).toLocaleString('id-ID')
}

function endOfMonth(month) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10)
}

function chartRangeDate(value, period, edge) {
  if (period === 'MONTH') return edge === 'from' ? `${value}-01` : endOfMonth(value)
  if (period === 'YEAR') return edge === 'from' ? `${value}-01-01` : `${value}-12-31`
  return value
}

function normalizeBarcode(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeLockedGroup(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return GROUPS.includes(normalized) ? normalized : ''
}

function hasPackingScan(row) {
  return Boolean(row?.is_packed || row?.timestamp_packing)
}

function hasDeliveryScan(row) {
  return Boolean(row?.is_delivered || row?.timestamp_delivery)
}

async function fetchAllSummaryRows(createQuery) {
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await createQuery().range(from, from + SUMMARY_PAGE_SIZE - 1)
    if (error) return { data: rows, error }

    const page = data || []
    rows.push(...page)

    if (page.length < SUMMARY_PAGE_SIZE) break
    from += SUMMARY_PAGE_SIZE
  }

  return { data: rows, error: null }
}

function CourierComposition({ values }) {
  const total = values.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className={styles.courierCompositionList} aria-label="Courier composition list">
      {values.map((item, index) => {
        const percentage = total ? Math.round((safeNumber(item.value) / total) * 100) : 0

        return (
          <div className={styles.courierCompositionRow} key={item.label}>
            <div className={styles.courierCompositionMeta}>
              <strong>{item.label}</strong>
              <span>{formatCount(item.value)} ({percentage}%)</span>
            </div>
            <div className={styles.courierCompositionTrack}>
              <span
                style={{
                  width: `${total ? (safeNumber(item.value) / total) * 100 : 0}%`,
                  backgroundColor: index === 0 ? '#2563eb' : '#94a3b8',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LineChart({ values, series, selectedSeries, onSelectSeries }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    chartRef.current?.destroy()
    chartRef.current = new ChartJS(canvas, {
      type: 'line',
      data: {
        labels: values.map((item) => item.label),
        datasets: series.map((name) => ({
          label: name,
          data: values.map((item) => safeNumber(item[name])),
          backgroundColor(context) {
            const { chart } = context
            const area = chart.chartArea
            const muted = selectedSeries && selectedSeries !== name
            if (!area) return `${SERIES_COLORS[name]}${muted ? '08' : '22'}`
            const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
            gradient.addColorStop(0, `${SERIES_COLORS[name]}${muted ? '0d' : '40'}`)
            gradient.addColorStop(1, `${SERIES_COLORS[name]}00`)
            return gradient
          },
          borderColor: selectedSeries && selectedSeries !== name ? '#cbd5e1' : SERIES_COLORS[name],
          borderWidth: selectedSeries && selectedSeries !== name ? 1.5 : 3,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: selectedSeries && selectedSeries !== name ? '#cbd5e1' : SERIES_COLORS[name],
          pointRadius: values.length > 60 ? 0 : (selectedSeries && selectedSeries !== name ? 2 : 4),
          pointBorderWidth: 2.5,
          pointHoverRadius: 7,
          pointHoverBorderWidth: 3,
          pointHitRadius: 14,
          tension: .36,
          cubicInterpolationMode: 'monotone',
          fill: 'origin',
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: true },
        layout: { padding: { top: 20, right: 20, bottom: 4 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external({ chart, tooltip }) {
              const point = tooltip.dataPoints?.[0]
              if (!point || tooltip.opacity === 0) {
                setHover(null)
                return
              }
              const bounds = chart.canvas.getBoundingClientRect()
              const anchorX = bounds.left + tooltip.caretX * (bounds.width / chart.width)
              const anchorY = bounds.top + tooltip.caretY * (bounds.height / chart.height)
              const width = 230
              const height = 70
              setHover({
                title: `${point.dataset.label === 'TOTAL' ? 'TOTAL' : point.dataset.label} · ${point.label}`,
                detail: `${formatCount(point.parsed.y)} order(s)`,
                left: anchorX + width + 24 <= window.innerWidth ? anchorX + 12 : Math.max(12, anchorX - width - 12),
                top: Math.max(12, Math.min(anchorY - height / 2, window.innerHeight - height - 12)),
              })
            },
          },
        },
        scales: {
          x: {
            border: { display: false },
            grid: { display: false },
            ticks: { color: '#64748b', maxRotation: 0, maxTicksLimit: 10, font: { size: 12 } },
          },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: '#edf0f5' },
            title: { display: true, text: 'Order quantity', color: '#64748b' },
            ticks: { color: '#64748b', precision: 0, maxTicksLimit: 6, font: { size: 12 }, callback: (value) => new Intl.NumberFormat('en', { notation: 'compact' }).format(value) },
          },
        },
        onClick(_event, elements) {
          const index = elements?.[0]?.datasetIndex
          if (Number.isInteger(index)) onSelectSeries(series[index])
        },
      },
    })

    return () => chartRef.current?.destroy()
  }, [onSelectSeries, selectedSeries, series, values])

  return (
    <div className={styles.barChart}>
      <canvas ref={canvasRef} role="img" aria-label={`Order quantity trend by ${series.join(', ')}. Total ${formatCount(values.reduce((sum, item) => sum + item.TOTAL, 0))} orders.`} />
      {hover && typeof document !== 'undefined' ? createPortal(<div className={styles.returnChartTooltip} style={{ left: hover.left, top: hover.top }} role="tooltip"><strong>{hover.title}</strong><span>{hover.detail}</span></div>, document.body) : null}
    </div>
  )
}

export default function DeliverySummary({ lockedGroup: lockedGroupProp = '' }) {
  const today = useMemo(() => todayIso(), [])
  const lockedGroup = useMemo(() => normalizeLockedGroup(lockedGroupProp), [lockedGroupProp])
  const visibleGroups = useMemo(() => (lockedGroup ? [lockedGroup] : GROUPS), [lockedGroup])
  const [filters, setFilters] = useState({ from: today, to: today, group: lockedGroup || 'ALL', category: 'ALL' })
  const applied = filters
  const [chartPeriod, setChartPeriod] = useState('DAY')
  const yearOptions = useMemo(() => Array.from({ length: Math.max(12, Number(today.slice(0, 4)) - 2018 + 3) }, (_, index) => String(2019 + index)), [today])
  const changeChartPeriod = (period) => {
    setChartPeriod(period)
    setFilters((current) => ({
      ...current,
      from: chartRangeDate(current.from.slice(0, period === 'YEAR' ? 4 : period === 'MONTH' ? 7 : 10), period, 'from'),
      to: chartRangeDate(current.to.slice(0, period === 'YEAR' ? 4 : period === 'MONTH' ? 7 : 10), period, 'to'),
    }))
  }
  const changeChartRange = (edge, value) => {
    if (!value) return
    setFilters((current) => {
      const next = { ...current, [edge]: chartRangeDate(value, chartPeriod, edge) }
      if (next.from > next.to) next[edge === 'from' ? 'to' : 'from'] = chartRangeDate(value, chartPeriod, edge === 'from' ? 'to' : 'from')
      return next
    })
  }
  const [chartView, setChartView] = useState('TOTAL')
  const [highlightedSeries, setHighlightedSeries] = useState('')
  const selectChartSeries = useCallback((name) => {
    setHighlightedSeries((current) => current === name ? '' : name)
  }, [])
  const [orders, setOrders] = useState([])
  const [packingRows, setPackingRows] = useState([])
  const [deliveryRows, setDeliveryRows] = useState([])
  const [scanPhase, setScanPhase] = useState('DELIVERY')
  const [matrixMode, setMatrixMode] = useState('SHORTAGE')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [issueModal, setIssueModal] = useState(null)

  const loadData = useCallback(async (signal) => {
    setLoading(true)
    setStatus(null)
    setOrders([])
    setPackingRows([])
    setDeliveryRows([])
    if (!applied.from || !applied.to || applied.from > applied.to) {
      setStatus({ type: 'error', message: 'Choose a valid date range. Date From must be on or before Date To.' })
      setLoading(false)
      return
    }
    const createOrderQuery = () => {
      let query = deliverySupabase
        .from('delivery_order')
        .select(SUMMARY_ORDER_COLUMNS)
        .gte('delivery_date', applied.from)
        .lte('delivery_date', applied.to)
        .order('delivery_date', { ascending: true })
        .order('id', { ascending: true })
        .abortSignal(signal)

      if (applied.group !== 'ALL') query = query.eq('group_order', applied.group)
      return query
    }

    const createPackingQuery = () => {
      let query = deliverySupabase
        .from('delivery_barcode')
        .select(SUMMARY_BARCODE_COLUMNS)
        .gte('timestamp_packing', jakartaStart(applied.from))
        .lte('timestamp_packing', jakartaEnd(applied.to))
        .order('barcode', { ascending: true })
        .abortSignal(signal)

      if (applied.group !== 'ALL') query = query.eq('group_order', applied.group)
      return query
    }

    const createDeliveryQuery = () => {
      let query = deliverySupabase
        .from('delivery_barcode')
        .select(SUMMARY_BARCODE_COLUMNS)
        .gte('timestamp_delivery', jakartaStart(applied.from))
        .lte('timestamp_delivery', jakartaEnd(applied.to))
        .order('barcode', { ascending: true })
        .abortSignal(signal)

      if (applied.group !== 'ALL') query = query.eq('group_order', applied.group)
      return query
    }

    try {
      const [ordersResult, packingResult, deliveryResult] = await Promise.all([
        fetchAllSummaryRows(createOrderQuery),
        fetchAllSummaryRows(createPackingQuery),
        fetchAllSummaryRows(createDeliveryQuery),
      ])
      if (signal.aborted) return

      const error = ordersResult.error || packingResult.error || deliveryResult.error
      if (error) {
        setStatus({ type: 'error', message: `Failed to load summary: ${error.message}` })
      } else {
        setOrders(ordersResult.data || [])
        setPackingRows(packingResult.data || [])
        setDeliveryRows(deliveryResult.data || [])
      }
      setLoading(false)
    } catch (error) {
      if (signal.aborted) return
      setStatus({ type: 'error', message: `Failed to load summary: ${error.message}` })
      setLoading(false)
    }
  }, [applied.from, applied.to, applied.group])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => loadData(controller.signal), 200)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [loadData])

  const categoryFilteredOrders = useMemo(
    () => orders.filter((row) => applied.category === 'ALL' || row.delivery_category === applied.category),
    [applied.category, orders]
  )

  const categoryOrderKeys = useMemo(() => {
    if (applied.category === 'ALL') return null
    return new Set(
      categoryFilteredOrders.map((row) => `${row.group_order || ''}|||${row.courier || 'UNDEFINED'}`)
    )
  }, [applied.category, categoryFilteredOrders])

  const categoryFilteredDeliveryRows = useMemo(() => {
    if (!categoryOrderKeys) return deliveryRows
    return deliveryRows.filter((row) => categoryOrderKeys.has(`${row.group_order || ''}|||${row.courier || 'UNDEFINED'}`))
  }, [categoryOrderKeys, deliveryRows])

  const categoryFilteredPackingRows = useMemo(() => {
    if (!categoryOrderKeys) return packingRows
    return packingRows.filter((row) => categoryOrderKeys.has(`${row.group_order || ''}|||${row.courier || 'UNDEFINED'}`))
  }, [categoryOrderKeys, packingRows])

  const targetByGroup = useMemo(
    () =>
      Object.fromEntries(
        visibleGroups.map((group) => [
          group,
          categoryFilteredOrders.filter((row) => row.group_order === group).reduce((sum, row) => sum + safeNumber(row.quantity), 0),
        ])
      ),
    [categoryFilteredOrders, visibleGroups]
  )
  const totalTarget = Object.values(targetByGroup).reduce((sum, value) => sum + value, 0)
  const totalScanned = scanPhase === 'PACKING' ? categoryFilteredPackingRows.length : categoryFilteredDeliveryRows.length
  const totalProgress = pct(totalScanned, totalTarget)

  const deliveryByGroup = useMemo(
    () => Object.fromEntries(visibleGroups.map((group) => [group, categoryFilteredDeliveryRows.filter((row) => row.group_order === group).length])),
    [categoryFilteredDeliveryRows, visibleGroups]
  )

  const couriers = useMemo(() => {
    const names = [...new Set(categoryFilteredOrders.map((row) => row.courier || 'UNDEFINED'))].filter((name) => name !== 'UNDEFINED')
    return names
      .map((courier) => ({
        label: courier,
        value: categoryFilteredOrders.filter((row) => (row.courier || 'UNDEFINED') === courier).reduce((sum, row) => sum + safeNumber(row.quantity), 0),
      }))
      .sort((a, b) => b.value - a.value)
  }, [categoryFilteredOrders])

  const matrixRows = useMemo(() => {
    const names = [...new Set([...categoryFilteredOrders.map((row) => row.courier || 'UNDEFINED'), ...categoryFilteredDeliveryRows.map((row) => row.courier || 'UNDEFINED')])].filter((name) => name !== 'UNDEFINED')
    return names
      .map((courier) => {
        const row = { courier }
        visibleGroups.forEach((group) => {
          const target = categoryFilteredOrders
            .filter((item) => item.group_order === group && (item.courier || 'UNDEFINED') === courier)
            .reduce((sum, item) => sum + safeNumber(item.quantity), 0)
          const delivered = categoryFilteredDeliveryRows.filter(
            (item) => item.group_order === group && (item.courier || 'UNDEFINED') === courier
          ).length
          row[group] = matrixMode === 'SHORTAGE' ? target - delivered : target
        })
        row.total = visibleGroups.reduce((sum, group) => sum + row[group], 0)
        return row
      })
      .sort((a, b) => b.total - a.total)
  }, [categoryFilteredDeliveryRows, categoryFilteredOrders, matrixMode, visibleGroups])

  const chartSeries = chartView === 'TOTAL' ? TOTAL_SERIES : visibleGroups

  const chartValues = useMemo(
    () => buildOrderTrend(categoryFilteredOrders, chartPeriod, visibleGroups),
    [chartPeriod, categoryFilteredOrders, visibleGroups]
  )

  const categories = useMemo(() => {
    const values = new Set(orders.map((row) => row.delivery_category).filter(Boolean))
    if (filters.category !== 'ALL') values.add(filters.category)
    if (applied.category !== 'ALL') values.add(applied.category)
    return ['ALL', ...values]
  }, [applied.category, filters.category, orders])
  const undefinedRows = useMemo(() => deliveryRows.filter((row) => row.is_defined === false), [deliveryRows])
  const barcodeMismatchRows = useMemo(() => {
    const byBarcode = new Map()

    ;[...packingRows, ...deliveryRows].forEach((row) => {
      const barcode = normalizeBarcode(row.barcode)
      if (!barcode) return
      const current = byBarcode.get(barcode) || {}

      byBarcode.set(barcode, {
        ...current,
        ...row,
        barcode,
        timestamp_packing: current.timestamp_packing || row.timestamp_packing,
        timestamp_delivery: current.timestamp_delivery || row.timestamp_delivery,
        packing_team: current.packing_team || row.packing_team,
        group_order: current.group_order || row.group_order,
        courier: current.courier || row.courier,
        is_packed: Boolean(current.is_packed || row.is_packed),
        is_delivered: Boolean(current.is_delivered || row.is_delivered),
      })
    })

    return [...byBarcode.values()]
      .map((row) => {
        const packed = hasPackingScan(row)
        const delivered = hasDeliveryScan(row)

        if (packed && !delivered) {
          return {
            ...row,
            issue: 'PACKED_NOT_DELIVERED',
            issueLabel: 'Packed, not delivered yet',
          }
        }
        if (delivered && !packed) {
          return {
            ...row,
            issue: 'DELIVERED_NOT_PACKED',
            issueLabel: 'Delivered, not packed yet',
          }
        }
        return null
      })
      .filter(Boolean)
      .sort((a, b) => {
        const bTime = b.timestamp_delivery || b.timestamp_packing || ''
        const aTime = a.timestamp_delivery || a.timestamp_packing || ''
        return bTime.localeCompare(aTime)
      })
  }, [deliveryRows, packingRows])
  const undefinedCount = undefinedRows.length
  const missingBarcode = barcodeMismatchRows.length
  const modalRows = issueModal === 'undefined' ? undefinedRows : barcodeMismatchRows

  return (
    <div className={`${styles.modulePage} ${styles.summaryPage}`}>
      <div className={styles.summaryWrap}>
        <header className={styles.summaryTopbar}>
          <div className={styles.summaryTitleBlock}>
            <div className={styles.summaryBackRow}>
              <Link href="/dashboard" className={styles.summaryBackButton}>← Back to Dashboard</Link>
              <Link href="/dashboard/delivery-report" className={styles.summaryBackButton}>← Back to Home</Link>
            </div>
            <h1>DELIVERY SUMMARY</h1>
          </div>

          <section className={styles.filterBar}>
            <label>
              <span>CATEGORY</span>
              <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              <span>GROUP</span>
              <select value={filters.group} onChange={(event) => setFilters({ ...filters, group: lockedGroup || event.target.value })} disabled={Boolean(lockedGroup)}>
                {lockedGroup ? null : <option>ALL</option>}
                {visibleGroups.map((group) => <option key={group}>{group}</option>)}
              </select>
            </label>
          </section>
        </header>

        {loading ? <div className={styles.summaryLoading}>Loading summary...</div> : null}

        <StatusMessage status={status} />

        <section className={styles.metricGrid} aria-busy={loading}>
        {visibleGroups.map((group) => {
          const target = targetByGroup[group]
          const current = scanPhase === 'DELIVERY' ? deliveryByGroup[group] : null
          const progress = current == null ? 0 : pct(current, target)
          return (
            <article className={styles.metricCard} key={group}>
              <h3>{group}</h3>
              <strong>{loading ? '-' : current == null ? '-' : formatCount(current)}</strong>
              <p>{loading ? '-' : current == null ? '-' : `${formatCount(current)} / ${formatCount(target)} (${progress}%)`}</p>
              <div className={styles.progressLabel}><b>PROGRESS</b><span>Remaining: {current == null ? '-' : formatCount(Math.max(0, target - current))}</span></div>
              <div className={styles.progressTrack}>
                <span style={{ width: `${Math.min(100, progress)}%`, backgroundColor: getProgressColor(progress) }} />
              </div>
            </article>
          )
        })}

        <article className={`${styles.metricCard} ${styles.totalMetric}`}>
          <h3>TOTAL {scanPhase} SCANNED</h3>
          <div className={styles.totalMetricMain}>
            <div>
              <strong>{loading ? '-' : formatCount(totalScanned)}</strong>
              <p>{loading ? '-' : `${formatCount(totalScanned)} / ${formatCount(totalTarget)} (${totalProgress}%)`}</p>
            </div>
            <div className={styles.segmentedControl}>
              {['PACKING', 'DELIVERY'].map((phase) => (
                <button key={phase} className={scanPhase === phase ? styles.active : ''} onClick={() => setScanPhase(phase)}>{phase}</button>
              ))}
            </div>
          </div>
          <div className={styles.progressLabel}><b>{scanPhase} PROGRESS</b><span>Remaining: {formatCount(Math.max(0, totalTarget - totalScanned))}</span></div>
          <div className={styles.progressTrack}>
            <span style={{ width: `${Math.min(100, totalProgress)}%`, backgroundColor: getProgressColor(totalProgress) }} />
          </div>
        </article>
        </section>

        <section className={styles.summaryGrid}>
        <article className={`${styles.dataCard} ${styles.summaryMatrix}`}>
          <div className={styles.cardTitleRow}>
            <h2>{matrixMode} MATRIX</h2>
            <div className={styles.cardToolbar}>
              <div className={styles.segmentedControl}>
                {['SHORTAGE', 'DELIVERY'].map((mode) => (
                  <button key={mode} className={matrixMode === mode ? styles.active : ''} onClick={() => setMatrixMode(mode)}>{mode}</button>
                ))}
              </div>
              <span className={styles.infoPill}>Undefined Count: {formatCount(undefinedCount)}</span>
              {undefinedCount > 0 ? (
                <button
                  type="button"
                  className={styles.infoButton}
                  aria-label="Show undefined courier details"
                  title="Show details"
                  onClick={() => setIssueModal('undefined')}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" /><path d="M10 9v5m0-8h.01" /></svg>
                </button>
              ) : null}
              <span className={styles.infoPill}>Missing Barcode: {formatCount(missingBarcode)}</span>
              {missingBarcode > 0 ? (
                <button
                  type="button"
                  className={styles.infoButton}
                  aria-label="Show missing barcode details"
                  title="Show details"
                  onClick={() => setIssueModal('missing')}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" /><path d="M10 9v5m0-8h.01" /></svg>
                </button>
              ) : null}
            </div>
          </div>
          <p className={styles.cardHint}>
            {matrixMode === 'SHORTAGE'
              ? 'Shortage = Delivery Order - Delivery Scanned. Negative values mean scans are higher than the target.'
              : 'Delivery Matrix shows the original Delivery Order target by courier and group.'}
          </p>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Courier</th>{visibleGroups.map((group) => <th key={group}>{group}</th>)}<th>Total</th></tr></thead>
              <tbody>
                {matrixRows.length ? matrixRows.map((row) => (
                  <tr key={row.courier}>
                    <td><strong>{row.courier}</strong></td>
                    {visibleGroups.map((group) => <td key={group}>{formatCount(row[group])}</td>)}
                    <td><strong>{formatCount(row.total)}</strong></td>
                  </tr>
                )) : <tr><td colSpan={visibleGroups.length + 2}><EmptyState /></td></tr>}
              </tbody>
              {matrixRows.length ? (
                <tfoot><tr><td><strong>TOTAL</strong></td>{visibleGroups.map((group) => <td key={group}><strong>{formatCount(matrixRows.reduce((sum, row) => sum + row[group], 0))}</strong></td>)}<td><strong>{formatCount(matrixRows.reduce((sum, row) => sum + row.total, 0))}</strong></td></tr></tfoot>
              ) : null}
            </table>
          </div>
        </article>

        <article className={`${styles.dataCard} ${styles.compositionCard}`}>
          <div className={styles.cardTitleRow}><h2>COURIER COMPOSITION</h2><span className={styles.infoPill}>By Courier</span></div>
          {couriers.length ? <CourierComposition values={couriers} /> : <EmptyState />}
        </article>

        <article className={`${styles.dataCard} ${styles.fullWidth}`}>
          <div className={`${styles.cardTitleRow} ${styles.summaryChartHeader}`}>
            <h2>Order Chart</h2>
            <div className={styles.summaryChartControls}>
              <div className={styles.segmentedControl} role="group" aria-label="Chart period">
                {['DAY', 'MONTH', 'YEAR'].map((period) => (
                  <button type="button" key={period} aria-pressed={chartPeriod === period} className={chartPeriod === period ? styles.active : ''} onClick={() => changeChartPeriod(period)}>{period[0] + period.slice(1).toLowerCase()}</button>
                ))}
              </div>
              {['from', 'to'].map((edge) => <label className={styles.summaryChartDateField} key={edge}>
                <span>{chartPeriod === 'DAY' ? 'DATE' : chartPeriod === 'MONTH' ? 'MONTH' : 'YEAR'} {edge.toUpperCase()}</span>
                {chartPeriod === 'YEAR' ? <select aria-label={`Year ${edge}`} value={filters[edge].slice(0, 4)} onChange={(event) => changeChartRange(edge, event.target.value)}>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select>
                  : <input aria-label={`${chartPeriod === 'DAY' ? 'Date' : 'Month'} ${edge}`} type={chartPeriod === 'DAY' ? 'date' : 'month'} value={filters[edge].slice(0, chartPeriod === 'DAY' ? 10 : 7)} onChange={(event) => changeChartRange(edge, event.target.value)} />}
              </label>)}
              <div className={styles.segmentedControl} role="group" aria-label="Chart breakdown">
                {[['TOTAL', 'Total'], ['GROUP', 'Per Group']].map(([view, label]) => <button type="button" key={view} aria-pressed={chartView === view} className={chartView === view ? styles.active : ''} onClick={() => { setChartView(view); setHighlightedSeries('') }}>{label}</button>)}
              </div>
            </div>
          </div>
          {chartValues.length && chartSeries.length ? <LineChart values={chartValues} series={chartSeries} selectedSeries={highlightedSeries} onSelectSeries={selectChartSeries} /> : <EmptyState />}
          <div className={styles.chartLegend} role="group" aria-label="Highlight chart series">{chartSeries.map((name) => <button type="button" key={name} aria-pressed={highlightedSeries === name} onClick={() => selectChartSeries(name)} className={highlightedSeries && highlightedSeries !== name ? styles.chartLegendMuted : ''}><i style={{ backgroundColor: SERIES_COLORS[name] }} />{name === 'TOTAL' ? 'Total orders' : name}</button>)}</div>
        </article>
        </section>

        <Modal
          open={Boolean(issueModal)}
          title={issueModal === 'undefined' ? 'UNDEFINED BARCODES' : 'MISSING BARCODES'}
          description={issueModal === 'undefined'
            ? 'These barcodes could not be identified by the courier rules.'
            : 'These barcodes have incomplete status: packed but not delivered yet, or delivered but not packed yet.'}
          onClose={() => setIssueModal(null)}
        >
          <div className={styles.tableWrap}>
            {issueModal === 'undefined' ? (
              <table>
                <thead><tr><th>Barcode</th><th>Timestamp Delivery</th><th>Group</th><th>Courier</th></tr></thead>
                <tbody>
                  {modalRows.map((row, index) => (
                    <tr key={`${row.barcode || 'undefined'}-${row.timestamp_delivery || index}`}>
                      <td><strong>{row.barcode || '-'}</strong></td>
                      <td>{formatDate(row.timestamp_delivery, { time: true })}</td>
                      <td>{row.group_order || '-'}</td>
                      <td>{row.courier || 'UNDEFINED'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table>
                <thead><tr><th>Barcode</th><th>Status</th><th>Packing Time</th><th>Delivery Time</th><th>Group</th><th>Courier</th><th>Packing Team</th></tr></thead>
                <tbody>
                  {modalRows.map((row) => (
                    <tr key={row.barcode}>
                      <td><strong>{row.barcode}</strong></td>
                      <td>
                        <span className={`${styles.issueBadge} ${row.issue === 'PACKED_NOT_DELIVERED' ? styles.warningIssue : styles.dangerIssue}`}>
                          {row.issueLabel}
                        </span>
                      </td>
                      <td>{formatDate(row.timestamp_packing, { time: true })}</td>
                      <td>{formatDate(row.timestamp_delivery, { time: true })}</td>
                      <td>{row.group_order || '-'}</td>
                      <td>{row.courier || 'UNDEFINED'}</td>
                      <td>{row.packing_team || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      </div>
    </div>
  )
}
