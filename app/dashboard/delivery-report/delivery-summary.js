'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { deliverySupabase } from '@/lib/delivery-supabase'
import { EmptyState, ModuleHeader, StatusMessage } from './delivery-report-client'
import {
  COURIER_COLORS,
  GROUPS,
  jakartaEnd,
  jakartaStart,
  pct,
  safeNumber,
  todayIso,
} from './delivery-report-helpers'
import styles from './delivery-report.module.css'

function PieChart({ values }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * ratio
    canvas.height = height * ratio
    ctx.scale(ratio, ratio)
    ctx.clearRect(0, 0, width, height)

    const total = values.reduce((sum, item) => sum + item.value, 0)
    const radius = Math.min(width, height) * 0.34
    const centerX = width / 2
    const centerY = height * 0.44
    let angle = -Math.PI / 2

    values.forEach((item, index) => {
      const slice = total ? (item.value / total) * Math.PI * 2 : 0
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, angle, angle + slice)
      ctx.closePath()
      ctx.fillStyle = COURIER_COLORS[index % COURIER_COLORS.length]
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()

      if (slice > 0.2) {
        const middle = angle + slice / 2
        const labelRadius = radius * 0.64
        ctx.fillStyle = '#0f172a'
        ctx.font = '700 12px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          `${item.value} (${Math.round((item.value / total) * 100)}%)`,
          centerX + Math.cos(middle) * labelRadius,
          centerY + Math.sin(middle) * labelRadius
        )
      }
      angle += slice
    })
  }, [values])

  return (
    <>
      <canvas ref={canvasRef} className={styles.pieCanvas} aria-label="Courier composition chart" />
      <div className={styles.chartLegend}>
        {values.map((item, index) => (
          <span key={item.label}>
            <i style={{ backgroundColor: COURIER_COLORS[index % COURIER_COLORS.length] }} />
            {item.label} ({item.value})
          </span>
        ))}
      </div>
    </>
  )
}

function BarChart({ values }) {
  const max = Math.max(1, ...values.flatMap((item) => GROUPS.map((group) => item[group] || 0)))
  return (
    <div className={styles.barChart}>
      {values.map((item) => (
        <div className={styles.barGroup} key={item.label}>
          <div className={styles.barStack}>
            {GROUPS.map((group, index) => (
              <span
                key={group}
                className={styles.bar}
                style={{
                  height: `${Math.max(2, ((item[group] || 0) / max) * 100)}%`,
                  backgroundColor: COURIER_COLORS[index],
                }}
                title={`${group}: ${item[group] || 0}`}
              >
                {item[group] || ''}
              </span>
            ))}
          </div>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  )
}

export default function DeliverySummary() {
  const today = useMemo(() => todayIso(), [])
  const [filters, setFilters] = useState({ mode: 'DAY', from: today, to: today, category: 'ALL' })
  const [applied, setApplied] = useState(filters)
  const [orders, setOrders] = useState([])
  const [packingRows, setPackingRows] = useState([])
  const [deliveryRows, setDeliveryRows] = useState([])
  const [scanPhase, setScanPhase] = useState('DELIVERY')
  const [matrixMode, setMatrixMode] = useState('SHORTAGE')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    let orderQuery = deliverySupabase
      .from('Delivery_Order')
      .select('*')
      .gte('delivery_date', applied.from)
      .lte('delivery_date', applied.to)
      .order('delivery_date', { ascending: true })

    if (applied.category !== 'ALL') orderQuery = orderQuery.eq('delivery_category', applied.category)

    const [ordersResult, packingResult, deliveryResult] = await Promise.all([
      orderQuery,
      deliverySupabase
        .from('Delivery_Barcode')
        .select('*')
        .gte('timestamp_packing', jakartaStart(applied.from))
        .lte('timestamp_packing', jakartaEnd(applied.to)),
      deliverySupabase
        .from('Delivery_Barcode')
        .select('*')
        .gte('timestamp_delivery', jakartaStart(applied.from))
        .lte('timestamp_delivery', jakartaEnd(applied.to)),
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
      if (GROUPS.includes(row.group_order)) bucket[row.group_order] += safeNumber(row.quantity)
    })
    return [...map.values()]
  }, [applied.mode, orders])

  const categories = useMemo(() => ['ALL', ...new Set(orders.map((row) => row.delivery_category).filter(Boolean))], [orders])
  const undefinedCount = deliveryRows.filter((row) => row.is_defined === false).length
  const missingBarcode = deliveryRows.filter((row) => !row.barcode).length

  return (
    <div className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Delivery Report • Summary"
        title="DELIVERY SUMMARY"
        subtitle="Dashboard progress, matrix, category chart, dan courier composition."
      />

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
        <button className={styles.darkButton} onClick={() => setApplied(filters)}>APPLY</button>
      </section>

      <StatusMessage status={status} />

      <section className={styles.metricGrid} aria-busy={loading}>
        {GROUPS.map((group) => {
          const target = targetByGroup[group]
          const current = scanPhase === 'DELIVERY' ? deliveryByGroup[group] : null
          return (
            <article className={styles.metricCard} key={group}>
              <h3>{group}</h3>
              <strong>{loading ? '-' : current ?? '-'}</strong>
              <p>{loading ? '-' : current == null ? '-' : `${current} / ${target} (${pct(current, target)}%)`}</p>
              <div className={styles.progressLabel}><b>PROGRESS</b><span>Remaining: {current == null ? '-' : Math.max(0, target - current)}</span></div>
              <div className={styles.progressTrack}><span style={{ width: `${current == null ? 0 : Math.min(100, pct(current, target))}%` }} /></div>
            </article>
          )
        })}

        <article className={`${styles.metricCard} ${styles.totalMetric}`}>
          <h3>TOTAL {scanPhase} SCANNED</h3>
          <strong>{loading ? '-' : totalScanned}</strong>
          <p>{loading ? '-' : `${totalScanned} / ${totalTarget} (${pct(totalScanned, totalTarget)}%)`}</p>
          <div className={styles.segmentedControl}>
            {['PACKING', 'DELIVERY'].map((phase) => (
              <button key={phase} className={scanPhase === phase ? styles.active : ''} onClick={() => setScanPhase(phase)}>{phase}</button>
            ))}
          </div>
          <div className={styles.progressLabel}><b>{scanPhase} PROGRESS</b><span>Remaining: {Math.max(0, totalTarget - totalScanned)}</span></div>
          <div className={styles.progressTrack}><span style={{ width: `${Math.min(100, pct(totalScanned, totalTarget))}%` }} /></div>
        </article>
      </section>

      <section className={styles.summaryGrid}>
        <article className={styles.dataCard}>
          <h2>{matrixMode} MATRIX</h2>
          <div className={styles.cardToolbar}>
            <div className={styles.segmentedControl}>
              {['SHORTAGE', 'DELIVERY'].map((mode) => (
                <button key={mode} className={matrixMode === mode ? styles.active : ''} onClick={() => setMatrixMode(mode)}>{mode}</button>
              ))}
            </div>
            <span className={styles.infoPill}>Undefined Count: {undefinedCount}</span>
            <span className={styles.infoPill}>Missing Barcode: {missingBarcode}</span>
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

        <article className={styles.dataCard}>
          <div className={styles.cardTitleRow}><h2>COURIER COMPOSITION</h2><span className={styles.infoPill}>By Courier</span></div>
          {couriers.length ? <PieChart values={couriers} /> : <EmptyState />}
        </article>

        <article className={`${styles.dataCard} ${styles.fullWidth}`}>
          <div className={styles.cardTitleRow}>
            <div><h2>ORDER CHART</h2><p className={styles.cardHint}>1 bar per periode, isi bar dibagi berdasarkan kategori.</p></div>
            <span className={styles.darkPill}>Mode: {applied.mode}</span>
          </div>
          {barValues.length ? <BarChart values={barValues} /> : <EmptyState />}
          <div className={styles.chartLegend}>{GROUPS.map((group, index) => <span key={group}><i style={{ backgroundColor: COURIER_COLORS[index] }} />{group}</span>)}</div>
        </article>
      </section>
    </div>
  )
}
