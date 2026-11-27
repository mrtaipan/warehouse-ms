'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

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

function LineChart({ values, series, selectedSeries, onSelectSeries, period }) {
  const chartId = useId().replaceAll(':', '')
  const chartWrapRef = useRef(null)
  const [chartWidth, setChartWidth] = useState(1000)
  const [hover, setHover] = useState(null)
  useEffect(() => {
    const element = chartWrapRef.current
    if (!element) return
    const measure = () => setChartWidth(Math.max(1, element.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const chartHeight = 350
  const plot = { left: 62, right: 18, top: 22, bottom: 42 }
  const plotWidth = Math.max(1, chartWidth - plot.left - plot.right)
  const plotHeight = chartHeight - plot.top - plot.bottom
  const maxValue = values.reduce(
    (maximum, item) => series.reduce((lineMaximum, name) => Math.max(lineMaximum, safeNumber(item[name])), maximum),
    0
  )
  const rawStep = Math.max(maxValue / 4, 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalizedStep = rawStep / magnitude
  const stepFactor = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 2.5 ? 2.5 : normalizedStep <= 5 ? 5 : 10
  const step = stepFactor * magnitude
  const yMax = Math.max(step * 4, Math.ceil(maxValue / step) * step)
  const xFor = (index) => plot.left + (values.length > 1 ? (index / (values.length - 1)) * plotWidth : plotWidth / 2)
  const yFor = (value) => plot.top + (1 - safeNumber(value) / yMax) * plotHeight
  const pathFor = (name) => {
    if (!values.length) return ''
    const points = values.map((item, index) => ({ x: xFor(index), y: yFor(item[name]) }))
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
    return points.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`
      const previous = points[index - 1]
      const middle = (previous.x + point.x) / 2
      return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`
    }, '')
  }
  const areaFor = (name) => {
    const path = pathFor(name)
    if (!path) return ''
    return `${path} L ${xFor(values.length - 1)} ${plot.top + plotHeight} L ${xFor(0)} ${plot.top + plotHeight} Z`
  }
  const visibleTicks = values.length <= 8
    ? values.map((_item, index) => index)
    : Array.from({ length: 8 }, (_item, index) => Math.round(index * (values.length - 1) / 7))
  const weekBoundaryIndices = period === 'DAY'
    ? values.reduce((indices, item, index) => {
      if (item.dateKey && new Date(`${item.dateKey}T00:00:00Z`).getUTCDay() === 0) indices.push(index)
      return indices
    }, [])
    : []
  const chartNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
  const tooltipRows = hover ? series
    .map((name) => ({ name, count: safeNumber(values[hover.index]?.[name]) }))
    .filter((row) => row.count > 0) : []

  const handlePointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !values.length) return
    const layoutWidth = chartWrapRef.current?.clientWidth || chartWidth
    const layoutHeight = chartWrapRef.current?.clientHeight || chartHeight
    const x = ((event.clientX - bounds.left) / bounds.width) * chartWidth
    const y = ((event.clientY - bounds.top) / bounds.height) * chartHeight
    if (x < plot.left || x > chartWidth - plot.right || y < plot.top || y > plot.top + plotHeight) {
      setHover(null)
      return
    }
    const index = values.length > 1
      ? Math.max(0, Math.min(values.length - 1, Math.round(((x - plot.left) / plotWidth) * (values.length - 1))))
      : 0
    const rows = series.filter((name) => safeNumber(values[index]?.[name]) > 0)
    if (!rows.length) {
      setHover(null)
      return
    }
    const tipWidth = Math.min(250, layoutWidth - 24)
    const tipHeight = 56 + rows.length * 28
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * layoutWidth
    const pointerY = ((event.clientY - bounds.top) / bounds.height) * layoutHeight
    const left = Math.max(12, Math.min(pointerX + 14, layoutWidth - tipWidth - 12))
    const top = pointerY + tipHeight + 18 <= layoutHeight
      ? pointerY + 14
      : Math.max(12, pointerY - tipHeight - 14)
    setHover({ index, left, top })
  }

  const handleChartClick = (event) => {
    if (!hover) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const pointerY = ((event.clientY - bounds.top) / bounds.height) * chartHeight
    const nearestSeries = series
      .filter((name) => safeNumber(values[hover.index]?.[name]) > 0)
      .map((name) => ({ name, distance: Math.abs(yFor(values[hover.index]?.[name]) - pointerY) }))
      .sort((a, b) => a.distance - b.distance)[0]
    if (nearestSeries) onSelectSeries(nearestSeries.name)
  }

  return (
    <div ref={chartWrapRef} className={`${styles.barChart} ${styles.orderChart}`} onPointerLeave={() => setHover(null)}>
      <svg
        className={styles.orderChartSvg}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label={`Order quantity trend by ${series.join(', ')}. Total ${formatCount(values.reduce((sum, item) => sum + safeNumber(item.TOTAL), 0))} orders.`}
        onPointerMove={handlePointerMove}
        onClick={handleChartClick}
      >
        <defs>
          {series.map((name) => <linearGradient key={name} id={`${chartId}-${name}-area`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLORS[name]} stopOpacity={selectedSeries && selectedSeries !== name ? .05 : .20} />
            <stop offset="100%" stopColor={SERIES_COLORS[name]} stopOpacity="0" />
          </linearGradient>)}
        </defs>
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = yMax * tick / 4
          const y = yFor(value)
          return <g key={tick}>
            <line x1={plot.left} x2={chartWidth - plot.right} y1={y} y2={y} className={styles.orderChartGrid} />
            <text x={plot.left - 12} y={y + 4} textAnchor="end" className={styles.orderChartAxis}>{chartNumber.format(value)}</text>
          </g>
        })}
        {weekBoundaryIndices.map((index) => <line
          key={`week-boundary-${index}`}
          x1={xFor(index)}
          x2={xFor(index)}
          y1={plot.top}
          y2={plot.top + plotHeight}
          className={styles.orderChartWeekBoundary}
        />)}
        <text transform={`translate(16 ${plot.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" className={styles.orderChartAxisTitle}>Order quantity</text>
        {series.map((name) => {
          const muted = selectedSeries && selectedSeries !== name
          const opacity = muted ? .20 : 1
          return <g key={name} opacity={opacity}>
            <path d={areaFor(name)} fill={`url(#${chartId}-${name}-area)`} />
            <path d={pathFor(name)} fill="none" stroke={SERIES_COLORS[name]} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className={styles.orderChartLineShadow} />
            <path d={pathFor(name)} fill="none" stroke={SERIES_COLORS[name]} strokeWidth={selectedSeries === name ? 3.5 : 2.75} strokeLinecap="round" strokeLinejoin="round" />
            {values.map((item, index) => {
              const count = safeNumber(item[name])
              if (count <= 0) return null
              const markerEvery = Math.max(1, Math.ceil(values.length / 90))
              if (values.length > 90 && index !== values.length - 1 && index % markerEvery !== 0 && hover?.index !== index) return null
              const active = hover?.index === index
              return <g key={`${name}-${index}`}>
                {active ? <circle cx={xFor(index)} cy={yFor(count)} r="10" fill={SERIES_COLORS[name]} opacity=".14" /> : null}
                <circle cx={xFor(index)} cy={yFor(count)} r={active ? 5.5 : values.length > 90 ? 2 : 3.5} fill="#ffffff" stroke={SERIES_COLORS[name]} strokeWidth={active ? 3 : 2.25} />
              </g>
            })}
          </g>
        })}
        {hover ? <line x1={xFor(hover.index)} x2={xFor(hover.index)} y1={plot.top} y2={plot.top + plotHeight} className={styles.orderChartCrosshair} /> : null}
        {hover ? series.map((name) => {
          const count = safeNumber(values[hover.index]?.[name])
          if (!count) return null
          return <g key={`active-${name}`}>
            <circle cx={xFor(hover.index)} cy={yFor(count)} r="10" fill={SERIES_COLORS[name]} opacity=".14" />
            <circle cx={xFor(hover.index)} cy={yFor(count)} r="5.5" fill="#ffffff" stroke={SERIES_COLORS[name]} strokeWidth="3" />
          </g>
        }) : null}
        {visibleTicks.map((index) => <text key={`tick-${index}`} x={xFor(index)} y={chartHeight - 10} textAnchor="middle" className={styles.orderChartAxis}>{values[index]?.label}</text>)}
      </svg>
      {hover && tooltipRows.length ? <div className={`${styles.returnChartTooltip} ${styles.summaryChartTooltip} ${styles.orderChartTooltip}`} style={{ left: hover.left, top: hover.top }} role="tooltip">
        <strong>{values[hover.index]?.label}</strong>
        {tooltipRows.map((row) => <div className={styles.summaryChartTooltipRow} key={row.name}>
          <span><i style={{ backgroundColor: SERIES_COLORS[row.name] }} />{row.name === 'TOTAL' ? 'Total orders' : row.name}</span>
          <b>{formatCount(row.count)}</b>
        </div>)}
      </div> : null}
    </div>
  )
}

export default function DeliverySummary({ lockedGroup: lockedGroupProp = '', isAdmin = false, access = {} }) {
  const hasSummarySections = ['metrics', 'matrix', 'courier', 'order_chart'].some((key) => access[`summary.${key}`])
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
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [removeError, setRemoveError] = useState('')
  const [removeFeedback, setRemoveFeedback] = useState('')

  const removeMissingBarcode = async () => {
    if (!isAdmin || !removeTarget || removeBusy) return
    setRemoveBusy(true)
    setRemoveError('')

    try {
      const response = await fetch('/api/delivery-report/missing-barcode', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: removeTarget.sourceBarcode || removeTarget.barcode }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to remove barcode.')

      const removedBarcode = result.barcode
      setPackingRows((current) => current.filter((row) => row.barcode !== removedBarcode))
      setDeliveryRows((current) => current.filter((row) => row.barcode !== removedBarcode))
      setRemoveFeedback(`Barcode ${removedBarcode} was removed.`)
      setRemoveTarget(null)
    } catch (error) {
      setRemoveError(error.message || 'Failed to remove barcode.')
    } finally {
      setRemoveBusy(false)
    }
  }

  const loadData = useCallback(async (signal) => {
    setLoading(true)
    setStatus(null)
    setOrders([])
    setPackingRows([])
    setDeliveryRows([])
    if (!hasSummarySections) {
      setLoading(false)
      return
    }
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
  }, [applied.from, applied.to, applied.group, hasSummarySections])

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
    () => buildOrderTrend(categoryFilteredOrders, chartPeriod, visibleGroups, applied.from, applied.to),
    [applied.from, applied.to, chartPeriod, categoryFilteredOrders, visibleGroups]
  )
  const hasWeekBoundaries = chartPeriod === 'DAY' && chartValues.some(
    (item) => item.dateKey && new Date(`${item.dateKey}T00:00:00Z`).getUTCDay() === 0
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
        sourceBarcode: current.sourceBarcode || row.barcode,
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
            {!access['summary.order_chart'] ? ['from', 'to'].map((edge) => <label key={edge}>
              <span>DATE {edge.toUpperCase()}</span>
              <input type="date" value={filters[edge]} onChange={(event) => changeChartRange(edge, event.target.value)} />
            </label>) : null}
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

        {loading ? <div className={styles.summaryLoading} role="status" aria-live="polite">Loading summary...</div> : null}

        <StatusMessage status={status} />
        {!hasSummarySections ? <EmptyState label="No summary sections are enabled for your role." /> : null}

        {access['summary.metrics'] ? <section className={styles.metricGrid} aria-busy={loading}>
        {visibleGroups.map((group) => {
          const target = targetByGroup[group]
          const current = scanPhase === 'DELIVERY' ? deliveryByGroup[group] : null
          const progress = current == null ? 0 : pct(current, target)
          return (
            <article className={styles.metricCard} key={group}>
              <h3>{group}</h3>
              <strong>{loading ? '-' : current == null ? '-' : formatCount(current)}</strong>
              <p>{loading ? '-' : current == null ? '-' : `${formatCount(current)} / ${formatCount(target)} (${progress}%)`}</p>
              <div className={styles.progressLabel}><b>PROGRESS</b><span>Remaining: {loading || current == null ? '-' : formatCount(Math.max(0, target - current))}</span></div>
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
          <div className={styles.progressLabel}><b>{scanPhase} PROGRESS</b><span>Remaining: {loading ? '-' : formatCount(Math.max(0, totalTarget - totalScanned))}</span></div>
          <div className={styles.progressTrack}>
            <span style={{ width: `${Math.min(100, totalProgress)}%`, backgroundColor: getProgressColor(totalProgress) }} />
          </div>
        </article>
        </section> : null}

        <section className={styles.summaryGrid}>
        {access['summary.matrix'] ? <article className={`${styles.dataCard} ${styles.summaryMatrix}`}>
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
                  onClick={() => { setRemoveFeedback(''); setIssueModal('missing') }}
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
                {!loading && matrixRows.length ? matrixRows.map((row) => (
                  <tr key={row.courier}>
                    <td><strong>{row.courier}</strong></td>
                    {visibleGroups.map((group) => <td key={group}>{formatCount(row[group])}</td>)}
                    <td><strong>{formatCount(row.total)}</strong></td>
                  </tr>
                )) : <tr><td colSpan={visibleGroups.length + 2}>{loading ? 'Loading matrix...' : <EmptyState />}</td></tr>}
              </tbody>
              {!loading && matrixRows.length ? (
                <tfoot><tr><td><strong>TOTAL</strong></td>{visibleGroups.map((group) => <td key={group}><strong>{formatCount(matrixRows.reduce((sum, row) => sum + row[group], 0))}</strong></td>)}<td><strong>{formatCount(matrixRows.reduce((sum, row) => sum + row.total, 0))}</strong></td></tr></tfoot>
              ) : null}
            </table>
          </div>
        </article> : null}

        {access['summary.courier'] ? <article className={`${styles.dataCard} ${styles.compositionCard}`}>
          <div className={styles.cardTitleRow}><h2>COURIER COMPOSITION</h2><span className={styles.infoPill}>By Courier</span></div>
          {loading ? <div className={styles.summaryLoading}>Loading courier composition...</div> : couriers.length ? <CourierComposition values={couriers} /> : <EmptyState />}
        </article> : null}

        {access['summary.order_chart'] ? <article className={`${styles.dataCard} ${styles.fullWidth}`}>
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
          {loading ? <div className={styles.summaryLoading}>Loading order chart...</div> : chartValues.length && chartSeries.length ? <LineChart values={chartValues} series={chartSeries} selectedSeries={highlightedSeries} onSelectSeries={selectChartSeries} period={chartPeriod} /> : <EmptyState />}
          <div className={styles.chartLegend} role="group" aria-label="Highlight chart series">
            {chartSeries.map((name) => <button type="button" key={name} aria-pressed={highlightedSeries === name} onClick={() => selectChartSeries(name)} className={highlightedSeries && highlightedSeries !== name ? styles.chartLegendMuted : ''}><i style={{ backgroundColor: SERIES_COLORS[name] }} />{name === 'TOTAL' ? 'Total orders' : name}</button>)}
            {hasWeekBoundaries ? <span className={styles.orderChartWeekLegend}><i aria-hidden="true" />Week boundary (Sunday)</span> : null}
          </div>
        </article> : null}
        </section>

        <Modal
          open={Boolean(issueModal)}
          title={issueModal === 'undefined' ? 'UNDEFINED BARCODES' : 'MISSING BARCODES'}
          description={issueModal === 'undefined'
            ? 'These barcodes could not be identified by the courier rules.'
            : 'These barcodes have incomplete status: packed but not delivered yet, or delivered but not packed yet.'}
          className={issueModal === 'missing' ? styles.missingBarcodeListModal : ''}
          onClose={() => { setIssueModal(null); setRemoveFeedback('') }}
        >
          {issueModal === 'missing' && removeFeedback ? <StatusMessage status={{ type: 'success', message: removeFeedback }} /> : null}
          {!modalRows.length ? <EmptyState label="No barcodes to show." /> : null}
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
                <thead><tr><th>Barcode</th><th>Status</th><th>Packing Time</th><th>Delivery Time</th><th>Group</th><th>Courier</th><th>Packing Team</th>{isAdmin ? <th className={styles.missingBarcodeAction}>Action</th> : null}</tr></thead>
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
                      {isAdmin ? <td className={styles.missingBarcodeAction}>
                        <button type="button" className={styles.missingBarcodeRemoveButton} onClick={() => { setRemoveError(''); setRemoveTarget(row) }} aria-label={`Remove barcode ${row.barcode}`}>Remove</button>
                      </td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
        <Modal
          open={Boolean(removeTarget)}
          title="Remove barcode?"
          description={removeTarget ? `Barcode ${removeTarget.barcode} will be permanently deleted from delivery scans. This action cannot be undone.` : ''}
          className={styles.missingBarcodeConfirmModal}
          portal
          onClose={() => { if (!removeBusy) setRemoveTarget(null) }}
          actions={<>
            <button type="button" className={styles.softButton} disabled={removeBusy} onClick={() => setRemoveTarget(null)}>Cancel</button>
            <button type="button" className={styles.dangerButton} disabled={removeBusy} onClick={removeMissingBarcode}>{removeBusy ? 'Removing...' : 'Remove barcode'}</button>
          </>}
        >
          {removeError ? <StatusMessage status={{ type: 'error', message: removeError }} /> : null}
        </Modal>
      </div>
    </div>
  )
}
