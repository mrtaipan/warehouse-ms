'use client'
import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'

import shellStyles from '../arkline.module.css'
import styles from './progress-overview.module.css'

const supabase = createClient()

const BOARD_STATUSES = ['Initiated', 'On Progress', 'Completed']
const RECEIPT_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const DEFAULT_UPDATE_REASON = 'FABRIC ISSUE'
const OTHERS_UPDATE_REASON = 'OTHERS'

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.calendarIcon}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 3.8v3.4M17 3.8v3.4M3.8 9.2h16.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function KanbanIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.calendarIcon}>
      <rect x="4" y="5" width="7" height="5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="5" width="7" height="8" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4" y="12" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="15" width="7" height="4" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function ProductListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.calendarIcon}>
      <path d="M5 7.5h14M5 12h14M5 16.5h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="7" cy="7.5" r="1" fill="currentColor" />
      <circle cx="7" cy="12" r="1" fill="currentColor" />
      <circle cx="7" cy="16.5" r="1" fill="currentColor" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIcon}>
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIcon}>
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.infoIcon}>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" />
      <path d="M12 10.2v5.1M12 8.1h.01" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon({ expanded }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.chevronIcon}>
      <path
        d={expanded ? 'M7 14l5-5 5 5' : 'M9 7l5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function parseIso(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date)
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
}

function normalizeBoardStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'COMPLETED') return 'Completed'
  if (normalized === 'ON PROGRESS' || normalized === 'IN PROGRESS' || normalized === 'ONGOING') return 'On Progress'
  return 'Initiated'
}

function getStatusKey(status) {
  if (status === 'On Progress') return 'OnProgress'
  return status
}

function getDelayDays(targetDate, updatedDate) {
  const target = parseIso(targetDate)
  const updated = parseIso(updatedDate)
  if (!target || !updated) return 0
  const diff = Math.round((updated - target) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

function getDelayTone(targetDate, updatedDate) {
  const delayDays = getDelayDays(targetDate, updatedDate)
  if (delayDays > 14) return 'late'
  if (delayDays > 0) return 'watch'
  return 'ontime'
}

function getProductDelayTone(targetDate, updatedDate) {
  const delayDays = getDelayDays(targetDate, updatedDate)
  if (delayDays > 14) return 'late'
  if (delayDays > 7) return 'watch'
  return 'ontime'
}

function getProductCardTone(entry, targetDate) {
  const receivedQty = Number(entry?.actualQty || 0)
  const tone = getProductDelayTone(targetDate, entry?.updatedDeliveryDate || targetDate)
  if (receivedQty <= 0 && tone === 'ontime') {
    return 'watch'
  }
  return tone
}

function getLaterIsoDate(...values) {
  let latestValue = ''
  let latestTime = -Infinity

  values.forEach((value) => {
    const normalized = String(value || '').slice(0, 10)
    if (!normalized) return
    const parsed = parseIso(normalized)
    if (!parsed) return
    const nextTime = parsed.getTime()
    if (nextTime > latestTime) {
      latestTime = nextTime
      latestValue = normalized
    }
  })

  return latestValue
}

function buildMonthDays(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const totalDays = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: totalDays }, (_, index) => new Date(year, month, index + 1))
}

function sameMonth(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
}

function sameDay(left, right) {
  return sameMonth(left, right) && left.getDate() === right.getDate()
}

function getLineRange(item, monthDate) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const start = parseIso(item.startDate)
  const end = parseIso(item.completionDate || item.updatedDate || item.targetDate)
  if (!start || !end) return null

  const visibleStart = start < monthStart ? monthStart : start
  const visibleEnd = end > monthEnd ? monthEnd : end
  if (visibleEnd < monthStart || visibleStart > monthEnd) return null

  const totalDays = monthEnd.getDate()
  const startOffset = visibleStart.getDate() - 1
  const spanDays = visibleEnd.getDate() - visibleStart.getDate() + 1

  return {
    left: `${(startOffset / totalDays) * 100}%`,
    width: `${Math.max((spanDays / totalDays) * 100, 4)}%`,
  }
}

function normalizePoRow(row) {
  const poId = String(row?.po_id || '').trim().toUpperCase()
  const supplier = String(row?.supplier_name || '').trim().toUpperCase()
  const method = String(row?.method || 'FOB').trim().toUpperCase()
  const notes = String(row?.notes || '').trim()
  const startDate = String(row?.created_at || '').slice(0, 10)
  const targetDate = String(row?.request_delivery_date || '').slice(0, 10)
  const status = normalizeBoardStatus(row?.status)

  return {
    id: String(row?.id || poId).trim(),
    poId,
    supplier,
    method,
    status,
    startDate,
    targetDate,
    updatedDate: '',
    displayDate: targetDate,
    completionDate: '',
    notes,
    subtitle: notes,
    productNames: [],
    productEntries: [],
    totalQty: 0,
    payments: [],
  }
}

async function loadSnapshotRows() {
  const [
    { data: poData, error: poError },
    { data: itemData, error: itemError },
    { data: receiptData, error: receiptError },
    { data: sizeData, error: sizeError },
  ] = await Promise.all([
    supabase
      .from('arkline_pos')
      .select('id, po_id, supplier_name, method, status, request_delivery_date, notes, created_at, updated_at')
      .not('po_id', 'is', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('arkline_po_items')
      .select('id, po_id, sku_induk, nama_produk, total_qty, actual_qty, price, hpp, updated_delivery_date, notes, status'),
    supabase.from('arkline_po_item_receipts').select('arkline_po_item_id, received_qty'),
    supabase.from('arkline_po_item_sizes').select('arkline_po_item_id, size, qty'),
  ])

  if (poError) {
    throw new Error(poError.message)
  }

  if (itemError) {
    throw new Error(itemError.message)
  }

  if (receiptError) {
    throw new Error(receiptError.message)
  }

  if (sizeError) {
    throw new Error(sizeError.message)
  }

  const receiptQtyByItemId = (receiptData || []).reduce((accumulator, row) => {
    const key = String(row?.arkline_po_item_id || '').trim()
    if (!key) return accumulator
    accumulator[key] = (accumulator[key] || 0) + Number(row?.received_qty || 0)
    return accumulator
  }, {})

  const sizeRowsByItemId = (sizeData || []).reduce((accumulator, row) => {
    const key = String(row?.arkline_po_item_id || '').trim()
    if (!key) return accumulator
    if (!accumulator[key]) accumulator[key] = []
    accumulator[key].push({
      size: String(row?.size || '').trim().toUpperCase(),
      qty: Number(row?.qty || 0),
    })
    return accumulator
  }, {})

  const itemSummaryByPoId = (itemData || []).reduce((accumulator, row) => {
    const poId = String(row?.po_id || '').trim().toUpperCase()
    if (!poId) return accumulator

    const productName = String(row?.nama_produk || '').trim().toUpperCase()
    const productSku = String(row?.sku_induk || '').trim().toUpperCase()
    const totalQty = Number(row?.total_qty || 0)
    const actualQty = Number(receiptQtyByItemId[String(row?.id || '').trim()] ?? row?.actual_qty ?? 0)
    const updatedDeliveryDate = String(row?.updated_delivery_date || '').slice(0, 10)
    const price = Number(row?.price || 0)
    const hpp = Number(row?.hpp || 0)
    const itemStatus = normalizeBoardStatus(row?.status)
    const itemNotes = String(row?.notes || '').trim()
    const itemId = String(row?.id || '').trim()
    const sizeBreakdown = ((sizeRowsByItemId[itemId] || []).length ? sizeRowsByItemId[itemId] : [])
      .sort((left, right) => {
        const leftIndex = RECEIPT_SIZE_ORDER.indexOf(left.size)
        const rightIndex = RECEIPT_SIZE_ORDER.indexOf(right.size)
        if (leftIndex === -1 && rightIndex === -1) return left.size.localeCompare(right.size)
        if (leftIndex === -1) return 1
        if (rightIndex === -1) return -1
        return leftIndex - rightIndex
      })

    if (!accumulator[poId]) {
      accumulator[poId] = {
        productNames: [],
        productEntries: [],
        totalQty: 0,
        latestUpdatedDeliveryDate: '',
      }
    }

    if (productName && !accumulator[poId].productNames.includes(productName)) {
      accumulator[poId].productNames.push(productName)
    }

    accumulator[poId].productEntries.push({
      id: String(row?.id || `${poId}::${productName || 'NO PRODUCT'}::${accumulator[poId].productEntries.length}`),
      sku: productSku || 'NO SKU',
      productName: productName || 'NO PRODUCT',
      qty: Number.isFinite(totalQty) ? totalQty : 0,
      actualQty: Number.isFinite(actualQty) ? actualQty : 0,
      price: Number.isFinite(price) ? price : 0,
      hpp: Number.isFinite(hpp) ? hpp : 0,
      updatedDeliveryDate,
      status: itemStatus,
      notes: itemNotes,
      sizeBreakdown,
    })

    accumulator[poId].totalQty += Number.isFinite(totalQty) ? totalQty : 0
    accumulator[poId].latestUpdatedDeliveryDate = getLaterIsoDate(accumulator[poId].latestUpdatedDeliveryDate, updatedDeliveryDate)
    return accumulator
  }, {})

  return (poData || [])
    .map((row) => {
      const normalized = normalizePoRow(row)
      const summary = itemSummaryByPoId[normalized.poId]
      const latestUpdatedDeliveryDate = summary?.latestUpdatedDeliveryDate || ''
      const actualDate = getLaterIsoDate(normalized.targetDate, latestUpdatedDeliveryDate)
      return {
        ...normalized,
        productNames: summary?.productNames || [],
        productEntries: (summary?.productEntries || []).map((entry) => ({
          ...entry,
          targetDate: normalized.targetDate,
          displayDate: getLaterIsoDate(normalized.targetDate, entry.updatedDeliveryDate),
        })),
        totalQty: summary?.totalQty || 0,
        updatedDate: actualDate,
        displayDate: actualDate || normalized.targetDate || normalized.startDate,
        completionDate: normalized.status === 'Completed' ? actualDate : '',
        latestUpdatedDeliveryDate,
      }
    })
    .filter((item) => item.poId)
}

async function loadUpdateReasons() {
  const { data, error } = await supabase
    .from('arkline_po_update_reasons')
    .select('id, reason_name, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('reason_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

function getStatusSymbol(status) {
  if (status === 'Completed') return '●'
  if (status === 'On Progress') return '◐'
  return '○'
}

function getPoSortNumber(poId) {
  const match = String(poId || '').trim().toUpperCase().match(/^PO-(\d+)-/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function comparePoItems(left, right) {
  const leftNumber = getPoSortNumber(left?.poId)
  const rightNumber = getPoSortNumber(right?.poId)
  if (leftNumber !== rightNumber) return leftNumber - rightNumber
  return String(left?.poId || '').localeCompare(String(right?.poId || ''), undefined, { numeric: true })
}

function formatNumber(value) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat('en-US').format(numeric)
}

function formatDateLabel(value) {
  const parsed = parseIso(value)
  if (!parsed) return '-'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function formatDateTimeLabel(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function buildIncomingGoodsGroups(receipts) {
  const grouped = new Map()

  ;(receipts || []).forEach((row) => {
    const fallbackKey = [
      String(row?.receive_date || ''),
      String(row?.notes || ''),
      String(row?.created_by || ''),
      String(row?.created_at || ''),
    ].join('::')
    const groupKey = String(row?.receipt_group_id || fallbackKey || row?.id || '').trim()
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        id: groupKey,
        receiptGroupId: row?.receipt_group_id || null,
        receiveDate: row?.receive_date || '',
        notes: row?.notes || '',
        createdBy: row?.created_by || '',
        createdAt: row?.created_at || '',
        isFinal: Boolean(row?.is_final),
        totalQty: 0,
        rows: [],
      })
    }

    const target = grouped.get(groupKey)
    target.totalQty += Number(row?.received_qty || 0)
    target.isFinal = target.isFinal || Boolean(row?.is_final)
    target.rows.push({
      id: row?.id,
      size: row?.size || '-',
      qty: Number(row?.received_qty || 0),
    })
  })

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      rows: group.rows.sort((left, right) => RECEIPT_SIZE_ORDER.indexOf(left.size) - RECEIPT_SIZE_ORDER.indexOf(right.size)),
    }))
    .sort((left, right) => {
      const leftTime = new Date(left.receiveDate || left.createdAt || 0).getTime()
      const rightTime = new Date(right.receiveDate || right.createdAt || 0).getTime()
      return leftTime - rightTime
    })
}

function formatIncomingGoodsGroupSizes(rows) {
  return (rows || [])
    .map((row) => `${row.size}: ${formatNumber(row.qty)}`)
    .join(', ')
}

function formatSizeSummary(rows) {
  if (!(rows || []).length) {
    return '-'
  }

  return rows.map((row) => `${row.size}: ${formatNumber(row.qty)}`).join(' • ')
}

function buildIncomingGoodsSizeSummary(receipts) {
  const totals = (receipts || []).reduce((accumulator, row) => {
    const size = String(row?.size || '').trim().toUpperCase()
    if (!size) return accumulator
    accumulator[size] = (accumulator[size] || 0) + Number(row?.received_qty || 0)
    return accumulator
  }, {})

  return [
    ...RECEIPT_SIZE_ORDER.filter((size) => Object.prototype.hasOwnProperty.call(totals, size)),
    ...Object.keys(totals).filter((size) => !RECEIPT_SIZE_ORDER.includes(size)).sort(),
  ].map((size) => ({
    size,
    qty: totals[size] || 0,
  }))
}

function getUpdateImpactDays(requestDeliveryDate, updatedDeliveryDate) {
  return getDelayDays(requestDeliveryDate, updatedDeliveryDate)
}

function getUpdateShiftDays(previousUpdatedDeliveryDate, updatedDeliveryDate) {
  const previous = parseIso(previousUpdatedDeliveryDate)
  const next = parseIso(updatedDeliveryDate)
  if (!previous || !next) return 0
  return Math.round((next - previous) / (1000 * 60 * 60 * 24))
}

function formatSignedDays(value) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric) || numeric === 0) return '0 day(s)'
  return `${numeric > 0 ? '+' : ''}${numeric} day(s)`
}

function getResolvedUpdateReason(updateDraft) {
  if ((updateDraft.reason || '') === OTHERS_UPDATE_REASON) {
    return String(updateDraft.customReason || '').trim().toUpperCase()
  }
  return String(updateDraft.reason || '').trim()
}

function buildUpdateStatusSummary(updates, requestDeliveryDate) {
  const rows = updates || []
  const latest = rows[0] || null
  const totalImpact = latest?.updated_delivery_date ? getUpdateImpactDays(requestDeliveryDate, latest.updated_delivery_date) : 0
  return {
    latestUpdatedDeliveryDate: latest?.updated_delivery_date || '',
    latestReason: latest?.reason || '-',
    lastUpdatedBy: latest?.created_by || '-',
    totalImpact,
    totalUpdates: rows.length,
  }
}

function getShipmentVariance(entry) {
  const orderedQty = Number(entry?.qty || 0)
  const receivedQty = Number(entry?.actualQty || 0)
  if (orderedQty <= 0) {
    return { label: 'Shortship', value: '0%' }
  }

  const deltaPct = Math.abs(((receivedQty - orderedQty) / orderedQty) * 100)
  if (receivedQty > orderedQty) {
    return { label: 'Overship', value: `${deltaPct.toFixed(1)}%` }
  }
  return { label: 'Shortship', value: `${deltaPct.toFixed(1)}%` }
}

function buildPoProductGroups(entries) {
  const completed = []
  const active = []

  ;(entries || []).forEach((entry) => {
    if (String(entry?.status || '').trim() === 'Completed') {
      completed.push(entry)
    } else {
      active.push(entry)
    }
  })

  return [
    { key: 'active', title: 'Not Completed', items: active },
    { key: 'completed', title: 'Completed', items: completed },
  ]
}

async function loadOptionalRows(queryFactory) {
  try {
    const { data, error } = await queryFactory()
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

export default function ArklineProgressOverviewPage() {
  const [view, setView] = useState('kanban')
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [lastRefresh, setLastRefresh] = useState(() => new Date())
  const [productFilter, setProductFilter] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [poRows, setPoRows] = useState([])
  const [updateReasons, setUpdateReasons] = useState([])
  const [selectedPoDetail, setSelectedPoDetail] = useState(null)
  const [poDetailSections, setPoDetailSections] = useState({
    productLists: false,
    finance: false,
  })
  const [selectedProductDetail, setSelectedProductDetail] = useState(null)
  const [productDetailLoading, setProductDetailLoading] = useState(false)
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [productDetailSections, setProductDetailSections] = useState({
    receivingHistory: false,
    updateStatus: false,
    finance: false,
    qcSampleReport: false,
  })
  const [productActionMessage, setProductActionMessage] = useState('')
  const [productActionError, setProductActionError] = useState('')
  const [receiptDraft, setReceiptDraft] = useState({ receiveDate: '', notes: '', sizeQty: {}, isFinal: false, hpp: '' })
  const [statusDraft, setStatusDraft] = useState({
    updatedDeliveryDate: '',
    reason: DEFAULT_UPDATE_REASON,
    customReason: '',
    notes: '',
  })

  useEffect(() => {
    void refreshRows()
  }, [])

  async function refreshRows() {
    setLoading(true)
    setLoadError('')

    try {
      const [rows, reasons] = await Promise.all([loadSnapshotRows(), loadUpdateReasons()])
      setPoRows(rows)
      setUpdateReasons(reasons)
      setLastRefresh(new Date())
    } catch (error) {
      setLoadError(error.message || 'Failed to load Arkline progress snapshot.')
    } finally {
      setLoading(false)
    }
  }

  const monthDays = useMemo(() => buildMonthDays(monthDate), [monthDate])

  const filteredRows = useMemo(() => {
    const keyword = productFilter.trim().toUpperCase()
    return poRows.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [
          item.poId,
          item.supplier,
          item.method,
          item.status,
          item.notes,
          ...(item.productNames || []),
          ...((item.productEntries || []).flatMap((entry) => [entry?.productName, entry?.sku])),
        ]
          .join(' ')
          .toUpperCase()
          .includes(keyword)
      return matchesKeyword
    })
  }, [poRows, productFilter])

  const productItemsInMonth = useMemo(
    () =>
      filteredRows.filter((item) => {
        if (item.status === 'Completed') {
          return false
        }
        const display = parseIso(item.displayDate || item.updatedDate || item.targetDate)
        const created = parseIso(item.startDate)
        return (display && sameMonth(display, monthDate)) || (created && sameMonth(created, monthDate))
      }),
    [filteredRows, monthDate]
  )
  const calendarItemsInMonth = useMemo(
    () =>
      filteredRows.flatMap((item) => {
        if (item.status === 'Completed') {
          return []
        }

        const entries = (item.productEntries || []).length
          ? item.productEntries
          : [
              {
                id: `${item.id}::fallback`,
                productName: item.productNames?.[0] || 'NO PRODUCT',
                qty: item.totalQty || 0,
                displayDate: item.displayDate || item.updatedDate || item.targetDate,
                status: item.status,
              },
            ]

        return entries.filter((entry) => {
          if (entry.status === 'Completed') {
            return false
          }
          const display = parseIso(entry.displayDate)
          return Boolean(display && sameMonth(display, monthDate))
        }).map((entry) => ({
          id: entry.id,
          poId: item.poId,
          supplier: item.supplier,
          productName: entry.productName,
          qty: entry.qty,
          displayDate: entry.displayDate,
          targetDate: item.targetDate,
          updatedDate: entry.displayDate,
        }))
      }),
    [filteredRows, monthDate]
  )

  const boardItemsByStatus = useMemo(
    () =>
      BOARD_STATUSES.reduce((accumulator, status) => {
        accumulator[status] = filteredRows.filter((item) => item.status === status).sort(comparePoItems)
        return accumulator
      }, {}),
    [filteredRows]
  )

  const openProductSnapshot = useMemo(() => {
    const keyword = productFilter.trim().toUpperCase()
    const openEntries = filteredRows.flatMap((item) =>
      (item.productEntries || [])
        .filter((entry) => {
          if (String(entry?.status || '').trim() === 'Completed') {
            return false
          }
          if (!keyword) {
            return true
          }

          const matchesPoLevel = [item.poId, item.supplier, item.method, item.status, item.notes]
            .join(' ')
            .toUpperCase()
            .includes(keyword)

          if (matchesPoLevel) {
            return true
          }

          return [entry?.productName, entry?.sku].join(' ').toUpperCase().includes(keyword)
        })
        .map((entry) => ({
          ...entry,
          poId: item.poId,
          supplier: item.supplier,
          method: item.method,
          targetDate: item.targetDate,
        }))
    )

    const grouped = openEntries.reduce((accumulator, entry) => {
      const key = [String(entry?.sku || '').trim().toUpperCase(), String(entry?.productName || '').trim().toUpperCase()].join('::')
      if (!accumulator[key]) {
        accumulator[key] = {
          key,
          sku: entry.sku || 'NO SKU',
          productName: entry.productName || 'NO PRODUCT',
          totalQty: 0,
          poIds: [],
          sizeTotals: {},
          rows: [],
        }
      }

      accumulator[key].totalQty += Number(entry?.qty || 0)
      if (entry.poId && !accumulator[key].poIds.includes(entry.poId)) {
        accumulator[key].poIds.push(entry.poId)
      }
      ;(entry.sizeBreakdown || []).forEach((row) => {
        const size = String(row?.size || '').trim().toUpperCase()
        if (!size) return
        accumulator[key].sizeTotals[size] = (accumulator[key].sizeTotals[size] || 0) + Number(row?.qty || 0)
      })
      accumulator[key].rows.push(entry)
      return accumulator
    }, {})

    const products = Object.values(grouped)
      .map((group) => {
        const sizeSummary = [
          ...RECEIPT_SIZE_ORDER.filter((size) => Object.prototype.hasOwnProperty.call(group.sizeTotals, size)),
          ...Object.keys(group.sizeTotals).filter((size) => !RECEIPT_SIZE_ORDER.includes(size)).sort(),
        ].map((size) => ({
          size,
          qty: group.sizeTotals[size] || 0,
        }))

        return {
          ...group,
          poCount: group.poIds.length,
          sizeSummary,
        }
      })
      .sort((left, right) => {
        if (right.totalQty !== left.totalQty) return right.totalQty - left.totalQty
        return String(left.productName || '').localeCompare(String(right.productName || ''))
      })

    return {
      products,
      totalProducts: products.length,
      totalQty: products.reduce((sum, product) => sum + Number(product.totalQty || 0), 0),
      totalOpenPo: new Set(openEntries.map((entry) => entry.poId).filter(Boolean)).size,
    }
  }, [filteredRows, productFilter])

  const availableUpdateReasons = useMemo(() => {
    if (updateReasons.length) return updateReasons
    return [
      { id: 'fabric-issue', reason_name: DEFAULT_UPDATE_REASON },
      { id: 'printing-issue', reason_name: 'PRINTING ISSUE' },
      { id: 'internal-review-revision', reason_name: 'INTERNAL REVIEW & REVISION' },
      { id: 'garment-quality-issue', reason_name: 'GARMENT QUALITY ISSUE' },
      { id: 'supplier-issue', reason_name: 'SUPPLIER ISSUE' },
      { id: 'others', reason_name: OTHERS_UPDATE_REASON },
    ]
  }, [updateReasons])

  function handleClearFilters() {
    setProductFilter('')
    setMessage(`Refreshed at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`)
  }

  async function handleRefresh() {
    await refreshRows()
    setMessage(`Refreshed at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`)
  }

  function closePoDetail() {
    setSelectedPoDetail(null)
    setSelectedProductDetail(null)
    setDeliveryModalOpen(false)
    setStatusModalOpen(false)
    setProductActionMessage('')
    setProductActionError('')
  }

  function toggleProductDetailSection(sectionKey) {
    setProductDetailSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  async function openPoDetail(item) {
    setSelectedPoDetail({
      ...item,
      payments: [],
    })
    setPoDetailSections({
      productLists: false,
      finance: false,
    })
    setSelectedProductDetail(null)

    const paymentRows = await loadOptionalRows(() =>
      supabase
        .from('arkline_po_payments')
        .select('id, payment_date, payment_type, amount, notes')
        .eq('po_id', item.poId)
        .order('payment_date', { ascending: false })
    )

    setSelectedPoDetail((prev) => {
      if (!prev || String(prev.id) !== String(item.id)) return prev
      return {
        ...prev,
        payments: paymentRows,
      }
    })
  }

  function togglePoDetailSection(sectionKey) {
    setPoDetailSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  async function openProductDetail(entry) {
    if (!selectedPoDetail || !entry) return
    setProductDetailLoading(true)
    setProductActionMessage('')
    setProductActionError('')
    setProductDetailSections({
      receivingHistory: false,
      updateStatus: false,
      finance: false,
      qcSampleReport: false,
    })
    setSelectedProductDetail({
      ...entry,
      poId: selectedPoDetail.poId,
      supplier: selectedPoDetail.supplier,
      method: selectedPoDetail.method,
      requestDeliveryDate: selectedPoDetail.targetDate,
      actualSnapshotDate: entry.updatedDeliveryDate || selectedPoDetail.updatedDate || selectedPoDetail.targetDate,
      poNotes: selectedPoDetail.notes || '',
      receipts: [],
      updates: [],
      payments: [],
      qcRows: [],
      financeSummary: null,
      sizeBreakdown: [],
    })
    setReceiptDraft({ receiveDate: '', notes: '', sizeQty: {}, isFinal: false, hpp: '' })
    setStatusDraft({
      updatedDeliveryDate: entry.updatedDeliveryDate || '',
      reason: DEFAULT_UPDATE_REASON,
      customReason: '',
      notes: '',
    })
    try {
      const [itemRows, sizeRows, receiptRows, updateRows, paymentRows, qcRows] = await Promise.all([
        loadOptionalRows(() =>
          supabase
            .from('arkline_po_items')
            .select('id, sku_induk, nama_produk, total_qty, actual_qty, allowance_pct, price, hpp, notes, status, updated_delivery_date, completion_date')
            .eq('id', entry.id)
            .limit(1)
        ),
        loadOptionalRows(() =>
          supabase
            .from('arkline_po_item_sizes')
            .select('id, size, qty')
            .eq('arkline_po_item_id', entry.id)
        ),
        loadOptionalRows(() =>
          supabase
            .from('arkline_po_item_receipts')
            .select('id, receipt_group_id, size, received_qty, receive_date, is_final, notes, created_by, created_at')
            .eq('arkline_po_item_id', entry.id)
            .order('receive_date', { ascending: false })
        ),
        loadOptionalRows(() =>
          supabase
            .from('arkline_po_item_updates')
            .select(
              'id, arkline_po_item_id, po_id, sku_induk, previous_updated_delivery_date, updated_delivery_date, reason, notes, impact_days, created_by, created_at, updated_at'
            )
            .eq('arkline_po_item_id', entry.id)
            .order('created_at', { ascending: false })
        ),
        loadOptionalRows(() =>
          supabase
            .from('arkline_po_payments')
            .select('id, payment_date, payment_type, amount, notes')
            .eq('po_id', selectedPoDetail.poId)
            .order('payment_date', { ascending: false })
        ),
        loadOptionalRows(() =>
          supabase
            .from('arkline_qc')
            .select('id, assigned_to, allocated_qty, qty_a, qty_b, qty_c, model_name, status, started_at, finished_at, updated_at')
            .eq('po_id', selectedPoDetail.poId)
            .or(`arkline_po_item_id.eq.${entry.id},sku_induk.eq.${entry.sku}`)
            .order('updated_at', { ascending: false })
        ),
      ])

      const itemDetail = itemRows[0] || null
      const price = Number(itemDetail?.price || entry.price || 0)
      const hpp = Number(itemDetail?.hpp || 0)
      const plannedQty = Number(itemDetail?.total_qty || entry.qty || 0)
      const actualQty = Number(itemDetail?.actual_qty || 0)
      const totalReceived = receiptRows.reduce((sum, row) => sum + Number(row?.received_qty || 0), 0)
      const receivedBySize = receiptRows.reduce((accumulator, row) => {
        const sizeKey = String(row?.size || '').trim().toUpperCase()
        if (!sizeKey) return accumulator
        accumulator[sizeKey] = (accumulator[sizeKey] || 0) + Number(row?.received_qty || 0)
        return accumulator
      }, {})
      const orderedSizeMap = sizeRows.reduce((accumulator, row) => {
        const sizeKey = String(row?.size || '').trim().toUpperCase()
        if (!sizeKey) return accumulator
        accumulator[sizeKey] = Number(row?.qty || 0)
        return accumulator
      }, {})
      const sizeKeys = [
        ...RECEIPT_SIZE_ORDER.filter((size) => Object.prototype.hasOwnProperty.call(orderedSizeMap, size)),
        ...Object.keys(orderedSizeMap).filter((size) => !RECEIPT_SIZE_ORDER.includes(size)),
      ]
      const sizeBreakdown = sizeKeys.map((size) => ({
        size,
        orderedQty: Number(orderedSizeMap[size] || 0),
        receivedQty: Number(receivedBySize[size] || 0),
      }))

      setSelectedProductDetail({
        ...entry,
        poId: selectedPoDetail.poId,
        supplier: selectedPoDetail.supplier,
        method: selectedPoDetail.method,
        requestDeliveryDate: selectedPoDetail.targetDate,
        actualSnapshotDate: entry.updatedDeliveryDate || selectedPoDetail.updatedDate || selectedPoDetail.targetDate,
        poNotes: selectedPoDetail.notes || '',
        notes: itemDetail?.notes || entry.notes || '',
        status: itemDetail?.status || entry.status || '',
        price,
        updatedDeliveryDate: itemDetail?.updated_delivery_date || entry.updatedDeliveryDate || '',
        receipts: receiptRows,
        updates: updateRows,
        payments: paymentRows,
        qcRows,
        sizeBreakdown,
        financeSummary: {
          price,
          hpp,
          plannedQty,
          actualQty,
          allowancePct: Number(itemDetail?.allowance_pct || 0),
          plannedValue: (price || hpp) * plannedQty,
          actualValue: hpp * (actualQty || totalReceived),
          paidValue: paymentRows.reduce((sum, row) => sum + Number(row?.amount || 0), 0),
        },
      })
      setStatusDraft({
        updatedDeliveryDate: itemDetail?.updated_delivery_date || entry.updatedDeliveryDate || '',
        reason: DEFAULT_UPDATE_REASON,
        customReason: '',
        notes: '',
      })
      setReceiptDraft({
        receiveDate: '',
        notes: '',
        sizeQty: sizeBreakdown.reduce((accumulator, row) => {
          accumulator[row.size] = ''
          return accumulator
        }, {}),
        isFinal: false,
        hpp: String(hpp || 0),
      })
    } finally {
      setProductDetailLoading(false)
    }
  }

  async function handleSaveReceipt() {
    if (!selectedProductDetail) return
    setProductActionMessage('')
    setProductActionError('')
    const sizeEntries = Object.entries(receiptDraft.sizeQty || {})
      .map(([size, qty]) => ({ size, qty: Number(qty || 0) }))
      .filter((row) => row.qty > 0)

    if (!receiptDraft.receiveDate || !sizeEntries.length) {
      setProductActionError('Isi tanggal receipt dan minimal satu qty size.')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const createdBy = user?.email?.toLowerCase() || null
    const receiptGroupId = crypto.randomUUID()
    const nextHpp = Number(receiptDraft.hpp || 0)

    const insertPayload = sizeEntries.map((row) => ({
      arkline_po_item_id: selectedProductDetail.id,
      po_id: selectedProductDetail.poId,
      sku_induk: selectedProductDetail.sku,
      receipt_group_id: receiptGroupId,
      size: row.size,
      received_qty: row.qty,
      receive_date: receiptDraft.receiveDate,
      is_final: receiptDraft.isFinal,
      notes: receiptDraft.notes.trim() || null,
      created_by: createdBy,
    }))

    const { error } = await supabase.from('arkline_po_item_receipts').insert(insertPayload)

    if (error) {
      setProductActionError(error.message || 'Failed to save receipt.')
      return
    }

    const itemUpdatePayload = {
      hpp: nextHpp,
    }

    if (receiptDraft.isFinal) {
      const totalReceivedAfterSave =
        (selectedProductDetail.receipts || []).reduce((sum, row) => sum + Number(row?.received_qty || 0), 0) +
        sizeEntries.reduce((sum, row) => sum + row.qty, 0)
      Object.assign(itemUpdatePayload, {
        status: 'Completed',
        completion_date: receiptDraft.receiveDate,
        actual_qty: totalReceivedAfterSave,
      })
    }

    const { error: itemUpdateError } = await supabase.from('arkline_po_items').update(itemUpdatePayload).eq('id', selectedProductDetail.id)
    if (itemUpdateError) {
      setProductActionError(itemUpdateError.message || 'Receipt saved, but failed to update HPP/item summary.')
      return
    }

    setProductActionMessage('Receipt berhasil disimpan.')
    setReceiptDraft((prev) => ({
      receiveDate: '',
      notes: '',
      sizeQty: Object.keys(prev.sizeQty || {}).reduce((accumulator, size) => {
        accumulator[size] = ''
        return accumulator
      }, {}),
      isFinal: false,
      hpp: prev.hpp,
    }))
    await openProductDetail(selectedProductDetail)
    await refreshRows()
  }

  async function handleSaveStatusChange() {
    if (!selectedProductDetail) return
    setProductActionMessage('')
    setProductActionError('')
    const resolvedReason = getResolvedUpdateReason(statusDraft)
    if (!statusDraft.updatedDeliveryDate) {
      setProductActionError('Isi updated delivery date dulu.')
      return
    }
    if (!resolvedReason) {
      setProductActionError('Pilih atau isi reason update dulu.')
      return
    }
    if (!statusDraft.notes.trim()) {
      setProductActionError('Isi notes alasan update dulu.')
      return
    }

    const currentUpdatedDate = selectedProductDetail.updatedDeliveryDate || ''
    const impactDays = getUpdateImpactDays(selectedProductDetail.requestDeliveryDate, statusDraft.updatedDeliveryDate)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const createdBy = user?.email?.toLowerCase() || null

    if (statusDraft.reason === OTHERS_UPDATE_REASON) {
      const normalizedCustomReason = resolvedReason.toUpperCase()
      const { error: reasonInsertError } = await supabase.from('arkline_po_update_reasons').upsert(
        [
          {
            reason_name: normalizedCustomReason,
            sort_order: 998,
            is_active: true,
          },
        ],
        { onConflict: 'reason_name' }
      )

      if (reasonInsertError) {
        setProductActionError(reasonInsertError.message || 'Failed to save custom reason.')
        return
      }
    }

    const itemPayload = {
      updated_delivery_date: statusDraft.updatedDeliveryDate || null,
      notes: statusDraft.notes.trim(),
    }

    const { error: updateError } = await supabase
      .from('arkline_po_items')
      .update(itemPayload)
      .eq('id', selectedProductDetail.id)

    if (updateError) {
      setProductActionError(updateError.message || 'Failed to update delivery.')
      return
    }

    const { error: insertUpdateError } = await supabase.from('arkline_po_item_updates').insert([
      {
        arkline_po_item_id: selectedProductDetail.id,
        po_id: selectedProductDetail.poId,
        sku_induk: selectedProductDetail.sku,
        previous_updated_delivery_date: currentUpdatedDate || null,
        updated_delivery_date: statusDraft.updatedDeliveryDate || null,
        reason: resolvedReason,
        notes: statusDraft.notes.trim(),
        impact_days: impactDays,
        created_by: createdBy,
      },
    ])

    if (insertUpdateError) {
      setProductActionError(insertUpdateError.message || 'Delivery updated, but failed to save monitoring log.')
      return
    }

    setProductActionMessage('Update delivery berhasil disimpan.')
    setStatusDraft({
      updatedDeliveryDate: statusDraft.updatedDeliveryDate,
      reason: availableUpdateReasons[0]?.reason_name || DEFAULT_UPDATE_REASON,
      customReason: '',
      notes: '',
    })
    await openProductDetail({ ...selectedProductDetail, updatedDeliveryDate: statusDraft.updatedDeliveryDate })
    await refreshRows()
  }

  function openDeliveryModal() {
    setDeliveryModalOpen(true)
    setStatusModalOpen(false)
    setProductActionMessage('')
    setProductActionError('')
  }

  function openStatusModal() {
    setStatusModalOpen(true)
    setDeliveryModalOpen(false)
    setProductActionMessage('')
    setProductActionError('')
    setStatusDraft((prev) => ({
      ...prev,
      reason: prev.reason || availableUpdateReasons[0]?.reason_name || DEFAULT_UPDATE_REASON,
    }))
  }

  return (
    <div className={`${shellStyles.page} ${styles.page}`.trim()}>
      <section className={view === 'kanban' ? styles.scheduleShell : styles.timelineShell}>
        <div className={styles.scheduleHeader}>
          <div className={styles.scheduleTitleWrap}>
            <div>
              <p className={styles.eyebrow}>Arkline</p>
              <h2 className={styles.scheduleTitle}>Progress Snapshot</h2>
            </div>
            <div className={styles.segmented}>
              <button
                type="button"
                aria-label="Kanban view"
                data-view-label="Kanban View"
                className={`${styles.segmentButton} ${view === 'kanban' ? styles.segmentButtonActive : ''}`.trim()}
                onClick={() => setView('kanban')}
              >
                <KanbanIcon />
              </button>
              <button
                type="button"
                aria-label="Calendar view"
                data-view-label="Calendar View"
                className={`${styles.segmentButton} ${view === 'calendar' ? styles.segmentButtonActive : ''}`.trim()}
                onClick={() => setView('calendar')}
              >
                <CalendarIcon />
              </button>
              <button
                type="button"
                aria-label="Product snapshot view"
                data-view-label="Product Snapshot"
                className={`${styles.segmentButton} ${view === 'products' ? styles.segmentButtonActive : ''}`.trim()}
                onClick={() => setView('products')}
              >
                <ProductListIcon />
              </button>
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.filterCluster}>
              <div className={styles.filterField}>
                <span>Product / PO</span>
                <input
                  className={styles.input}
                  value={productFilter}
                  onChange={(event) => setProductFilter(event.target.value.toUpperCase())}
                  placeholder="Type PO / supplier / notes"
                />
              </div>
              <div className={styles.scheduleActions}>
                <button type="button" className={styles.secondaryButton} onClick={handleClearFilters}>
                  Clear
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => void handleRefresh()} disabled={loading}>
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              <div className={styles.messageText}>
                {loadError || message || `Refreshed at ${lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className={styles.emptyColumn}>Loading progress snapshot...</div>
        ) : view === 'kanban' ? (
          <div className={styles.boardGrid}>
            {BOARD_STATUSES.map((status) => (
              <section key={status} className={`${styles.boardColumn} ${styles[`boardColumn${getStatusKey(status)}`]}`.trim()}>
                <div className={styles.boardColumnHead}>
                  <div className={styles.boardColumnTitleWrap}>
                    <span className={styles.boardColumnDot}>{getStatusSymbol(status)}</span>
                    <h3>{status}</h3>
                  </div>
                  <span>{boardItemsByStatus[status]?.length || 0}</span>
                </div>
                <div className={styles.boardDropzone}>
                  {(boardItemsByStatus[status] || []).length ? (
                    boardItemsByStatus[status].map((item) => {
                      const tone = getDelayTone(item.targetDate, item.updatedDate)
                      return (
                        <article
                          key={item.id}
                          className={styles.boardCard}
                          role="button"
                          tabIndex={0}
                          onClick={() => openPoDetail(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openPoDetail(item)
                            }
                          }}
                        >
                          <div className={styles.boardCardTop}>
                            <div className={styles.boardCardIdentity}>
                              <strong className={styles.poLinkButton}>{item.poId}</strong>
                              <span className={styles.boardSupplierLine}>{item.supplier || '-'}</span>
                            </div>
                            <span className={styles.boardMethod}>{item.method}</span>
                          </div>
                          <div className={styles.boardProductSummary}>
                            <p className={styles.boardProductLine}>
                              {item.productNames?.length ? item.productNames.slice(0, 3).join(' / ') : 'NO PRODUCT'}
                            </p>
                            {item.productNames?.length > 3 ? <p className={styles.boardProductExtra}>+{item.productNames.length - 3} more products</p> : null}
                          </div>
                          <div className={styles.boardFooter}>
                            <span className={styles.boardQty}>Qty {item.totalQty || 0}</span>
                            <span className={styles.boardQty}>
                              Actual {item.updatedDate || item.targetDate || '-'}
                            </span>
                          </div>
                        </article>
                      )
                    })
                  ) : (
                    <div className={styles.emptyColumn}>No PO in this column.</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : view === 'calendar' ? (
          <>
            <div className={styles.legendRow}>
              <div className={styles.legendGroup}>
                <span className={`${styles.legendDot} ${styles.legendOnTime}`.trim()} />
                <span>On time</span>
              </div>
              <div className={styles.legendGroup}>
                <span className={`${styles.legendDot} ${styles.legendWatch}`.trim()} />
                <span>Delay 1-14 days</span>
              </div>
              <div className={styles.legendGroup}>
                <span className={`${styles.legendDot} ${styles.legendLate}`.trim()} />
                <span>Delay &gt; 14 days</span>
              </div>
              <div className={styles.legendMeta}>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                >
                  {'<'}
                </button>
                <div className={styles.monthPill}>{formatMonthLabel(monthDate)}</div>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                >
                  {'>'}
                </button>
              </div>
            </div>
            <div className={styles.calendarShell}>
              <div className={styles.calendarGrid}>
                {monthDays.map((day) => {
                  const dayItems = calendarItemsInMonth.filter((item) => {
                    const display = parseIso(item.displayDate || item.updatedDate || item.targetDate)
                    return Boolean(display && sameDay(display, day))
                  })

                  return (
                    <div key={day.toISOString()} className={styles.calendarCell}>
                      <div className={styles.calendarCellHeader}>
                        <span className={styles.calendarWeekday}>{formatDayLabel(day)}</span>
                        <strong>{day.getDate()}</strong>
                      </div>

                      <div className={styles.calendarEvents}>
                        {dayItems.length ? (
                          dayItems.map((item) => {
                            const tone = getDelayTone(item.targetDate, item.updatedDate)
                            return (
                              <article key={item.id} className={`${styles.eventCard} ${styles[`eventCard${tone[0].toUpperCase()}${tone.slice(1)}`]}`.trim()}>
                                <div className={styles.eventTitle}>{item.productName || 'NO PRODUCT'}</div>
                                <p className={styles.eventText}>{item.poId}</p>
                                <p className={styles.eventMetaText}>Qty {item.qty || 0}</p>
                              </article>
                            )
                          })
                        ) : (
                          <div className={styles.emptyMini}>No entries</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        ) : view === 'products' ? (
          <div className={styles.productSnapshotShell}>
            <div className={`${styles.modalGrid} ${styles.compactModalGrid}`.trim()}>
              <div className={styles.modalMetric}>
                <span>Open PO</span>
                <strong>{formatNumber(openProductSnapshot.totalOpenPo)}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Open Products</span>
                <strong>{formatNumber(openProductSnapshot.totalProducts)}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Total Qty</span>
                <strong>{formatNumber(openProductSnapshot.totalQty)}</strong>
              </div>
            </div>

            <div className={styles.productSnapshotList}>
              {openProductSnapshot.products.length ? (
                openProductSnapshot.products.map((product) => (
                  <div key={product.key} className={styles.productSnapshotCard}>
                    <div className={styles.productSnapshotHead}>
                      <div>
                        <strong>{product.productName || 'NO PRODUCT'}</strong>
                        <span>{product.sku || 'NO SKU'}</span>
                      </div>
                      <div className={styles.productSnapshotMeta}>
                        <strong>{formatNumber(product.totalQty)}</strong>
                        <span>{formatNumber(product.poCount)} PO</span>
                      </div>
                    </div>
                    <div className={styles.productSnapshotDetailGrid}>
                      <div className={styles.productSnapshotInlineMeta}>
                        <span>PO List</span>
                        <strong>{product.poIds.join(', ') || '-'}</strong>
                      </div>
                      <div className={styles.productSnapshotSizeCards}>
                        {product.sizeSummary.length ? (
                          product.sizeSummary.map((row) => (
                            <div key={`${product.key}-${row.size}`} className={styles.productSnapshotSizeCard}>
                              <span>{row.size}</span>
                              <strong>{formatNumber(row.qty)}</strong>
                            </div>
                          ))
                        ) : (
                          <div className={styles.productSnapshotSizeCard}>
                            <span>Size</span>
                            <strong>-</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyColumn}>No open products.</div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {selectedPoDetail ? (
        <div className={styles.modalOverlay} onClick={closePoDetail}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>PO Detail</p>
                <h3 className={styles.modalTitle}>{selectedPoDetail.poId}</h3>
                <p className={styles.modalMetaLine}>
                  {selectedPoDetail.supplier || '-'}
                  {selectedPoDetail.method ? ` • ${selectedPoDetail.method}` : ''}
                </p>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={closePoDetail}>
                Close
              </button>
            </div>

            <div className={`${styles.modalGrid} ${styles.compactModalGrid}`.trim()}>
              <div className={styles.modalMetric}>
                <span>Ordered Qty</span>
                <strong>{formatNumber(selectedPoDetail.totalQty || 0)}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Received Qty</span>
                <strong>{formatNumber((selectedPoDetail.productEntries || []).reduce((sum, entry) => sum + Number(entry?.actualQty || 0), 0))}</strong>
              </div>
              <div className={styles.modalMetric}>
                {(() => {
                  const orderedQty = Number(selectedPoDetail.totalQty || 0)
                  const receivedQty = (selectedPoDetail.productEntries || []).reduce((sum, entry) => sum + Number(entry?.actualQty || 0), 0)
                  if (orderedQty <= 0) {
                    return (
                      <>
                        <span>Shortship</span>
                        <strong>0%</strong>
                      </>
                    )
                  }
                  const deltaPct = Math.abs(((receivedQty - orderedQty) / orderedQty) * 100)
                  const label = receivedQty > orderedQty ? 'Overship' : 'Shortship'
                  return (
                    <>
                      <span>{label}</span>
                      <strong>{`${deltaPct.toFixed(1)}%`}</strong>
                    </>
                  )
                })()}
              </div>
            </div>

            <div className={styles.modalSection}>
              <div className={styles.productDetailSectionHead}>
                <h4 className={styles.modalSectionTitle}>Product Lists</h4>
                <button type="button" className={styles.productDetailSectionToggle} onClick={() => togglePoDetailSection('productLists')}>
                  <ChevronIcon expanded={poDetailSections.productLists} />
                </button>
              </div>
              {poDetailSections.productLists ? (
                <div className={styles.modalList}>
                  {(() => {
                    const productGroups = buildPoProductGroups(selectedPoDetail.productEntries || []).filter((group) => group.items.length)
                    if (!productGroups.length) {
                      return <div className={styles.emptyMini}>No product lines.</div>
                    }
                    return productGroups.map((group) => (
                        <div key={group.key} className={`${styles.modalListGroup} ${styles[`modalListGroup${group.key[0].toUpperCase()}${group.key.slice(1)}`]}`.trim()}>
                          <h5 className={styles.modalListGroupTitle}>{group.title}</h5>
                          {group.items.map((entry) => {
                            const variance = getShipmentVariance(entry)
                            return (
                              <button key={entry.id} type="button" className={styles.modalListButton} onClick={() => openProductDetail(entry)}>
                                <div
                                  className={`${styles.modalListRow} ${
                                    styles[`modalListRow${(() => {
                                      const tone = getProductCardTone(entry, selectedPoDetail.targetDate)
                                      return tone[0].toUpperCase() + tone.slice(1)
                                    })()}`]
                                  }`.trim()}
                                >
                                  <div className={styles.modalListIdentity}>
                                    <span>{entry.status || '-'}</span>
                                    <strong>{entry.productName || 'NO PRODUCT'}</strong>
                                    <span>{entry.sku || 'NO SKU'}</span>
                                  </div>
                                  <div className={styles.modalListMeta}>
                                    <div className={styles.modalMetricCard}>
                                      <span>Ordered Qty</span>
                                      <strong>{formatNumber(entry.qty || 0)}</strong>
                                    </div>
                                    <div className={styles.modalMetricCard}>
                                      <span>Received Qty</span>
                                      <strong>{formatNumber(entry.actualQty || 0)}</strong>
                                    </div>
                                    <div className={styles.modalMetricCard}>
                                      <span>{variance.label}</span>
                                      <strong>{variance.value}</strong>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      ))
                  })()}
                </div>
              ) : null}
            </div>

            <div className={styles.modalSection}>
              <div className={styles.productDetailSectionHead}>
                <h4 className={styles.modalSectionTitle}>Finance</h4>
                <button type="button" className={styles.productDetailSectionToggle} onClick={() => togglePoDetailSection('finance')}>
                  <ChevronIcon expanded={poDetailSections.finance} />
                </button>
              </div>
              {poDetailSections.finance ? (
                <>
                  {(() => {
                    const dueValue = (selectedPoDetail.productEntries || []).reduce(
                      (sum, entry) => sum + Number(entry?.qty || 0) * Number(entry?.price || entry?.hpp || 0),
                      0
                    )
                    const paidValue = (selectedPoDetail.payments || []).reduce((sum, row) => sum + Number(row?.amount || 0), 0)
                    const progressPct = dueValue > 0 ? Math.min((paidValue / dueValue) * 100, 100) : 0
                    let paymentStatus = 'Unpaid'
                    if (paidValue > 0 && paidValue < dueValue) paymentStatus = 'Partial'
                    if (paidValue >= dueValue && dueValue > 0) paymentStatus = 'Paid'

                    return (
                      <>
                        <div className={styles.financeGrid}>
                          <div className={styles.modalMetric}>
                            <span>Seharusnya Dibayar</span>
                            <strong>{formatNumber(dueValue)}</strong>
                          </div>
                          <div className={styles.modalMetric}>
                            <span>Sudah Dibayar</span>
                            <strong>{formatNumber(paidValue)}</strong>
                          </div>
                          <div className={styles.modalMetric}>
                            <span>Progress Payment</span>
                            <strong>{`${progressPct.toFixed(1)}%`}</strong>
                          </div>
                          <div className={styles.modalMetric}>
                            <span>Status Otomatis</span>
                            <strong>{paymentStatus}</strong>
                          </div>
                        </div>
                        <div className={styles.productDetailRows}>
                          {(selectedPoDetail.payments || []).length ? (
                            selectedPoDetail.payments.map((row) => (
                              <div key={row.id} className={styles.productDetailRow}>
                                <div>
                                  <strong>{row.payment_type || 'Payment'}</strong>
                                  <span>{formatDateLabel(row.payment_date)}</span>
                                </div>
                                <div className={styles.productDetailRowMeta}>
                                  <strong>{formatNumber(row.amount)}</strong>
                                  <span>{row.notes || '-'}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className={styles.emptyMini}>No payment rows.</div>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedProductDetail ? (
        <div className={styles.modalOverlay} onClick={() => setSelectedProductDetail(null)}>
          <div className={`${styles.modalCard} ${styles.productModalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Product Detail</p>
                <h3 className={styles.modalTitle}>{selectedProductDetail.productName || 'NO PRODUCT'}</h3>
                <p className={styles.productDetailSubmeta}>HPP {formatNumber(selectedProductDetail.financeSummary?.hpp || 0)}</p>
              </div>
              <div className={styles.productHeaderActions}>
                <button type="button" className={styles.iconButton} onClick={() => setSelectedProductDetail(null)} aria-label="Close product detail">
                  <CloseIcon />
                </button>
              </div>
            </div>

            {productDetailLoading ? <div className={styles.emptyMini}>Loading product detail...</div> : null}

            {(() => {
              const incomingGoodsGroups = buildIncomingGoodsGroups(selectedProductDetail.receipts || [])
              const incomingGoodsSizeSummary = buildIncomingGoodsSizeSummary(selectedProductDetail.receipts || [])
              return (
            <div className={styles.productDetailStack}>
              <div className={styles.productDetailSection}>
                <div className={styles.productDetailSectionHead}>
                  <div className={styles.productSectionHeadLeft}>
                    <h4 className={styles.modalSectionTitle}>Update Delivery</h4>
                    <button type="button" className={styles.productSectionLaunch} onClick={openStatusModal} aria-label="Open update status input">
                      <PlusIcon />
                    </button>
                  </div>
                  <button type="button" className={styles.productDetailSectionToggle} onClick={() => toggleProductDetailSection('updateStatus')}>
                    <span className={styles.productDetailHint}>{selectedProductDetail.updatedDeliveryDate || selectedProductDetail.status || '-'}</span>
                    <ChevronIcon expanded={productDetailSections.updateStatus} />
                  </button>
                </div>
                {productDetailSections.updateStatus ? (
                <div className={styles.productDetailRows}>
                  {(() => {
                    const updateSummary = buildUpdateStatusSummary(selectedProductDetail.updates || [], selectedProductDetail.requestDeliveryDate)
                    return (
                      <>
                        <div className={`${styles.modalGrid} ${styles.compactModalGrid} ${styles.updateDeliverySummaryGrid}`.trim()}>
                          <div className={styles.modalMetric}>
                            <span>Latest Updated Delivery Date</span>
                            <strong>{formatDateLabel(updateSummary.latestUpdatedDeliveryDate)}</strong>
                          </div>
                          <div className={styles.modalMetric}>
                            <span>Latest Reason</span>
                            <strong>{updateSummary.latestReason}</strong>
                          </div>
                          <div className={styles.modalMetric}>
                            <span>Last Updated By</span>
                            <strong>{updateSummary.lastUpdatedBy}</strong>
                          </div>
                          <div className={styles.modalMetric}>
                            <span>Total Impact</span>
                            <strong>{formatNumber(updateSummary.totalImpact)} day(s)</strong>
                          </div>
                          <div className={styles.modalMetric}>
                            <span>Total Updates</span>
                            <strong>{formatNumber(updateSummary.totalUpdates)}</strong>
                          </div>
                        </div>
                        {(selectedProductDetail.updates || []).length ? (
                          selectedProductDetail.updates.map((row) => (
                            <div key={row.id} className={styles.updateTimelineCard}>
                              <div className={styles.updateTimelineHead}>
                                <div>
                                  <strong>{row.reason || '-'}</strong>
                                  <span>{formatDateTimeLabel(row.created_at)}</span>
                                </div>
                                <div className={styles.updateTimelineMeta}>
                                  <strong>{formatSignedDays(getUpdateShiftDays(row.previous_updated_delivery_date, row.updated_delivery_date))}</strong>
                                  <span>{row.created_by || '-'}</span>
                                </div>
                              </div>
                              <div className={styles.updateTimelineBody}>
                                <div className={styles.updateTimelinePill}>
                                  <span>Delivery</span>
                                  <strong>{`${formatDateLabel(row.previous_updated_delivery_date)} -> ${formatDateLabel(row.updated_delivery_date)}`}</strong>
                                </div>
                              </div>
                              <p className={styles.updateTimelineNotes}>{row.notes || '-'}</p>
                            </div>
                          ))
                        ) : (
                          <div className={styles.emptyMini}>No update delivery logs yet.</div>
                        )}
                      </>
                    )
                  })()}
                </div>
                ) : null}
              </div>

              <div className={styles.productDetailSection}>
                <div className={styles.productDetailSectionHead}>
                  <div className={styles.productSectionHeadLeft}>
                    <h4 className={styles.modalSectionTitle}>Receiving History</h4>
                    <button type="button" className={styles.productSectionLaunch} onClick={openDeliveryModal} aria-label="Open incoming goods input">
                      <PlusIcon />
                    </button>
                  </div>
                  <button type="button" className={styles.productDetailSectionToggle} onClick={() => toggleProductDetailSection('receivingHistory')}>
                    <span className={styles.productDetailToggleValue}>
                      <span className={styles.productDetailHint}>
                        Total {formatNumber((selectedProductDetail.receipts || []).reduce((sum, row) => sum + Number(row?.received_qty || 0), 0))}
                      </span>
                      <ChevronIcon expanded={productDetailSections.receivingHistory} />
                    </span>
                  </button>
                </div>
                {productDetailSections.receivingHistory ? (
                  <div className={styles.productDetailRows}>
                    {incomingGoodsGroups.length ? (
                      <>
                        {incomingGoodsSizeSummary.length ? (
                          <div className={styles.receivingHistorySizeSummary}>
                            <span className={styles.receivingHistorySizeSummaryLabel}>Size Summary</span>
                            <div className={styles.receivingHistorySizeSummaryList}>
                              {incomingGoodsSizeSummary.map((row) => (
                                <div key={row.size} className={styles.receivingHistorySizeSummaryChip}>
                                  <strong>{row.size}</strong>
                                  <span>{formatNumber(row.qty)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className={styles.receivingHistoryTableWrap}>
                          <table className={styles.receivingHistoryTable}>
                            <thead>
                              <tr>
                                <th>Receiving Date</th>
                                <th>Size</th>
                                <th>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {incomingGoodsGroups.map((group) => (
                                <tr key={group.id}>
                                  <td>{formatDateLabel(group.receiveDate)}</td>
                                  <td>{formatIncomingGoodsGroupSizes(group.rows)}</td>
                                  <td>{formatNumber(group.totalQty)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className={styles.emptyMini}>No Incoming Goods yet.</div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className={styles.productDetailSection}>
                <div className={styles.productDetailSectionHead}>
                  <h4 className={styles.modalSectionTitle}>QC Sample Report</h4>
                  <button type="button" className={styles.productDetailSectionToggle} onClick={() => toggleProductDetailSection('qcSampleReport')}>
                    <span className={styles.productDetailHint}>{selectedProductDetail.poId || '-'}</span>
                    <ChevronIcon expanded={productDetailSections.qcSampleReport} />
                  </button>
                </div>
                {productDetailSections.qcSampleReport ? (
                <div className={styles.productDetailRows}>
                  {(selectedProductDetail.qcRows || []).length ? (
                    selectedProductDetail.qcRows.map((row) => (
                      <div key={row.id} className={styles.productDetailRow}>
                        <div>
                          <strong>{row.assigned_to || '-'}</strong>
                          <span>{row.model_name || selectedProductDetail.productName || '-'}</span>
                        </div>
                        <div className={styles.productDetailRowMeta}>
                          <strong>
                            A {formatNumber(row.qty_a)} | B {formatNumber(row.qty_b)} | C {formatNumber(row.qty_c)}
                          </strong>
                          <span>
                            {row.status || '-'} | Finished {formatDateTimeLabel(row.finished_at)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyMini}>No QC report rows.</div>
                  )}
                </div>
                ) : null}
              </div>
            </div>
              )
            })()}
          </div>
        </div>
      ) : null}

      {selectedProductDetail && deliveryModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setDeliveryModalOpen(false)}>
          <div className={`${styles.modalCard} ${styles.actionModalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Incoming Goods</p>
                <h3 className={styles.modalTitle}>Incoming Goods - {selectedProductDetail.productName || 'NO PRODUCT'}</h3>
              </div>
              <div className={styles.productHeaderActions}>
                <label className={styles.receiptCheckbox}>
                  <input
                    type="checkbox"
                    checked={receiptDraft.isFinal}
                    onChange={(event) => setReceiptDraft((prev) => ({ ...prev, isFinal: event.target.checked }))}
                  />
                  <span>Last Delivery</span>
                  <span
                    className={styles.infoHint}
                    title="Last Delivery dicheck list ketika qty yang diterima dianggap shortship daripada yang diorder"
                    aria-label="Last Delivery dicheck list ketika qty yang diterima dianggap shortship daripada yang diorder"
                  >
                    <InfoIcon />
                  </span>
                </label>
                <button type="button" className={styles.primaryButton} onClick={() => void handleSaveReceipt()}>
                  Save
                </button>
                <button type="button" className={styles.iconButton} onClick={() => setDeliveryModalOpen(false)} aria-label="Close incoming goods">
                  <CloseIcon />
                </button>
              </div>
            </div>

            {productActionError ? <div className={styles.productActionError}>{productActionError}</div> : null}
            {productActionMessage ? <div className={styles.productActionMessage}>{productActionMessage}</div> : null}

            <div className={styles.deliveryTopGrid}>
              <div className={styles.filterField}>
                <span>Incoming Goods Date</span>
                <input
                  className={styles.input}
                  type="date"
                  value={receiptDraft.receiveDate}
                  onChange={(event) => setReceiptDraft((prev) => ({ ...prev, receiveDate: event.target.value }))}
                />
              </div>
              <div className={styles.filterField}>
                <span>Product</span>
                <div className={styles.readonlyField}>{selectedProductDetail.productName || 'NO PRODUCT'}</div>
              </div>
              <div className={styles.filterField}>
                <span>HPP</span>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={receiptDraft.hpp}
                  onChange={(event) => setReceiptDraft((prev) => ({ ...prev, hpp: event.target.value }))}
                />
              </div>
              <div className={styles.filterField}>
                <span>Incoming Qty</span>
                <div className={styles.readonlyField}>
                  {formatNumber(
                    Object.values(receiptDraft.sizeQty || {}).reduce((sum, qty) => sum + Number(qty || 0), 0)
                  )}
                </div>
              </div>
              <div className={styles.filterField}>
                <span>Total Order</span>
                <div className={styles.readonlyField}>{formatNumber(selectedProductDetail.qty || 0)}</div>
              </div>
              <div className={styles.filterField}>
                <span>Received Goods</span>
                <div className={styles.readonlyField}>
                  {formatNumber((selectedProductDetail.receipts || []).reduce((sum, row) => sum + Number(row?.received_qty || 0), 0))}
                </div>
              </div>
              <div className={styles.filterField}>
                <span>Remaining</span>
                <div className={styles.readonlyField}>
                  {formatNumber(
                    Math.max(
                      Number(selectedProductDetail.qty || 0) -
                        ((selectedProductDetail.receipts || []).reduce((sum, row) => sum + Number(row?.received_qty || 0), 0) +
                          Object.values(receiptDraft.sizeQty || {}).reduce((sum, qty) => sum + Number(qty || 0), 0)),
                      0
                    )
                  )}
                </div>
              </div>
            </div>

            <div className={styles.incomingGoodsSplit}>
              <div className={styles.receiptTableWrap}>
                <table className={styles.receiptTable}>
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Ordered</th>
                      <th>Received</th>
                      <th>Incoming Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedProductDetail.sizeBreakdown || []).length ? (
                      selectedProductDetail.sizeBreakdown.map((row) => (
                        <tr key={row.size}>
                          <td>{row.size}</td>
                          <td>{formatNumber(row.orderedQty)}</td>
                          <td>{formatNumber(row.receivedQty)}</td>
                          <td>
                            <input
                              className={styles.receiptQtyInput}
                              type="number"
                              min="0"
                              value={receiptDraft.sizeQty?.[row.size] || ''}
                              onChange={(event) =>
                                setReceiptDraft((prev) => ({
                                  ...prev,
                                  sizeQty: {
                                    ...(prev.sizeQty || {}),
                                    [row.size]: event.target.value,
                                  },
                                }))
                              }
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className={styles.receiptEmptyCell}>
                          No size breakdown.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.incomingGoodsNotesPane}>
                <label className={styles.filterField}>
                  <span>Notes</span>
                  <textarea
                    className={styles.incomingGoodsNotes}
                    placeholder="Incoming goods notes"
                    value={receiptDraft.notes}
                    onChange={(event) => setReceiptDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedProductDetail && statusModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setStatusModalOpen(false)}>
          <div className={`${styles.modalCard} ${styles.actionModalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Update Delivery</p>
                <h3 className={styles.modalTitle}>Update Delivery - {selectedProductDetail.productName || 'NO PRODUCT'}</h3>
              </div>
              <div className={styles.productHeaderActions}>
                <button type="button" className={styles.primaryButton} onClick={() => void handleSaveStatusChange()}>
                  Save
                </button>
                <button type="button" className={styles.iconButton} onClick={() => setStatusModalOpen(false)} aria-label="Close update delivery">
                  <CloseIcon />
                </button>
              </div>
            </div>
            {productActionError ? <div className={styles.productActionError}>{productActionError}</div> : null}
            {productActionMessage ? <div className={styles.productActionMessage}>{productActionMessage}</div> : null}
            <div className={styles.productFormGrid}>
              <label className={styles.filterField}>
                <span>Updated Delivery Date</span>
                <input className={styles.input} type="date" value={statusDraft.updatedDeliveryDate} onChange={(event) => setStatusDraft((prev) => ({ ...prev, updatedDeliveryDate: event.target.value }))} />
              </label>
              <label className={styles.filterField}>
                <span>Reason</span>
                <select className={styles.select} value={statusDraft.reason} onChange={(event) => setStatusDraft((prev) => ({ ...prev, reason: event.target.value }))}>
                  {availableUpdateReasons.map((item) => (
                    <option key={item.id || item.reason_name} value={item.reason_name}>
                      {item.reason_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.filterField}>
                <span>{statusDraft.reason === OTHERS_UPDATE_REASON ? 'Custom Reason' : 'Reason Detail'}</span>
                {statusDraft.reason === OTHERS_UPDATE_REASON ? (
                  <input
                    className={styles.input}
                    placeholder="Type custom reason"
                    value={statusDraft.customReason}
                    onChange={(event) => setStatusDraft((prev) => ({ ...prev, customReason: event.target.value.toUpperCase() }))}
                  />
                ) : (
                  <div className={styles.readonlyField}>{statusDraft.reason}</div>
                )}
              </label>
              <label className={`${styles.filterField} ${styles.productFormWideText}`.trim()}>
                <span>Notes</span>
                <textarea
                  className={styles.incomingGoodsNotes}
                  placeholder="Notes alasan update ini apa?"
                  value={statusDraft.notes}
                  onChange={(event) => setStatusDraft((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
