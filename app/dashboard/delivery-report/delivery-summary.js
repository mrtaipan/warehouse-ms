'use client'

import Link from 'next/link'
import { Chart as ChartJS, registerables } from 'chart.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { deliverySupabase } from '@/lib/delivery-supabase'
import { EmptyState, Modal, StatusMessage } from './delivery-report-client'
import {
  COURIER_COLORS,
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

function getProgressColor(percentage) {
  if (percentage > 80) return PROGRESS_COLORS.success
  if (percentage >= 50) return PROGRESS_COLORS.warning
  return PROGRESS_COLORS.danger
}

function formatCount(value) {
  return safeNumber(value).toLocaleString('id-ID')
}

function normalizeBarcode(value) {
  return String(value || '').trim().toUpperCase()
}

function hasPackingScan(row) {
  return Boolean(row?.is_packed || row?.timestamp_packing)
}

function hasDeliveryScan(row) {
  return Boolean(row?.is_delivered || row?.timestamp_delivery)
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
                  width: `${Math.max(2, percentage)}%`,
                  backgroundColor: COURIER_COLORS[index % COURIER_COLORS.length],
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BarChart({ values, series }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const totals = values.map((item) => series.reduce((sum, name) => sum + safeNumber(item[name]), 0))

    chartRef.current?.destroy()
    chartRef.current = new ChartJS(canvas, {
      type: 'bar',
      data: {
        labels: values.map((item) => item.label),
        datasets: series.map((name, index) => ({
          label: name,
          data: values.map((item) => safeNumber(item[name])),
          backgroundColor: COURIER_COLORS[index % COURIER_COLORS.length],
          borderColor: COURIER_COLORS[index % COURIER_COLORS.length],
          borderWidth: 1,
          stack: 'order',
          borderRadius: 3,
          borderSkipped: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 22 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              footer(items) {
                const index = items?.[0]?.dataIndex ?? -1
                return index >= 0 ? `Total: ${totals[index].toLocaleString('id-ID')}` : ''
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: '#6b7280', font: { family: 'Arial', size: 11 } },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            border: { display: false },
            grid: { color: '#edf0f5' },
            ticks: { color: '#6b7280', precision: 0, font: { family: 'Arial', size: 11 } },
          },
        },
      },
      plugins: [
        {
          id: 'stackedTotalLabels',
          afterDatasetsDraw(chart) {
            const context = chart.ctx
            const xScale = chart.scales.x
            const yScale = chart.scales.y
            context.save()
            context.font = 'bold 11px Arial'
            context.fillStyle = '#111827'
            context.textAlign = 'center'
            totals.forEach((total, index) => {
              if (total <= 0) return
              context.fillText(
                total.toLocaleString('id-ID'),
                xScale.getPixelForValue(index),
                Math.max(yScale.getPixelForValue(total) - 9, 16)
              )
            })
            context.restore()
          },
        },
      ],
    })

    return () => chartRef.current?.destroy()
  }, [series, values])

  return (
    <div className={styles.barChart}>
      <canvas ref={canvasRef} aria-label="Stacked order chart" />
    </div>
  )
}

export default function DeliverySummary() {
  const today = useMemo(() => todayIso(), [])
  const [filters, setFilters] = useState({ mode: 'DAY', from: today, to: today, group: 'ALL', category: 'ALL' })
  const [applied, setApplied] = useState(filters)
  const [orders, setOrders] = useState([])
  const [packingRows, setPackingRows] = useState([])
  const [deliveryRows, setDeliveryRows] = useState([])
  const [scanPhase, setScanPhase] = useState('DELIVERY')
  const [matrixMode, setMatrixMode] = useState('SHORTAGE')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [issueModal, setIssueModal] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    let orderQuery = deliverySupabase
      .from('Delivery_Order')
      .select('*')
      .gte('delivery_date', applied.from)
      .lte('delivery_date', applied.to)
      .order('delivery_date', { ascending: true })

    if (applied.group !== 'ALL') orderQuery = orderQuery.eq('group_order', applied.group)
    if (applied.category !== 'ALL') orderQuery = orderQuery.eq('delivery_category', applied.category)

    let packingQuery = deliverySupabase
      .from('Delivery_Barcode')
      .select('*')
      .gte('timestamp_packing', jakartaStart(applied.from))
      .lte('timestamp_packing', jakartaEnd(applied.to))

    let deliveryQuery = deliverySupabase
      .from('Delivery_Barcode')
      .select('*')
      .gte('timestamp_delivery', jakartaStart(applied.from))
      .lte('timestamp_delivery', jakartaEnd(applied.to))

    if (applied.group !== 'ALL') {
      packingQuery = packingQuery.eq('group_order', applied.group)
      deliveryQuery = deliveryQuery.eq('group_order', applied.group)
    }

    const [ordersResult, packingResult, deliveryResult] = await Promise.all([
      orderQuery,
      packingQuery,
      deliveryQuery,
    ])

    const error = ordersResult.error || packingResult.error || deliveryResult.error
    if (error) {
      setStatus({ type: 'error', message: `Gagal memuat summary: ${error.message}` })
    } else {
      setOrders(ordersResult.data || [])
      setPackingRows(packingResult.data || [])
      setDeliveryRows(deliveryResult.data || [])
    }
    setLoading(false)
  }, [applied])

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const targetByGroup = useMemo(
    () =>
      Object.fromEntries(
        GROUPS.map((group) => [
          group,
          orders.filter((row) => row.group_order === group).reduce((sum, row) => sum + safeNumber(row.quantity), 0),
        ])
      ),
    [orders]
  )
  const totalTarget = Object.values(targetByGroup).reduce((sum, value) => sum + value, 0)
  const totalScanned = scanPhase === 'PACKING' ? packingRows.length : deliveryRows.length
  const totalProgress = pct(totalScanned, totalTarget)

  const deliveryByGroup = useMemo(
    () => Object.fromEntries(GROUPS.map((group) => [group, deliveryRows.filter((row) => row.group_order === group).length])),
    [deliveryRows]
  )

  const couriers = useMemo(() => {
    const names = [...new Set(orders.map((row) => row.courier || 'UNDEFINED'))]
    return names
      .map((courier) => ({
        label: courier,
        value: orders.filter((row) => (row.courier || 'UNDEFINED') === courier).reduce((sum, row) => sum + safeNumber(row.quantity), 0),
      }))
      .sort((a, b) => b.value - a.value)
  }, [orders])

  const matrixRows = useMemo(() => {
    const names = [...new Set([...orders.map((row) => row.courier || 'UNDEFINED'), ...deliveryRows.map((row) => row.courier || 'UNDEFINED')])]
    return names
      .map((courier) => {
        const row = { courier }
        GROUPS.forEach((group) => {
          const target = orders
            .filter((item) => item.group_order === group && (item.courier || 'UNDEFINED') === courier)
            .reduce((sum, item) => sum + safeNumber(item.quantity), 0)
          const delivered = deliveryRows.filter(
            (item) => item.group_order === group && (item.courier || 'UNDEFINED') === courier
          ).length
          row[group] = matrixMode === 'SHORTAGE' ? target - delivered : target
        })
        row.total = GROUPS.reduce((sum, group) => sum + row[group], 0)
        return row
      })
      .sort((a, b) => b.total - a.total)
  }, [deliveryRows, matrixMode, orders])

  const chartSeries = GROUPS

  const barValues = useMemo(() => {
    const map = new Map()
    orders.forEach((row) => {
      const date = new Date(`${row.delivery_date}T00:00:00+07:00`)
      const key =
        applied.mode === 'YEAR'
          ? String(date.getFullYear())
          : applied.mode === 'MONTH'
            ? new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' }).format(date)
            : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date)
      if (!map.has(key)) map.set(key, { label: key, ARKLINE: 0, MOB: 0, OI: 0 })
      const bucket = map.get(key)
      if (GROUPS.includes(row.group_order)) {
        bucket[row.group_order] += safeNumber(row.quantity)
      }
    })
    return [...map.values()]
  }, [applied.mode, orders])

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
            issueLabel: 'Packing belum delivery',
          }
        }
        if (delivered && !packed) {
          return {
            ...row,
            issue: 'DELIVERED_NOT_PACKED',
            issueLabel: 'Delivery belum packing',
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
            <Link href="/dashboard/delivery-report" className={styles.summaryBackButton}>← Back to Home</Link>
            <h1>DELIVERY SUMMARY</h1>
            <p>Dashboard progress, matrix, group chart, dan courier composition.</p>
          </div>

          <section className={styles.filterBar}>
            <label>
              <span>PERIOD</span>
              <select value={filters.mode} onChange={(event) => setFilters({ ...filters, mode: event.target.value })}>
                <option>DAY</option>
                <option>MONTH</option>
                <option>YEAR</option>
              </select>
            </label>
            <label>
              <span>DATE FROM</span>
              <input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
            </label>
            <label>
              <span>DATE TO</span>
              <input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
            </label>
            <label>
              <span>KATEGORI</span>
              <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              <span>GROUP</span>
              <select value={filters.group} onChange={(event) => setFilters({ ...filters, group: event.target.value })}>
                <option>ALL</option>
                {GROUPS.map((group) => <option key={group}>{group}</option>)}
              </select>
            </label>
            <button className={styles.darkButton} onClick={() => setApplied(filters)} disabled={loading}>APPLY</button>
          </section>
        </header>

        {loading ? <div className={styles.summaryLoading}>Loading summary...</div> : null}

        <StatusMessage status={status} />

        <section className={styles.metricGrid} aria-busy={loading}>
        {GROUPS.map((group) => {
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
        <article className={styles.dataCard}>
          <div className={styles.cardTitleRow}>
            <h2>{matrixMode} MATRIX</h2>
            <div className={styles.cardToolbar}>
              <div className={styles.segmentedControl}>
                {['SHORTAGE', 'DELIVERY'].map((mode) => (
                  <button key={mode} className={matrixMode === mode ? styles.active : ''} onClick={() => setMatrixMode(mode)}>{mode}</button>
                ))}
              </div>
              <span className={styles.infoPill}>Undefined Count: {formatCount(undefinedCount)}</span>
              {undefinedCount > 0 ? <button type="button" className={styles.infoButton} onClick={() => setIssueModal('undefined')}>Detail</button> : null}
              <span className={styles.infoPill}>Missing Barcode: {formatCount(missingBarcode)}</span>
              {missingBarcode > 0 ? <button type="button" className={styles.infoButton} onClick={() => setIssueModal('missing')}>Detail</button> : null}
            </div>
          </div>
          <p className={styles.cardHint}>
            {matrixMode === 'SHORTAGE'
              ? 'Shortage = Delivery Order - Delivery Scanned. Nilai minus berarti scanned lebih banyak dari target.'
              : 'Delivery Matrix menampilkan target Delivery Order asli per courier dan per group.'}
          </p>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Courier</th>{GROUPS.map((group) => <th key={group}>{group}</th>)}<th>Total</th></tr></thead>
              <tbody>
                {matrixRows.length ? matrixRows.map((row) => (
                  <tr key={row.courier}>
                    <td><strong>{row.courier}</strong></td>
                    {GROUPS.map((group) => <td key={group}>{row[group]}</td>)}
                    <td><strong>{row.total}</strong></td>
                  </tr>
                )) : <tr><td colSpan="5"><EmptyState /></td></tr>}
              </tbody>
              {matrixRows.length ? (
                <tfoot><tr><td><strong>TOTAL</strong></td>{GROUPS.map((group) => <td key={group}><strong>{matrixRows.reduce((sum, row) => sum + row[group], 0)}</strong></td>)}<td><strong>{matrixRows.reduce((sum, row) => sum + row.total, 0)}</strong></td></tr></tfoot>
              ) : null}
            </table>
          </div>
        </article>

        <article className={`${styles.dataCard} ${styles.compositionCard}`}>
          <div className={styles.cardTitleRow}><h2>COURIER COMPOSITION</h2><span className={styles.infoPill}>By Courier</span></div>
          {couriers.length ? <CourierComposition values={couriers} /> : <EmptyState />}
        </article>

        <article className={`${styles.dataCard} ${styles.fullWidth}`}>
          <div className={styles.cardTitleRow}>
            <div><h2>ORDER CHART</h2><p className={styles.cardHint}>1 bar per periode, isi bar dibagi berdasarkan group.</p></div>
            <span className={styles.darkPill}>Mode: {applied.mode}</span>
          </div>
          {barValues.length && chartSeries.length ? <BarChart values={barValues} series={chartSeries} /> : <EmptyState />}
          <div className={styles.chartLegend}>{chartSeries.map((name, index) => <span key={name}><i style={{ backgroundColor: COURIER_COLORS[index % COURIER_COLORS.length] }} />{name}</span>)}</div>
        </article>
        </section>

        <Modal
          open={Boolean(issueModal)}
          title={issueModal === 'undefined' ? 'UNDEFINED BARCODES' : 'MISSING BARCODES'}
          description={issueModal === 'undefined'
            ? 'Barcode berikut belum dapat diidentifikasi berdasarkan courier rules.'
            : 'Barcode berikut statusnya belum lengkap: sudah packing tapi belum delivery, atau sudah delivery tapi belum packing.'}
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
