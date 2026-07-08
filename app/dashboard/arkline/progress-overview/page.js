'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'
import useArklineAccess from '../use-arkline-access'

import shellStyles from '../arkline.module.css'
import styles from './progress-overview.module.css'

const supabase = createClient()

const BOARD_STATUSES = ['Initiated', 'On Progress', 'Completed']
const MATERIAL_BOARD_STATUSES = ['Ordered', 'Received', 'Sent']
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

function MaterialStackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.calendarIcon}>
      <path d="M5 8.2 12 4l7 4.2-7 4.1-7-4.1Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5 12.2 12 16l7-3.8M5 16.1 12 20l7-3.9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIcon}>
      <path
        d="M7 9V4.8h10V9M7.2 14.5H6.4A2.4 2.4 0 0 1 4 12.1V9.9a2.4 2.4 0 0 1 2.4-2.4h11.2A2.4 2.4 0 0 1 20 9.9v2.2a2.4 2.4 0 0 1-2.4 2.4h-.8M8 12.5h8v6.7H8zM16.6 10.8h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIcon}>
      <circle cx="10.8" cy="10.8" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.2 15.2 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function normalizeMaterialLogStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'SENT') return 'Sent'
  if (normalized === 'RECEIVED') return 'Received'
  return 'Ordered'
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

function getFinanceQtyForItem(entry) {
  const status = normalizeBoardStatus(entry?.status)
  if (status === 'Initiated') {
    return Number(entry?.qty || entry?.totalQty || 0)
  }
  return Number(entry?.actualQty || entry?.actual_qty || 0)
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
    supabase
      .from('arkline_po_item_receipts')
      .select('arkline_po_item_id, size, received_qty')
      .eq('receipt_type', 'INITIAL'),
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

  const receiptQtyByItemAndSize = (receiptData || []).reduce((accumulator, row) => {
    const itemId = String(row?.arkline_po_item_id || '').trim()
    const size = String(row?.size || '').trim().toUpperCase()
    if (!itemId || !size) return accumulator
    const key = `${itemId}::${size}`
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
      .map((row) => {
        const orderedQty = Number(row?.qty || 0)
        const sizeKey = String(row?.size || '').trim().toUpperCase()
        const receivedQty = Number(receiptQtyByItemAndSize[`${itemId}::${sizeKey}`] || 0)
        return {
          ...row,
          orderedQty,
          receivedQty,
          remainingQty: Math.max(orderedQty - receivedQty, 0),
        }
      })
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
        itemCount: 0,
        completedItemCount: 0,
        hasReceipts: false,
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
      remainingQty: Math.max((Number.isFinite(totalQty) ? totalQty : 0) - (Number.isFinite(actualQty) ? actualQty : 0), 0),
      price: Number.isFinite(price) ? price : 0,
      hpp: Number.isFinite(hpp) ? hpp : 0,
      updatedDeliveryDate,
      status: itemStatus,
      notes: itemNotes,
      sizeBreakdown,
    })

    accumulator[poId].itemCount += 1
    if (itemStatus === 'Completed') {
      accumulator[poId].completedItemCount += 1
    }
    if (actualQty > 0) {
      accumulator[poId].hasReceipts = true
    }
    accumulator[poId].totalQty += Number.isFinite(totalQty) ? totalQty : 0
    accumulator[poId].latestUpdatedDeliveryDate = getLaterIsoDate(accumulator[poId].latestUpdatedDeliveryDate, updatedDeliveryDate)
    return accumulator
  }, {})

  return (poData || [])
    .map((row) => {
      const normalized = normalizePoRow(row)
      const summary = itemSummaryByPoId[normalized.poId]
      const derivedStatus =
        summary?.itemCount && summary.completedItemCount === summary.itemCount
          ? 'Completed'
          : summary?.hasReceipts
            ? 'On Progress'
            : normalized.status
      const latestUpdatedDeliveryDate = summary?.latestUpdatedDeliveryDate || ''
      const actualDate = getLaterIsoDate(normalized.targetDate, latestUpdatedDeliveryDate)
      return {
        ...normalized,
        status: derivedStatus,
        productNames: summary?.productNames || [],
        productEntries: (summary?.productEntries || []).map((entry) => ({
          ...entry,
          targetDate: normalized.targetDate,
          displayDate: getLaterIsoDate(normalized.targetDate, entry.updatedDeliveryDate),
        })),
        totalQty: summary?.totalQty || 0,
        updatedDate: actualDate,
        displayDate: actualDate || normalized.targetDate || normalized.startDate,
        completionDate: derivedStatus === 'Completed' ? actualDate : '',
        latestUpdatedDeliveryDate,
      }
    })
    .filter((item) => item.poId)
}

async function loadMaterialProgressRows() {
  const [
    { data: headerData, error: headerError },
    { data: itemData, error: itemError },
    { data: logData, error: logError },
  ] = await Promise.all([
    supabase
      .from('arkline_po_material_ordered')
      .select('id, material_po_number, supplier_name_snapshot, garment_po_number, request_delivery_date, status, notes, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('arkline_po_material_ordered_items')
      .select('id, material_po_ordered_id, material_po_number, material_name_snapshot, size_variant, color_variant, unit, qty, notes, source_po_id'),
    supabase
      .from('arkline_po_material_logs')
      .select(
        'id, material_po_number, material_po_ordered_id, material_name_snapshot, size_variant, color_variant, unit, qty, supplier_name, notes, log_type, event_date, created_at'
      )
      .in('log_type', ['RECEIVED', 'SENT'])
      .order('event_date', { ascending: false }),
  ])

  if (headerError) throw new Error(headerError.message)
  if (itemError) throw new Error(itemError.message)
  if (logError) throw new Error(logError.message)

  const headerById = (headerData || []).reduce((accumulator, row) => {
    accumulator[String(row?.id || '').trim()] = row
    return accumulator
  }, {})

  const orderedRows = (itemData || []).map((row) => {
    const header = headerById[String(row?.material_po_ordered_id || '').trim()] || null
    return {
      id: `ordered:${row.id}`,
      status: 'Ordered',
      poNumber: String(row?.material_po_number || header?.material_po_number || '').trim().toUpperCase(),
      supplier: String(header?.supplier_name_snapshot || '').trim().toUpperCase(),
      materialName: String(row?.material_name_snapshot || '').trim().toUpperCase() || 'NO MATERIAL',
      variant: [String(row?.size_variant || '').trim().toUpperCase(), String(row?.color_variant || '').trim().toUpperCase()].filter(Boolean).join(' / ') || '-',
      unit: String(row?.unit || '').trim().toUpperCase() || '-',
      qty: Number(row?.qty || 0),
      date: String(header?.request_delivery_date || header?.created_at || '').slice(0, 10),
      notes: String(row?.notes || header?.notes || '').trim(),
      garmentPoNumber: String(row?.source_po_id || header?.garment_po_number || '').trim().toUpperCase(),
    }
  })

  const logRows = (logData || []).map((row) => {
    const header = headerById[String(row?.material_po_ordered_id || '').trim()] || null
    return {
      id: `${String(row?.log_type || '').trim().toLowerCase()}:${row.id}`,
      status: normalizeMaterialLogStatus(row?.log_type),
      poNumber: String(row?.material_po_number || header?.material_po_number || '').trim().toUpperCase(),
      supplier: String(row?.supplier_name || header?.supplier_name_snapshot || '').trim().toUpperCase(),
      materialName: String(row?.material_name_snapshot || '').trim().toUpperCase() || 'NO MATERIAL',
      variant: [String(row?.size_variant || '').trim().toUpperCase(), String(row?.color_variant || '').trim().toUpperCase()].filter(Boolean).join(' / ') || '-',
      unit: String(row?.unit || '').trim().toUpperCase() || '-',
      qty: Number(row?.qty || 0),
      date: String(row?.event_date || row?.created_at || '').slice(0, 10),
      notes: String(row?.notes || '').trim(),
      garmentPoNumber: String(header?.garment_po_number || '').trim().toUpperCase(),
    }
  })

  return [...orderedRows, ...logRows]
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

function formatPercent(value, total) {
  const numericValue = Number(value || 0)
  const numericTotal = Number(total || 0)
  if (!numericTotal) return '0%'
  return `${((numericValue / numericTotal) * 100).toFixed(1)}%`
}

function getReceivingQtyBase(receipts = [], actualQty = 0) {
  const receivedFromHistory = (receipts || []).reduce((sum, row) => sum + Number(row?.received_qty || 0), 0)
  if (receivedFromHistory > 0) return receivedFromHistory
  return Number(actualQty || 0)
}

function formatRepairabilityNote(qty, totalRejectQty, receivingQty) {
  return `${formatPercent(qty, totalRejectQty)} of reject | ${formatPercent(qty, receivingQty)} of receiving`
}

async function syncPoBoardStatus(poId) {
  const normalizedPoId = String(poId || '').trim().toUpperCase()
  if (!normalizedPoId) return

  const { data: itemRows, error: itemError } = await supabase
    .from('arkline_po_items')
    .select('status, actual_qty')
    .eq('po_id', normalizedPoId)

  if (itemError) {
    throw new Error(itemError.message)
  }

  const items = itemRows || []
  const nextStatus =
    items.length && items.every((row) => normalizeBoardStatus(row?.status) === 'Completed')
      ? 'Completed'
      : items.some((row) => Number(row?.actual_qty || 0) > 0 || normalizeBoardStatus(row?.status) === 'Completed')
        ? 'On Progress'
        : 'Initiated'

  const { error: updateError } = await supabase.from('arkline_pos').update({ status: nextStatus }).eq('po_id', normalizedPoId)
  if (updateError) {
    throw new Error(updateError.message)
  }
}

function normalizeFinancePaymentRow(row) {
  return {
    id: row?.id || '',
    paymentDate: String(row?.paid_at || row?.created_at || '').slice(0, 10),
    paymentLabel: String(row?.invoice_number || row?.status || 'Payment').trim() || 'Payment',
    amount: Number(row?.amount || 0),
    notes: row?.notes || '',
    status: String(row?.status || 'SUBMITTED').trim().toUpperCase() || 'SUBMITTED',
  }
}

function applySignedAdjustmentToRejectTotals(qtyB, qtyC, adjustmentQty) {
  let nextQtyB = Number(qtyB || 0)
  let nextQtyC = Number(qtyC || 0)
  const signedQty = Number(adjustmentQty || 0)

  if (!signedQty) {
    return { qtyB: nextQtyB, qtyC: nextQtyC }
  }

  if (signedQty > 0) {
    let remaining = signedQty
    const qtyCAdjustment = Math.min(nextQtyC, remaining)
    nextQtyC -= qtyCAdjustment
    remaining -= qtyCAdjustment
    const qtyBAdjustment = Math.min(nextQtyB, remaining)
    nextQtyB -= qtyBAdjustment
    return { qtyB: nextQtyB, qtyC: nextQtyC }
  }

  nextQtyC += Math.abs(signedQty)
  return { qtyB: nextQtyB, qtyC: nextQtyC }
}

function buildQcGradeSummary(rows, adjustmentRows = []) {
  const summary = (rows || []).reduce(
    (accumulator, row) => {
      accumulator.qtyA += Number(row?.qty_a || 0)
      accumulator.qtyB += Number(row?.qty_b || 0)
      accumulator.qtyC += Number(row?.qty_c || 0)
      return accumulator
    },
    { qtyA: 0, qtyB: 0, qtyC: 0 }
  )

  const adjustmentSummary = (adjustmentRows || []).reduce(
    (accumulator, row) => {
      const type = String(row?.adjustment_type || '').trim().toLowerCase()
      if (type === 'bc_to_a') accumulator.bcToAQty += Number(row?.qty || 0)
      if (type === 'inspector_data_error') accumulator.inspectorErrorQty += Number(row?.qty || 0)
      return accumulator
    },
    { bcToAQty: 0, inspectorErrorQty: 0 }
  )

  summary.qtyA += adjustmentSummary.bcToAQty
  const rejectTotalsAfterGradeAAdjustment = applySignedAdjustmentToRejectTotals(
    summary.qtyB,
    summary.qtyC,
    adjustmentSummary.bcToAQty
  )
  const adjustedRejectTotals = applySignedAdjustmentToRejectTotals(
    rejectTotalsAfterGradeAAdjustment.qtyB,
    rejectTotalsAfterGradeAAdjustment.qtyC,
    adjustmentSummary.inspectorErrorQty
  )
  summary.qtyB = adjustedRejectTotals.qtyB
  summary.qtyC = adjustedRejectTotals.qtyC

  return {
    ...summary,
    totalQc: summary.qtyA + summary.qtyB + summary.qtyC,
  }
}

function buildRejectDetailSummary(rows, qcSummary = {}) {
  const grouped = new Map()
  let identifiedQty = 0

  ;(rows || []).forEach((row) => {
    const reason = String(row?.reason?.reason_name || row?.reason_name || '').trim() || 'Belum dikategorikan'
    const grade = String(row?.grade || '').trim().toUpperCase() || '-'
    const key = `${reason}::${grade}`
    const qty = Number(row?.qty || 0)
    const current = grouped.get(key) || { key, reason, grade, qty: 0 }
    current.qty += qty
    identifiedQty += qty
    grouped.set(key, current)
  })

  const summaryRows = Array.from(grouped.values()).sort((left, right) => {
    if (right.qty !== left.qty) return right.qty - left.qty
    return left.reason.localeCompare(right.reason)
  })

  const unidentifiedQty = Math.max(Number(qcSummary.qtyB || 0) + Number(qcSummary.qtyC || 0) - identifiedQty, 0)
  if (unidentifiedQty > 0) {
    summaryRows.push({
      key: 'unidentified',
      reason: 'Belum dikategorikan',
      grade: 'B/C',
      qty: unidentifiedQty,
    })
  }

  return summaryRows
}

function buildRepairabilitySummary(rows = []) {
  return (rows || []).reduce(
    (accumulator, row) => {
      const qty = Number(row?.qty || 0)
      const isRepairable = Boolean(row?.reason?.is_repairable)
      if (isRepairable) {
        accumulator.repairableQty += qty
      } else {
        accumulator.nonRepairableQty += qty
      }
      return accumulator
    },
    { repairableQty: 0, nonRepairableQty: 0 }
  )
}

function buildReturnReQcSummary(batch = {}) {
  return (batch.qcRows || []).reduce(
    (summary, row) => {
      summary.a += Number(row?.qty_a || 0)
      summary.b += Number(row?.qty_b || 0)
      summary.c += Number(row?.qty_c || 0)
      return summary
    },
    { a: 0, b: 0, c: 0 }
  )
}

function buildReturnSizeSummary(rows = [], qtyKeys = ['qty']) {
  const totals = (rows || []).reduce((summary, row) => {
    const size = String(row?.size || '').trim().toUpperCase()
    if (!size) return summary
    const qty = qtyKeys.reduce((value, key) => {
      if (value) return value
      return Number(row?.[key] || 0)
    }, 0)
    if (!qty) return summary
    summary[size] = (summary[size] || 0) + qty
    return summary
  }, {})

  return [
    ...RECEIPT_SIZE_ORDER.filter((size) => Object.prototype.hasOwnProperty.call(totals, size)),
    ...Object.keys(totals).filter((size) => !RECEIPT_SIZE_ORDER.includes(size)).sort(),
  ].map((size) => ({ size, qty: totals[size] }))
}

function formatReturnReQcResult(batch = {}) {
  const summary = buildReturnReQcSummary(batch)
  const total = summary.a + summary.b + summary.c
  if (!total) return '-'
  return `A ${formatNumber(summary.a)} / B ${formatNumber(summary.b)} / C ${formatNumber(summary.c)}`
}

function buildReturnReasonSummary(rows = []) {
  return Array.from(
    (rows || []).reduce((grouped, row) => {
      const reason = String(row?.reasonName || row?.reason?.reason_name || 'Reject reason').trim() || 'Reject reason'
      const grade = String(row?.grade || '-').trim().toUpperCase() || '-'
      const size = String(row?.size || '-').trim().toUpperCase() || '-'
      const key = `${reason}::${grade}::${size}`
      const current = grouped.get(key) || { key, reason, grade, size, qty: 0 }
      current.qty += Number(row?.qty || 0)
      grouped.set(key, current)
      return grouped
    }, new Map()).values()
  ).sort((left, right) => {
    const reasonCompare = left.reason.localeCompare(right.reason)
    if (reasonCompare) return reasonCompare
    const gradeCompare = left.grade.localeCompare(right.grade)
    if (gradeCompare) return gradeCompare
    return left.size.localeCompare(right.size, undefined, { numeric: true })
  })
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
        supplierSj: row?.supplier_sj || '',
        isFinal: Boolean(row?.is_final),
        totalQty: 0,
        rows: [],
      })
    }

    const target = grouped.get(groupKey)
    target.totalQty += Number(row?.received_qty || 0)
    target.isFinal = target.isFinal || Boolean(row?.is_final)
    if (!target.supplierSj && row?.supplier_sj) {
      target.supplierSj = row.supplier_sj
    }
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

function addDaysIso(value, days) {
  const parsed = parseIso(value)
  if (!parsed) return ''
  parsed.setDate(parsed.getDate() + days)
  return parsed.toISOString().slice(0, 10)
}

function buildQcReceiptPeriodOptions(receipts = []) {
  const dates = Array.from(
    new Set(
      (receipts || [])
        .map((row) => String(row?.receive_date || '').slice(0, 10))
        .filter(Boolean)
    )
  ).sort()

  return [
    { value: 'all', label: 'All Incoming Goods', startDate: '', nextDate: '' },
    ...dates.map((date, index) => {
      const nextDate = dates[index + 1] || ''
      const endDate = nextDate ? addDaysIso(nextDate, -1) : ''
      return {
        value: date,
        startDate: date,
        nextDate,
        label: endDate ? `${formatDateLabel(date)} - ${formatDateLabel(endDate)}` : `${formatDateLabel(date)} onwards`,
      }
    }),
  ]
}

function isDateWithinReceiptPeriod(value, startDate, nextDate = '') {
  const normalized = String(value || '').slice(0, 10)
  if (!normalized || !startDate) return false
  return normalized >= startDate && (!nextDate || normalized < nextDate)
}

function getQcRowActivityDate(row = {}) {
  return row.finished_at || row.updated_at || row.started_at || row.created_at || ''
}

function getQcSampleReportData(productDetail, receiptDateFilter = 'all') {
  const options = buildQcReceiptPeriodOptions(productDetail?.receipts || [])
  const selectedOption = options.find((option) => option.value === receiptDateFilter) || options[0]

  if (!selectedOption || selectedOption.value === 'all') {
    return {
      options,
      selectedOption: options[0],
      qcRows: productDetail?.qcRows || [],
      rejectRows: productDetail?.qcRejectRows || [],
      adjustmentRows: productDetail?.qcRejectAdjustments || [],
      receipts: productDetail?.receipts || [],
    }
  }

  const { startDate, nextDate } = selectedOption
  const qcRows = (productDetail?.qcRows || []).filter((row) => isDateWithinReceiptPeriod(getQcRowActivityDate(row), startDate, nextDate))
  const qcIds = new Set(qcRows.map((row) => String(row.id || '')).filter(Boolean))
  const rejectRows = (productDetail?.qcRejectRows || []).filter(
    (row) =>
      (row.arkline_qc_id && qcIds.has(String(row.arkline_qc_id))) ||
      isDateWithinReceiptPeriod(row.created_at, startDate, nextDate)
  )
  const adjustmentRows = (productDetail?.qcRejectAdjustments || []).filter((row) =>
    isDateWithinReceiptPeriod(row.created_at, startDate, nextDate)
  )
  const receipts = (productDetail?.receipts || []).filter((row) => isDateWithinReceiptPeriod(row.receive_date, startDate, nextDate))

  return { options, selectedOption, qcRows, rejectRows, adjustmentRows, receipts }
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
  const { access, loading: accessLoading, role } = useArklineAccess()
  const canOpenKanbanDetail = role === 'admin' || access.progressKanbanAdd || access.progressKanbanEdit
  const [view, setView] = useState('')
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [lastRefresh, setLastRefresh] = useState(() => new Date())
  const [productFilter, setProductFilter] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [poRows, setPoRows] = useState([])
  const [materialRows, setMaterialRows] = useState([])
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
  const [deleteStatusConfirmRow, setDeleteStatusConfirmRow] = useState(null)
  const [productDetailSections, setProductDetailSections] = useState({
    receivingHistory: false,
    updateStatus: false,
    finance: false,
    qcSampleReport: false,
    returnHistory: false,
  })
  const [productActionMessage, setProductActionMessage] = useState('')
  const [productActionError, setProductActionError] = useState('')
  const [printingQcReport, setPrintingQcReport] = useState(false)
  const [printingReturnHistory, setPrintingReturnHistory] = useState(false)
  const [qcReceiptDateFilter, setQcReceiptDateFilter] = useState('all')
  const [expandedReturnBatchId, setExpandedReturnBatchId] = useState('')
  const [savingStatusChange, setSavingStatusChange] = useState(false)
  const [shortageBatch, setShortageBatch] = useState(null)
  const [shortageNotes, setShortageNotes] = useState('')
  const [savingShortage, setSavingShortage] = useState(false)
  const [receiptDraft, setReceiptDraft] = useState({ receiveDate: '', supplierSj: '', notes: '', sizeQty: {}, isFinal: false, hpp: '' })
  const [statusDraft, setStatusDraft] = useState({
    editingUpdateId: '',
    updatedDeliveryDate: '',
    reason: DEFAULT_UPDATE_REASON,
    customReason: '',
    notes: '',
  })

  useEffect(() => {
    if (accessLoading) return

    setView((current) => {
      if (current === 'kanban' && access.progressKanban) return current
      if (current === 'calendar' && access.progressCalendar) return current
      if (current === 'products' && access.progressProducts) return current
      if (current === 'materials' && access.progressOverview) return current
      if (access.progressKanban) return 'kanban'
      if (access.progressCalendar) return 'calendar'
      if (access.progressProducts) return 'products'
      if (access.progressOverview) return 'materials'
      return 'calendar'
    })
  }, [access.progressCalendar, access.progressKanban, access.progressOverview, access.progressProducts, accessLoading])

  useEffect(() => {
    void refreshRows()
  }, [])

  async function refreshRows() {
    setLoading(true)
    setLoadError('')

    try {
      const [rows, reasons, materialResult] = await Promise.all([
        loadSnapshotRows(),
        loadUpdateReasons(),
        loadMaterialProgressRows().catch((error) => ({ __error: error })),
      ])
      setPoRows(rows)
      setUpdateReasons(reasons)
      if (materialResult?.__error) {
        setMaterialRows([])
      } else {
        setMaterialRows(materialResult)
      }
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

  const filteredMaterialRows = useMemo(() => {
    const keyword = productFilter.trim().toUpperCase()
    return materialRows.filter((item) => {
      if (!keyword) return true
      return [item.poNumber, item.supplier, item.materialName, item.variant, item.notes, item.garmentPoNumber]
        .join(' ')
        .toUpperCase()
        .includes(keyword)
    })
  }, [materialRows, productFilter])

  const materialBoardItemsByStatus = useMemo(
    () =>
      MATERIAL_BOARD_STATUSES.reduce((accumulator, status) => {
        accumulator[status] = filteredMaterialRows
          .filter((item) => item.status === status)
          .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')) || String(left.poNumber || '').localeCompare(String(right.poNumber || '')))
        return accumulator
      }, {}),
    [filteredMaterialRows]
  )

  const openProductSnapshot = useMemo(() => {
    const keyword = productFilter.trim().toUpperCase()
    const openEntries = filteredRows.flatMap((item) =>
      (item.productEntries || [])
        .filter((entry) => {
          if (String(entry?.status || '').trim() === 'Completed') {
            return false
          }
          if (Number(entry?.remainingQty || 0) <= 0) {
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

      accumulator[key].totalQty += Number(entry?.remainingQty || 0)
      if (entry.poId && !accumulator[key].poIds.includes(entry.poId)) {
        accumulator[key].poIds.push(entry.poId)
      }
      ;(entry.sizeBreakdown || []).forEach((row) => {
        const size = String(row?.size || '').trim().toUpperCase()
        if (!size) return
        accumulator[key].sizeTotals[size] = (accumulator[key].sizeTotals[size] || 0) + Number(row?.remainingQty || 0)
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
    setExpandedReturnBatchId('')
    setQcReceiptDateFilter('all')
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

    const paymentRowsRaw = await loadOptionalRows(() =>
      supabase
        .from('arkline_payment')
        .select('id, payment_basis, po_source_type, po_db_id, po_number, invoice_number, amount, notes, status, paid_at, created_at')
        .eq('payment_basis', 'PO_BASED')
        .eq('po_source_type', 'GARMENT')
        .eq('po_number', item.poId)
        .order('created_at', { ascending: false })
    )

    const paymentRows = (paymentRowsRaw || []).map(normalizeFinancePaymentRow)

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
    setExpandedReturnBatchId('')
    setQcReceiptDateFilter('all')
    setProductDetailSections({
      receivingHistory: false,
      updateStatus: false,
      finance: false,
      qcSampleReport: false,
      returnHistory: false,
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
      qcRejectRows: [],
      qcRejectAdjustments: [],
      financeSummary: null,
      sizeBreakdown: [],
    })
    setReceiptDraft({ receiveDate: '', supplierSj: '', notes: '', sizeQty: {}, isFinal: false, hpp: '' })
    setStatusDraft({
      updatedDeliveryDate: entry.updatedDeliveryDate || '',
      reason: DEFAULT_UPDATE_REASON,
      customReason: '',
      notes: '',
    })
    try {
      const [itemRows, sizeRows, receiptRows, updateRows, paymentRowsRaw, qcRowsRaw, returnBatchRows] = await Promise.all([
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
            .select('id, receipt_group_id, size, received_qty, receive_date, supplier_sj, is_final, notes, created_by, created_at')
            .eq('arkline_po_item_id', entry.id)
            .eq('receipt_type', 'INITIAL')
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
            .from('arkline_payment')
            .select('id, payment_basis, po_source_type, po_db_id, po_number, invoice_number, amount, notes, status, paid_at, created_at')
            .eq('payment_basis', 'PO_BASED')
            .eq('po_source_type', 'GARMENT')
            .eq('po_number', selectedPoDetail.poId)
            .order('created_at', { ascending: false })
        ),
        loadOptionalRows(() =>
          supabase
            .from('arkline_qc')
            .select('id, qc_cycle_id, qc_round_number, qc_type, source_return_batch_id, arkline_po_item_id, po_id, sku_induk, assigned_to, allocated_qty, qty_a, qty_b, qty_c, model_name, status, started_at, finished_at, created_at, updated_at')
            .eq('po_id', selectedPoDetail.poId)
            .order('updated_at', { ascending: false })
        ),
        loadOptionalRows(() =>
          supabase
            .from('arkline_qc_return_batches')
            .select('*')
            .eq('arkline_po_item_id', entry.id)
            .order('return_date', { ascending: false })
        ),
      ])

      const normalizedItemId = String(entry.id || '').trim()
      const normalizedSku = String(entry.sku || '').trim().toUpperCase()
      const qcRowsByItem = (qcRowsRaw || []).filter((row) => {
        const rowItemId = String(row?.arkline_po_item_id || '').trim()
        const rowSku = String(row?.sku_induk || '').trim().toUpperCase()
        return (normalizedItemId && rowItemId === normalizedItemId) || (normalizedSku && rowSku === normalizedSku)
      })
      const qcRows = qcRowsByItem.length ? qcRowsByItem : (qcRowsRaw || []).filter((row) => String(row?.sku_induk || '').trim().toUpperCase() === normalizedSku)
      const qcTaskIds = qcRows.map((row) => row.id).filter(Boolean)
      const rejectDetailRows = await loadOptionalRows(() => {
        let query = supabase
          .from('arkline_qc_reject_details')
          .select(
            `
              id,
              arkline_qc_id,
              po_id,
              sku_induk,
              grade,
              size,
              qty,
              created_at,
              reason:reject_reason_id (
                id,
                reason_name,
                is_repairable
              )
            `
          )
          .order('created_at', { ascending: false })

        if (normalizedItemId) {
          query = query.eq('arkline_po_item_id', normalizedItemId)
        } else if (selectedPoDetail.poId && normalizedSku) {
          query = query.eq('po_id', selectedPoDetail.poId).eq('sku_induk', normalizedSku)
        } else if (qcTaskIds.length) {
          query = query.in('arkline_qc_id', qcTaskIds)
        } else {
          query = query.limit(0)
        }

        return query
      })
      const rejectAdjustmentRows = await loadOptionalRows(() => {
        let query = supabase
          .from('arkline_qc_reject_adjustments')
          .select('id, po_id, arkline_po_item_id, sku_induk, model_name, adjustment_type, qty, notes, created_at')
          .order('created_at', { ascending: false })

        if (normalizedItemId) {
          query = query.eq('arkline_po_item_id', normalizedItemId)
        } else if (selectedPoDetail.poId && normalizedSku) {
          query = query.eq('po_id', selectedPoDetail.poId).eq('sku_induk', normalizedSku)
        } else {
          query = query.limit(0)
        }

        return query
      })

      const returnBatchIds = (returnBatchRows || []).map((row) => row.id).filter(Boolean)
      const [returnLineRows, reworkReceiptRows] = returnBatchIds.length
        ? await Promise.all([
            loadOptionalRows(() =>
              supabase
                .from('arkline_qc_return_batch_lines')
                .select('*')
                .in('return_batch_id', returnBatchIds)
            ),
            loadOptionalRows(() =>
              supabase
                .from('arkline_po_item_receipts')
                .select('id, source_return_batch_id, source_return_batch_line_id, receipt_group_id, size, received_qty, receive_date, round_number, notes')
                .in('source_return_batch_id', returnBatchIds)
                .eq('receipt_type', 'REWORK_RETURN')
                .order('receive_date', { ascending: false })
            ),
          ])
        : [[], []]
      const rejectDetailById = new Map((rejectDetailRows || []).map((row) => [String(row.id), row]))
      const receiptsByBatch = new Map()
      ;(reworkReceiptRows || []).forEach((receipt) => {
        const key = String(receipt.source_return_batch_id || '')
        receiptsByBatch.set(key, [...(receiptsByBatch.get(key) || []), receipt])
      })
      const linesByBatch = new Map()
      ;(returnLineRows || []).forEach((line) => {
        const detail = rejectDetailById.get(String(line.reject_detail_id)) || {}
        const key = String(line.return_batch_id || '')
        linesByBatch.set(key, [
          ...(linesByBatch.get(key) || []),
          {
            ...line,
            reasonName: detail.reason?.reason_name || 'Reject reason',
          },
        ])
      })
      const returnHistory = (returnBatchRows || []).map((batch) => {
        const batchQcRows = qcRows.filter((row) => String(row.source_return_batch_id || '') === String(batch.id))
        const batchQcIds = new Set(batchQcRows.map((row) => String(row.id)))
        return {
          ...batch,
          lines: linesByBatch.get(String(batch.id)) || [],
          receipts: receiptsByBatch.get(String(batch.id)) || [],
          qcRows: batchQcRows,
          latestRejectRows: (rejectDetailRows || []).filter((row) => batchQcIds.has(String(row.arkline_qc_id))),
        }
      })

      const paymentRows = (paymentRowsRaw || []).map(normalizeFinancePaymentRow)
      const itemDetail = itemRows[0] || null
      const price = Number(itemDetail?.price || entry.price || 0)
      const hpp = Number(itemDetail?.hpp || 0)
      const plannedQty = Number(itemDetail?.total_qty || entry.qty || 0)
      const actualQty = Number(itemDetail?.actual_qty || 0)
      const totalReceived = receiptRows.reduce((sum, row) => sum + Number(row?.received_qty || 0), 0)
      const financeUnitPrice = price || hpp
      const actualFinanceQty = actualQty || totalReceived
      const financeQty = getFinanceQtyForItem({
        qty: plannedQty,
        actualQty: actualFinanceQty,
        status: itemDetail?.status || entry.status,
      })
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
        qcRejectRows: rejectDetailRows,
        qcRejectAdjustments: rejectAdjustmentRows,
        returnHistory,
        sizeBreakdown,
        financeSummary: {
          price,
          hpp,
          plannedQty,
          actualQty,
          allowancePct: Number(itemDetail?.allowance_pct || 0),
          plannedValue: financeUnitPrice * plannedQty,
          actualValue: financeUnitPrice * financeQty,
          paidValue: paymentRows.filter((row) => row.status === 'PAID').reduce((sum, row) => sum + Number(row?.amount || 0), 0),
        },
      })
      setStatusDraft({
        editingUpdateId: '',
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
        supplierSj: '',
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
      supplier_sj: receiptDraft.supplierSj.trim().toUpperCase() || null,
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

    try {
      await syncPoBoardStatus(selectedProductDetail.poId)
    } catch (statusError) {
      setProductActionError(statusError.message || 'Receipt saved, but failed to update PO status.')
      return
    }

    setProductActionMessage('Receipt berhasil disimpan.')
    setReceiptDraft((prev) => ({
      receiveDate: '',
      supplierSj: '',
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
    if (!selectedProductDetail || savingStatusChange) return
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

    setSavingStatusChange(true)
    try {
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

      const editingUpdateId = String(statusDraft.editingUpdateId || '').trim()
      if (editingUpdateId) {
        const existingUpdateRow = (selectedProductDetail.updates || []).find((item) => String(item.id) === editingUpdateId)
        const previousUpdatedDate = existingUpdateRow?.previous_updated_delivery_date || currentUpdatedDate || null
        const nextImpactDays = getUpdateImpactDays(previousUpdatedDate || selectedProductDetail.requestDeliveryDate, statusDraft.updatedDeliveryDate)
        const { error: editUpdateError } = await supabase
          .from('arkline_po_item_updates')
          .update({
            updated_delivery_date: statusDraft.updatedDeliveryDate || null,
            reason: resolvedReason,
            notes: statusDraft.notes.trim(),
            impact_days: nextImpactDays,
          })
          .eq('id', editingUpdateId)

        if (editUpdateError) {
          setProductActionError(editUpdateError.message || 'Delivery updated, but failed to edit monitoring log.')
          return
        }

        setProductActionMessage('Update delivery log berhasil diedit.')
      } else {
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
      }

      setStatusDraft({
        editingUpdateId: '',
        updatedDeliveryDate: statusDraft.updatedDeliveryDate,
        reason: availableUpdateReasons[0]?.reason_name || DEFAULT_UPDATE_REASON,
        customReason: '',
        notes: '',
      })
      await openProductDetail({ ...selectedProductDetail, updatedDeliveryDate: statusDraft.updatedDeliveryDate })
      await refreshRows()
    } finally {
      setSavingStatusChange(false)
    }
  }

  async function handleCloseReturnShortage() {
    if (!shortageBatch || !shortageNotes.trim() || savingShortage) return

    setSavingShortage(true)
    setProductActionError('')
    const { data: authData } = await supabase.auth.getUser()
    const { error: closeError } = await supabase.rpc('close_arkline_return_shortage', {
      p_return_batch_id: shortageBatch.id,
      p_notes: shortageNotes.trim(),
      p_closed_by: authData?.user?.email || '',
    })

    if (closeError) {
      setProductActionError(closeError.message)
      setSavingShortage(false)
      return
    }

    setSelectedProductDetail((current) =>
      current
        ? {
            ...current,
            returnHistory: (current.returnHistory || []).map((batch) =>
              batch.id === shortageBatch.id
                ? {
                    ...batch,
                    status: 'CLOSED_SHORT',
                    short_qty: Math.max(0, Number(batch.sent_qty || 0) - Number(batch.returned_qty || 0)),
                    closed_short_notes: shortageNotes.trim(),
                  }
                : batch
            ),
          }
        : current
    )
    setShortageBatch(null)
    setShortageNotes('')
    setSavingShortage(false)
    setProductActionMessage('Outstanding return qty closed as shortage.')
    void refreshRows()
  }

  async function handlePrintQcSampleReport() {
    if (!selectedProductDetail || !(selectedProductDetail.qcRows || []).length || printingQcReport) {
      return
    }

    setProductActionError('')
    setPrintingQcReport(true)
    try {
      const { jsPDF } = await import('jspdf')
      const qcReportData = getQcSampleReportData(selectedProductDetail, qcReceiptDateFilter)
      if (!qcReportData.qcRows.length) {
        setProductActionError('No QC sample rows for the selected incoming goods date.')
        return
      }
      const qcSummary = buildQcGradeSummary(
        qcReportData.qcRows || [],
        qcReportData.adjustmentRows || []
      )
      const rejectSummary = buildRejectDetailSummary(qcReportData.rejectRows || [], qcSummary)
      const repairabilitySummary = buildRepairabilitySummary(qcReportData.rejectRows || [])
      const receivingQty =
        qcReportData.selectedOption?.value === 'all'
          ? getReceivingQtyBase(selectedProductDetail.receipts || [], selectedProductDetail.financeSummary?.actualQty || 0)
          : (qcReportData.receipts || []).reduce((sum, row) => sum + Number(row?.received_qty || 0), 0)
      const totalRejectQty = Number(qcSummary.qtyB || 0) + Number(qcSummary.qtyC || 0)
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 14
      let cursorY = 18

      const ensureSpace = (neededHeight = 8) => {
        if (cursorY + neededHeight <= pageHeight - margin) return
        doc.addPage()
        cursorY = 18
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('QC Sample Report', margin, cursorY)
      cursorY += 8

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`PO: ${selectedProductDetail.poId || '-'}`, margin, cursorY)
      cursorY += 5
      doc.text(`Product: ${selectedProductDetail.productName || '-'}`, margin, cursorY)
      cursorY += 5
      doc.text(`SKU: ${selectedProductDetail.sku || '-'}`, margin, cursorY)
      cursorY += 8
      doc.setTextColor(71, 85, 105)
      doc.text(`Incoming Filter: ${qcReportData.selectedOption?.label || 'All Incoming Goods'}`, margin, cursorY)
      cursorY += 7

      const metricWidth = (pageWidth - margin * 2 - 15) / 6
      const metricHeight = 24
      const metrics = [
        {
          label: 'Grade A',
          value: formatNumber(qcSummary.qtyA),
          note: `${formatPercent(qcSummary.qtyA, qcSummary.totalQc)} of total QC sample`,
          dark: false,
        },
        {
          label: 'Grade B',
          value: formatNumber(qcSummary.qtyB),
          note: `${formatPercent(qcSummary.qtyB, qcSummary.totalQc)} of total QC sample`,
          dark: false,
        },
        {
          label: 'Grade C',
          value: formatNumber(qcSummary.qtyC),
          note: `${formatPercent(qcSummary.qtyC, qcSummary.totalQc)} of total QC sample`,
          dark: false,
        },
        {
          label: 'Total QC',
          value: formatNumber(qcSummary.totalQc),
          note: `${formatPercent(qcSummary.totalQc, receivingQty)} of receiving qty`,
          dark: true,
        },
        {
          label: 'Repairable',
          value: formatNumber(repairabilitySummary.repairableQty),
          note: formatRepairabilityNote(repairabilitySummary.repairableQty, totalRejectQty, receivingQty),
          dark: false,
        },
        {
          label: 'Non-Repairable',
          value: formatNumber(repairabilitySummary.nonRepairableQty),
          note: formatRepairabilityNote(repairabilitySummary.nonRepairableQty, totalRejectQty, receivingQty),
          dark: false,
        },
      ]

      metrics.forEach((metric, index) => {
        const x = margin + index * (metricWidth + 3)
        doc.setDrawColor(226, 232, 240)
        if (metric.dark) {
          doc.setFillColor(15, 23, 42)
          doc.roundedRect(x, cursorY, metricWidth, metricHeight, 3, 3, 'FD')
          doc.setTextColor(255, 255, 255)
        } else {
          doc.setFillColor(248, 250, 252)
          doc.roundedRect(x, cursorY, metricWidth, metricHeight, 3, 3, 'FD')
          doc.setTextColor(100, 116, 139)
        }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(metric.label.toUpperCase(), x + 3, cursorY + 5)
        doc.setFontSize(13)
        doc.setTextColor(metric.dark ? 255 : 15, metric.dark ? 255 : 23, metric.dark ? 255 : 42)
        doc.text(metric.value, x + 3, cursorY + 13)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(metric.dark ? 226 : 100, metric.dark ? 232 : 116, metric.dark ? 240 : 139)
        doc.text(metric.note, x + 3, cursorY + 19)
      })

      cursorY += metricHeight + 10
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Reject Details', margin, cursorY)
      cursorY += 6

      if (!rejectSummary.length) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(100, 116, 139)
        doc.text('No reject detail rows.', margin, cursorY)
      } else {
        rejectSummary.forEach((row) => {
          ensureSpace(14)
          const label = `${row.grade === 'B/C' ? row.grade : `Grade ${row.grade}`} • ${row.reason}`
          doc.setDrawColor(226, 232, 240)
          doc.setFillColor(248, 250, 252)
          doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 12, 3, 3, 'FD')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.setTextColor(15, 23, 42)
          doc.text(label, margin + 4, cursorY + 7)
          doc.text(formatNumber(row.qty), pageWidth - margin - 4, cursorY + 7, { align: 'right' })
          cursorY += 15
        })
      }

      const safePoId = String(selectedProductDetail.poId || 'PO').replace(/[^A-Z0-9_-]+/gi, '-')
      const safeProduct = String(selectedProductDetail.productName || 'PRODUCT').replace(/[^A-Z0-9_-]+/gi, '-')
      doc.save(`qc-sample-report-${safePoId}-${safeProduct}.pdf`)
    } catch (error) {
      setProductActionError(error?.message || 'Failed to generate QC sample report PDF.')
    } finally {
      setPrintingQcReport(false)
    }
  }

  async function handlePrintReturnHistory() {
    const returnHistory = selectedProductDetail?.returnHistory || []
    if (!selectedProductDetail || !returnHistory.length || printingReturnHistory) {
      return
    }

    setProductActionError('')
    setPrintingReturnHistory(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 14
      let cursorY = 18

      const ensureSpace = (neededHeight = 10) => {
        if (cursorY + neededHeight <= pageHeight - margin) return
        doc.addPage()
        cursorY = 18
      }

      const drawText = (text, x, y, options = {}) => {
        const maxWidth = options.maxWidth || pageWidth - margin * 2
        const lines = doc.splitTextToSize(String(text || '-'), maxWidth)
        if (options.align) {
          doc.text(lines, x, y, { align: options.align })
        } else {
          doc.text(lines, x, y)
        }
        return lines.length
      }

      const drawSizeSummary = (title, rows = []) => {
        ensureSpace(12)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(15, 23, 42)
        doc.text(title, margin, cursorY)
        cursorY += 5

        if (!rows.length) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.setTextColor(100, 116, 139)
          doc.text('No size qty recorded.', margin, cursorY)
          cursorY += 6
          return
        }

        const summaryText = rows.map((row) => `${row.size}: ${formatNumber(row.qty)}`).join('  |  ')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(51, 65, 85)
        const lineCount = drawText(summaryText, margin + 3, cursorY, { maxWidth: pageWidth - margin * 2 - 6 })
        cursorY += Math.max(6, lineCount * 4.5)
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(15, 23, 42)
      doc.text('Return & Rework History', margin, cursorY)
      cursorY += 8

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(71, 85, 105)
      doc.text(`PO: ${selectedProductDetail.poId || '-'}`, margin, cursorY)
      cursorY += 5
      doc.text(`Product: ${selectedProductDetail.productName || '-'}`, margin, cursorY)
      cursorY += 5
      doc.text(`SKU: ${selectedProductDetail.sku || '-'}`, margin, cursorY)
      cursorY += 9

      returnHistory.forEach((batch, batchIndex) => {
        ensureSpace(42)
        const reQcResult = formatReturnReQcResult(batch)
        const originalReasons = buildReturnReasonSummary(batch.lines || [])
        const latestReasons = buildReturnReasonSummary(batch.latestRejectRows || [])
        const sentSizeSummary = buildReturnSizeSummary(batch.lines || [], ['qty', 'sent_qty'])
        const returnedSizeSummary = buildReturnSizeSummary(batch.receipts || [], ['received_qty', 'qty'])
        const returnedDates = Array.from(new Set((batch.receipts || []).map((receipt) => formatDateLabel(receipt.receive_date)).filter((date) => date !== '-'))).join(', ')

        doc.setDrawColor(226, 232, 240)
        doc.setFillColor(248, 250, 252)
        doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 26, 3, 3, 'FD')
        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text(`${batchIndex + 1}. ${batch.return_number || 'Return Batch'}`, margin + 4, cursorY + 7)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(71, 85, 105)
        doc.text(`Status: ${String(batch.status || 'SENT').replaceAll('_', ' ')}`, pageWidth - margin - 4, cursorY + 7, { align: 'right' })
        doc.text(`Return: ${formatDateLabel(batch.return_date)} | Returned: ${returnedDates || '-'}`, margin + 4, cursorY + 14)
        doc.text(`Sent ${formatNumber(batch.sent_qty)} | Received ${formatNumber(batch.returned_qty)} | Short ${formatNumber(batch.short_qty)} | Re-QC ${reQcResult}`, margin + 4, cursorY + 21)
        cursorY += 34

        drawSizeSummary('Sent Size Summary', sentSizeSummary)
        drawSizeSummary('Returned Size Summary', returnedSizeSummary)
        cursorY += 2

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(15, 23, 42)
        doc.text('Original Reject Reasons', margin, cursorY)
        cursorY += 5
        if (!originalReasons.length) {
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(100, 116, 139)
          doc.text('No original reject reason rows.', margin, cursorY)
          cursorY += 6
        } else {
          originalReasons.forEach((row) => {
            ensureSpace(7)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8.5)
            doc.setTextColor(51, 65, 85)
            const label = `${row.reason} - Grade ${row.grade} - Size ${row.size} - Qty ${formatNumber(row.qty)}`
            const lineCount = drawText(label, margin + 3, cursorY, { maxWidth: pageWidth - margin * 2 - 6 })
            cursorY += Math.max(5, lineCount * 4.5)
          })
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(15, 23, 42)
        doc.text('Latest Re-QC Reject Reasons', margin, cursorY)
        cursorY += 5
        if (!latestReasons.length) {
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(100, 116, 139)
          doc.text('No reject reason recorded after rework.', margin, cursorY)
          cursorY += 7
        } else {
          latestReasons.forEach((row) => {
            ensureSpace(7)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8.5)
            doc.setTextColor(51, 65, 85)
            const label = `${row.reason} - Grade ${row.grade} - Size ${row.size} - Qty ${formatNumber(row.qty)}`
            const lineCount = drawText(label, margin + 3, cursorY, { maxWidth: pageWidth - margin * 2 - 6 })
            cursorY += Math.max(5, lineCount * 4.5)
          })
        }

        cursorY += 5
      })

      const safePoId = String(selectedProductDetail.poId || 'PO').replace(/[^A-Z0-9_-]+/gi, '-')
      const safeProduct = String(selectedProductDetail.productName || 'PRODUCT').replace(/[^A-Z0-9_-]+/gi, '-')
      doc.save(`return-rework-history-${safePoId}-${safeProduct}.pdf`)
    } catch (error) {
      setProductActionError(error?.message || 'Failed to generate return and rework history PDF.')
    } finally {
      setPrintingReturnHistory(false)
    }
  }

  function openDeliveryModal() {
    setDeliveryModalOpen(true)
    setStatusModalOpen(false)
    setDeleteStatusConfirmRow(null)
    setProductActionMessage('')
    setProductActionError('')
  }

  function openStatusModal() {
    setStatusModalOpen(true)
    setDeliveryModalOpen(false)
    setDeleteStatusConfirmRow(null)
    setProductActionMessage('')
    setProductActionError('')
    setStatusDraft({
      editingUpdateId: '',
      updatedDeliveryDate: selectedProductDetail?.updatedDeliveryDate || '',
      reason: availableUpdateReasons[0]?.reason_name || DEFAULT_UPDATE_REASON,
      customReason: '',
      notes: '',
    })
  }

  function openUpdateDeliveryEditor(row) {
    if (!row) return
    const reason = String(row.reason || '').trim()
    const hasPresetReason = availableUpdateReasons.some((item) => item.reason_name === reason)
    setStatusModalOpen(true)
    setDeliveryModalOpen(false)
    setDeleteStatusConfirmRow(null)
    setProductActionMessage('')
    setProductActionError('')
    setStatusDraft({
      editingUpdateId: String(row.id || ''),
      updatedDeliveryDate: row.updated_delivery_date || '',
      reason: hasPresetReason ? reason : OTHERS_UPDATE_REASON,
      customReason: hasPresetReason ? '' : reason,
      notes: row.notes || '',
    })
  }

  function openDeleteStatusConfirm(row) {
    if (!row?.id) return
    setStatusModalOpen(false)
    setDeliveryModalOpen(false)
    setProductActionMessage('')
    setProductActionError('')
    setDeleteStatusConfirmRow(row)
  }

  async function handleDeleteStatusUpdate(row) {
    if (!selectedProductDetail || !row?.id) return
    setProductActionMessage('')
    setProductActionError('')

    const remainingUpdates = (selectedProductDetail.updates || []).filter((item) => String(item.id) !== String(row.id))
    const latestRemainingUpdate = remainingUpdates[0] || null

    const { error: deleteError } = await supabase.from('arkline_po_item_updates').delete().eq('id', row.id)
    if (deleteError) {
      setProductActionError(deleteError.message || 'Failed to delete update delivery log.')
      return
    }

    const { error: itemError } = await supabase
      .from('arkline_po_items')
      .update({
        updated_delivery_date: latestRemainingUpdate?.updated_delivery_date || null,
        notes: latestRemainingUpdate?.notes || null,
      })
      .eq('id', selectedProductDetail.id)

    if (itemError) {
      setProductActionError(itemError.message || 'Update log deleted, but failed to refresh latest delivery state.')
      return
    }

    setDeleteStatusConfirmRow(null)
    setProductActionMessage('Update delivery log deleted.')
    await openProductDetail({
      ...selectedProductDetail,
      updatedDeliveryDate: latestRemainingUpdate?.updated_delivery_date || '',
    })
    await refreshRows()
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
              {access.progressKanban ? (
                <button
                  type="button"
                  aria-label="Kanban view"
                  data-view-label="Kanban View"
                  className={`${styles.segmentButton} ${view === 'kanban' ? styles.segmentButtonActive : ''}`.trim()}
                  onClick={() => setView('kanban')}
                >
                  <KanbanIcon />
                </button>
              ) : null}
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
              <button
                type="button"
                aria-label="Material progress view"
                data-view-label="Material Progress"
                className={`${styles.segmentButton} ${view === 'materials' ? styles.segmentButtonActive : ''}`.trim()}
                onClick={() => setView('materials')}
              >
                <MaterialStackIcon />
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

        {accessLoading || !view ? (
          <div className={styles.emptyColumn}>Loading progress snapshot...</div>
        ) : loading ? (
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
                          className={`${styles.boardCard} ${!canOpenKanbanDetail ? styles.boardCardStatic : ''}`.trim()}
                          role={canOpenKanbanDetail ? 'button' : undefined}
                          tabIndex={canOpenKanbanDetail ? 0 : undefined}
                          onClick={canOpenKanbanDetail ? () => openPoDetail(item) : undefined}
                          onKeyDown={
                            canOpenKanbanDetail
                              ? (event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    openPoDetail(item)
                                  }
                                }
                              : undefined
                          }
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
        ) : view === 'materials' ? (
          <div className={styles.boardGrid}>
            {MATERIAL_BOARD_STATUSES.map((status) => (
              <section key={status} className={`${styles.boardColumn} ${styles[`boardColumn${status}`] || ''}`.trim()}>
                <div className={styles.boardColumnHead}>
                  <div className={styles.boardColumnTitleWrap}>
                    <span className={styles.boardColumnDot}>{status.slice(0, 1).toUpperCase()}</span>
                    <h3>{status}</h3>
                  </div>
                  <span>{materialBoardItemsByStatus[status]?.length || 0}</span>
                </div>
                <div className={styles.boardDropzone}>
                  {(materialBoardItemsByStatus[status] || []).length ? (
                    materialBoardItemsByStatus[status].map((item) => (
                      <article key={item.id} className={`${styles.boardCard} ${styles.boardCardStatic}`.trim()}>
                        <div className={styles.boardCardTop}>
                          <div className={styles.boardCardIdentity}>
                            <strong className={styles.poLinkButton}>{item.poNumber || '-'}</strong>
                            <span className={styles.boardSupplierLine}>{item.supplier || '-'}</span>
                          </div>
                          <span className={styles.boardMethod}>{item.unit || '-'}</span>
                        </div>
                        <div className={styles.boardProductSummary}>
                          <p className={styles.boardProductLine}>{item.materialName || 'NO MATERIAL'}</p>
                          <p className={styles.boardProductExtra}>{item.variant || '-'}</p>
                        </div>
                        <div className={styles.boardFooter}>
                          <span className={styles.boardQty}>Qty {formatNumber(item.qty || 0)}</span>
                          <span className={styles.boardQty}>{item.date || '-'}</span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className={styles.emptyColumn}>No material in this column.</div>
                  )}
                </div>
              </section>
            ))}
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
                      (sum, entry) => sum + getFinanceQtyForItem(entry) * Number(entry?.price || entry?.hpp || 0),
                      0
                    )
                    const paidValue = (selectedPoDetail.payments || [])
                      .filter((row) => row.status === 'PAID')
                      .reduce((sum, row) => sum + Number(row?.amount || 0), 0)
                    const outstandingValue = Math.max(dueValue - paidValue, 0)

                    return (
                      <>
                        <div className={styles.financeGrid}>
                          <div className={styles.modalMetric}>
                            <span>Amount Due</span>
                            <strong>{formatNumber(dueValue)}</strong>
                          </div>
                          <div className={styles.modalMetric}>
                            <span>Amount Paid</span>
                            <strong>{formatNumber(paidValue)}</strong>
                          </div>
                          <div className={styles.modalMetric}>
                            <span>Outstanding</span>
                            <strong>{formatNumber(outstandingValue)}</strong>
                          </div>
                        </div>
                        <div className={styles.financeTableWrap}>
                          {(selectedPoDetail.payments || []).length ? (
                            <table className={styles.financeTable}>
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Invoice No</th>
                                  <th>Nominal Paid</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedPoDetail.payments.map((row) => (
                                  <tr key={row.id}>
                                    <td>{formatDateLabel(row.paymentDate)}</td>
                                    <td>{row.invoiceNumber || row.paymentLabel || '-'}</td>
                                    <td>{formatNumber(row.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
                                <div className={styles.updateTimelineHeadPrimary}>
                                  <strong>{row.reason || '-'}</strong>
                                  <span>{formatDateTimeLabel(row.created_at)}</span>
                                  <div className={styles.updateTimelinePill}>
                                    <span>Delivery</span>
                                    <strong>{`${formatDateLabel(row.previous_updated_delivery_date)} -> ${formatDateLabel(row.updated_delivery_date)}`}</strong>
                                  </div>
                                </div>
                                <div className={styles.updateTimelineMeta}>
                                  <strong>{formatSignedDays(getUpdateShiftDays(row.previous_updated_delivery_date, row.updated_delivery_date))}</strong>
                                  <span>{row.created_by || '-'}</span>
                                </div>
                              </div>
                              <div className={styles.updateTimelineFooter}>
                                <p className={styles.updateTimelineNotes}>{row.notes || '-'}</p>
                                <div className={styles.updateTimelineActions}>
                                  <button type="button" className={styles.secondaryButton} onClick={() => openUpdateDeliveryEditor(row)}>
                                    Edit
                                  </button>
                                  {role === 'admin' ? (
                                    <button type="button" className={styles.updateTimelineDeleteButton} onClick={() => openDeleteStatusConfirm(row)}>
                                      Delete
                                    </button>
                                  ) : null}
                                </div>
                              </div>
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
                                <th>Supplier SJ</th>
                                <th>Size</th>
                                <th>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {incomingGoodsGroups.map((group) => (
                                <tr key={group.id}>
                                  <td>{formatDateLabel(group.receiveDate)}</td>
                                  <td>{group.supplierSj || '-'}</td>
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
                  <div className={styles.productSectionHeadLeft}>
                    <h4 className={styles.modalSectionTitle}>QC Sample Report</h4>
                    <button
                      type="button"
                      className={styles.productSectionLaunch}
                      onClick={() => void handlePrintQcSampleReport()}
                      aria-label="Generate QC sample report PDF"
                      title="Generate QC sample report PDF"
                      disabled={printingQcReport || !(selectedProductDetail.qcRows || []).length}
                    >
                      <PrintIcon />
                    </button>
                  </div>
                  <button type="button" className={styles.productDetailSectionToggle} onClick={() => toggleProductDetailSection('qcSampleReport')}>
                    <span className={styles.productDetailHint}>{selectedProductDetail.poId || '-'}</span>
                    <ChevronIcon expanded={productDetailSections.qcSampleReport} />
                  </button>
                </div>
                {productDetailSections.qcSampleReport ? (
                <div className={styles.productDetailRows}>
                  {(selectedProductDetail.qcRows || []).length ? (
                    <>
                      {(() => {
                        const qcReportData = getQcSampleReportData(selectedProductDetail, qcReceiptDateFilter)
                        const qcSummary = buildQcGradeSummary(
                          qcReportData.qcRows || [],
                          qcReportData.adjustmentRows || []
                        )
                        const rejectSummary = buildRejectDetailSummary(qcReportData.rejectRows || [], qcSummary)
                        const repairabilitySummary = buildRepairabilitySummary(qcReportData.rejectRows || [])
                        const receivingQty =
                          qcReportData.selectedOption?.value === 'all'
                            ? getReceivingQtyBase(selectedProductDetail.receipts || [], selectedProductDetail.financeSummary?.actualQty || 0)
                            : (qcReportData.receipts || []).reduce((sum, row) => sum + Number(row?.received_qty || 0), 0)
                        const totalRejectQty = Number(qcSummary.qtyB || 0) + Number(qcSummary.qtyC || 0)
                        const repairableWidth = totalRejectQty > 0 ? Math.max(Math.min((repairabilitySummary.repairableQty / totalRejectQty) * 100, 100), 0) : 0
                        const nonRepairableWidth =
                          totalRejectQty > 0 ? Math.max(Math.min((repairabilitySummary.nonRepairableQty / totalRejectQty) * 100, 100), 0) : 0

                        return (
                          <>
                            <label className={styles.filterField}>
                              <span>Incoming Goods Filter</span>
                              <select
                                className={styles.select}
                                value={qcReceiptDateFilter}
                                onChange={(event) => setQcReceiptDateFilter(event.target.value)}
                              >
                                {qcReportData.options.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {!qcReportData.qcRows.length ? (
                              <div className={styles.emptyMini}>No QC sample rows for this incoming goods date.</div>
                            ) : null}
                            <div className={`${styles.modalGrid} ${styles.compactModalGrid}`.trim()} style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                              <div className={`${styles.modalMetric} ${styles.qcGradeAMetric}`.trim()}>
                                <span>Grade A</span>
                                <strong>{formatNumber(qcSummary.qtyA)}</strong>
                                <small className={styles.metricNote}>{formatPercent(qcSummary.qtyA, qcSummary.totalQc)} of total QC sample</small>
                              </div>
                              <div className={`${styles.modalMetric} ${styles.qcGradeBMetric}`.trim()}>
                                <span>Grade B</span>
                                <strong>{formatNumber(qcSummary.qtyB)}</strong>
                                <small className={styles.metricNote}>{formatPercent(qcSummary.qtyB, qcSummary.totalQc)} of total QC sample</small>
                              </div>
                              <div className={`${styles.modalMetric} ${styles.qcGradeCMetric}`.trim()}>
                                <span>Grade C</span>
                                <strong>{formatNumber(qcSummary.qtyC)}</strong>
                                <small className={styles.metricNote}>{formatPercent(qcSummary.qtyC, qcSummary.totalQc)} of total QC sample</small>
                              </div>
                              <div className={`${styles.modalMetric} ${styles.qcTotalMetric}`.trim()}>
                                <span>Total QC</span>
                                <strong>{formatNumber(qcSummary.totalQc)}</strong>
                                <small className={styles.metricNote}>{formatPercent(qcSummary.totalQc, receivingQty)} of receiving qty</small>
                              </div>
                            </div>
                            <div className={styles.repairabilityInlineBarWrap}>
                              <div className={styles.repairabilityInlineBar}>
                                <div className={styles.repairabilityInlineBackground}>
                                  <div className={styles.repairabilityInlineRepairable} style={{ width: `${repairableWidth}%` }} />
                                  <div className={styles.repairabilityInlineNonRepairable} style={{ width: `${nonRepairableWidth}%` }} />
                                </div>
                                <div className={styles.repairabilityInlineContent}>
                                  <div className={styles.repairabilityInlineContentRepairable}>
                                    <strong>Repairable {formatNumber(repairabilitySummary.repairableQty)}</strong>
                                    <span>{formatRepairabilityNote(repairabilitySummary.repairableQty, totalRejectQty, receivingQty)}</span>
                                  </div>
                                  <div className={styles.repairabilityInlineContentNonRepairable}>
                                    <strong>Non-Repairable {formatNumber(repairabilitySummary.nonRepairableQty)}</strong>
                                    <span>{formatRepairabilityNote(repairabilitySummary.nonRepairableQty, totalRejectQty, receivingQty)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {rejectSummary.length ? (
                              rejectSummary.map((row) => (
                                <div key={row.key} className={styles.productDetailRow}>
                                  <div>
                                    <strong>
                                      {row.grade === 'B/C' ? row.grade : `Grade ${row.grade}`} • {row.reason}
                                    </strong>
                                  </div>
                                  <div className={styles.productDetailRowMeta}>
                                    <strong>{formatNumber(row.qty)}</strong>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className={styles.emptyMini}>No reject detail rows.</div>
                            )}
                          </>
                        )
                      })()}
                    </>
                  ) : (
                    <div className={styles.emptyMini}>No QC report rows.</div>
                  )}
                </div>
                ) : null}
              </div>

              <div className={styles.productDetailSection}>
                <div className={styles.productDetailSectionHead}>
                  <div className={styles.productSectionHeadLeft}>
                    <h4 className={styles.modalSectionTitle}>Return &amp; Rework History</h4>
                    <button
                      type="button"
                      className={styles.productSectionLaunch}
                      onClick={() => void handlePrintReturnHistory()}
                      aria-label="Generate return and rework history PDF"
                      title="Generate return and rework history PDF"
                      disabled={printingReturnHistory || !(selectedProductDetail.returnHistory || []).length}
                    >
                      <PrintIcon />
                    </button>
                  </div>
                  <button type="button" className={styles.productDetailSectionToggle} onClick={() => toggleProductDetailSection('returnHistory')}>
                    <span className={styles.productDetailToggleValue}>
                      <span className={styles.productDetailHint}>
                        {(selectedProductDetail.returnHistory || []).length} batch(es)
                      </span>
                      <ChevronIcon expanded={productDetailSections.returnHistory} />
                    </span>
                  </button>
                </div>
                {productDetailSections.returnHistory ? (
                  <div className={styles.productDetailRows}>
                    {(selectedProductDetail.returnHistory || []).length ? (
                      <div className={styles.receivingHistoryTableWrap}>
                        <table className={styles.receivingHistoryTable}>
                          <thead>
                            <tr>
                              <th>Return Date</th>
                              <th>Batch</th>
                              <th>Sent</th>
                              <th>Returned Date</th>
                              <th>Returned Qty</th>
                              <th>Short Qty</th>
                              <th>Status</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedProductDetail.returnHistory || []).map((batch) => {
                              const returnedDates = Array.from(
                                new Set((batch.receipts || []).map((receipt) => formatDateLabel(receipt.receive_date)))
                              ).join(', ')
                              const latestRejectSummary = buildReturnReasonSummary(batch.latestRejectRows || [])
                              const reQcSummary = buildReturnReQcSummary(batch)
                              const hasReQcDetail = (batch.qcRows || []).length > 0 || latestRejectSummary.length > 0
                              const canCloseShort =
                                (role === 'admin' || access.progressKanbanEdit) &&
                                !['FULLY_RETURNED', 'CLOSED_SHORT'].includes(String(batch.status || 'SENT')) &&
                                Number(batch.returned_qty || 0) < Number(batch.sent_qty || 0)
                              const isExpanded = expandedReturnBatchId === batch.id
                              return (
                                <Fragment key={batch.id}>
                                  <tr>
                                    <td>{formatDateLabel(batch.return_date)}</td>
                                    <td>{batch.return_number || '-'}</td>
                                    <td>{formatNumber(batch.sent_qty)}</td>
                                    <td>{returnedDates || '-'}</td>
                                    <td>{formatNumber(batch.returned_qty)}</td>
                                    <td>{formatNumber(batch.short_qty)}</td>
                                    <td>{String(batch.status || 'SENT').replaceAll('_', ' ')}</td>
                                    <td>
                                      <div className={styles.returnHistoryActions}>
                                        <button
                                          type="button"
                                          className={styles.returnHistoryIconButton}
                                          onClick={() => setExpandedReturnBatchId(isExpanded ? '' : batch.id)}
                                          aria-label={`${isExpanded ? 'Hide' : 'Show'} Re-QC detail`}
                                          title={`${isExpanded ? 'Hide' : 'Show'} Re-QC detail`}
                                          disabled={!hasReQcDetail}
                                        >
                                          <SearchIcon />
                                        </button>
                                        {canCloseShort ? (
                                          <button
                                            type="button"
                                            className={`${styles.returnHistoryIconButton} ${styles.returnHistoryDangerButton}`.trim()}
                                            onClick={() => {
                                              setShortageBatch(batch)
                                              setShortageNotes('')
                                              setProductActionError('')
                                            }}
                                            aria-label="Close short qty"
                                            title="Close short qty"
                                          >
                                            <CloseIcon />
                                          </button>
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                  {isExpanded ? (
                                    <tr className={styles.returnHistoryDetailRow}>
                                      <td colSpan={8}>
                                        <div className={styles.returnHistoryDetailPanel}>
                                          <div className={`${styles.modalGrid} ${styles.compactModalGrid}`.trim()} style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                                            <div className={`${styles.modalMetric} ${styles.qcGradeAMetric}`.trim()}>
                                              <span>Grade A</span>
                                              <strong>{formatNumber(reQcSummary.a)}</strong>
                                            </div>
                                            <div className={`${styles.modalMetric} ${styles.qcGradeBMetric}`.trim()}>
                                              <span>Grade B</span>
                                              <strong>{formatNumber(reQcSummary.b)}</strong>
                                            </div>
                                            <div className={`${styles.modalMetric} ${styles.qcGradeCMetric}`.trim()}>
                                              <span>Grade C</span>
                                              <strong>{formatNumber(reQcSummary.c)}</strong>
                                            </div>
                                            <div className={`${styles.modalMetric} ${styles.qcTotalMetric}`.trim()}>
                                              <span>Total Re-QC</span>
                                              <strong>{formatNumber(reQcSummary.a + reQcSummary.b + reQcSummary.c)}</strong>
                                            </div>
                                          </div>
                                          {latestRejectSummary.length ? (
                                            <div className={styles.returnHistoryRejectList}>
                                              <span>Latest Reject Reasons</span>
                                              {latestRejectSummary.map((row) => (
                                                <div key={row.key} className={styles.productDetailRow}>
                                                  <div>
                                                    <strong>{row.reason}</strong>
                                                    <span>Grade {row.grade} / Size {row.size}</span>
                                                  </div>
                                                  <div className={styles.productDetailRowMeta}>
                                                    <strong>{formatNumber(row.qty)}</strong>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className={styles.emptyMini}>No reject reason recorded after rework.</div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={styles.emptyMini}>No Arkline return or rework history yet.</div>
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

      {selectedProductDetail && shortageBatch ? (
        <div className={styles.modalOverlay} onClick={() => !savingShortage && setShortageBatch(null)}>
          <div className={`${styles.modalCard} ${styles.actionModalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>PO Number: {selectedProductDetail.poId || '-'}</p>
                <h3 className={styles.modalTitle}>{selectedProductDetail.productName || 'NO PRODUCT'}</h3>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setShortageBatch(null)} disabled={savingShortage} aria-label="Close shortage modal">
                <CloseIcon />
              </button>
            </div>
            <div className={`${styles.modalGrid} ${styles.compactModalGrid}`.trim()}>
              <div className={styles.modalMetric}>
                <span>Product Name</span>
                <strong>{selectedProductDetail.productName || 'NO PRODUCT'}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Return Batch</span>
                <strong>{shortageBatch.return_number || '-'}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Outstanding Qty</span>
                <strong>{formatNumber(Math.max(0, Number(shortageBatch.sent_qty || 0) - Number(shortageBatch.returned_qty || 0)))}</strong>
              </div>
            </div>
            <label className={styles.filterField}>
              <span>Decision Notes</span>
              <textarea
                className={styles.textarea}
                value={shortageNotes}
                onChange={(event) => setShortageNotes(event.target.value)}
                placeholder="Explain why the remaining qty will not be returned."
                rows={4}
              />
            </label>
            {productActionError ? <div className={styles.productActionError}>{productActionError}</div> : null}
            <div className={styles.productHeaderActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setShortageBatch(null)} disabled={savingShortage}>Cancel</button>
              <button type="button" className={styles.dangerButton} onClick={() => void handleCloseReturnShortage()} disabled={savingShortage || !shortageNotes.trim()}>
                {savingShortage ? 'Saving...' : 'Confirm Closed Short'}
              </button>
            </div>
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
                <span>Supplier SJ</span>
                <input
                  className={styles.input}
                  value={receiptDraft.supplierSj}
                  onChange={(event) => setReceiptDraft((prev) => ({ ...prev, supplierSj: event.target.value.toUpperCase() }))}
                  placeholder="Input supplier SJ"
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
        <div className={styles.modalOverlay} onClick={() => (!savingStatusChange ? setStatusModalOpen(false) : null)}>
          <div className={`${styles.modalCard} ${styles.actionModalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Update Delivery</p>
                <h3 className={styles.modalTitle}>
                  {statusDraft.editingUpdateId ? 'Edit Update Delivery' : 'Update Delivery'} - {selectedProductDetail.productName || 'NO PRODUCT'}
                </h3>
              </div>
              <div className={styles.productHeaderActions}>
                <button type="button" className={styles.primaryButton} onClick={() => void handleSaveStatusChange()} disabled={savingStatusChange}>
                  {savingStatusChange ? 'Saving...' : statusDraft.editingUpdateId ? 'Update' : 'Save'}
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setStatusModalOpen(false)}
                  aria-label="Close update delivery"
                  disabled={savingStatusChange}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            {productActionError ? <div className={styles.productActionError}>{productActionError}</div> : null}
            {productActionMessage ? <div className={styles.productActionMessage}>{productActionMessage}</div> : null}
            <div className={styles.productFormGrid}>
              <label className={styles.filterField}>
                <span>Updated Delivery Date</span>
                <input
                  className={styles.input}
                  type="date"
                  value={statusDraft.updatedDeliveryDate}
                  onChange={(event) => setStatusDraft((prev) => ({ ...prev, updatedDeliveryDate: event.target.value }))}
                  disabled={savingStatusChange}
                />
              </label>
              <label className={styles.filterField}>
                <span>Reason</span>
                <select
                  className={styles.select}
                  value={statusDraft.reason}
                  onChange={(event) => setStatusDraft((prev) => ({ ...prev, reason: event.target.value }))}
                  disabled={savingStatusChange}
                >
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
                    disabled={savingStatusChange}
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
                  disabled={savingStatusChange}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {selectedProductDetail && deleteStatusConfirmRow ? (
        <div className={styles.modalOverlay} onClick={() => setDeleteStatusConfirmRow(null)}>
          <div className={`${styles.modalCard} ${styles.actionModalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Delete Update</p>
                <h3 className={styles.modalTitle}>Delete update delivery log?</h3>
              </div>
              <div className={styles.productHeaderActions}>
                <button type="button" className={styles.iconButton} onClick={() => setDeleteStatusConfirmRow(null)} aria-label="Close delete update confirmation">
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className={styles.productDetailRows}>
              <div className={styles.productDetailRow}>
                <div>
                  <strong>{deleteStatusConfirmRow.reason || '-'}</strong>
                  <span>{formatDateTimeLabel(deleteStatusConfirmRow.created_at)}</span>
                </div>
                <div className={styles.productDetailRowMeta}>
                  <strong>{formatDateLabel(deleteStatusConfirmRow.updated_delivery_date)}</strong>
                  <span>{deleteStatusConfirmRow.created_by || '-'}</span>
                </div>
              </div>
              <p className={styles.updateTimelineNotes}>This will remove the selected update log and refresh the latest updated delivery state for this product.</p>
            </div>
            <div className={styles.productHeaderActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setDeleteStatusConfirmRow(null)}>
                Cancel
              </button>
              <button type="button" className={styles.updateTimelineDeleteButton} onClick={() => void handleDeleteStatusUpdate(deleteStatusConfirmRow)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

