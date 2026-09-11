'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Fragment, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'
import useArklineAccess from '../use-arkline-access'
import {
  createGarmentPurchaseOrderPreviewHtml,
  fetchGarmentPoBundle,
  openPreviewWindow,
} from '../directory/po-directory-utils'

import shellStyles from '../arkline.module.css'
import styles from './progress-overview.module.css'

const supabase = createClient()

const BOARD_STATUSES = ['Initiated', 'On Progress', 'Completed']
const MATERIAL_BOARD_STATUSES = ['Ordered', 'Received', 'Sent']
const RECEIPT_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const PPN_RATE = 0.11
const DEFAULT_UPDATE_REASON = 'FABRIC ISSUE'
const OTHERS_UPDATE_REASON = 'OTHERS'
const CMT_INSPECTION_BUCKET = 'arkline-po'
const PAYMENT_REQUEST_BUCKET = 'arkline-payments'
const CMT_INSPECTION_RESULT_OPTIONS = ['PASSED', 'REJECTED']
const CMT_INSPECTION_TYPE_OPTIONS = [
  { value: 'INLINE', label: 'In-Line' },
  { value: 'PREFINAL', label: 'Pre-Final' },
  { value: 'FINAL', label: 'Final' },
]
const CMT_PRODUCTION_STATUS_ROWS = [
  { key: 'cutting', label: 'Cutting' },
  { key: 'printing', label: 'Printing' },
  { key: 'sewing', label: 'Sewing' },
]
const CMT_QC_INFO_OPTIONS = ['PPS/Approval Sample', 'Buyer Comment', 'Washing Std.', 'Test Report', "Trim's Card"]
const CMT_ACCESSORIES_OPTIONS = [
  'Main Label',
  'Care Label',
  'Logo Print Label',
  'Barcode Label',
  'Thread',
  'I/L',
  'Button/Snap',
  'Eyelet/Rivet',
  'Cord String',
  'Elastic',
  'Velcro Tape',
  'Spare Button',
]
const CMT_PACKING_OPTIONS = ['Shipping Mark', 'Barcode Sticker', 'Size/CLR Ratio', 'Hanger', 'Polybag', 'Hangtag', 'Tissue Paper']

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

function AttachmentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIcon}>
      <path
        d="M8.5 12.3 13 7.8a3 3 0 0 1 4.2 4.2l-6.1 6.1a4.2 4.2 0 0 1-5.9-5.9l6.5-6.5"
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

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIcon}>
      <path
        d="m5 16.8-.8 3 3-.8L18.4 7.8a2.1 2.1 0 0 0-3-3L5 16.8ZM13.8 6.4l3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
    return parseNumberValue(entry?.qty || entry?.totalQty || 0)
  }
  return Math.max(parseNumberValue(entry?.actualQty || entry?.actual_qty || 0) - parseNumberValue(entry?.shortQty || entry?.short_qty || 0), 0)
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === null || value === undefined || value === '') return fallback
  const normalized = String(value).trim().toLowerCase()
  if (['true', 'yes', 'with', 'with ppn', '1'].includes(normalized)) return true
  if (['false', 'no', 'without', 'without ppn', '0'].includes(normalized)) return false
  return fallback
}

function applyPpnToAmount(value, includePpn) {
  const amount = parseNumberValue(value)
  return roundCurrencyValue(normalizeBoolean(includePpn, true) ? amount * (1 + PPN_RATE) : amount)
}

function roundCurrencyValue(value) {
  const amount = parseNumberValue(value)
  return Number.isFinite(amount) ? Math.round(amount) : 0
}

function getFinanceOutstandingValue(dueValue, paidValue) {
  return Math.max(roundCurrencyValue(dueValue) - roundCurrencyValue(paidValue), 0)
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

function getTodayDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLatestReceiptDate(receipts = []) {
  return getLaterIsoDate(...(receipts || []).map((row) => row?.receive_date))
}

function getProductReceivedQty(productDetail) {
  const receiptQty = (productDetail?.receipts || []).reduce((sum, row) => sum + Number(row?.received_qty || 0), 0)
  if (receiptQty > 0) return receiptQty
  return Number(productDetail?.financeSummary?.actualQty ?? productDetail?.actualQty ?? 0)
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
  const includePpn = normalizeBoolean(row?.include_ppn, true)

  return {
    id: String(row?.id || poId).trim(),
    poId,
    supplier,
    method,
    status,
    includePpn,
    createdAt: row?.created_at || '',
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
    { data: paymentData, error: paymentError },
    { data: returnBatchData, error: returnBatchError },
  ] = await Promise.all([
    supabase
      .from('arkline_pos')
      .select('id, po_id, supplier_name, method, status, request_delivery_date, include_ppn, notes, created_at, updated_at')
      .not('po_id', 'is', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('arkline_po_items')
      .select('id, po_id, sku_induk, nama_produk, kategori_pengadaan, kategori_produk, total_qty, actual_qty, price, hpp, updated_delivery_date, notes, status'),
    supabase
      .from('arkline_po_item_receipts')
      .select('arkline_po_item_id, size, received_qty')
      .eq('receipt_type', 'INITIAL'),
    supabase.from('arkline_po_item_sizes').select('arkline_po_item_id, size, qty'),
    supabase
      .from('arkline_payment')
      .select('po_number, amount, status, paid_at')
      .eq('payment_basis', 'PO_BASED')
      .eq('po_source_type', 'GARMENT'),
    supabase
      .from('arkline_qc_return_batches')
      .select('arkline_po_item_id, short_qty'),
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

  if (paymentError) {
    throw new Error(paymentError.message)
  }

  if (returnBatchError) {
    throw new Error(returnBatchError.message)
  }

  const paidValueByPoId = (paymentData || []).reduce((accumulator, row) => {
    if (!isPaidFinancePayment(row)) return accumulator
    const poId = String(row?.po_number || '').trim().toUpperCase()
    if (!poId) return accumulator
    accumulator[poId] = (accumulator[poId] || 0) + parseNumberValue(row?.amount)
    return accumulator
  }, {})

  const shortQtyByItemId = (returnBatchData || []).reduce((accumulator, row) => {
    const key = String(row?.arkline_po_item_id || '').trim()
    if (!key) return accumulator
    accumulator[key] = (accumulator[key] || 0) + Number(row?.short_qty || 0)
    return accumulator
  }, {})

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
    const productCategory = String(row?.kategori_pengadaan || row?.kategori_produk || '').trim().toUpperCase()
    const totalQty = Number(row?.total_qty || 0)
    const itemId = String(row?.id || '').trim()
    const actualQty = Number(receiptQtyByItemId[itemId] ?? row?.actual_qty ?? 0)
    const shortQty = Number(shortQtyByItemId[itemId] || 0)
    const updatedDeliveryDate = String(row?.updated_delivery_date || '').slice(0, 10)
    const price = parseNumberValue(row?.price)
    const hpp = parseNumberValue(row?.hpp)
    const itemNotes = String(row?.notes || '').trim()
    const savedItemStatus = normalizeBoardStatus(row?.status)
    const itemStatus =
      savedItemStatus === 'Completed' || (totalQty > 0 && actualQty >= totalQty)
        ? 'Completed'
        : actualQty > 0
          ? 'On Progress'
          : savedItemStatus

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
        financeDueValue: 0,
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
      category: productCategory,
      qty: Number.isFinite(totalQty) ? totalQty : 0,
      actualQty: Number.isFinite(actualQty) ? actualQty : 0,
      shortQty: Number.isFinite(shortQty) ? shortQty : 0,
      remainingQty: Math.max((Number.isFinite(totalQty) ? totalQty : 0) - (Number.isFinite(actualQty) ? actualQty : 0), 0),
      price: Number.isFinite(price) ? price : 0,
      hpp: Number.isFinite(hpp) ? hpp : 0,
      updatedDeliveryDate,
      status: itemStatus,
      notes: itemNotes,
      sizeBreakdown,
    })

    accumulator[poId].financeDueValue += getFinanceQtyForItem({
      qty: totalQty,
      actualQty,
      shortQty,
      status: itemStatus,
    }) * price
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
      const financeDueValue = applyPpnToAmount(summary?.financeDueValue || 0, normalized.includePpn)
      const financePaidValue = paidValueByPoId[normalized.poId] || 0
      const financeOutstandingValue = getFinanceOutstandingValue(financeDueValue, financePaidValue)
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
        financeDueValue,
        financePaidValue,
        financeOutstandingValue,
        isFinanceSettled: derivedStatus === 'Completed' && financeDueValue > 0 && financeOutstandingValue === 0,
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
  const numeric = parseNumberValue(value)
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat('en-US').format(numeric)
}

function parseNumberValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  if (!raw) return 0

  const cleaned = raw.replace(/[^\d.,-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return 0

  const hasDot = cleaned.includes('.')
  const hasComma = cleaned.includes(',')

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.')
    const lastComma = cleaned.lastIndexOf(',')
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ','
    const normalized = cleaned.replaceAll(thousandsSeparator, '').replace(decimalSeparator, '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (hasComma) {
    const normalized = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(',', '.') : cleaned.replaceAll(',', '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (hasDot && /^\-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    const parsed = Number(cleaned.replaceAll('.', ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function sanitizeFileName(value) {
  return String(value || 'file')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'file'
}

function getArklinePoStorageFolder(poId) {
  return `Arkline PO/${sanitizeFileName(poId || 'PO')}`
}

function getSignedPoStorageFolder(poId) {
  return `${getArklinePoStorageFolder(poId)}/Signed PO`
}

function normalizeSignedPoStorageObject(row, folder) {
  if (!row || row.id === null || !row.name || row.name === '.emptyFolderPlaceholder') return null
  const fileName = String(row.name || 'Signed PO').trim()
  return {
    id: String(row.id || `${folder}/${fileName}`).trim(),
    storageBucket: CMT_INSPECTION_BUCKET,
    storagePath: `${folder}/${fileName}`,
    fileName,
    mimeType: String(row.metadata?.mimetype || row.metadata?.mimeType || '').trim(),
    createdAt: row.created_at || row.updated_at || '',
  }
}

async function loadSignedPoFiles(poId) {
  const folder = getSignedPoStorageFolder(poId)
  const { data, error } = await supabase.storage.from(CMT_INSPECTION_BUCKET).list(folder, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) return []
  return (data || []).map((row) => normalizeSignedPoStorageObject(row, folder)).filter(Boolean)
}

function getLatestSignedPoDate(files = []) {
  return [...(files || [])]
    .map((file) => file?.createdAt)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]
}

function getStorageAttachmentPreviewType(attachment) {
  const mimeType = String(attachment?.mimeType || '').toLowerCase()
  const fileName = String(attachment?.fileName || attachment?.storagePath || '').toLowerCase()
  if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) return 'pdf'
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(fileName)) return 'image'
  return 'file'
}

function getNextCmtInspectionRound(inspections = [], inspectionType = 'FINAL') {
  const normalizedType = String(inspectionType || 'FINAL').toUpperCase()
  const rounds = (inspections || [])
    .filter((row) => String(row?.inspection_type || '').toUpperCase() === normalizedType)
    .map((row) => Number(row?.round_number || 0))
  return Math.max(0, ...rounds) + 1
}

function getNextFinalInspectionRound(inspections = []) {
  return getNextCmtInspectionRound(inspections, 'FINAL')
}

function getEmptyChecklist(options = []) {
  return options.reduce((accumulator, item) => {
    accumulator[item] = false
    return accumulator
  }, {})
}

function createCmtInspectionDraft(productDetail = {}) {
  const orderQty = parseNumberValue(productDetail?.financeSummary?.plannedQty || productDetail?.qty || 0)
  return {
    inspectionType: 'FINAL',
    roundNumber: String(getNextFinalInspectionRound(productDetail?.cmtInspections || [])),
    inspectionDate: getTodayDateInputValue(),
    samplingQty: '',
    printingQty: '',
    printingPct: '',
    cuttingQty: '',
    cuttingPct: '',
    sewingQty: '',
    sewingPct: '',
    acceptanceStandard: '',
    rejectStandard: '',
    acceptQty: '',
    rejectQty: '',
    measurementPdfPath: '',
    qcInformation: getEmptyChecklist(CMT_QC_INFO_OPTIONS),
    accessoriesChecklist: getEmptyChecklist(CMT_ACCESSORIES_OPTIONS),
    packingInformation: getEmptyChecklist(CMT_PACKING_OPTIONS),
    inspectionResult: '',
    notes: '',
    orderQty: String(orderQty || 0),
  }
}

function getCmtInspectionTitle(row = {}) {
  const type = String(row?.inspection_type || '').trim().toUpperCase()
  const roundNumber = Number(row?.round_number || 1)
  if (type === 'INLINE') return `In-Line Round ${roundNumber || 1}`
  if (type === 'PREFINAL') return 'Pre-Final'
  return `Final Round ${roundNumber || 1}`
}

function getCmtInspectionReportTitle(row = {}) {
  const type = String(row?.inspection_type || '').trim().toUpperCase()
  if (type === 'INLINE') return 'IN-LINE INSPECTION REPORT'
  if (type === 'PREFINAL') return 'PRE-FINAL INSPECTION REPORT'
  return 'FINAL INSPECTION REPORT'
}

function getCmtInspectionRoundSubtitle(row = {}) {
  const type = String(row?.inspection_type || '').trim().toUpperCase()
  if (type === 'PREFINAL') return 'Pre-Final'
  return `Round ${Number(row?.round_number || 1) || 1}`
}

function getCmtInspectionResultLabel(row = {}) {
  const type = String(row?.inspection_type || '').trim().toUpperCase()
  if (type === 'PREFINAL') return row?.prefinal_pdf_path ? 'PDF Uploaded' : 'PDF Missing'
  return String(row?.inspection_result || 'Draft').replace('_', ' ')
}

function getCmtInspectionDefectQty(row = {}) {
  return (row.defects || []).reduce((sum, defect) => sum + Number(defect?.major_qty || 0) + Number(defect?.minor_qty || 0), 0)
}

function getCmtInspectionPhotoList(row = {}) {
  if (!row) return []
  return Array.isArray(row.defect_photo_urls) ? row.defect_photo_urls : []
}

function sortCmtInspectionsByDate(rows = []) {
  return [...rows].sort((left, right) => {
    const leftTime = new Date(left?.inspection_date || left?.created_at || 0).getTime() || 0
    const rightTime = new Date(right?.inspection_date || right?.created_at || 0).getTime() || 0
    if (leftTime !== rightTime) return leftTime - rightTime
    const typeCompare = String(left?.inspection_type || '').localeCompare(String(right?.inspection_type || ''))
    if (typeCompare) return typeCompare
    return Number(left?.round_number || 0) - Number(right?.round_number || 0)
  })
}

function getCheckedChecklistItems(value = {}) {
  return Object.entries(value || {})
    .filter(([, isChecked]) => Boolean(isChecked))
    .map(([label]) => label)
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
    .select('id, status, total_qty, actual_qty')
    .eq('po_id', normalizedPoId)

  if (itemError) {
    throw new Error(itemError.message)
  }

  const items = itemRows || []
  const itemIds = items.map((row) => row.id).filter(Boolean)
  const { data: receiptRows, error: receiptError } = itemIds.length
    ? await supabase
        .from('arkline_po_item_receipts')
        .select('arkline_po_item_id, received_qty')
        .in('arkline_po_item_id', itemIds)
    : { data: [], error: null }

  if (receiptError) {
    throw new Error(receiptError.message)
  }

  const receiptQtyByItemId = (receiptRows || []).reduce((accumulator, row) => {
    const itemId = String(row?.arkline_po_item_id || '').trim()
    if (!itemId) return accumulator
    accumulator[itemId] = (accumulator[itemId] || 0) + Number(row?.received_qty || 0)
    return accumulator
  }, {})

  const normalizedItems = items.map((row) => {
    const actualQty = Number(receiptQtyByItemId[String(row?.id || '').trim()] ?? row?.actual_qty ?? 0)
    const totalQty = Number(row?.total_qty || 0)
    const savedStatus = normalizeBoardStatus(row?.status)
    const status =
      savedStatus === 'Completed' || (totalQty > 0 && actualQty >= totalQty)
        ? 'Completed'
        : actualQty > 0
          ? 'On Progress'
          : savedStatus

    return { ...row, actualQty, totalQty, status }
  })

  const nextStatus =
    normalizedItems.length && normalizedItems.every((row) => row.status === 'Completed')
      ? 'Completed'
      : normalizedItems.some((row) => row.actualQty > 0 || row.status === 'Completed')
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
    paidAt: row?.paid_at || '',
    createdAt: row?.created_at || '',
    invoiceNumber: String(row?.invoice_number || '').trim().toUpperCase(),
    paymentLabel: String(row?.invoice_number || row?.status || 'Payment').trim() || 'Payment',
    amount: parseNumberValue(row?.amount),
    notes: row?.notes || '',
    status: String(row?.status || 'SUBMITTED').trim().toUpperCase() || 'SUBMITTED',
    attachments: Array.isArray(row?.attachments) ? row.attachments.map(normalizeFinanceAttachmentRow) : [],
  }
}

function isPaidFinancePayment(row) {
  return String(row?.status || '').trim().toUpperCase() === 'PAID' || Boolean(row?.paidAt)
}

function normalizeFinanceAttachmentRow(row) {
  return {
    id: row?.id || '',
    storageBucket: String(row?.storage_bucket || PAYMENT_REQUEST_BUCKET).trim(),
    storagePath: String(row?.storage_path || '').trim(),
    fileName: String(row?.file_name || 'Attachment').trim(),
    mimeType: String(row?.mime_type || '').trim(),
    createdAt: row?.created_at || '',
  }
}

function getFinanceAttachmentKind(attachment) {
  return String(attachment?.storagePath || '').includes('/payment-proof/') ? 'PAYMENT_PROOF' : 'SUBMISSION_PROOF'
}

function getFinanceAttachmentsByKind(payment, kind) {
  return (payment?.attachments || []).filter((attachment) => getFinanceAttachmentKind(attachment) === kind)
}

function buildReceiptDocumentRows(receipts = []) {
  const grouped = new Map()

  ;(receipts || []).forEach((row) => {
    const receiveDate = String(row?.receive_date || '').slice(0, 10)
    if (!receiveDate) return
    const key = [receiveDate, String(row?.supplier_sj || '').trim().toUpperCase()].join('::')
    const existing = grouped.get(key) || {
      key,
      receiveDate,
      supplierSj: String(row?.supplier_sj || '').trim(),
      qty: 0,
    }
    existing.qty += Number(row?.received_qty || 0)
    grouped.set(key, existing)
  })

  return Array.from(grouped.values()).sort((left, right) => {
    const leftTime = parseIso(left.receiveDate)?.getTime() || 0
    const rightTime = parseIso(right.receiveDate)?.getTime() || 0
    if (leftTime !== rightTime) return rightTime - leftTime
    return left.key.localeCompare(right.key, undefined, { numeric: true })
  })
}

function buildGarmentPrintBundle(rawBundle) {
  const po = rawBundle?.po || {}
  const supplier = rawBundle?.supplier || {}
  const supplierContact = [supplier.contactPerson, supplier.phone].filter(Boolean).join(' | ')

  return {
    poId: String(po.po_id || '').trim().toUpperCase(),
    method: String(po.method || '').trim().toUpperCase(),
    poCreatedAt: po.created_at,
    header: {
      supplierName: supplier.supplierName || String(po.supplier_name || '').trim().toUpperCase() || '-',
      supplierAddress: supplier.address || '',
      supplierContact,
      requestDeliveryDate: po.request_delivery_date || '',
      paymentTerms: String(po.payment_terms || po.method || '').trim(),
      notes: String(po.notes || '').trim(),
      includePpn: normalizeBoolean(po.include_ppn, true),
    },
    items: rawBundle?.items || [],
  }
}

const QC_GRADE_OPTIONS = ['A', 'B', 'C']

function normalizeQcGrade(value, fallback = '') {
  const grade = String(value || '').trim().toUpperCase()
  return QC_GRADE_OPTIONS.includes(grade) ? grade : fallback
}

function applyArklineAdjustmentsToGradeTotals(qtyA, qtyB, qtyC, adjustmentRows = []) {
  const totals = {
    A: Number(qtyA || 0),
    B: Number(qtyB || 0),
    C: Number(qtyC || 0),
  }

  function moveQty(fromGrade, toGrade, rawQty) {
    const sourceGrade = normalizeQcGrade(fromGrade)
    const targetGrade = normalizeQcGrade(toGrade)
    const qty = Math.max(0, Number(rawQty || 0))
    if (!sourceGrade || !targetGrade || sourceGrade === targetGrade || !qty) return 0

    const appliedQty = Math.min(totals[sourceGrade], qty)
    totals[sourceGrade] -= appliedQty
    totals[targetGrade] += appliedQty
    return appliedQty
  }

  function reduceGrade(grade, rawQty) {
    const targetGrade = normalizeQcGrade(grade)
    const qty = Math.max(0, Number(rawQty || 0))
    if (!targetGrade || !qty) return 0

    const appliedQty = Math.min(totals[targetGrade], qty)
    totals[targetGrade] -= appliedQty
    return appliedQty
  }

  adjustmentRows.forEach((row) => {
    const type = String(row?.adjustment_type || '').trim().toLowerCase()
    const qty = Number(row?.qty || 0)
    if (!qty) return

    if (type === 'transfer') {
      if (qty > 0) moveQty(row.from_grade, row.to_grade, qty)
      if (qty < 0) moveQty(row.to_grade, row.from_grade, Math.abs(qty))
      return
    }

    if (type === 'bc_to_a') {
      if (qty > 0) {
        const movedFromC = moveQty('C', 'A', qty)
        moveQty('B', 'A', Math.max(0, qty - movedFromC))
      } else {
        moveQty('A', 'C', Math.abs(qty))
      }
      return
    }

    if (type === 'inspector_data_error') {
      const affectedGrade = normalizeQcGrade(row.affected_grade)
      if (affectedGrade) {
        if (qty > 0) reduceGrade(affectedGrade, qty)
        if (qty < 0) totals[affectedGrade] += Math.abs(qty)
        return
      }

      if (qty > 0) {
        const reducedFromC = reduceGrade('C', qty)
        reduceGrade('B', Math.max(0, qty - reducedFromC))
      } else {
        totals.C += Math.abs(qty)
      }
    }
  })

  return {
    qtyA: totals.A,
    qtyB: totals.B,
    qtyC: totals.C,
  }
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

  const adjustedTotals = applyArklineAdjustmentsToGradeTotals(summary.qtyA, summary.qtyB, summary.qtyC, adjustmentRows)
  summary.qtyA = adjustedTotals.qtyA
  summary.qtyB = adjustedTotals.qtyB
  summary.qtyC = adjustedTotals.qtyC

  return {
    ...summary,
    totalQc: summary.qtyA + summary.qtyB + summary.qtyC,
  }
}

function isUnidentifiedRejectRow(row = {}) {
  return String(row?.reason || '').trim().toUpperCase() === 'BELUM DIKATEGORIKAN'
}

function compareRejectSummaryRows(left, right) {
  const leftUnidentified = isUnidentifiedRejectRow(left)
  const rightUnidentified = isUnidentifiedRejectRow(right)
  if (leftUnidentified !== rightUnidentified) return leftUnidentified ? 1 : -1
  if (Number(right.qty || 0) !== Number(left.qty || 0)) return Number(right.qty || 0) - Number(left.qty || 0)
  return String(left.reason || '').localeCompare(String(right.reason || ''))
}

function compareReturnReasonRows(left, right) {
  const leftUnidentified = isUnidentifiedRejectRow(left)
  const rightUnidentified = isUnidentifiedRejectRow(right)
  if (leftUnidentified !== rightUnidentified) return leftUnidentified ? 1 : -1
  const reasonCompare = String(left.reason || '').localeCompare(String(right.reason || ''))
  if (reasonCompare) return reasonCompare
  const gradeCompare = String(left.grade || '').localeCompare(String(right.grade || ''))
  if (gradeCompare) return gradeCompare
  return String(left.size || '').localeCompare(String(right.size || ''), undefined, { numeric: true })
}

function groupRejectDetailRows(rows = []) {
  const grouped = new Map()

  ;(rows || []).forEach((row) => {
    const reason = String(row?.reason?.reason_name || row?.reason_name || '').trim() || 'Belum dikategorikan'
    const grade = normalizeQcGrade(row?.grade, 'B/C')
    const isRepairable = Boolean(row?.reason?.is_repairable)
    const key = `${isRepairable ? 'repairable' : 'non-repairable'}::${reason}::${grade}`
    const qty = Number(row?.qty || 0)
    const current = grouped.get(key) || { key, reason, grade, isRepairable, qty: 0 }
    current.qty += qty
    grouped.set(key, current)
  })

  return Array.from(grouped.values())
    .filter((row) => Number(row.qty || 0) > 0)
    .sort(compareRejectSummaryRows)
}

function mergeRejectSummaryRows(targetRows, sourceRows) {
  const grouped = new Map((targetRows || []).map((row) => [row.key, { ...row }]))

  ;(sourceRows || []).forEach((row) => {
    const key = row.key || `${row.isRepairable ? 'repairable' : 'non-repairable'}::${row.reason}::${row.grade}`
    const current = grouped.get(key) || { ...row, key, qty: 0 }
    current.qty += Number(row.qty || 0)
    grouped.set(key, current)
  })

  return Array.from(grouped.values())
    .filter((row) => Number(row.qty || 0) > 0)
    .sort(compareRejectSummaryRows)
}

function capRejectSummaryRows(summaryRows = [], targetQty = 0) {
  const normalizedTarget = Math.max(0, Number(targetQty || 0))
  const totalQty = (summaryRows || []).reduce((sum, row) => sum + Number(row.qty || 0), 0)
  if (!normalizedTarget || !totalQty) return []
  if (totalQty <= normalizedTarget) return summaryRows

  let excessQty = totalQty - normalizedTarget
  const cappedRows = (summaryRows || []).map((row) => ({ ...row }))
  const smallestRowsFirst = [...cappedRows]
    .filter((row) => row.reason !== 'Belum dikategorikan')
    .sort((left, right) => {
      if (Number(left.qty || 0) !== Number(right.qty || 0)) return Number(left.qty || 0) - Number(right.qty || 0)
      return String(left.reason || '').localeCompare(String(right.reason || ''))
    })
  const unidentifiedRowsLast = [...cappedRows]
    .filter((row) => row.reason === 'Belum dikategorikan')
    .sort((left, right) => {
      if (Number(left.qty || 0) !== Number(right.qty || 0)) return Number(left.qty || 0) - Number(right.qty || 0)
      return String(left.reason || '').localeCompare(String(right.reason || ''))
    })

  for (const row of [...smallestRowsFirst, ...unidentifiedRowsLast]) {
    if (excessQty <= 0) break
    const reduction = Math.min(Number(row.qty || 0), excessQty)
    row.qty -= reduction
    excessQty -= reduction
  }

  return cappedRows
    .filter((row) => Number(row.qty || 0) > 0)
    .sort(compareRejectSummaryRows)
}

function getUnidentifiedRejectGrade(qcSummary = {}) {
  const qtyB = Number(qcSummary.qtyB || 0)
  const qtyC = Number(qcSummary.qtyC || 0)
  if (qtyB > 0 && qtyC > 0) return 'B/C'
  if (qtyC > 0) return 'C'
  if (qtyB > 0) return 'B'
  return 'B/C'
}

function buildRejectRowsForSummaryTarget(rows = [], qcSummary = {}) {
  const targetRejectQty = Number(qcSummary.qtyB || 0) + Number(qcSummary.qtyC || 0)
  const cappedRows = capRejectSummaryRows(groupRejectDetailRows(rows), targetRejectQty)
  const identifiedQty = cappedRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)

  const unidentifiedQty = Math.max(Number(qcSummary.qtyB || 0) + Number(qcSummary.qtyC || 0) - identifiedQty, 0)
  if (unidentifiedQty > 0) {
    cappedRows.push({
      key: `unidentified::${getUnidentifiedRejectGrade(qcSummary)}`,
      reason: 'Belum dikategorikan',
      grade: getUnidentifiedRejectGrade(qcSummary),
      isRepairable: false,
      qty: unidentifiedQty,
    })
  }

  return cappedRows.sort(compareRejectSummaryRows)
}

function buildRejectDetailSummary(rows, qcSummary = {}, context = {}) {
  const qcRows = context?.qcRows || []
  if (!qcRows.length) return buildRejectRowsForSummaryTarget(rows, qcSummary)

  const selectedOption = context?.selectedOption || {}
  const adjustmentRows = context?.adjustmentRows || []

  if (selectedOption.value && selectedOption.value !== 'all') {
    return buildRejectRowsForSummaryTarget(rows, qcSummary)
  }

  const periodOptions = (context?.options || []).filter((option) => option.value && option.value !== 'all')
  if (!periodOptions.length) return buildRejectRowsForSummaryTarget(rows, qcSummary)

  const assignedQcIds = new Set()
  const assignedAdjustmentIds = new Set()
  const bucketSummaries = periodOptions.map((option) => {
    const bucketQcRows = qcRows.filter((row) => isDateWithinReceiptPeriod(getQcRowActivityDate(row), option.startDate, option.nextDate))
    bucketQcRows.forEach((row) => assignedQcIds.add(String(row.id || '')))
    const bucketQcIds = new Set(bucketQcRows.map((row) => String(row.id || '')).filter(Boolean))
    const bucketQcCycleIds = new Set(bucketQcRows.map((row) => String(row.qc_cycle_id || '')).filter(Boolean))
    const bucketRejectRows = (rows || []).filter((row) => {
      const rowQcId = String(row.arkline_qc_id || '').trim()
      if (rowQcId) return bucketQcIds.has(rowQcId)
      return isDateWithinReceiptPeriod(row.created_at, option.startDate, option.nextDate)
    })
    const bucketAdjustmentRows = adjustmentRows.filter((row) => {
      const rowCycleId = String(row.qc_cycle_id || '').trim()
      const matchesCycle = rowCycleId ? bucketQcCycleIds.has(rowCycleId) : true
      const matchesDate = isDateWithinReceiptPeriod(getArklineAdjustmentDateValue(row), option.startDate, option.nextDate)
      if (matchesCycle && matchesDate) assignedAdjustmentIds.add(String(row.id || ''))
      return matchesCycle && matchesDate
    })

    return buildRejectRowsForSummaryTarget(bucketRejectRows, buildQcGradeSummary(bucketQcRows, bucketAdjustmentRows))
  })

  const unbucketedQcRows = qcRows.filter((row) => !assignedQcIds.has(String(row.id || '')))
  if (unbucketedQcRows.length) {
    const unbucketedQcIds = new Set(unbucketedQcRows.map((row) => String(row.id || '')).filter(Boolean))
    const unbucketedQcCycleIds = new Set(unbucketedQcRows.map((row) => String(row.qc_cycle_id || '')).filter(Boolean))
    const unbucketedRejectRows = (rows || []).filter((row) => unbucketedQcIds.has(String(row.arkline_qc_id || '')))
    const unbucketedAdjustmentRows = adjustmentRows.filter((row) => {
      const rowId = String(row.id || '')
      const rowCycleId = String(row.qc_cycle_id || '').trim()
      return !assignedAdjustmentIds.has(rowId) && (rowCycleId ? unbucketedQcCycleIds.has(rowCycleId) : true)
    })
    bucketSummaries.push(buildRejectRowsForSummaryTarget(unbucketedRejectRows, buildQcGradeSummary(unbucketedQcRows, unbucketedAdjustmentRows)))
  }

  const mergedRows = bucketSummaries.reduce((mergedRows, bucketRows) => mergeRejectSummaryRows(mergedRows, bucketRows), [])
  const rawRejectQty = groupRejectDetailRows(rows).reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const finalTargetQty = rawRejectQty > 0 ? rawRejectQty : Number(qcSummary.qtyB || 0) + Number(qcSummary.qtyC || 0)
  return capRejectSummaryRows(mergedRows, finalTargetQty)
}

function normalizeAllIncomingQcSummary(qcSummary = {}, rejectSummary = [], receivingQty = 0, selectedOption = {}) {
  if (selectedOption?.value !== 'all') return qcSummary

  const normalizedTotalQc = Number(qcSummary.totalQc || 0) || Number(receivingQty || 0)
  const rejectTotals = (rejectSummary || []).reduce(
    (totals, row) => {
      const qty = Number(row?.qty || 0)
      const grade = normalizeQcGrade(row?.grade)
      if (grade === 'B') totals.qtyB += qty
      else totals.qtyC += qty
      return totals
    },
    { qtyB: 0, qtyC: 0 }
  )
  const rejectQty = rejectTotals.qtyB + rejectTotals.qtyC

  if (!normalizedTotalQc || !rejectQty) return qcSummary

  return {
    ...qcSummary,
    qtyA: Math.max(normalizedTotalQc - rejectQty, 0),
    qtyB: rejectTotals.qtyB,
    qtyC: rejectTotals.qtyC,
    totalQc: normalizedTotalQc,
  }
}

function buildRepairabilitySummary(rows = []) {
  return (rows || []).reduce(
    (accumulator, row) => {
      const qty = Number(row?.qty || 0)
      const isRepairable =
        typeof row?.isRepairable === 'boolean'
          ? row.isRepairable
          : Boolean(row?.reason?.is_repairable)
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
  const summary = (batch.qcRows || []).reduce(
    (summary, row) => {
      summary.a += Number(row?.qty_a || 0)
      summary.b += Number(row?.qty_b || 0)
      summary.c += Number(row?.qty_c || 0)
      return summary
    },
    { a: 0, b: 0, c: 0 }
  )

  const adjustedTotals = applyArklineAdjustmentsToGradeTotals(summary.a, summary.b, summary.c, batch.adjustmentRows || [])
  return {
    a: adjustedTotals.qtyA,
    b: adjustedTotals.qtyB,
    c: adjustedTotals.qtyC,
  }
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

function buildReturnReasonSummary(rows = [], qcSummary = {}) {
  let identifiedQty = 0
  const summaryRows = Array.from(
    (rows || []).reduce((grouped, row) => {
      const reason = String(row?.reasonName || row?.reason?.reason_name || 'Belum dikategorikan').trim() || 'Belum dikategorikan'
      const grade = String(row?.grade || '-').trim().toUpperCase() || '-'
      const size = String(row?.size || '-').trim().toUpperCase() || '-'
      const qty = Number(row?.qty || 0)
      const key = `${reason}::${grade}::${size}`
      const current = grouped.get(key) || { key, reason, grade, size, qty: 0 }
      current.qty += qty
      identifiedQty += qty
      grouped.set(key, current)
      return grouped
    }, new Map()).values()
  ).sort(compareReturnReasonRows)

  const unidentifiedQty = Math.max(Number(qcSummary.b || 0) + Number(qcSummary.c || 0) - identifiedQty, 0)
  if (unidentifiedQty > 0) {
    summaryRows.push({
      key: `uncategorized::B/C::ALL::${unidentifiedQty}`,
      reason: 'Belum dikategorikan',
      grade: 'B/C',
      size: 'ALL',
      qty: unidentifiedQty,
    })
  }

  return summaryRows.sort(compareReturnReasonRows)
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
        .filter((row) => String(row?.receipt_type || 'INITIAL').trim().toUpperCase() === 'INITIAL')
        .map((row) => String(row?.receive_date || '').slice(0, 10))
        .filter(Boolean)
    )
  ).sort()

  if (dates.length <= 1) {
    return [{ value: 'all', label: 'All Incoming Goods', startDate: '', nextDate: '' }]
  }

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

function getArklineAdjustmentDateValue(row = {}) {
  return row.effective_date || row.created_at || row.updated_at || ''
}

function isInitialArklineQcRow(row = {}) {
  return String(row?.qc_type || 'INITIAL').trim().toUpperCase() !== 'RE_QC'
}

function isReturnArklineQcRow(row = {}) {
  return String(row?.qc_type || '').trim().toUpperCase() === 'RE_QC' || Boolean(row?.source_return_batch_id)
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
  const qcCycleIds = new Set(qcRows.map((row) => String(row.qc_cycle_id || '')).filter(Boolean))
  const rejectRows = (productDetail?.qcRejectRows || []).filter(
    (row) => {
      const rowQcId = String(row.arkline_qc_id || '').trim()
      if (rowQcId) return qcIds.has(rowQcId)
      return isDateWithinReceiptPeriod(row.created_at, startDate, nextDate)
    }
  )
  const adjustmentRows = (productDetail?.qcRejectAdjustments || []).filter((row) => {
    const rowCycleId = String(row.qc_cycle_id || '').trim()
    const matchesCycle = rowCycleId ? qcCycleIds.has(rowCycleId) : true
    return matchesCycle && isDateWithinReceiptPeriod(getArklineAdjustmentDateValue(row), startDate, nextDate)
  })
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
  const searchParams = useSearchParams()
  const canOpenKanbanDetail = role === 'admin' || access.progressKanbanAdd || access.progressKanbanEdit
  const requestedPoId = String(searchParams.get('po') || '').trim().toUpperCase()
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
  const [openedPoParam, setOpenedPoParam] = useState('')
  const [poDetailSections, setPoDetailSections] = useState({
    productLists: false,
    finance: false,
    documentHistory: false,
  })
  const [printingPoDetail, setPrintingPoDetail] = useState(false)
  const [uploadingSignedPo, setUploadingSignedPo] = useState(false)
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
    cmtInspection: false,
    returnHistory: false,
  })
  const [productActionMessage, setProductActionMessage] = useState('')
  const [productActionError, setProductActionError] = useState('')
  const [printingQcReport, setPrintingQcReport] = useState(false)
  const [printingReturnHistory, setPrintingReturnHistory] = useState(false)
  const [printingCmtInspectionId, setPrintingCmtInspectionId] = useState('')
  const [qcReceiptDateFilter, setQcReceiptDateFilter] = useState('all')
  const [expandedReturnBatchId, setExpandedReturnBatchId] = useState('')
  const [savingStatusChange, setSavingStatusChange] = useState(false)
  const [shortageBatch, setShortageBatch] = useState(null)
  const [shortageNotes, setShortageNotes] = useState('')
  const [savingShortage, setSavingShortage] = useState(false)
  const [manualCompleteOpen, setManualCompleteOpen] = useState(false)
  const [savingManualComplete, setSavingManualComplete] = useState(false)
  const [manualCompleteDraft, setManualCompleteDraft] = useState({ completionDate: '', notes: '' })
  const [hppModalOpen, setHppModalOpen] = useState(false)
  const [hppDraft, setHppDraft] = useState('')
  const [savingHpp, setSavingHpp] = useState(false)
  const [cmtInspectionModalOpen, setCmtInspectionModalOpen] = useState(false)
  const [savingCmtInspection, setSavingCmtInspection] = useState(false)
  const [cmtInspectionDraft, setCmtInspectionDraft] = useState(() => createCmtInspectionDraft())
  const [cmtDefectDrafts, setCmtDefectDrafts] = useState([])
  const [cmtRejectReasons, setCmtRejectReasons] = useState([])
  const [cmtPrefinalPdfFile, setCmtPrefinalPdfFile] = useState(null)
  const [cmtPrefinalPdfPreview, setCmtPrefinalPdfPreview] = useState(null)
  const [cmtMeasurementPdfFile, setCmtMeasurementPdfFile] = useState(null)
  const [cmtMeasurementPdfPreview, setCmtMeasurementPdfPreview] = useState(null)
  const [cmtDefectPhotoFiles, setCmtDefectPhotoFiles] = useState([])
  const [cmtDefectPhotoPreviews, setCmtDefectPhotoPreviews] = useState([])
  const [cmtAttachmentPreview, setCmtAttachmentPreview] = useState(null)
  const [selectedCmtInspectionDetail, setSelectedCmtInspectionDetail] = useState(null)
  const [cmtSavedPhotoPreviews, setCmtSavedPhotoPreviews] = useState([])
  const [cmtReasonFocusIndex, setCmtReasonFocusIndex] = useState(null)
  const [receiptDraft, setReceiptDraft] = useState({ receiveDate: '', supplierSj: '', notes: '', sizeQty: {}, isFinal: false })
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

  useEffect(() => {
    const previews = cmtDefectPhotoFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }))
    setCmtDefectPhotoPreviews(previews)

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url))
    }
  }, [cmtDefectPhotoFiles])

  useEffect(() => {
    if (!cmtPrefinalPdfFile) {
      setCmtPrefinalPdfPreview(null)
      return undefined
    }

    const preview = {
      file: cmtPrefinalPdfFile,
      url: URL.createObjectURL(cmtPrefinalPdfFile),
    }
    setCmtPrefinalPdfPreview(preview)

    return () => {
      URL.revokeObjectURL(preview.url)
    }
  }, [cmtPrefinalPdfFile])

  useEffect(() => {
    if (!cmtMeasurementPdfFile) {
      setCmtMeasurementPdfPreview(null)
      return undefined
    }

    const preview = {
      file: cmtMeasurementPdfFile,
      url: URL.createObjectURL(cmtMeasurementPdfFile),
    }
    setCmtMeasurementPdfPreview(preview)

    return () => {
      URL.revokeObjectURL(preview.url)
    }
  }, [cmtMeasurementPdfFile])

  useEffect(() => {
    let cancelled = false

    async function loadSavedPhotoPreviews() {
      const photos = getCmtInspectionPhotoList(selectedCmtInspectionDetail)
      if (!photos.length) {
        setCmtSavedPhotoPreviews([])
        return
      }

      const previewRows = await Promise.all(
        photos.map(async (photo, index) => {
          const path = String(photo?.path || '').trim()
          if (!path) {
            return { ...photo, index, previewUrl: '' }
          }
          const { data } = await supabase.storage.from(CMT_INSPECTION_BUCKET).createSignedUrl(path, 60 * 60)
          return { ...photo, index, previewUrl: data?.signedUrl || '' }
        })
      )

      if (!cancelled) {
        setCmtSavedPhotoPreviews(previewRows)
      }
    }

    void loadSavedPhotoPreviews()

    return () => {
      cancelled = true
    }
  }, [selectedCmtInspectionDetail])

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
    setPrintingPoDetail(false)
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
      documentHistory: {
        receipts: [],
        signedPoFiles: [],
      },
    })
    setPoDetailSections({
      productLists: false,
      finance: false,
      documentHistory: false,
    })
    setSelectedProductDetail(null)

    const poItemIds = (item.productEntries || []).map((entry) => String(entry?.id || '').trim()).filter(Boolean)
    const [paymentRowsRaw, receiptRowsRaw, signedPoFiles] = await Promise.all([
      loadOptionalRows(() =>
        supabase
          .from('arkline_payment')
          .select(
            `id, payment_basis, po_source_type, po_db_id, po_number, invoice_number, amount, notes, status, paid_at, created_at,
            attachments:arkline_payment_attachments(id, storage_bucket, storage_path, file_name, mime_type, file_size, uploaded_by, created_at)`
          )
          .eq('payment_basis', 'PO_BASED')
          .eq('po_source_type', 'GARMENT')
          .eq('po_number', item.poId)
          .order('created_at', { ascending: false })
      ),
      poItemIds.length
        ? loadOptionalRows(() =>
            supabase
              .from('arkline_po_item_receipts')
              .select('id, arkline_po_item_id, receipt_group_id, receive_date, supplier_sj, received_qty, created_at')
              .in('arkline_po_item_id', poItemIds)
              .eq('receipt_type', 'INITIAL')
              .order('receive_date', { ascending: false })
          )
        : Promise.resolve([]),
      loadSignedPoFiles(item.poId),
    ])

    const paymentRows = (paymentRowsRaw || []).map(normalizeFinancePaymentRow)
    const receiptRows = buildReceiptDocumentRows(receiptRowsRaw || [])

    setSelectedPoDetail((prev) => {
      if (!prev || String(prev.id) !== String(item.id)) return prev
      return {
        ...prev,
        payments: paymentRows,
        documentHistory: {
          receipts: receiptRows,
          signedPoFiles,
        },
      }
    })
  }

  useEffect(() => {
    if (!requestedPoId || loading || !canOpenKanbanDetail || openedPoParam === requestedPoId) return

    const targetPo = filteredRows.find((item) => String(item.poId || '').trim().toUpperCase() === requestedPoId)
    if (!targetPo) return

    setView('kanban')
    setOpenedPoParam(requestedPoId)
    void openPoDetail(targetPo)
  }, [canOpenKanbanDetail, filteredRows, loading, openedPoParam, requestedPoId])

  function togglePoDetailSection(sectionKey) {
    setPoDetailSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  async function handlePrintPoDetail() {
    if (!selectedPoDetail || printingPoDetail) return

    const previewWindow = openPreviewWindow('Preparing purchase order preview...')
    if (!previewWindow) {
      setMessage('Popup blocked. Please allow popups to print the PO.')
      return
    }

    setPrintingPoDetail(true)
    setMessage('')

    try {
      const bundle = buildGarmentPrintBundle(await fetchGarmentPoBundle(supabase, selectedPoDetail.poId))
      const previewHtml = await createGarmentPurchaseOrderPreviewHtml(bundle)
      previewWindow.document.open()
      previewWindow.document.write(previewHtml)
      previewWindow.document.close()
      setMessage(`PO ${selectedPoDetail.poId} print preview opened.`)
    } catch (error) {
      previewWindow.close()
      setMessage(error?.message || 'Failed to prepare purchase order print preview.')
    } finally {
      setPrintingPoDetail(false)
    }
  }

  async function openFinanceAttachment(attachment) {
    const storageBucket = String(attachment?.storageBucket || PAYMENT_REQUEST_BUCKET).trim()
    const storagePath = String(attachment?.storagePath || '').trim()
    if (!storageBucket || !storagePath) return

    const { data, error } = await supabase.storage.from(storageBucket).createSignedUrl(storagePath, 300)
    if (error) {
      setMessage(error.message || 'Failed to open attachment.')
      return
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  async function openSignedPoAttachment(attachment) {
    const storagePath = String(attachment?.storagePath || '').trim()
    if (!storagePath) return

    const { data, error } = await supabase.storage.from(CMT_INSPECTION_BUCKET).createSignedUrl(storagePath, 300)
    if (error) {
      setMessage(error.message || 'Failed to open signed PO.')
      return
    }

    if (!data?.signedUrl) return
    const previewType = getStorageAttachmentPreviewType(attachment)
    if (previewType === 'pdf' || previewType === 'image') {
      setCmtAttachmentPreview({
        type: previewType,
        url: data.signedUrl,
        title: attachment.fileName || 'Signed PO',
      })
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleSignedPoUpload(files) {
    if (!selectedPoDetail || uploadingSignedPo) return
    const uploadFiles = Array.from(files || []).filter(Boolean)
    if (!uploadFiles.length) return

    setUploadingSignedPo(true)
    setMessage('')
    const uploadedPaths = []

    try {
      const folder = getSignedPoStorageFolder(selectedPoDetail.poId)
      for (const file of uploadFiles) {
        const safeName = sanitizeFileName(file.name || 'signed-po')
        const filePath = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`
        const { error } = await supabase.storage.from(CMT_INSPECTION_BUCKET).upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })
        if (error) throw new Error(error.message || `Failed to upload ${file.name || 'signed PO'}.`)
        uploadedPaths.push(filePath)
      }

      const signedPoFiles = await loadSignedPoFiles(selectedPoDetail.poId)
      setSelectedPoDetail((prev) => {
        if (!prev || String(prev.poId || '') !== String(selectedPoDetail.poId || '')) return prev
        return {
          ...prev,
          documentHistory: {
            ...(prev.documentHistory || {}),
            signedPoFiles,
          },
        }
      })
      setMessage(`${uploadFiles.length} signed PO file(s) uploaded.`)
    } catch (error) {
      if (uploadedPaths.length) {
        await supabase.storage.from(CMT_INSPECTION_BUCKET).remove(uploadedPaths)
      }
      setMessage(error?.message || 'Failed to upload signed PO.')
    } finally {
      setUploadingSignedPo(false)
    }
  }

  async function openProductDetail(entry) {
    if (!selectedPoDetail || !entry) return
    setProductDetailLoading(true)
    setProductActionMessage('')
    setProductActionError('')
    setExpandedReturnBatchId('')
    setQcReceiptDateFilter('all')
    setManualCompleteOpen(false)
    setHppModalOpen(false)
    setCmtInspectionModalOpen(false)
    setSelectedCmtInspectionDetail(null)
    setCmtPrefinalPdfFile(null)
    setCmtMeasurementPdfFile(null)
    setCmtDefectPhotoFiles([])
    setCmtDefectDrafts([])
    setProductDetailSections({
      receivingHistory: false,
      updateStatus: false,
      finance: false,
      qcSampleReport: false,
      cmtInspection: false,
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
      returnQcRows: [],
      returnQcRejectAdjustments: [],
      cmtInspections: [],
      financeSummary: null,
      sizeBreakdown: [],
    })
    setReceiptDraft({ receiveDate: '', supplierSj: '', notes: '', sizeQty: {}, isFinal: false })
    setStatusDraft({
      updatedDeliveryDate: entry.updatedDeliveryDate || '',
      reason: DEFAULT_UPDATE_REASON,
      customReason: '',
      notes: '',
    })
    try {
      const [itemRows, sizeRows, receiptRows, updateRows, paymentRowsRaw, qcRowsRaw, returnBatchRows, cmtInspectionRows, cmtRejectReasonRows] = await Promise.all([
        loadOptionalRows(() =>
          supabase
            .from('arkline_po_items')
            .select('id, sku_induk, nama_produk, kategori_pengadaan, kategori_produk, total_qty, actual_qty, allowance_pct, price, hpp, notes, status, updated_delivery_date, completion_date')
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
        loadOptionalRows(() =>
          supabase
            .from('arkline_cmt_inspections')
            .select('*')
            .eq('arkline_po_item_id', entry.id)
            .order('inspection_date', { ascending: false })
            .order('round_number', { ascending: false })
        ),
        loadOptionalRows(() =>
          supabase
            .from('arkline_qc_reject_reasons')
            .select('id, reason_name, is_active')
            .eq('is_active', true)
            .order('reason_name', { ascending: true })
        ),
      ])
      setCmtRejectReasons(cmtRejectReasonRows || [])

      const normalizedItemId = String(entry.id || '').trim()
      const normalizedSku = String(entry.sku || '').trim().toUpperCase()
      const qcRowsByItemId = (qcRowsRaw || []).filter((row) => {
        const rowItemId = String(row?.arkline_po_item_id || '').trim()
        return normalizedItemId && rowItemId === normalizedItemId
      })
      const qcRowsBySku = (qcRowsRaw || []).filter((row) => String(row?.sku_induk || '').trim().toUpperCase() === normalizedSku)
      const qcCandidateRows = Array.from(
        new Map([...(qcRowsByItemId || []), ...(qcRowsBySku || [])].map((row) => [String(row.id), row])).values()
      )
      const qcRows = qcCandidateRows.filter(isInitialArklineQcRow)
      const returnQcRows = qcCandidateRows.filter(isReturnArklineQcRow)
      const qcTaskIds = qcRows.map((row) => row.id).filter(Boolean)
      const qcCycleIds = new Set(qcRows.map((row) => String(row.qc_cycle_id || '')).filter(Boolean))
      const returnQcTaskIds = returnQcRows.map((row) => row.id).filter(Boolean)
      const returnQcTaskIdSet = new Set(returnQcTaskIds.map((id) => String(id)))
      const returnQcCycleIds = new Set(returnQcRows.map((row) => String(row.qc_cycle_id || '')).filter(Boolean))
      const allQcTaskIds = Array.from(new Set([...qcTaskIds, ...returnQcTaskIds].map((id) => String(id)).filter(Boolean)))
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

        if (!allQcTaskIds.length) return query.limit(0)

        query = query.in('arkline_qc_id', allQcTaskIds)

        return query
      })
      const initialRejectDetailRows = (rejectDetailRows || []).filter((row) => !returnQcTaskIdSet.has(String(row.arkline_qc_id || '')))
      const returnRejectDetailRows = (rejectDetailRows || []).filter((row) => returnQcTaskIdSet.has(String(row.arkline_qc_id || '')))
      const rejectAdjustmentRowsRaw = await loadOptionalRows(() => {
        let query = supabase
          .from('arkline_qc_reject_adjustments')
          .select('*')
          .order('created_at', { ascending: false })

        if (selectedPoDetail.poId && normalizedSku) {
          query = query.eq('po_id', selectedPoDetail.poId).eq('sku_induk', normalizedSku)
        } else if (normalizedItemId) {
          query = query.eq('arkline_po_item_id', normalizedItemId)
        } else {
          query = query.limit(0)
        }

        return query
      })
      const rejectAdjustmentRows = (rejectAdjustmentRowsRaw || []).filter((row) => {
        const cycleId = String(row?.qc_cycle_id || '')
        return !cycleId || qcCycleIds.has(cycleId)
      })
      const returnRejectAdjustmentRows = (rejectAdjustmentRowsRaw || []).filter((row) => {
        const cycleId = String(row?.qc_cycle_id || '')
        return cycleId && returnQcCycleIds.has(cycleId)
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
        const batchQcRows = returnQcRows.filter((row) => String(row.source_return_batch_id || '') === String(batch.id))
        const batchQcIds = new Set(batchQcRows.map((row) => String(row.id)))
        const batchQcCycleIds = new Set(batchQcRows.map((row) => String(row.qc_cycle_id || '')).filter(Boolean))
        return {
          ...batch,
          lines: linesByBatch.get(String(batch.id)) || [],
          receipts: receiptsByBatch.get(String(batch.id)) || [],
          qcRows: batchQcRows,
          adjustmentRows: returnRejectAdjustmentRows.filter((row) => batchQcCycleIds.has(String(row.qc_cycle_id || ''))),
          latestRejectRows: returnRejectDetailRows.filter((row) => batchQcIds.has(String(row.arkline_qc_id))),
        }
      })
      const cmtInspectionIds = (cmtInspectionRows || []).map((row) => row.id).filter(Boolean)
      const cmtDefectRows = cmtInspectionIds.length
        ? await loadOptionalRows(() =>
            supabase
              .from('arkline_cmt_inspection_defects')
              .select('id, cmt_inspection_id, reject_reason_id, reject_reason_name, major_qty, minor_qty, notes, created_at')
              .in('cmt_inspection_id', cmtInspectionIds)
              .order('created_at', { ascending: true })
          )
        : []
      const cmtDefectsByInspection = new Map()
      ;(cmtDefectRows || []).forEach((row) => {
        const key = String(row?.cmt_inspection_id || '')
        cmtDefectsByInspection.set(key, [...(cmtDefectsByInspection.get(key) || []), row])
      })
      const cmtInspections = (cmtInspectionRows || []).map((row) => ({
        ...row,
        inspected_by: String(row?.inspected_by || '').trim(),
        defects: cmtDefectsByInspection.get(String(row.id)) || [],
      }))

      const paymentRows = (paymentRowsRaw || []).map(normalizeFinancePaymentRow)
      const itemDetail = itemRows[0] || null
      const price = parseNumberValue(itemDetail?.price || entry.price || 0)
      const hpp = parseNumberValue(itemDetail?.hpp || 0)
      const plannedQty = parseNumberValue(itemDetail?.total_qty || entry.qty || 0)
      const actualQty = parseNumberValue(itemDetail?.actual_qty || 0)
      const totalReceived = receiptRows.reduce((sum, row) => sum + Number(row?.received_qty || 0), 0)
      const totalShortQty = returnHistory.reduce((sum, row) => sum + Number(row?.short_qty || 0), 0)
      const financeUnitPrice = price
      const financeTaxMultiplier = normalizeBoolean(selectedPoDetail.includePpn, true) ? 1 + PPN_RATE : 1
      const actualFinanceQty = actualQty || totalReceived
      const financeQty = getFinanceQtyForItem({
        qty: plannedQty,
        actualQty: actualFinanceQty,
        shortQty: totalShortQty,
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
        includePpn: selectedPoDetail.includePpn,
        requestDeliveryDate: selectedPoDetail.targetDate,
        actualSnapshotDate: entry.updatedDeliveryDate || selectedPoDetail.updatedDate || selectedPoDetail.targetDate,
        poNotes: selectedPoDetail.notes || '',
        notes: itemDetail?.notes || entry.notes || '',
        status: itemDetail?.status || entry.status || '',
        category: String(itemDetail?.kategori_pengadaan || itemDetail?.kategori_produk || entry.category || '').trim().toUpperCase(),
        price,
        updatedDeliveryDate: itemDetail?.updated_delivery_date || entry.updatedDeliveryDate || '',
        completionDate: itemDetail?.completion_date || entry.completionDate || '',
        receipts: receiptRows,
        updates: updateRows,
        payments: paymentRows,
        qcRows,
        qcRejectRows: initialRejectDetailRows,
        qcRejectAdjustments: rejectAdjustmentRows,
        returnQcRows,
        returnQcRejectAdjustments: returnRejectAdjustmentRows,
        returnHistory,
        cmtInspections,
        sizeBreakdown,
        financeSummary: {
          price,
          hpp,
          plannedQty,
          actualQty,
          shortQty: totalShortQty,
          allowancePct: Number(itemDetail?.allowance_pct || 0),
          includePpn: selectedPoDetail.includePpn,
          plannedValue: financeUnitPrice * plannedQty * financeTaxMultiplier,
          actualValue: financeUnitPrice * financeQty * financeTaxMultiplier,
          paidValue: paymentRows.filter(isPaidFinancePayment).reduce((sum, row) => sum + parseNumberValue(row?.amount), 0),
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

    const totalReceivedAfterSave =
      (selectedProductDetail.receipts || []).reduce((sum, row) => sum + Number(row?.received_qty || 0), 0) +
      sizeEntries.reduce((sum, row) => sum + row.qty, 0)
    const plannedQty = Number(selectedProductDetail.financeSummary?.plannedQty || selectedProductDetail.qty || 0)
    const nextStatus =
      receiptDraft.isFinal || (plannedQty > 0 && totalReceivedAfterSave >= plannedQty)
        ? 'Completed'
        : totalReceivedAfterSave > 0
          ? 'On Progress'
          : 'Initiated'
    const itemUpdatePayload = {
      actual_qty: totalReceivedAfterSave,
      status: nextStatus,
    }

    if (nextStatus === 'Completed') {
      itemUpdatePayload.completion_date = receiptDraft.receiveDate
    }

    const { error: itemUpdateError } = await supabase.from('arkline_po_items').update(itemUpdatePayload).eq('id', selectedProductDetail.id)
    if (itemUpdateError) {
      setProductActionError(itemUpdateError.message || 'Receipt saved, but failed to update item summary.')
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
    }))
    await openProductDetail(selectedProductDetail)
    await refreshRows()
  }

  function openHppEditor() {
    if (!selectedProductDetail) return
    setProductActionError('')
    setProductActionMessage('')
    const currentHpp = parseNumberValue(selectedProductDetail.financeSummary?.hpp || selectedProductDetail.hpp || 0)
    setHppDraft(currentHpp ? formatNumber(currentHpp) : '')
    setHppModalOpen(true)
  }

  async function handleSaveHpp() {
    if (!selectedProductDetail || savingHpp) return
    setProductActionMessage('')
    setProductActionError('')
    const nextHpp = parseNumberValue(hppDraft)

    setSavingHpp(true)
    try {
      const { error } = await supabase
        .from('arkline_po_items')
        .update({ hpp: nextHpp, updated_at: new Date().toISOString() })
        .eq('id', selectedProductDetail.id)

      if (error) {
        setProductActionError(error.message || 'Failed to update HPP.')
        return
      }

      const updateEntryHpp = (entry) => (entry?.id === selectedProductDetail.id ? { ...entry, hpp: nextHpp } : entry)
      setPoRows((currentRows) =>
        currentRows.map((row) => ({
          ...row,
          productEntries: (row.productEntries || []).map(updateEntryHpp),
        }))
      )
      setSelectedPoDetail((currentDetail) =>
        currentDetail
          ? {
              ...currentDetail,
              productEntries: (currentDetail.productEntries || []).map(updateEntryHpp),
            }
          : currentDetail
      )
      setSelectedProductDetail((currentDetail) =>
        currentDetail
          ? (() => {
              const financeSummary = currentDetail.financeSummary || {}
              const price = parseNumberValue(financeSummary.price || currentDetail.price || 0)
              const unitPrice = price
              const financeTaxMultiplier = normalizeBoolean(financeSummary.includePpn ?? currentDetail.includePpn, true) ? 1 + PPN_RATE : 1
              const plannedQty = parseNumberValue(financeSummary.plannedQty || currentDetail.qty || 0)
              const actualQty = getFinanceQtyForItem({
                actualQty: parseNumberValue(financeSummary.actualQty ?? currentDetail.actualQty ?? 0),
                shortQty: parseNumberValue(financeSummary.shortQty || currentDetail.shortQty || 0),
                status: currentDetail.status,
              })
              return {
                ...currentDetail,
                hpp: nextHpp,
                financeSummary: {
                  ...financeSummary,
                  hpp: nextHpp,
                  plannedValue: unitPrice * plannedQty * financeTaxMultiplier,
                  actualValue: unitPrice * actualQty * financeTaxMultiplier,
                },
              }
            })()
          : currentDetail
      )
      setHppModalOpen(false)
      setProductActionMessage('HPP berhasil diperbarui.')
    } catch (error) {
      setProductActionError(error?.message || 'Failed to update HPP.')
    } finally {
      setSavingHpp(false)
    }
  }

  function handleOpenCmtInspectionDraft() {
    setProductActionError('')
    setProductActionMessage('')
    setCmtInspectionDraft(createCmtInspectionDraft(selectedProductDetail || {}))
    setCmtDefectDrafts([])
    setCmtPrefinalPdfFile(null)
    setCmtDefectPhotoFiles([])
    setCmtInspectionModalOpen(true)
  }

  async function openStoredCmtAttachmentPreview(path, type = 'pdf', title = 'Attachment') {
    const normalizedPath = String(path || '').trim()
    if (!normalizedPath) {
      setProductActionError('Attachment belum tersedia.')
      return
    }

    setProductActionError('')
    const { data, error } = await supabase.storage.from(CMT_INSPECTION_BUCKET).createSignedUrl(normalizedPath, 60 * 60)
    if (error || !data?.signedUrl) {
      setProductActionError(error?.message || 'Failed to open attachment preview.')
      return
    }
    setCmtAttachmentPreview({ type, url: data.signedUrl, title })
  }

  async function handlePrintCmtInspection(inspection) {
    if (!selectedProductDetail || !inspection?.id || printingCmtInspectionId) return
    setProductActionError('')
    setPrintingCmtInspectionId(String(inspection.id))

    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 12
      const contentWidth = pageWidth - margin * 2
      let cursorY = 14

      const ensureSpace = (height = 10) => {
        if (cursorY + height <= pageHeight - margin) return
        doc.addPage()
        cursorY = 14
      }

      const drawText = (text, x, y, options = {}) => {
        const maxWidth = options.maxWidth || contentWidth
        const lines = doc.splitTextToSize(String(text || '-'), maxWidth)
        if (options.align) {
          doc.text(lines, x, y, { align: options.align })
        } else {
          doc.text(lines, x, y)
        }
        return lines.length
      }

      const drawBox = (x, y, width, height, title) => {
        doc.setDrawColor(17, 24, 39)
        doc.setLineWidth(0.25)
        doc.rect(x, y, width, height)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.setFontSize(8)
        doc.text(title, x + 2, y + 5)
      }

      const defectRows = inspection.defects || []
      const photoList = getCmtInspectionPhotoList(inspection)
      const isPrefinal = String(inspection.inspection_type || '').toUpperCase() === 'PREFINAL'
      const safePoId = String(selectedProductDetail.poId || 'PO').replace(/[^A-Z0-9_-]+/gi, '-')
      const safeTitle = getCmtInspectionTitle(inspection).replace(/[^A-Z0-9_-]+/gi, '-')
      const getSignedStorageUrl = async (path) => {
        const normalizedPath = String(path || '').trim()
        if (!normalizedPath) return ''
        const { data } = await supabase.storage.from(CMT_INSPECTION_BUCKET).createSignedUrl(normalizedPath, 60 * 60)
        return data?.signedUrl || ''
      }
      const imageToDataUrl = async (path) => {
        try {
          const signedUrl = await getSignedStorageUrl(path)
          if (!signedUrl) return null
          const response = await fetch(signedUrl)
          const blob = await response.blob()
          if (!blob.type.startsWith('image/')) return null
          return await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(blob)
          })
        } catch {
          return null
        }
      }
      const visiblePhotos = photoList.slice(0, 8)
      const photoPreviews = await Promise.all(visiblePhotos.map((photo) => imageToDataUrl(photo.path)))

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setCharSpace(3.4)
      doc.setTextColor(15, 23, 42)
      doc.text('ARKLINE', pageWidth - margin - 24, cursorY, { align: 'right' })
      doc.setCharSpace(0)

      doc.setFontSize(14)
      doc.text(getCmtInspectionReportTitle(inspection), margin, cursorY)
      cursorY += 6
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.text(getCmtInspectionRoundSubtitle(inspection), margin, cursorY)
      cursorY += 8

      doc.setDrawColor(17, 24, 39)
      doc.setLineWidth(0.4)
      doc.line(margin, cursorY, pageWidth - margin, cursorY)
      cursorY += 7

      const leftLabelX = margin
      const leftValueX = margin + 28
      const rightLabelX = margin + 104
      const rightValueX = margin + 135
      const headerRow = (label, value, rightLabel, rightValue) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(15, 23, 42)
        doc.text(label, leftLabelX, cursorY)
        doc.setFont('helvetica', 'normal')
        const leftLines = drawText(value, leftValueX, cursorY, { maxWidth: 72 })
        let rightLines = 1
        if (rightLabel) {
          doc.setFont('helvetica', 'bold')
          doc.text(rightLabel, rightLabelX, cursorY)
          doc.setFont('helvetica', 'normal')
          rightLines = drawText(rightValue, rightValueX, cursorY, { maxWidth: pageWidth - margin - rightValueX })
        }
        cursorY += Math.max(leftLines, rightLines, 1) * 4.4 + 1.6
      }

      headerRow('BUYER', 'ARKLINE', 'INSP. DATE', formatDateLabel(inspection.inspection_date))
      headerRow('STYLE NO.', selectedProductDetail.productName || '-', 'INSPECTED BY', inspection.inspected_by || '-')
      headerRow('PO NO.', selectedProductDetail.poId || '-', 'ORDER QTY', `${formatNumber(selectedProductDetail.qty || inspection.order_qty || 0)} pcs`)
      headerRow('DESCRIPTION', selectedProductDetail.category || selectedProductDetail.productName || '-', 'SKU', selectedProductDetail.sku || '-')
      cursorY += 4

      if (!isPrefinal) {
        const checked = (source, label) => (source?.[label] ? 'Y' : '-')
        const firstBoxY = cursorY
        const boxGap = 4
        const smallBoxWidth = (contentWidth - boxGap * 2) / 3
        const smallBoxHeight = 42
        const prodX = margin
        const qcX = margin + smallBoxWidth + boxGap
        const packX = margin + (smallBoxWidth + boxGap) * 2
        drawBox(prodX, firstBoxY, smallBoxWidth, smallBoxHeight, 'PROD. STATUS')
        drawBox(qcX, firstBoxY, smallBoxWidth, smallBoxHeight, 'QC INFORMATION')
        drawBox(packX, firstBoxY, smallBoxWidth, smallBoxHeight, 'PACKING INFORMATION')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.6)
        doc.setTextColor(15, 23, 42)
        ;[
          ['Cutting', inspection.cutting_qty, inspection.cutting_pct],
          ['Printing', inspection.printing_qty, inspection.printing_pct],
          ['Sewing', inspection.sewing_qty, inspection.sewing_pct],
        ].forEach(([label, qty, pct], index) => {
          const y = firstBoxY + 13 + index * 8
          doc.text(label.toUpperCase(), prodX + 2, y)
          doc.text(formatNumber(qty || 0), prodX + 32, y, { align: 'right' })
          doc.text(`${formatNumber(pct || 0)}%`, prodX + smallBoxWidth - 3, y, { align: 'right' })
        })

        CMT_QC_INFO_OPTIONS.forEach((label, index) => {
          const y = firstBoxY + 12 + index * 5.6
          doc.text(label.toUpperCase(), qcX + 2, y)
          doc.text(checked(inspection.qc_information, label), qcX + smallBoxWidth - 5, y, { align: 'right' })
        })

        CMT_PACKING_OPTIONS.forEach((label, index) => {
          const y = firstBoxY + 11 + index * 4.6
          doc.text(label.toUpperCase(), packX + 2, y)
          doc.text(checked(inspection.packing_information, label), packX + smallBoxWidth - 5, y, { align: 'right' })
        })

        cursorY += smallBoxHeight + 4
        const accessoryBoxHeight = 39
        drawBox(margin, cursorY, contentWidth, accessoryBoxHeight, 'ACCESSORIES CHECK LIST')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.6)
        doc.setTextColor(15, 23, 42)
        const accessoryColumns = [CMT_ACCESSORIES_OPTIONS.slice(0, 6), CMT_ACCESSORIES_OPTIONS.slice(6)]
        accessoryColumns.forEach((labels, columnIndex) => {
          labels.forEach((label, index) => {
            const y = cursorY + 11 + index * 4.8
            const x = margin + 2 + columnIndex * 92
            doc.text(label.toUpperCase(), x, y)
            doc.text(checked(inspection.accessories_checklist, label), x + 78, y, { align: 'right' })
          })
        })
        cursorY += accessoryBoxHeight + 8

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text('SAMPLING QTY :', margin, cursorY)
        doc.setFont('helvetica', 'normal')
        doc.text(formatNumber(inspection.sampling_qty || 0), margin + 32, cursorY)
        doc.setFont('helvetica', 'bold')
        doc.text('ACCEPTANCE STD. :', margin + 62, cursorY)
        doc.setFont('helvetica', 'normal')
        doc.text(formatNumber(inspection.acceptance_standard || 0), margin + 100, cursorY)
        doc.setFont('helvetica', 'bold')
        doc.text('REJECTION STD. :', margin + 124, cursorY)
        doc.setFont('helvetica', 'normal')
        doc.text(formatNumber(inspection.reject_standard || 0), margin + 158, cursorY)
        cursorY += 3

        doc.setFillColor(17, 24, 39)
        doc.rect(margin, cursorY, contentWidth, 7, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text('DEFECTIVES FOUND', margin + 2, cursorY + 5)
        const majorColumnX = pageWidth - margin - 35
        const minorColumnX = pageWidth - margin - 11
        doc.text('MAJOR', majorColumnX, cursorY + 5, { align: 'center' })
        doc.text('MINOR', minorColumnX, cursorY + 5, { align: 'center' })
        cursorY += 7
        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        const defectTableTop = cursorY
        const defectRowsToDraw = defectRows.length ? defectRows : [{ reject_reason_name: '-', major_qty: 0, minor_qty: 0 }]
        const totalMajorQty = defectRowsToDraw.reduce((sum, row) => sum + Number(row?.major_qty || 0), 0)
        const totalMinorQty = defectRowsToDraw.reduce((sum, row) => sum + Number(row?.minor_qty || 0), 0)
        defectRowsToDraw.slice(0, 9).forEach((row, index) => {
          const y = cursorY + index * 5.4
          doc.setDrawColor(203, 213, 225)
          doc.line(margin, y, pageWidth - margin, y)
          doc.text(`${index + 1}. ${row.reject_reason_name || '-'}`, margin + 2, y + 3.8)
          doc.text(row.major_qty ? formatNumber(row.major_qty) : '-', majorColumnX, y + 3.8, { align: 'center' })
          doc.text(row.minor_qty ? formatNumber(row.minor_qty) : '-', minorColumnX, y + 3.8, { align: 'center' })
        })
        cursorY = defectTableTop + defectRowsToDraw.slice(0, 9).length * 5.4
        doc.line(margin, cursorY, pageWidth - margin, cursorY)
        doc.setFont('helvetica', 'bold')
        doc.text('TOTAL', margin + 2, cursorY + 4.2)
        doc.text(formatNumber(totalMajorQty), majorColumnX, cursorY + 4.2, { align: 'center' })
        doc.text(formatNumber(totalMinorQty), minorColumnX, cursorY + 4.2, { align: 'center' })
        cursorY += 5.6
        doc.line(margin, cursorY, pageWidth - margin, cursorY)
        cursorY += 5

        if (visiblePhotos.length) {
          const photoColumns = 4
          const photoGap = 3
          const photoRows = Math.ceil(visiblePhotos.length / photoColumns)
          const photoBoxSize = (contentWidth - photoGap * (photoColumns - 1)) / photoColumns
          ensureSpace(9 + photoRows * (photoBoxSize + photoGap))
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.text('PHOTOS OF DEFECTS :', margin, cursorY)
          cursorY += 4
          const photoAreaY = cursorY
          visiblePhotos.forEach((photo, index) => {
            const column = index % photoColumns
            const row = Math.floor(index / photoColumns)
            const x = margin + column * (photoBoxSize + photoGap)
            const y = photoAreaY + row * (photoBoxSize + photoGap)
            doc.setDrawColor(203, 213, 225)
            doc.rect(x, y, photoBoxSize, photoBoxSize)
            const imageData = photoPreviews[index]
            if (imageData) {
              const imageType = String(imageData).startsWith('data:image/png') ? 'PNG' : 'JPEG'
              const imageProps = doc.getImageProperties(imageData)
              const maxImageSize = photoBoxSize - 1.6
              const imageScale = Math.min(maxImageSize / imageProps.width, maxImageSize / imageProps.height)
              const drawWidth = imageProps.width * imageScale
              const drawHeight = imageProps.height * imageScale
              doc.addImage(
                imageData,
                imageType,
                x + (photoBoxSize - drawWidth) / 2,
                y + (photoBoxSize - drawHeight) / 2,
                drawWidth,
                drawHeight,
                undefined,
                'FAST'
              )
            } else {
              doc.setFont('helvetica', 'normal')
              doc.setFontSize(6.5)
              doc.setTextColor(148, 163, 184)
              doc.text(photo?.name || 'Photo attached', x + photoBoxSize / 2, y + photoBoxSize / 2, {
                align: 'center',
                maxWidth: photoBoxSize - 3,
              })
              doc.setTextColor(15, 23, 42)
            }
          })
          cursorY = photoAreaY + photoRows * photoBoxSize + Math.max(0, photoRows - 1) * photoGap + 7
        }
      } else {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(15, 23, 42)
        doc.text('PRE-FINAL ATTACHMENT', margin, cursorY)
        cursorY += 7
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.text(`PDF: ${inspection.prefinal_pdf_path ? 'Attached' : 'Not attached'}`, margin, cursorY)
        cursorY += 24
      }

      ensureSpace(34)
      doc.setDrawColor(17, 24, 39)
      doc.rect(margin, cursorY, contentWidth, 17)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('COMMENT :', margin + 2, cursorY + 6)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      drawText(inspection.notes || '-', margin + 2, cursorY + 11, { maxWidth: contentWidth - 6 })
      cursorY += 22

      const resultX = margin
      const signatureX = margin + 63
      const signatureWidth = 36
      const signatureGap = 8
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text('INSPECTION RESULT :', resultX, cursorY)
      const resultValue = String(inspection.inspection_result || '').toUpperCase()
      ;['PASSED', 'REJECTED'].forEach((result, index) => {
        const y = cursorY + 8 + index * 7
        doc.setFont('helvetica', 'normal')
        doc.text(result, resultX, y)
        doc.rect(resultX + 29, y - 4, 4, 4)
        if (resultValue === result) {
          doc.setFont('helvetica', 'bold')
          doc.text('X', resultX + 30.1, y - 0.6)
        }
      })
      ;['QA Inspector', 'Production Manager', 'QA Manager'].forEach((label, index) => {
        const x = signatureX + index * (signatureWidth + signatureGap)
        doc.line(x, cursorY + 18, x + signatureWidth, cursorY + 18)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(`${label} :`, x + signatureWidth / 2, cursorY + 23, { align: 'center' })
      })

      doc.save(`cmt-inspection-${safePoId}-${safeTitle}.pdf`)
    } catch (error) {
      setProductActionError(error?.message || 'Failed to generate CMT inspection PDF.')
    } finally {
      setPrintingCmtInspectionId('')
    }
  }

  function updateCmtInspectionDraft(field, value) {
    setCmtInspectionDraft((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  function handleCmtInspectionTypeChange(value) {
    const nextType = String(value || 'FINAL').toUpperCase()
    const isPrefinal = nextType === 'PREFINAL'
    setCmtInspectionDraft((prev) => ({
      ...prev,
      inspectionType: nextType,
      roundNumber: nextType === 'PREFINAL' ? '1' : String(getNextCmtInspectionRound(selectedProductDetail?.cmtInspections || [], nextType)),
      samplingQty: isPrefinal ? '' : prev.samplingQty,
      cuttingQty: isPrefinal ? '' : prev.cuttingQty,
      cuttingPct: isPrefinal ? '' : prev.cuttingPct,
      printingQty: isPrefinal ? '' : prev.printingQty,
      printingPct: isPrefinal ? '' : prev.printingPct,
      sewingQty: isPrefinal ? '' : prev.sewingQty,
      sewingPct: isPrefinal ? '' : prev.sewingPct,
      acceptanceStandard: isPrefinal ? '' : prev.acceptanceStandard,
      rejectStandard: isPrefinal ? '' : prev.rejectStandard,
      acceptQty: isPrefinal ? '' : prev.acceptQty,
      rejectQty: isPrefinal ? '' : prev.rejectQty,
      inspectionResult: isPrefinal ? '' : prev.inspectionResult,
    }))
    if (isPrefinal) {
      setCmtDefectDrafts([])
      setCmtDefectPhotoFiles([])
      setCmtMeasurementPdfFile(null)
    }
  }

  function toggleCmtChecklistValue(groupKey, option) {
    setCmtInspectionDraft((prev) => ({
      ...prev,
      [groupKey]: {
        ...(prev[groupKey] || {}),
        [option]: !prev[groupKey]?.[option],
      },
    }))
  }

  function addCmtDefectDraft() {
    setCmtDefectDrafts((prev) => [
      ...prev,
      {
        rejectReasonId: '',
        rejectReasonName: '',
        newReasonName: '',
        majorQty: '',
        minorQty: '',
        notes: '',
      },
    ])
  }

  function updateCmtDefectDraft(index, field, value) {
    setCmtDefectDrafts((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row
        if (field === 'rejectReasonId') {
          const reason = cmtRejectReasons.find((item) => String(item.id) === String(value))
          return {
            ...row,
            rejectReasonId: value,
            rejectReasonName: String(reason?.reason_name || '').trim().toUpperCase(),
          }
        }
        if (field === 'rejectReasonName') {
          const reasonName = String(value || '').toUpperCase()
          const matchedReason = cmtRejectReasons.find((item) => String(item.reason_name || '').trim().toUpperCase() === reasonName.trim().toUpperCase())
          return {
            ...row,
            rejectReasonId: matchedReason?.id || '',
            rejectReasonName: matchedReason?.reason_name || reasonName,
            newReasonName: matchedReason ? '' : reasonName,
          }
        }
        return {
          ...row,
          [field]: field === 'newReasonName' ? String(value || '').toUpperCase() : value,
        }
      })
    )
  }

  function removeCmtDefectDraft(index) {
    setCmtDefectDrafts((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
  }

  async function compressCmtDefectPhoto(file) {
    if (!file?.type?.startsWith('image/')) return file
    const imageUrl = URL.createObjectURL(file)
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = imageUrl
      })
      const maxSize = 1600
      const ratio = Math.min(1, maxSize / Math.max(image.width || maxSize, image.height || maxSize))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round((image.width || maxSize) * ratio))
      canvas.height = Math.max(1, Math.round((image.height || maxSize) * ratio))
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78))
      if (!blob) return file
      const baseName = sanitizeFileName(file.name || 'defect-photo').replace(/\.[^.]+$/, '')
      return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
    } finally {
      URL.revokeObjectURL(imageUrl)
    }
  }

  async function addCmtDefectPhotos(files = []) {
    const nextFiles = Array.from(files || [])
    if (!nextFiles.length) return
    const compressedFiles = await Promise.all(nextFiles.map((file) => compressCmtDefectPhoto(file)))
    setCmtDefectPhotoFiles((prev) => [...prev, ...compressedFiles])
  }

  function removeCmtDefectPhoto(index) {
    setCmtDefectPhotoFiles((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
  }

  function selectCmtRejectReason(index, reason) {
    setCmtDefectDrafts((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              rejectReasonId: reason?.id || '',
              rejectReasonName: String(reason?.reason_name || '').trim().toUpperCase(),
              newReasonName: '',
            }
          : row
      )
    )
    setCmtReasonFocusIndex(null)
  }

  async function resolveCmtRejectReason(row) {
    if (row.rejectReasonId) return row.rejectReasonId
    const reasonName = String(row.rejectReasonName || row.newReasonName || '').trim().toUpperCase()
    if (!reasonName) {
      throw new Error('Isi reject reason dulu.')
    }

    const existingReason = cmtRejectReasons.find((item) => String(item.reason_name || '').trim().toUpperCase() === reasonName)
    if (existingReason) return existingReason.id

    const { data, error: insertError } = await supabase
      .from('arkline_qc_reject_reasons')
      .insert({ reason_name: reasonName })
      .select('id, reason_name, is_active')
      .single()

    if (insertError) {
      const { data: fallbackReason, error: fallbackError } = await supabase
        .from('arkline_qc_reject_reasons')
        .select('id, reason_name, is_active')
        .eq('reason_name', reasonName)
        .single()

      if (fallbackError) {
        throw new Error(insertError.message || 'Failed to save reject reason.')
      }

      setCmtRejectReasons((items) => [...items, fallbackReason].sort((a, b) => a.reason_name.localeCompare(b.reason_name)))
      return fallbackReason.id
    }

    setCmtRejectReasons((items) => [...items, data].sort((a, b) => a.reason_name.localeCompare(b.reason_name)))
    return data.id
  }

  async function addCmtRejectReasonFromDraft(index) {
    setProductActionError('')
    try {
      const row = cmtDefectDrafts[index]
      const reasonId = await resolveCmtRejectReason(row || {})
      const reason = cmtRejectReasons.find((item) => String(item.id) === String(reasonId))
      setCmtDefectDrafts((prev) =>
        prev.map((item, rowIndex) =>
          rowIndex === index
            ? {
                ...item,
                rejectReasonId: reasonId,
                rejectReasonName: reason?.reason_name || item.rejectReasonName || item.newReasonName,
                newReasonName: '',
              }
            : item
        )
      )
      setCmtReasonFocusIndex(null)
    } catch (error) {
      setProductActionError(error?.message || 'Failed to add reject reason.')
    }
  }

  async function uploadCmtInspectionFile(file, folder) {
    if (!file || !selectedProductDetail) return null
    const safePoId = sanitizeFileName(selectedProductDetail.poId || 'PO')
    const safeName = sanitizeFileName(file.name || 'attachment')
    const filePath = `Arkline PO/${safePoId}/${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`
    const { error } = await supabase.storage.from(CMT_INSPECTION_BUCKET).upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) {
      throw new Error(error.message || `Failed to upload ${file.name || 'file'}.`)
    }
    return {
      path: filePath,
      name: file.name || safeName,
      type: file.type || null,
      size: Number(file.size || 0),
    }
  }

  async function handleSaveCmtInspection() {
    if (!selectedProductDetail || savingCmtInspection) return
    setProductActionError('')
    setProductActionMessage('')

    const inspectionType = String(cmtInspectionDraft.inspectionType || 'FINAL').trim().toUpperCase()
    const isPrefinal = inspectionType === 'PREFINAL'
    const roundNumber = isPrefinal ? 1 : Number(cmtInspectionDraft.roundNumber || getNextFinalInspectionRound(selectedProductDetail.cmtInspections || []))
    const inspectionDate = String(cmtInspectionDraft.inspectionDate || '').trim()
    const orderQty = parseNumberValue(cmtInspectionDraft.orderQty || selectedProductDetail.financeSummary?.plannedQty || selectedProductDetail.qty || 0)
    const samplingQty = isPrefinal ? 0 : parseNumberValue(cmtInspectionDraft.samplingQty)
    const acceptanceStandard = isPrefinal ? 0 : parseNumberValue(cmtInspectionDraft.acceptanceStandard)
    const rejectStandard = isPrefinal ? 0 : parseNumberValue(cmtInspectionDraft.rejectStandard)

    if (!inspectionDate) {
      setProductActionError('Isi tanggal inspection dulu.')
      return
    }
    if (isPrefinal && !cmtPrefinalPdfFile) {
      setProductActionError('Upload PDF Pre-Final dulu.')
      return
    }
    if (!isPrefinal && (!samplingQty || !cmtInspectionDraft.inspectionResult)) {
      setProductActionError('Isi sampling qty dan inspection result dulu.')
      return
    }
    const defectDraftRows = isPrefinal
      ? []
      : cmtDefectDrafts
          .map((row) => ({
            rejectReasonId: row.rejectReasonId || '',
            rejectReasonName: String(row.rejectReasonName || row.newReasonName || '').trim().toUpperCase(),
            major_qty: parseNumberValue(row.majorQty),
            minor_qty: parseNumberValue(row.minorQty),
            notes: String(row.notes || '').trim() || null,
          }))
          .filter((row) => row.rejectReasonName || row.major_qty || row.minor_qty || row.notes)

    const invalidDefectRow = defectDraftRows.find((row) => !row.rejectReasonName || row.major_qty + row.minor_qty <= 0)
    if (invalidDefectRow) {
      setProductActionError('Lengkapi reject reason dan qty major/minor untuk setiap defective found.')
      return
    }
    const uploadedPaths = []
    setSavingCmtInspection(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      let inspectedBy = String(user?.user_metadata?.display_name || user?.user_metadata?.full_name || '').trim()
      const userId = String(user?.id || '').trim()
      if (userId) {
        const { data: inspectorProfiles } = await supabase
          .from('dir_user_profiles')
          .select('display_name')
          .or(`authenticated_id.eq.${userId},id.eq.${userId}`)
          .limit(1)
        inspectedBy = String(inspectorProfiles?.[0]?.display_name || inspectedBy).trim()
      }
      const defectPayloadRows = isPrefinal
        ? []
        : await Promise.all(
            defectDraftRows.map(async (row) => {
              const rejectReasonId = await resolveCmtRejectReason({
                rejectReasonId: row.rejectReasonId,
                rejectReasonName: row.rejectReasonName,
              })
              return {
                reject_reason_id: rejectReasonId || null,
                reject_reason_name: row.rejectReasonName,
                major_qty: row.major_qty,
                minor_qty: row.minor_qty,
                notes: row.notes,
              }
            })
          )
      const existingPrefinalPath = isPrefinal
        ? String(
            (selectedProductDetail.cmtInspections || []).find(
              (row) => String(row?.inspection_type || '').toUpperCase() === 'PREFINAL' && Number(row?.round_number || 1) === 1
            )?.prefinal_pdf_path || ''
          )
        : ''
      const prefinalPdf = isPrefinal ? await uploadCmtInspectionFile(cmtPrefinalPdfFile, 'Pre-Final') : null
      if (prefinalPdf?.path) uploadedPaths.push(prefinalPdf.path)
      const measurementPdf = !isPrefinal && cmtMeasurementPdfFile ? await uploadCmtInspectionFile(cmtMeasurementPdfFile, `${inspectionType === 'FINAL' ? `Final/Round ${roundNumber}` : `In-Line/Round ${roundNumber}`}/Measurement`) : null
      if (measurementPdf?.path) uploadedPaths.push(measurementPdf.path)

      const defectPhotos = []
      if (!isPrefinal) {
        for (const file of cmtDefectPhotoFiles || []) {
          const folderName = inspectionType === 'FINAL' ? `Final/Round ${roundNumber}/Defect Photos` : `In-Line/Round ${roundNumber}/Defect Photos`
          const uploadedPhoto = await uploadCmtInspectionFile(file, folderName)
          if (uploadedPhoto?.path) {
            uploadedPaths.push(uploadedPhoto.path)
            defectPhotos.push(uploadedPhoto)
          }
        }
      }

      const inspectionPayload = {
        po_id: String(selectedProductDetail.poId || '').trim().toUpperCase(),
        arkline_po_item_id: selectedProductDetail.id,
        sku_induk: String(selectedProductDetail.sku || '').trim().toUpperCase(),
        product_name: String(selectedProductDetail.productName || '').trim().toUpperCase(),
        kategori_pengadaan: String(selectedProductDetail.category || '').trim().toUpperCase() || null,
        inspection_type: inspectionType,
        round_number: roundNumber || 1,
        order_qty: orderQty,
        sampling_qty: samplingQty,
        printing_qty: isPrefinal ? 0 : parseNumberValue(cmtInspectionDraft.printingQty),
        printing_pct: isPrefinal ? 0 : parseNumberValue(cmtInspectionDraft.printingPct),
        cutting_qty: isPrefinal ? 0 : parseNumberValue(cmtInspectionDraft.cuttingQty),
        cutting_pct: isPrefinal ? 0 : parseNumberValue(cmtInspectionDraft.cuttingPct),
        sewing_qty: isPrefinal ? 0 : parseNumberValue(cmtInspectionDraft.sewingQty),
        sewing_pct: isPrefinal ? 0 : parseNumberValue(cmtInspectionDraft.sewingPct),
        acceptance_standard: acceptanceStandard,
        reject_standard: rejectStandard,
        accept_qty: 0,
        reject_qty: 0,
        qc_information: isPrefinal ? {} : cmtInspectionDraft.qcInformation || {},
        accessories_checklist: isPrefinal ? {} : cmtInspectionDraft.accessoriesChecklist || {},
        packing_information: isPrefinal ? {} : cmtInspectionDraft.packingInformation || {},
        inspection_result: isPrefinal ? null : String(cmtInspectionDraft.inspectionResult || '').trim().toUpperCase(),
        prefinal_pdf_path: prefinalPdf?.path || null,
        measurement_pdf_path: measurementPdf?.path || null,
        defect_photo_urls: defectPhotos,
        notes: String(cmtInspectionDraft.notes || '').trim() || null,
        inspected_by: inspectedBy || null,
        inspection_date: inspectionDate,
      }

      const query = isPrefinal
        ? supabase
            .from('arkline_cmt_inspections')
            .upsert(inspectionPayload, { onConflict: 'arkline_po_item_id,inspection_type,round_number' })
            .select('id')
            .single()
        : supabase.from('arkline_cmt_inspections').insert(inspectionPayload).select('id').single()

      const { data: insertedInspection, error: inspectionError } = await query
      if (inspectionError) {
        throw new Error(inspectionError.message || 'Failed to save CMT inspection.')
      }

      if (!isPrefinal && defectPayloadRows.length) {
        const { error: defectError } = await supabase.from('arkline_cmt_inspection_defects').insert(
          defectPayloadRows.map((row) => ({
            ...row,
            cmt_inspection_id: insertedInspection.id,
          }))
        )
        if (defectError) {
          await supabase.from('arkline_cmt_inspections').delete().eq('id', insertedInspection.id)
          throw new Error(defectError.message || 'Inspection saved, but failed to save defect rows.')
        }
      }

      setCmtInspectionModalOpen(false)
      setCmtPrefinalPdfFile(null)
      setCmtMeasurementPdfFile(null)
      setCmtDefectPhotoFiles([])
      setCmtDefectDrafts([])
      await openProductDetail(selectedProductDetail)
      if (existingPrefinalPath && prefinalPdf?.path && existingPrefinalPath !== prefinalPdf.path) {
        await supabase.storage.from(CMT_INSPECTION_BUCKET).remove([existingPrefinalPath])
      }
      setProductActionMessage(isPrefinal ? 'Pre-Final PDF berhasil disimpan.' : 'CMT Inspection berhasil disimpan.')
    } catch (error) {
      if (uploadedPaths.length) {
        await supabase.storage.from(CMT_INSPECTION_BUCKET).remove(uploadedPaths)
      }
      setProductActionError(error?.message || 'Failed to save CMT inspection.')
    } finally {
      setSavingCmtInspection(false)
    }
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

  function openManualCompleteModal() {
    if (!selectedProductDetail) return
    setManualCompleteOpen(true)
    setDeliveryModalOpen(false)
    setStatusModalOpen(false)
    setDeleteStatusConfirmRow(null)
    setProductActionMessage('')
    setProductActionError('')
    setManualCompleteDraft({
      completionDate: selectedProductDetail.completionDate || getLatestReceiptDate(selectedProductDetail.receipts || []) || getTodayDateInputValue(),
      notes: '',
    })
  }

  async function handleManualCompleteProduct() {
    if (!selectedProductDetail || savingManualComplete) return

    setProductActionMessage('')
    setProductActionError('')
    if (!manualCompleteDraft.completionDate) {
      setProductActionError('Isi completion date dulu.')
      return
    }

    const receivedQty = getProductReceivedQty(selectedProductDetail)
    if (receivedQty <= 0) {
      setProductActionError('Produk belum punya receipt, jadi belum bisa ditutup completed.')
      return
    }

    const existingNotes = String(selectedProductDetail.notes || '').trim()
    const manualNotes = String(manualCompleteDraft.notes || '').trim()
    const updatePayload = {
      status: 'Completed',
      completion_date: manualCompleteDraft.completionDate,
    }

    if (manualNotes) {
      updatePayload.notes = [existingNotes, `Manual completed: ${manualNotes}`].filter(Boolean).join('\n')
    }

    setSavingManualComplete(true)
    try {
      const { error: itemError } = await supabase.from('arkline_po_items').update(updatePayload).eq('id', selectedProductDetail.id)
      if (itemError) {
        setProductActionError(itemError.message || 'Failed to complete product.')
        return
      }

      await syncPoBoardStatus(selectedProductDetail.poId)
      setManualCompleteOpen(false)
      setManualCompleteDraft({ completionDate: '', notes: '' })
      await openProductDetail({
        ...selectedProductDetail,
        status: 'Completed',
        completionDate: manualCompleteDraft.completionDate,
        notes: updatePayload.notes ?? selectedProductDetail.notes,
      })
      await refreshRows()
      setProductActionMessage('Produk berhasil ditutup sebagai Completed.')
    } catch (error) {
      setProductActionError(error?.message || 'Failed to complete product.')
    } finally {
      setSavingManualComplete(false)
    }
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
      let qcSummary = buildQcGradeSummary(
        qcReportData.qcRows || [],
        qcReportData.adjustmentRows || []
      )
      const rejectSummary = buildRejectDetailSummary(qcReportData.rejectRows || [], qcSummary, qcReportData)
      const receivingQty =
        qcReportData.selectedOption?.value === 'all'
          ? getReceivingQtyBase(selectedProductDetail.receipts || [], selectedProductDetail.financeSummary?.actualQty || 0)
          : (qcReportData.receipts || []).reduce((sum, row) => sum + Number(row?.received_qty || 0), 0)
      qcSummary = normalizeAllIncomingQcSummary(qcSummary, rejectSummary, receivingQty, qcReportData.selectedOption)
      const totalRejectQty = Number(qcSummary.qtyB || 0) + Number(qcSummary.qtyC || 0)
      const repairableRejectRows = rejectSummary.filter((row) => row.isRepairable)
      const nonRepairableRejectRows = rejectSummary.filter((row) => !row.isRepairable)
      const repairableRejectQty = repairableRejectRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
      const nonRepairableRejectQty = nonRepairableRejectRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
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

      const metricWidth = (pageWidth - margin * 2 - 9) / 4
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

      const drawRejectSection = ({ title, qty, rows, tone }) => {
        const isRepairableTone = tone === 'repairable'
        ensureSpace(28)

        const cardWidth = Math.min(72, pageWidth - margin * 2)
        const cardHeight = 18
        doc.setDrawColor(isRepairableTone ? 187 : 254, isRepairableTone ? 247 : 202, isRepairableTone ? 208 : 202)
        doc.setFillColor(isRepairableTone ? 240 : 254, isRepairableTone ? 253 : 242, isRepairableTone ? 244 : 242)
        doc.roundedRect(margin, cursorY, cardWidth, cardHeight, 3, 3, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(isRepairableTone ? 22 : 153, isRepairableTone ? 101 : 27, isRepairableTone ? 52 : 27)
        doc.text(title.toUpperCase(), margin + 4, cursorY + 6)
        doc.setFontSize(13)
        doc.setTextColor(15, 23, 42)
        doc.text(formatNumber(qty), margin + 4, cursorY + 14)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.4)
        doc.setTextColor(100, 116, 139)
        doc.text(formatRepairabilityNote(qty, totalRejectQty, receivingQty), margin + 22, cursorY + 14)
        cursorY += cardHeight + 4

        if (!rows.length) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.setTextColor(100, 116, 139)
          doc.text(`No ${title.toLowerCase()} reject detail rows.`, margin + 2, cursorY)
          cursorY += 8
          return
        }

        rows.forEach((row) => {
          ensureSpace(14)
          const label = `${row.grade === 'B/C' ? row.grade : `Grade ${row.grade}`} - ${row.reason}`
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

        cursorY += 2
      }

      if (!rejectSummary.length) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(100, 116, 139)
        doc.text('No reject detail rows.', margin, cursorY)
      } else {
        drawRejectSection({
          title: 'Repairable',
          qty: repairableRejectQty,
          rows: repairableRejectRows,
          tone: 'repairable',
        })
        drawRejectSection({
          title: 'Non-Repairable',
          qty: nonRepairableRejectQty,
          rows: nonRepairableRejectRows,
          tone: 'non-repairable',
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
        const latestReasons = buildReturnReasonSummary(batch.latestRejectRows || [], buildReturnReQcSummary(batch))
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
    setManualCompleteOpen(false)
    setDeleteStatusConfirmRow(null)
    setProductActionMessage('')
    setProductActionError('')
  }

  function openStatusModal() {
    setStatusModalOpen(true)
    setDeliveryModalOpen(false)
    setManualCompleteOpen(false)
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
    setManualCompleteOpen(false)
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
    setManualCompleteOpen(false)
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

  const selectedProductReceivedQty = getProductReceivedQty(selectedProductDetail)
  const selectedProductPlannedQty = Number(selectedProductDetail?.financeSummary?.plannedQty || selectedProductDetail?.qty || 0)
  const selectedProductRemainingQty = Math.max(selectedProductPlannedQty - selectedProductReceivedQty, 0)
  const selectedProductDerivedStatus =
    normalizeBoardStatus(selectedProductDetail?.status) === 'Completed'
      ? 'Completed'
      : selectedProductReceivedQty > 0
        ? 'On Progress'
        : normalizeBoardStatus(selectedProductDetail?.status)
  const canManuallyCompleteSelectedProduct =
    Boolean(selectedProductDetail) &&
    (role === 'admin' || access.progressKanbanEdit) &&
    selectedProductDerivedStatus === 'On Progress' &&
    selectedProductReceivedQty > 0

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
                {role === 'admin' ? (
                  <Link className={styles.powerBiButton} href="/arkline-power-bi">
                    BI Report
                  </Link>
                ) : null}
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
                      const isSettledCompletedCard = status === 'Completed' && item.isFinanceSettled
                      return (
                        <article
                          key={item.id}
                          className={`${styles.boardCard} ${isSettledCompletedCard ? styles.boardCardFinanceSettled : ''} ${
                            !canOpenKanbanDetail ? styles.boardCardStatic : ''
                          }`.trim()}
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
                    const dueNetValue = (selectedPoDetail.productEntries || []).reduce(
                      (sum, entry) => sum + getFinanceQtyForItem(entry) * parseNumberValue(entry?.price || 0),
                      0
                    )
                    const dueValue = applyPpnToAmount(dueNetValue, selectedPoDetail.includePpn)
                    const paidValue = (selectedPoDetail.payments || [])
                      .filter(isPaidFinancePayment)
                      .reduce((sum, row) => sum + parseNumberValue(row?.amount), 0)
                    const outstandingValue = getFinanceOutstandingValue(dueValue, paidValue)

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
                                  <th>Status</th>
                                  <th>Nominal Paid</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedPoDetail.payments.map((row) => (
                                  <tr key={row.id}>
                                    <td>{formatDateLabel(row.paymentDate)}</td>
                                    <td>{row.invoiceNumber || row.paymentLabel || '-'}</td>
                                    <td>{row.status || '-'}</td>
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

            <div className={styles.modalSection}>
              <div className={styles.productDetailSectionHead}>
                <h4 className={styles.modalSectionTitle}>Document History</h4>
                <button type="button" className={styles.productDetailSectionToggle} onClick={() => togglePoDetailSection('documentHistory')}>
                  <ChevronIcon expanded={poDetailSections.documentHistory} />
                </button>
              </div>
              {poDetailSections.documentHistory
                ? (() => {
                    const signedPoFiles = selectedPoDetail.documentHistory?.signedPoFiles || []
                    const signedPoDate = getLatestSignedPoDate(signedPoFiles)
                    const signedPoInputId = `signed-po-upload-${sanitizeFileName(selectedPoDetail.poId || selectedPoDetail.id)}`

                    return (
                      <div className={styles.documentHistoryList}>
                        <div className={styles.documentHistoryGroup}>
                          <div className={styles.documentHistoryGroupHead}>
                            <span>Purchase Order</span>
                            <strong>{selectedPoDetail.poId}</strong>
                          </div>
                          <div className={styles.documentHistoryMiniList}>
                            <div className={styles.documentHistoryMiniRow}>
                              <strong>Generated PO</strong>
                              <span>{formatDateTimeLabel(selectedPoDetail.createdAt || selectedPoDetail.startDate)}</span>
                              <div className={styles.documentHistoryActions}>
                                <button
                                  type="button"
                                  className={styles.documentHistoryIconButton}
                                  onClick={() => void handlePrintPoDetail()}
                                  disabled={printingPoDetail}
                                  title="Print PO"
                                  aria-label="Print PO"
                                >
                                  <PrintIcon />
                                </button>
                              </div>
                            </div>

                            <div className={styles.documentHistoryMiniRow}>
                              <strong>Signed PO</strong>
                              <span>{signedPoDate ? formatDateTimeLabel(signedPoDate) : 'No signed PO file yet'}</span>
                              <div className={styles.documentHistoryActions}>
                                <input
                                  id={signedPoInputId}
                                  type="file"
                                  accept="application/pdf,image/*"
                                  multiple
                                  className={styles.hiddenFileInput}
                                  disabled={uploadingSignedPo}
                                  onChange={(event) => {
                                    const files = Array.from(event.target.files || [])
                                    event.target.value = ''
                                    void handleSignedPoUpload(files)
                                  }}
                                />
                                <label
                                  className={`${styles.documentHistoryIconButton} ${uploadingSignedPo ? styles.documentHistoryIconButtonDisabled : ''}`}
                                  htmlFor={signedPoInputId}
                                  title={uploadingSignedPo ? 'Uploading signed PO...' : 'Upload signed PO'}
                                  aria-label="Upload signed PO"
                                >
                                  <PlusIcon />
                                </label>
                                {signedPoFiles.map((attachment, index) => (
                                  <button
                                    key={attachment.id || attachment.storagePath || index}
                                    type="button"
                                    className={styles.documentHistoryIconButton}
                                    onClick={() => void openSignedPoAttachment(attachment)}
                                    title={attachment.fileName || `Signed PO ${index + 1}`}
                                    aria-label={`Open signed PO ${index + 1}`}
                                  >
                                    <AttachmentIcon />
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={styles.documentHistoryGroup}>
                          <div className={styles.documentHistoryGroupHead}>
                            <span>Receipt History</span>
                            <strong>{selectedPoDetail.documentHistory?.receipts?.length || 0} receipt date(s)</strong>
                          </div>
                          {(selectedPoDetail.documentHistory?.receipts || []).length ? (
                            <div className={styles.documentHistoryMiniList}>
                              {selectedPoDetail.documentHistory.receipts.map((receipt) => (
                                <div key={receipt.key} className={styles.documentHistoryMiniRow}>
                                  <strong>{formatDateLabel(receipt.receiveDate)}</strong>
                                  <span>{receipt.supplierSj ? `SJ ${receipt.supplierSj}` : 'No supplier SJ'}</span>
                                  <em>{formatNumber(receipt.qty)} pcs</em>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className={styles.emptyMini}>No receipt rows yet.</div>
                          )}
                        </div>

                        <div className={styles.documentHistoryGroup}>
                          <div className={styles.documentHistoryGroupHead}>
                            <span>Payment Arrangement</span>
                            <strong>{(selectedPoDetail.payments || []).length} invoice row(s)</strong>
                          </div>
                          {(selectedPoDetail.payments || []).length ? (
                            <div className={styles.documentHistoryPaymentTable}>
                              <div className={`${styles.documentHistoryPaymentRow} ${styles.documentHistoryPaymentHeader}`}>
                                <span>Invoice Number</span>
                                <span>Submitted At</span>
                                <span>Proof</span>
                                <span>Paid At</span>
                                <span>Proof</span>
                              </div>
                              {selectedPoDetail.payments.map((payment) => {
                                const submissionProofs = getFinanceAttachmentsByKind(payment, 'SUBMISSION_PROOF')
                                const paymentProofs = getFinanceAttachmentsByKind(payment, 'PAYMENT_PROOF')
                                const paidDate = isPaidFinancePayment(payment) ? payment.paidAt || payment.paymentDate : ''
                                return (
                                  <div key={`payment-arrangement-${payment.id}`} className={styles.documentHistoryPaymentRow}>
                                    <strong>{payment.invoiceNumber || payment.paymentLabel || '-'}</strong>
                                    <span>{formatDateTimeLabel(payment.createdAt)}</span>
                                    <div className={styles.documentHistoryActions}>
                                      {submissionProofs.length ? (
                                        submissionProofs.map((attachment, index) => (
                                          <button
                                            key={attachment.id || attachment.storagePath || index}
                                            type="button"
                                            className={styles.documentHistoryIconButton}
                                            onClick={() => void openFinanceAttachment(attachment)}
                                            title={attachment.fileName || `Invoice proof ${index + 1}`}
                                            aria-label={`Open invoice proof ${index + 1}`}
                                          >
                                            <AttachmentIcon />
                                          </button>
                                        ))
                                      ) : (
                                        <em>No proof</em>
                                      )}
                                    </div>
                                    <span>{paidDate ? formatDateTimeLabel(paidDate) : '-'}</span>
                                    <div className={styles.documentHistoryActions}>
                                      {paymentProofs.length ? (
                                        paymentProofs.map((attachment, index) => (
                                          <button
                                            key={attachment.id || attachment.storagePath || index}
                                            type="button"
                                            className={styles.documentHistoryIconButton}
                                            onClick={() => void openFinanceAttachment(attachment)}
                                            title={attachment.fileName || `Payment proof ${index + 1}`}
                                            aria-label={`Open payment proof ${index + 1}`}
                                          >
                                            <AttachmentIcon />
                                          </button>
                                        ))
                                      ) : (
                                        <em>No proof</em>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className={styles.emptyMini}>No payment arrangement rows yet.</div>
                          )}
                        </div>
                      </div>
                    )
                  })()
                : null}
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
                <div className={styles.productDetailSubmetaRow}>
                  <p className={styles.productDetailSubmeta}>HPP {formatNumber(selectedProductDetail.financeSummary?.hpp || 0)}</p>
                  <button type="button" className={styles.productDetailInlineButton} onClick={openHppEditor} aria-label="Edit HPP">
                    <EditIcon />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
              <div className={styles.productHeaderActions}>
                <button type="button" className={styles.iconButton} onClick={() => setSelectedProductDetail(null)} aria-label="Close product detail">
                  <CloseIcon />
                </button>
              </div>
            </div>

            {productDetailLoading ? <div className={styles.emptyMini}>Loading product detail...</div> : null}
            {productActionError ? <div className={styles.productActionError}>{productActionError}</div> : null}
            {productActionMessage ? <div className={styles.productActionMessage}>{productActionMessage}</div> : null}

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
                    <h4 className={styles.modalSectionTitle}>CMT Inspection</h4>
                    <button
                      type="button"
                      className={styles.productSectionLaunch}
                      onClick={handleOpenCmtInspectionDraft}
                      aria-label="Add CMT inspection"
                      title="Add CMT inspection"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                  <button type="button" className={styles.productDetailSectionToggle} onClick={() => toggleProductDetailSection('cmtInspection')}>
                    <span className={styles.productDetailHint}>CMT Report(s)</span>
                    <ChevronIcon expanded={productDetailSections.cmtInspection} />
                  </button>
                </div>
                {productDetailSections.cmtInspection ? (
                  <div className={styles.productDetailRows}>
                    {(selectedProductDetail.cmtInspections || []).length ? (
                      <div className={styles.cmtInspectionStageGrid}>
                        {sortCmtInspectionsByDate(selectedProductDetail.cmtInspections || []).map((inspection) => {
                          const defectQty = getCmtInspectionDefectQty(inspection)
                          const isPrefinal = String(inspection.inspection_type || '').toUpperCase() === 'PREFINAL'
                          return (
                            <div
                              key={inspection.id}
                              role="button"
                              tabIndex={0}
                              className={styles.cmtInspectionStageCard}
                              onClick={() => setSelectedCmtInspectionDetail(inspection)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  setSelectedCmtInspectionDetail(inspection)
                                }
                              }}
                            >
                              <div className={styles.cmtInspectionStageTop}>
                                <span>{getCmtInspectionTitle(inspection)}</span>
                                <button
                                  type="button"
                                  className={styles.cmtInspectionPrintButton}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handlePrintCmtInspection(inspection)
                                  }}
                                  disabled={printingCmtInspectionId === String(inspection.id)}
                                  aria-label={`Print ${getCmtInspectionTitle(inspection)}`}
                                  title={`Print ${getCmtInspectionTitle(inspection)}`}
                                >
                                  <PrintIcon />
                                </button>
                              </div>
                              <strong>{isPrefinal ? getCmtInspectionResultLabel(inspection) : `${formatNumber(defectQty)} defect qty`}</strong>
                              <div className={styles.cmtInspectionStageMeta}>
                                <span>{formatDateLabel(inspection.inspection_date)}</span>
                                <span>Sample {formatNumber(inspection.sampling_qty || 0)}</span>
                                <span>Defect {formatNumber(defectQty)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className={styles.emptyMini}>No CMT inspection yet.</div>
                    )}
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
                    {canManuallyCompleteSelectedProduct ? (
                      <button
                        type="button"
                        className={styles.productSectionTextButton}
                        onClick={openManualCompleteModal}
                        disabled={savingManualComplete}
                      >
                        Mark Completed
                      </button>
                    ) : null}
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
                        let qcSummary = buildQcGradeSummary(
                          qcReportData.qcRows || [],
                          qcReportData.adjustmentRows || []
                        )
                        const rejectSummary = buildRejectDetailSummary(qcReportData.rejectRows || [], qcSummary, qcReportData)
                        const repairabilitySummary = buildRepairabilitySummary(rejectSummary)
                        const receivingQty =
                          qcReportData.selectedOption?.value === 'all'
                            ? getReceivingQtyBase(selectedProductDetail.receipts || [], selectedProductDetail.financeSummary?.actualQty || 0)
                            : (qcReportData.receipts || []).reduce((sum, row) => sum + Number(row?.received_qty || 0), 0)
                        qcSummary = normalizeAllIncomingQcSummary(qcSummary, rejectSummary, receivingQty, qcReportData.selectedOption)
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
                        <table className={`${styles.receivingHistoryTable} ${styles.returnHistoryTable}`.trim()}>
                          <colgroup>
                            <col className={styles.returnHistoryDateCol} />
                            <col className={styles.returnHistoryBatchCol} />
                            <col className={styles.returnHistoryQtyCol} />
                            <col className={styles.returnHistoryReturnedDateCol} />
                            <col className={styles.returnHistoryQtyCol} />
                            <col className={styles.returnHistoryQtyCol} />
                            <col className={styles.returnHistoryStatusCol} />
                            <col className={styles.returnHistoryActionCol} />
                          </colgroup>
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
                              const reQcSummary = buildReturnReQcSummary(batch)
                              const latestRejectSummary = buildReturnReasonSummary(batch.latestRejectRows || [], reQcSummary)
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
                                    <td className={styles.returnHistoryBatchCell}>{batch.return_number || '-'}</td>
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
                                              <span>Latest Re-QC Reject Reasons</span>
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

      {selectedProductDetail && manualCompleteOpen ? (
        <div className={styles.modalOverlay} onClick={() => !savingManualComplete && setManualCompleteOpen(false)}>
          <div className={`${styles.modalCard} ${styles.actionModalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Manual Completion</p>
                <h3 className={styles.modalTitle}>{selectedProductDetail.productName || 'NO PRODUCT'}</h3>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setManualCompleteOpen(false)} disabled={savingManualComplete} aria-label="Close manual completion modal">
                <CloseIcon />
              </button>
            </div>
            <div className={`${styles.modalGrid} ${styles.compactModalGrid}`.trim()}>
              <div className={styles.modalMetric}>
                <span>Ordered Qty</span>
                <strong>{formatNumber(selectedProductPlannedQty)}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Received Qty</span>
                <strong>{formatNumber(selectedProductReceivedQty)}</strong>
              </div>
              <div className={styles.modalMetric}>
                <span>Closed Short</span>
                <strong>{formatNumber(selectedProductRemainingQty)}</strong>
              </div>
            </div>
            <div className={styles.manualCompleteNotice}>
              Status produk akan menjadi Completed tanpa menambah receipt baru. Receipt history tetap mengikuti qty penerimaan asli.
            </div>
            <label className={styles.filterField}>
              <span>Completion Date</span>
              <input
                type="date"
                className={styles.input}
                value={manualCompleteDraft.completionDate}
                onChange={(event) => setManualCompleteDraft((prev) => ({ ...prev, completionDate: event.target.value }))}
                disabled={savingManualComplete}
              />
            </label>
            <label className={styles.filterField}>
              <span>Notes</span>
              <textarea
                className={styles.textarea}
                value={manualCompleteDraft.notes}
                onChange={(event) => setManualCompleteDraft((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Contoh: Sisa pengiriman dibatalkan supplier."
                rows={4}
                disabled={savingManualComplete}
              />
            </label>
            {productActionError ? <div className={styles.productActionError}>{productActionError}</div> : null}
            <div className={styles.productHeaderActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setManualCompleteOpen(false)} disabled={savingManualComplete}>Cancel</button>
              <button type="button" className={styles.primaryButton} onClick={() => void handleManualCompleteProduct()} disabled={savingManualComplete || !manualCompleteDraft.completionDate}>
                {savingManualComplete ? 'Saving...' : 'Mark Completed'}
              </button>
            </div>
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

      {selectedProductDetail && cmtInspectionModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => (!savingCmtInspection ? setCmtInspectionModalOpen(false) : null)}>
          <div className={`${styles.modalCard} ${styles.actionModalCard} ${styles.cmtInspectionModalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>CMT Inspection</p>
                <h3 className={styles.modalTitle}>{selectedProductDetail.productName || 'NO PRODUCT'}</h3>
                <div className={styles.cmtInspectionMetaGrid}>
                  <div>
                    <span>PO Number</span>
                    <strong>{selectedProductDetail.poId || '-'}</strong>
                  </div>
                  <div>
                    <span>SKU</span>
                    <strong>{selectedProductDetail.sku || '-'}</strong>
                  </div>
                  <div>
                    <span>Category</span>
                    <strong>{selectedProductDetail.category || 'NO CATEGORY'}</strong>
                  </div>
                  <div>
                    <span>Total Order</span>
                    <strong>{formatNumber(cmtInspectionDraft.orderQty || selectedProductDetail.qty || 0)} pcs</strong>
                  </div>
                </div>
              </div>
              <div className={styles.productHeaderActions}>
                <button type="button" className={styles.blackPrimaryButton} onClick={() => void handleSaveCmtInspection()} disabled={savingCmtInspection}>
                  {savingCmtInspection ? 'Saving...' : 'Save Inspection'}
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setCmtInspectionModalOpen(false)}
                  disabled={savingCmtInspection}
                  aria-label="Close CMT inspection"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {productActionError ? <div className={styles.productActionError}>{productActionError}</div> : null}
            {productActionMessage ? <div className={styles.productActionMessage}>{productActionMessage}</div> : null}

            <div className={styles.productFormGrid}>
              <label className={styles.filterField}>
                <span>Inspection Type</span>
                <select
                  className={styles.select}
                  value={cmtInspectionDraft.inspectionType}
                  onChange={(event) => handleCmtInspectionTypeChange(event.target.value)}
                  disabled={savingCmtInspection}
                >
                  {CMT_INSPECTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.filterField}>
                <span>Round</span>
                <div className={styles.readonlyField}>
                  {cmtInspectionDraft.inspectionType === 'PREFINAL'
                    ? 'Pre-Final'
                    : cmtInspectionDraft.inspectionType === 'FINAL'
                      ? getCmtInspectionTitle({ inspection_type: 'FINAL', round_number: cmtInspectionDraft.roundNumber })
                      : getCmtInspectionTitle({ inspection_type: 'INLINE', round_number: cmtInspectionDraft.roundNumber })}
                </div>
              </label>
              <label className={styles.filterField}>
                <span>Inspection Date</span>
                <input
                  className={styles.input}
                  type="date"
                  value={cmtInspectionDraft.inspectionDate}
                  onChange={(event) => updateCmtInspectionDraft('inspectionDate', event.target.value)}
                  disabled={savingCmtInspection}
                />
              </label>
            </div>

            {cmtInspectionDraft.inspectionType === 'PREFINAL' ? (
              <div className={styles.cmtInspectionFormSection}>
                <div className={styles.filterField}>
                  <span>Pre-Final PDF</span>
                  <div className={styles.cmtPhotoUploadBox}>
                    <input
                      id="cmt-prefinal-pdf-input"
                      className={styles.hiddenFileInput}
                      type="file"
                      accept="application/pdf"
                      onChange={(event) => setCmtPrefinalPdfFile(event.target.files?.[0] || null)}
                      disabled={savingCmtInspection}
                    />
                    <label className={styles.cmtPhotoAddButton} htmlFor="cmt-prefinal-pdf-input" aria-label="Add Pre-Final PDF">
                      <PlusIcon />
                    </label>
                    <span>{cmtPrefinalPdfFile ? cmtPrefinalPdfFile.name : 'Add Pre-Final PDF'}</span>
                  </div>
                  {cmtPrefinalPdfPreview ? (
                    <div className={styles.cmtMeasurementPreviewCard}>
                      <button
                        type="button"
                        onClick={() => setCmtAttachmentPreview({ type: 'pdf', url: cmtPrefinalPdfPreview.url, title: cmtPrefinalPdfPreview.file.name || 'Pre-Final PDF' })}
                      >
                        Preview PDF
                      </button>
                      <button type="button" onClick={() => setCmtPrefinalPdfFile(null)} disabled={savingCmtInspection}>
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
                <label className={styles.filterField}>
                  <span>Notes / Comment</span>
                  <textarea
                    className={styles.textarea}
                    value={cmtInspectionDraft.notes}
                    onChange={(event) => updateCmtInspectionDraft('notes', event.target.value)}
                    placeholder="Optional notes for this Pre-Final PDF"
                    disabled={savingCmtInspection}
                  />
                </label>
              </div>
            ) : (
              <>
                <div className={styles.cmtInspectionMatrix}>
                  <div className={styles.cmtMatrixColumn}>
                    <div className={styles.cmtMatrixTitle}>Production Status</div>
                    <div className={styles.cmtStatusTable}>
                      <div className={styles.cmtStatusHeader} aria-hidden="true">
                        <span />
                        <span>Qty</span>
                        <span>%</span>
                      </div>
                      {CMT_PRODUCTION_STATUS_ROWS.map((row) => (
                        <div key={row.key} className={styles.cmtStatusRow}>
                          <strong>{row.label}</strong>
                          <input
                            className={styles.input}
                            type="number"
                            min="0"
                            value={cmtInspectionDraft[`${row.key}Qty`] || ''}
                            onChange={(event) => updateCmtInspectionDraft(`${row.key}Qty`, event.target.value)}
                            disabled={savingCmtInspection}
                          />
                          <input
                            className={styles.input}
                            inputMode="decimal"
                            value={cmtInspectionDraft[`${row.key}Pct`] || ''}
                            onChange={(event) => updateCmtInspectionDraft(`${row.key}Pct`, event.target.value)}
                            disabled={savingCmtInspection}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.cmtMatrixColumn}>
                    <div className={styles.cmtMatrixTitle}>QC Info</div>
                    <div className={styles.cmtChecklistStack}>
                      {CMT_QC_INFO_OPTIONS.map((option) => (
                        <label key={option} className={styles.cmtChecklistItem}>
                          <input
                            type="checkbox"
                            checked={Boolean(cmtInspectionDraft.qcInformation?.[option])}
                            onChange={() => toggleCmtChecklistValue('qcInformation', option)}
                            disabled={savingCmtInspection}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className={styles.cmtMatrixColumn}>
                    <div className={styles.cmtMatrixTitle}>Accessories Checklist</div>
                    <div className={styles.cmtChecklistStack}>
                      {CMT_ACCESSORIES_OPTIONS.map((option) => (
                        <label key={option} className={styles.cmtChecklistItem}>
                          <input
                            type="checkbox"
                            checked={Boolean(cmtInspectionDraft.accessoriesChecklist?.[option])}
                            onChange={() => toggleCmtChecklistValue('accessoriesChecklist', option)}
                            disabled={savingCmtInspection}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className={styles.cmtMatrixColumn}>
                    <div className={styles.cmtMatrixTitle}>Packing Info</div>
                    <div className={styles.cmtChecklistStack}>
                      {CMT_PACKING_OPTIONS.map((option) => (
                        <label key={option} className={styles.cmtChecklistItem}>
                          <input
                            type="checkbox"
                            checked={Boolean(cmtInspectionDraft.packingInformation?.[option])}
                            onChange={() => toggleCmtChecklistValue('packingInformation', option)}
                            disabled={savingCmtInspection}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`${styles.cmtInspectionFormSection} ${styles.cmtDefectPanel}`.trim()}>
                  <div className={styles.cmtInspectionSectionHeader}>
                    <strong>Defective Found</strong>
                  </div>
                  <div className={styles.cmtStandardsGrid}>
                    <label className={styles.filterField}>
                      <span>Sampling Qty</span>
                      <input
                        className={styles.input}
                        type="number"
                        min="0"
                        value={cmtInspectionDraft.samplingQty}
                        onChange={(event) => updateCmtInspectionDraft('samplingQty', event.target.value)}
                        disabled={savingCmtInspection}
                      />
                    </label>
                    <label className={styles.filterField}>
                      <span>Acceptance Standard</span>
                      <input
                        className={styles.input}
                        type="number"
                        min="0"
                        value={cmtInspectionDraft.acceptanceStandard}
                        onChange={(event) => updateCmtInspectionDraft('acceptanceStandard', event.target.value)}
                        disabled={savingCmtInspection}
                      />
                    </label>
                    <label className={styles.filterField}>
                      <span>Reject Standard</span>
                      <input
                        className={styles.input}
                        type="number"
                        min="0"
                        value={cmtInspectionDraft.rejectStandard}
                        onChange={(event) => updateCmtInspectionDraft('rejectStandard', event.target.value)}
                        disabled={savingCmtInspection}
                      />
                    </label>
                  </div>
                  {cmtDefectDrafts.length ? (
                    <div className={styles.cmtDefectRows}>
                      <div className={styles.cmtDefectHeader} aria-hidden="true">
                        <span>Reject Reason</span>
                        <span>Major</span>
                        <span>Minor</span>
                        <span>Notes</span>
                        <span />
                      </div>
                      {cmtDefectDrafts.map((row, index) => (
                        <div key={`cmt-defect-${index}`} className={styles.cmtDefectRow}>
                          <div className={styles.cmtReasonField}>
                            <input
                              className={styles.input}
                              value={row.rejectReasonName || row.newReasonName || ''}
                              onChange={(event) => updateCmtDefectDraft(index, 'rejectReasonName', event.target.value)}
                              placeholder="Type or choose reason"
                              disabled={savingCmtInspection}
                              onFocus={() => setCmtReasonFocusIndex(index)}
                              onBlur={() => window.setTimeout(() => setCmtReasonFocusIndex((current) => (current === index ? null : current)), 120)}
                            />
                            {cmtReasonFocusIndex === index ? (
                              <div className={styles.cmtReasonDropdown}>
                                {cmtRejectReasons
                                  .filter((reason) => {
                                    const keyword = String(row.rejectReasonName || row.newReasonName || '').trim().toUpperCase()
                                    if (!keyword) return true
                                    return String(reason.reason_name || '').toUpperCase().includes(keyword)
                                  })
                                  .slice(0, 6)
                                  .map((reason) => (
                                    <button key={reason.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectCmtRejectReason(index, reason)}>
                                      {reason.reason_name}
                                    </button>
                                  ))}
                                {!row.rejectReasonId && String(row.rejectReasonName || row.newReasonName || '').trim() ? (
                                  <button
                                    type="button"
                                    className={styles.cmtReasonAddOption}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => void addCmtRejectReasonFromDraft(index)}
                                    disabled={savingCmtInspection}
                                  >
                                    {`+ Add ${String(row.rejectReasonName || row.newReasonName || '').trim().toUpperCase()}`}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <div>
                            <input
                              className={styles.input}
                              type="number"
                              min="0"
                              value={row.majorQty}
                              onChange={(event) => updateCmtDefectDraft(index, 'majorQty', event.target.value)}
                              disabled={savingCmtInspection}
                            />
                          </div>
                          <div>
                            <input
                              className={styles.input}
                              type="number"
                              min="0"
                              value={row.minorQty}
                              onChange={(event) => updateCmtDefectDraft(index, 'minorQty', event.target.value)}
                              disabled={savingCmtInspection}
                            />
                          </div>
                          <div>
                            <input
                              className={styles.input}
                              value={row.notes}
                              onChange={(event) => updateCmtDefectDraft(index, 'notes', event.target.value)}
                              disabled={savingCmtInspection}
                            />
                          </div>
                          <button
                            type="button"
                            className={styles.iconDangerButton}
                            onClick={() => removeCmtDefectDraft(index)}
                            disabled={savingCmtInspection}
                            aria-label="Remove defect row"
                          >
                            <CloseIcon />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyMini}>No defective rows added yet.</div>
                  )}
                  <div className={styles.cmtAddDefectRow}>
                    <button type="button" className={styles.cmtAddDefectButton} onClick={addCmtDefectDraft} disabled={savingCmtInspection}>
                      Add Defect
                    </button>
                  </div>
                </div>

                <div className={styles.cmtClosingGrid}>
                  <div className={styles.cmtClosingStack}>
                    <div className={styles.filterField}>
                      <span>Measurement Attachment</span>
                      <div className={styles.cmtPhotoUploadBox}>
                        <input
                          id="cmt-measurement-pdf-input"
                          className={styles.hiddenFileInput}
                          type="file"
                          accept="application/pdf"
                          onChange={(event) => setCmtMeasurementPdfFile(event.target.files?.[0] || null)}
                          disabled={savingCmtInspection}
                        />
                        <label className={styles.cmtPhotoAddButton} htmlFor="cmt-measurement-pdf-input" aria-label="Add measurement PDF">
                          <PlusIcon />
                        </label>
                        <span>{cmtMeasurementPdfFile ? cmtMeasurementPdfFile.name : 'Add measurement PDF'}</span>
                      </div>
                      {cmtMeasurementPdfPreview ? (
                        <div className={styles.cmtMeasurementPreviewCard}>
                          <button
                            type="button"
                            onClick={() => setCmtAttachmentPreview({ type: 'pdf', url: cmtMeasurementPdfPreview.url, title: cmtMeasurementPdfPreview.file.name || 'Measurement Attachment' })}
                          >
                            Preview PDF
                          </button>
                          <button type="button" onClick={() => setCmtMeasurementPdfFile(null)} disabled={savingCmtInspection}>
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.filterField}>
                      <span>Defect Photos</span>
                      <div className={styles.cmtPhotoUploadBox}>
                        <input
                          id="cmt-defect-photos-input"
                          className={styles.hiddenFileInput}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) => {
                            addCmtDefectPhotos(event.target.files || [])
                            event.target.value = ''
                          }}
                          disabled={savingCmtInspection}
                        />
                        <label className={styles.cmtPhotoAddButton} htmlFor="cmt-defect-photos-input" aria-label="Add defect photos">
                          <PlusIcon />
                        </label>
                        <span>{cmtDefectPhotoFiles.length ? `${formatNumber(cmtDefectPhotoFiles.length)} photo(s) selected` : 'Add defect photos'}</span>
                      </div>
                      {cmtDefectPhotoPreviews.length ? (
                        <div className={styles.cmtPhotoPreviewGrid}>
                          {cmtDefectPhotoPreviews.map((preview, index) => (
                            <div key={`${preview.file.name}-${preview.file.size}-${index}`} className={styles.cmtPhotoPreviewCard}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={preview.url}
                                alt={preview.file.name || `Defect photo ${index + 1}`}
                                onClick={() => setCmtAttachmentPreview({ type: 'image', url: preview.url, title: preview.file.name || `Defect photo ${index + 1}` })}
                              />
                              <div>
                                <span>{preview.file.name || `Defect photo ${index + 1}`}</span>
                                <button type="button" onClick={() => removeCmtDefectPhoto(index)} disabled={savingCmtInspection}>
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <label className={styles.filterField}>
                      <span>Notes / Comment</span>
                      <textarea
                        className={styles.textarea}
                        value={cmtInspectionDraft.notes}
                        onChange={(event) => updateCmtInspectionDraft('notes', event.target.value)}
                        placeholder="Inspection notes"
                        disabled={savingCmtInspection}
                      />
                    </label>
                  </div>

                  <div className={styles.cmtResultPanel}>
                    <div className={styles.cmtMatrixTitle}>Inspection Result</div>
                    <div className={styles.cmtResultGrid}>
                      {CMT_INSPECTION_RESULT_OPTIONS.map((result) => (
                        <button
                          key={result}
                          type="button"
                          className={`${styles.cmtResultCard} ${styles[`cmtResult${result}`] || ''} ${
                            cmtInspectionDraft.inspectionResult === result ? styles.cmtResultCardActive : ''
                          }`.trim()}
                          onClick={() => updateCmtInspectionDraft('inspectionResult', result)}
                          disabled={savingCmtInspection}
                        >
                          <span>{result}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {selectedProductDetail && selectedCmtInspectionDetail ? (
        <div className={styles.modalOverlay} onClick={() => setSelectedCmtInspectionDetail(null)}>
          <div className={`${styles.modalCard} ${styles.actionModalCard} ${styles.cmtInspectionModalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>CMT Inspection Detail</p>
                <h3 className={styles.modalTitle}>{getCmtInspectionTitle(selectedCmtInspectionDetail)}</h3>
                <div className={styles.cmtInspectionMetaGrid}>
                  <div>
                    <span>PO</span>
                    <strong>{selectedProductDetail.poId || '-'}</strong>
                  </div>
                  <div>
                    <span>SKU</span>
                    <strong>{selectedProductDetail.sku || '-'}</strong>
                  </div>
                  <div>
                    <span>Category</span>
                    <strong>{selectedProductDetail.category || '-'}</strong>
                  </div>
                  <div>
                    <span>Total Order</span>
                    <strong>{formatNumber(selectedProductDetail.qty || selectedCmtInspectionDetail.order_qty || 0)} pcs</strong>
                  </div>
                </div>
              </div>
              <div className={styles.productHeaderActions}>
                <button
                  type="button"
                  className={styles.blackPrimaryButton}
                  onClick={() => void handlePrintCmtInspection(selectedCmtInspectionDetail)}
                  disabled={printingCmtInspectionId === String(selectedCmtInspectionDetail.id)}
                >
                  {printingCmtInspectionId === String(selectedCmtInspectionDetail.id) ? 'Generating...' : 'Print PDF'}
                </button>
                <button type="button" className={styles.iconButton} onClick={() => setSelectedCmtInspectionDetail(null)} aria-label="Close CMT inspection detail">
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className={styles.cmtViewSummaryGrid}>
              <div>
                <span>Inspection Date</span>
                <strong>{formatDateLabel(selectedCmtInspectionDetail.inspection_date)}</strong>
              </div>
              <div>
                <span>Sample Qty</span>
                <strong>{formatNumber(selectedCmtInspectionDetail.sampling_qty || 0)}</strong>
              </div>
              <div>
                <span>Defect Qty</span>
                <strong>{formatNumber(getCmtInspectionDefectQty(selectedCmtInspectionDetail))}</strong>
              </div>
              <div>
                <span>Result</span>
                <strong>{getCmtInspectionResultLabel(selectedCmtInspectionDetail)}</strong>
              </div>
            </div>

            {String(selectedCmtInspectionDetail.inspection_type || '').toUpperCase() === 'PREFINAL' ? (
              <div className={styles.cmtViewAttachmentRow}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() =>
                    void openStoredCmtAttachmentPreview(
                      selectedCmtInspectionDetail.prefinal_pdf_path,
                      'pdf',
                      `${getCmtInspectionTitle(selectedCmtInspectionDetail)} PDF`
                    )
                  }
                  disabled={!selectedCmtInspectionDetail.prefinal_pdf_path}
                >
                  Preview Pre-Final PDF
                </button>
              </div>
            ) : (
              <>
                <div className={styles.cmtInspectionMatrix}>
                  <div className={styles.cmtMatrixColumn}>
                    <div className={styles.cmtMatrixTitle}>Production Status</div>
                    <div className={styles.cmtStatusTable}>
                      {[
                        ['Cutting', selectedCmtInspectionDetail.cutting_qty, selectedCmtInspectionDetail.cutting_pct],
                        ['Printing', selectedCmtInspectionDetail.printing_qty, selectedCmtInspectionDetail.printing_pct],
                        ['Sewing', selectedCmtInspectionDetail.sewing_qty, selectedCmtInspectionDetail.sewing_pct],
                      ].map(([label, qty, pct]) => (
                        <div key={label} className={styles.cmtViewStatusRow}>
                          <strong>{label}</strong>
                          <span>{formatNumber(qty || 0)} pcs</span>
                          <span>{formatNumber(pct || 0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.cmtMatrixColumn}>
                    <div className={styles.cmtMatrixTitle}>QC Info</div>
                    <div className={styles.cmtViewChecklistStack}>
                      {CMT_QC_INFO_OPTIONS.map((option) => (
                        <label key={option} className={styles.cmtViewChecklistItem}>
                          <input type="checkbox" checked={Boolean(selectedCmtInspectionDetail.qc_information?.[option])} readOnly disabled />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className={styles.cmtMatrixColumn}>
                    <div className={styles.cmtMatrixTitle}>Accessories Checklist</div>
                    <div className={styles.cmtViewChecklistStack}>
                      {CMT_ACCESSORIES_OPTIONS.map((option) => (
                        <label key={option} className={styles.cmtViewChecklistItem}>
                          <input type="checkbox" checked={Boolean(selectedCmtInspectionDetail.accessories_checklist?.[option])} readOnly disabled />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className={styles.cmtMatrixColumn}>
                    <div className={styles.cmtMatrixTitle}>Packing Info</div>
                    <div className={styles.cmtViewChecklistStack}>
                      {CMT_PACKING_OPTIONS.map((option) => (
                        <label key={option} className={styles.cmtViewChecklistItem}>
                          <input type="checkbox" checked={Boolean(selectedCmtInspectionDetail.packing_information?.[option])} readOnly disabled />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`${styles.cmtInspectionFormSection} ${styles.cmtDefectPanel}`.trim()}>
                  <div className={styles.cmtInspectionSectionHeader}>
                    <strong>Defective Found</strong>
                  </div>
                  <div className={styles.cmtViewStandardsLine}>
                    <span>Sampling Qty <strong>{formatNumber(selectedCmtInspectionDetail.sampling_qty || 0)}</strong></span>
                    <span>Accept Std <strong>{formatNumber(selectedCmtInspectionDetail.acceptance_standard || 0)}</strong></span>
                    <span>Reject Std <strong>{formatNumber(selectedCmtInspectionDetail.reject_standard || 0)}</strong></span>
                  </div>
                  {(selectedCmtInspectionDetail.defects || []).length ? (
                    <div className={styles.cmtViewDefectTable}>
                      <div className={styles.cmtViewDefectTableHead}>
                        <span>Reject Reason</span>
                        <span>Major</span>
                        <span>Minor</span>
                        <span>Notes</span>
                      </div>
                      {(selectedCmtInspectionDetail.defects || []).map((row) => (
                        <div key={row.id || row.reject_reason_name} className={styles.cmtViewDefectRow}>
                          <strong>{row.reject_reason_name || '-'}</strong>
                          <span>{formatNumber(row.major_qty || 0)}</span>
                          <span>{formatNumber(row.minor_qty || 0)}</span>
                          <em>{row.notes || '-'}</em>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyMini}>No defective rows recorded.</div>
                  )}
                </div>

                <div className={styles.cmtViewAttachmentRow}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() =>
                      void openStoredCmtAttachmentPreview(
                        selectedCmtInspectionDetail.measurement_pdf_path,
                        'pdf',
                        `${getCmtInspectionTitle(selectedCmtInspectionDetail)} Measurement`
                      )
                    }
                    disabled={!selectedCmtInspectionDetail.measurement_pdf_path}
                  >
                    Preview Measurement PDF
                  </button>
                </div>
                {cmtSavedPhotoPreviews.length ? (
                  <div className={styles.cmtSavedPhotoGrid}>
                    {cmtSavedPhotoPreviews.map((photo, index) => (
                      <button
                        key={`${photo.path || photo.name || index}`}
                        type="button"
                        className={styles.cmtSavedPhotoCard}
                        onClick={() =>
                          photo.previewUrl
                            ? setCmtAttachmentPreview({ type: 'image', url: photo.previewUrl, title: photo.name || `Defect photo ${index + 1}` })
                            : void openStoredCmtAttachmentPreview(photo.path, 'image', photo.name || `Defect photo ${index + 1}`)
                        }
                      >
                        {photo.previewUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.previewUrl} alt={photo.name || `Defect photo ${index + 1}`} />
                          </>
                        ) : (
                          <span>{photo.name || `Defect photo ${index + 1}`}</span>
                        )}
                        <small>{photo.name || `Defect photo ${index + 1}`}</small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}

            <div className={styles.cmtViewNotesBox}>
              <span>Notes / Comment</span>
              <p>{selectedCmtInspectionDetail.notes || '-'}</p>
            </div>
          </div>
        </div>
      ) : null}

      {cmtAttachmentPreview ? (
        <div className={styles.cmtPreviewOverlay} onClick={() => setCmtAttachmentPreview(null)}>
          <div className={styles.cmtPreviewCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>{cmtAttachmentPreview.type === 'pdf' ? 'PDF Preview' : 'Photo Preview'}</p>
                <h3 className={styles.modalTitle}>{cmtAttachmentPreview.title || 'Attachment Preview'}</h3>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setCmtAttachmentPreview(null)} aria-label="Close attachment preview">
                <CloseIcon />
              </button>
            </div>
            <div className={styles.cmtPreviewBody}>
              {cmtAttachmentPreview.type === 'pdf' ? (
                <iframe className={styles.cmtPreviewPdf} src={cmtAttachmentPreview.url} title={cmtAttachmentPreview.title || 'Measurement attachment'} />
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.cmtPreviewImage} src={cmtAttachmentPreview.url} alt={cmtAttachmentPreview.title || 'Defect photo'} />
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedProductDetail && hppModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => (!savingHpp ? setHppModalOpen(false) : null)}>
          <div className={`${styles.modalCard} ${styles.hppModalCard}`.trim()} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Item Cost</p>
                <h3 className={styles.modalTitle}>Edit HPP</h3>
                <p className={styles.productDetailSubmeta}>{selectedProductDetail.productName || 'NO PRODUCT'}</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setHppModalOpen(false)} disabled={savingHpp} aria-label="Close HPP editor">
                <CloseIcon />
              </button>
            </div>
            <label className={styles.filterField}>
              <span>HPP per unit</span>
              <input
                className={styles.input}
                inputMode="decimal"
                value={hppDraft}
                onChange={(event) => {
                  const rawValue = event.target.value
                  setHppDraft(rawValue.trim() ? formatNumber(parseNumberValue(rawValue)) : '')
                }}
                placeholder="0"
                disabled={savingHpp}
              />
            </label>
            {productActionError ? <div className={styles.productActionError}>{productActionError}</div> : null}
            <div className={styles.productHeaderActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setHppModalOpen(false)} disabled={savingHpp}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => void handleSaveHpp()} disabled={savingHpp}>
                {savingHpp ? 'Saving...' : 'Save HPP'}
              </button>
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

