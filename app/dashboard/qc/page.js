'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6b7280',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
  },
  modeRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  modeButton: {
    minHeight: '42px',
    padding: '0 16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  modeButtonActive: {
    background: '#111827',
    color: '#fff',
    borderColor: '#111827',
  },
  summaryCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  infoIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    marginLeft: '6px',
    borderRadius: '999px',
    border: '1px solid #9ca3af',
    color: '#6b7280',
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: 1,
    cursor: 'help',
    textTransform: 'none',
  },
  infoWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  infoTooltip: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '240px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '500',
    lineHeight: 1.5,
    textTransform: 'none',
    zIndex: 20,
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.22)',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#111827',
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
  },
  select: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
    width: '100%',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '700',
    color: '#374151',
    padding: '12px 14px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
  },
  td: {
    padding: '12px 14px',
    fontSize: '14px',
    color: '#111827',
    borderBottom: '1px solid #f1f5f9',
  },
  thCenter: {
    textAlign: 'center',
  },
  tdCenter: {
    textAlign: 'center',
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
  },
  previewButton: {
    width: '36px',
    height: '36px',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  detailButton: {
    height: '34px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  inspectorNameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  liveTimerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '24px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#111827',
    color: '#fff',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.4)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 40,
    overflowY: 'auto',
  },
  modal: {
    width: '100%',
    maxWidth: '520px',
    maxHeight: 'calc(100vh - 48px)',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
  wideModal: {
    maxWidth: '1080px',
  },
  rejectDetailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '10px',
  },
  compactSummaryCard: {
    padding: '12px',
    gap: '4px',
  },
  compactSummaryValue: {
    fontSize: '20px',
  },
  inspectorModal: {
    maxWidth: '1160px',
    maxHeight: 'none',
    padding: '14px',
    gap: '12px',
    overflow: 'visible',
  },
  inspectorModalHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flexShrink: 0,
  },
  inspectorModalContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 'auto',
    overflow: 'visible',
  },
  inspectorModalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
    flexShrink: 0,
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px',
  },
  rejectRowGrid: {
    display: 'grid',
    gridTemplateColumns: '96px minmax(180px, 1.4fr) 96px 96px 86px',
    gap: '10px',
    alignItems: 'end',
  },
  rejectRowHeader: {
    display: 'grid',
    gridTemplateColumns: '96px minmax(180px, 1.4fr) 96px 96px 86px',
    gap: '10px',
    alignItems: 'center',
  },
  iconSmallButton: {
    width: '34px',
    height: '34px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '18px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  iconButtonRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    minHeight: '42px',
  },
  adjustmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  smallButton: {
    height: '34px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  primaryButton: {
    height: '42px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '8px',
    background: '#111827',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  secondaryButton: {
    height: '42px',
    padding: '0 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  warningBox: {
    padding: '12px 14px',
    border: '1px solid #f59e0b',
    borderRadius: '10px',
    background: '#fffbeb',
    color: '#92400e',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  smallNote: {
    margin: 0,
    fontSize: '12px',
    lineHeight: 1.6,
    color: '#6b7280',
    whiteSpace: 'pre-line',
  },
  noteGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  noteCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    background: '#f9fafb',
  },
  previewImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '70vh',
    objectFit: 'contain',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  modalTableWrap: {
    maxHeight: '360px',
    overflow: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  inspectorSection: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#fff',
  },
  inspectorSectionHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 14px',
    border: 'none',
    background: '#f9fafb',
    cursor: 'pointer',
    textAlign: 'left',
  },
  inspectorSectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '800',
    color: '#111827',
  },
  inspectorSectionMeta: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '600',
  },
  inspectorSectionBody: {
    padding: '10px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inspectorTableWrap: {
    maxHeight: 'none',
    overflow: 'visible',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
  },
  inspectorTh: {
    fontSize: '12px',
    padding: '10px 12px',
  },
  inspectorTd: {
    fontSize: '13px',
    padding: '10px 12px',
  },
}

function isWithinDateRange(dateString, dateFrom, dateTo) {
  if (!dateString) return false

  const dateOnly = String(dateString).slice(0, 10)
  if (dateFrom && dateOnly < dateFrom) return false
  if (dateTo && dateOnly > dateTo) return false
  return true
}

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateOnly(value) {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return ''
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue
  }

  const parsedDate = new Date(rawValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return rawValue.slice(0, 10)
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsedDate)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getTaskModelInfo(item) {
  return {
    model: item.model_name || 'UNKNOWN MODEL',
    photoUrl: item.photo_url || '',
  }
}

function getArklinePoLabel(item) {
  return String(item.po_id || 'NO PO').trim().toUpperCase() || 'NO PO'
}

function getArklineCategoryLabel(item) {
  return String(item.sku_induk || 'NO SKU').trim().toUpperCase() || 'NO SKU'
}

function getArklineProductLabel(item) {
  const sku = String(item.sku_induk || 'NO SKU').trim().toUpperCase() || 'NO SKU'
  const model = String(item.model_name || '').trim().toUpperCase()
  return model ? `${sku} - ${model}` : sku
}

function getBrandLabel(item) {
  return item.inbound_unload?.brands?.brand_name || 'UNBRANDED'
}

function getCategoryLabel(item) {
  return item.inbound_unload?.categories?.full_name || item.inbound_unload?.categories?.category_name || 'UNCATEGORIZED'
}

function getConfirmBrandLabel(item) {
  return item.brands?.brand_name || 'UNBRANDED'
}

function getConfirmCategoryLabel(item) {
  return item.categories?.full_name || item.categories?.category_name || 'UNCATEGORIZED'
}

function getReturnBrandLabel(item) {
  return item.brands?.brand_name || 'UNBRANDED'
}

function getReturnCategoryLabel(item) {
  return item.categories?.full_name || item.categories?.category_name || 'UNCATEGORIZED'
}

function getPauseDurationSeconds(item) {
  if (Number(item.duration_seconds || 0) > 0) {
    return Number(item.duration_seconds || 0)
  }

  const pausedAtMs = item.paused_at ? new Date(item.paused_at).getTime() : null
  const resumedAtMs = item.resumed_at ? new Date(item.resumed_at).getTime() : null

  if (!pausedAtMs) {
    return 0
  }

  const endMs = resumedAtMs || Date.now()
  return Math.max(0, Math.floor((endMs - pausedAtMs) / 1000))
}

function getPauseLogAssignedTo(item) {
  return item.qc_item?.assigned_to || item.arkline_qc?.assigned_to || item.paused_by || '-'
}

function getPauseLogArklinePoLabel(item) {
  return String(item.arkline_qc?.po_id || 'NO PO').trim().toUpperCase() || 'NO PO'
}

function getPauseLogArklineCategoryLabel(item) {
  return String(item.arkline_qc?.sku_induk || 'NO SKU').trim().toUpperCase() || 'NO SKU'
}

function getPauseLogArklineProductLabel(item) {
  const sku = getPauseLogArklineCategoryLabel(item)
  const model = String(item.arkline_qc?.model_name || '').trim().toUpperCase()
  return model ? `${sku} - ${model}` : sku
}

function formatMinutes(seconds) {
  return Math.round((Number(seconds || 0) / 60) * 100) / 100
}

function formatCompactTimer(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds || 0)))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function formatDisplayDate(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function getCheckedQty(item) {
  return Number(item?.qty_a || 0) + Number(item?.qty_b || 0) + Number(item?.qty_c || 0)
}

function getRejectQty(item) {
  return Number(item?.qty_b || 0) + Number(item?.qty_c || 0)
}

function hasQcResult(item) {
  return getCheckedQty(item) > 0 || Number(item?.locked_qty || 0) > 0
}

function getArklineTaskLabel(item, memberNameMap = {}) {
  const inspector = memberNameMap[item.assigned_to] || item.assigned_to || 'Unassigned'
  return `${inspector} | B ${Number(item.qty_b || 0)} / C ${Number(item.qty_c || 0)} | ${item.status || '-'}`
}

function getSummaryTaskKeyParts(summary) {
  return {
    brand: String(summary?.brand || '').trim().toUpperCase(),
    category: String(summary?.category || '').trim().toUpperCase(),
    model: String(summary?.model || '').trim().toUpperCase(),
  }
}

function isTaskInSummary(item, summary) {
  const summaryParts = getSummaryTaskKeyParts(summary)
  const itemBrand = getArklinePoLabel(item)
  const itemCategory = getArklineCategoryLabel(item)
  const itemModel = String(getTaskModelInfo(item).model || '').trim().toUpperCase()

  return itemBrand === summaryParts.brand && itemCategory === summaryParts.category && itemModel === summaryParts.model
}

function compareApparelSize(a, b) {
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  const normalizedA = String(a || '').trim().toUpperCase()
  const normalizedB = String(b || '').trim().toUpperCase()
  const indexA = order.indexOf(normalizedA)
  const indexB = order.indexOf(normalizedB)

  if (indexA !== -1 && indexB !== -1) return indexA - indexB
  if (indexA !== -1) return -1
  if (indexB !== -1) return 1
  return normalizedA.localeCompare(normalizedB, undefined, { numeric: true })
}

function applyInspectorErrorToRejectTotals(qtyB, qtyC, inspectorErrorQty) {
  let nextQtyB = Number(qtyB || 0)
  let nextQtyC = Number(qtyC || 0)
  const signedQty = Number(inspectorErrorQty || 0)

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

function createRejectDraftRow(overrides = {}) {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    grade: 'B',
    rejectReasonId: '',
    newReasonName: '',
    qty: '',
    size: '',
    ...overrides,
  }
}

function buildGroupedRejectDraftRows(rows = []) {
  const grouped = new Map()

  rows.forEach((item) => {
    const grade = String(item.grade || 'B').toUpperCase()
    const rejectReasonId = item.reject_reason_id || ''
    const size = String(item.size || '').trim().toUpperCase()
    const key = `${grade}|||${rejectReasonId}|||${size}`
    const current =
      grouped.get(key) ||
      createRejectDraftRow({
        grade,
        rejectReasonId,
        qty: '0',
        size,
      })

    current.qty = String(Number(current.qty || 0) + Number(item.qty || 0))
    grouped.set(key, current)
  })

  return Array.from(grouped.values())
}

function getSummaryRejectKey(item) {
  return `${item.brand}|||${item.category}|||${item.model}`
}

function getAdjustmentSummaryKey(item) {
  const po = String(item.po_id || 'NO PO').trim().toUpperCase() || 'NO PO'
  const sku = String(item.sku_induk || 'NO SKU').trim().toUpperCase() || 'NO SKU'
  const model = String(item.model_name || 'UNKNOWN MODEL').trim() || 'UNKNOWN MODEL'
  return `${po}|||${sku}|||${model}`
}

function getRejectDetailSummaryKey(item) {
  const po = String(item?.po_id || 'NO PO').trim().toUpperCase() || 'NO PO'
  const sku = String(item?.sku_induk || 'NO SKU').trim().toUpperCase() || 'NO SKU'
  const model = String(item?.model_name || 'UNKNOWN MODEL').trim() || 'UNKNOWN MODEL'
  return `${po}|||${sku}|||${model}`
}

function InfoHint({ text }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      style={styles.infoWrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button type="button" style={styles.infoIcon} aria-label={text}>
        i
      </button>
      {open ? <span style={styles.infoTooltip}>{text}</span> : null}
    </span>
  )
}

export default function QcDashboardPage() {
  const today = getTodayLocalDate()
  const [clockTick, setClockTick] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rejectDetailError, setRejectDetailError] = useState('')
  const [pausingAll, setPausingAll] = useState(false)
  const [showPauseConfirm, setShowPauseConfirm] = useState(false)
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [qcMode, setQcMode] = useState('regular')
  const [qcItems, setQcItems] = useState([])
  const [arklineQcItems, setArklineQcItems] = useState([])
  const [qcConfirmRows, setQcConfirmRows] = useState([])
  const [returnRows, setReturnRows] = useState([])
  const [qcMembers, setQcMembers] = useState([])
  const [qcProfiles, setQcProfiles] = useState([])
  const [pauseLogs, setPauseLogs] = useState([])
  const [arklineRejectReasons, setArklineRejectReasons] = useState([])
  const [arklineRejectDetails, setArklineRejectDetails] = useState([])
  const [arklineRejectAdjustments, setArklineRejectAdjustments] = useState([])
  const [arklinePoItemSizes, setArklinePoItemSizes] = useState([])
  const [grnFilter, setGrnFilter] = useState('')
  const [poFilter, setPoFilter] = useState('')
  const [arklineProductFilter, setArklineProductFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pauseDetailInspector, setPauseDetailInspector] = useState('')
  const [inspectorDetailSections, setInspectorDetailSections] = useState({
    nonProductive: false,
    finished: false,
    active: false,
  })
  const [rejectDetailSummary, setRejectDetailSummary] = useState(null)
  const [rejectDraftRows, setRejectDraftRows] = useState([])
  const [rejectAdjustmentDraft, setRejectAdjustmentDraft] = useState({
    bcToAQty: '',
    bcToANotes: '',
    inspectorErrorQty: '',
    inspectorErrorNotes: '',
  })
  const [savingRejectDetail, setSavingRejectDetail] = useState(false)

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError('')
    }

    const [
      { data: qcRows, error: qcError },
      { data: arklineRows, error: arklineError },
      { data: confirmRows, error: confirmError },
      { data: returnData, error: returnError },
      { data: memberRows, error: memberError },
      { data: rolePermissionRows, error: rolePermissionError },
      { data: pauseLogRows, error: pauseLogError },
      { data: rejectReasonRows, error: rejectReasonError },
      { data: rejectDetailRows, error: rejectDetailError },
      { data: rejectAdjustmentRows, error: rejectAdjustmentError },
      { data: poItemSizeRows, error: poItemSizeError },
    ] = await Promise.all([
      supabase
        .from('qc_items')
        .select(`
          *,
          inbound:inbound_id (
            id,
            grn_number
          ),
          inbound_unload:inbound_unload_id (
            id,
            brand_id,
            category_id,
            brands:dir_brands!brand_id (
              id,
              brand_name
            ),
            categories:dir_categories!category_id (
              id,
              category_name,
              full_name
            )
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('arkline_qc')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('qc_confirm')
        .select(`
          id,
          inbound_id,
          model_name,
          model_color,
          photo_url,
          qty,
          grade,
          is_adjustment,
          created_at,
          inbound:inbound_id (
            id,
            grn_number
          ),
          brands:dir_brands!brand_id (
            id,
            brand_name
          ),
          categories:dir_categories!category_id (
            id,
            category_name,
            full_name
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('warehouse_returns')
        .select(`
          id,
          inbound_id,
          model_name,
          model_color,
          qty,
          grade,
          is_adjustment,
          created_at,
          source_phase,
          inbound:inbound_id (
            id,
            grn_number
          ),
          brands:dir_brands!brand_id (
            id,
            brand_name
          ),
          categories:dir_categories!category_id (
            id,
            category_name,
            full_name
          )
        `)
        .eq('source_phase', 'qc')
        .order('created_at', { ascending: false }),
      supabase
        .from('dir_user_profiles')
        .select('id, email, display_name, role, is_qc_active, qc_active_date')
        .order('display_name', { ascending: true }),
      supabase.from('dir_user_roles').select('role, permission_code').eq('permission_code', 'qc.grading_task.view'),
      supabase
        .from('qc_pause_logs')
        .select(`
          id,
          qc_item_id,
          arkline_qc_id,
          paused_by,
          pause_reason,
          paused_at,
          resumed_at,
          resumed_by,
          duration_seconds,
          qc_item:qc_item_id (
            id,
            assigned_to,
            inbound:inbound_id (
              id,
              grn_number
            ),
            inbound_unload:inbound_unload_id (
              id,
              brand_id,
              category_id,
              brands:dir_brands!brand_id (
                id,
                brand_name
              ),
              categories:dir_categories!category_id (
                id,
                category_name,
                full_name
              )
            )
          ),
          arkline_qc:arkline_qc_id (
            id,
            assigned_to,
            po_id,
            sku_induk,
            model_name
          )
        `)
        .order('paused_at', { ascending: false }),
      supabase
        .from('arkline_qc_reject_reasons')
        .select('id, reason_name, is_active')
        .eq('is_active', true)
        .order('reason_name', { ascending: true }),
      supabase
        .from('arkline_qc_reject_details')
        .select(`
          id,
          arkline_qc_id,
          po_id,
          arkline_po_item_id,
          sku_induk,
          model_name,
          grade,
          size,
          reject_reason_id,
          qty,
          reason:reject_reason_id (
            id,
            reason_name
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('arkline_qc_reject_adjustments')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('arkline_po_item_sizes')
        .select('arkline_po_item_id, size, qty')
        .order('size', { ascending: true }),
    ])

    if (
      qcError ||
      arklineError ||
      confirmError ||
      returnError ||
      memberError ||
      pauseLogError ||
      rolePermissionError ||
      rejectReasonError ||
      rejectDetailError ||
      rejectAdjustmentError ||
      poItemSizeError
    ) {
      setError(
        qcError?.message ||
          arklineError?.message ||
          confirmError?.message ||
          returnError?.message ||
          memberError?.message ||
          pauseLogError?.message ||
          rolePermissionError?.message ||
          rejectReasonError?.message ||
          rejectDetailError?.message ||
          rejectAdjustmentError?.message ||
          poItemSizeError?.message ||
          'Failed to load QC dashboard.'
      )
      if (!silent) setLoading(false)
      return
    }

    const allowedRoles = new Set((rolePermissionRows || []).map((item) => item.role))
    const allProfiles = memberRows || []
    const eligibleMembers = allProfiles.filter(
      (item) => allowedRoles.has(item.role) && item.is_qc_active === true && getDateOnly(item.qc_active_date) === today
    )

    setQcItems(qcRows || [])
    setArklineQcItems(arklineRows || [])
    setQcConfirmRows(confirmRows || [])
    setReturnRows(returnData || [])
    setQcMembers(eligibleMembers)
    setQcProfiles(allProfiles)
    setPauseLogs(pauseLogRows || [])
    setArklineRejectReasons(rejectReasonRows || [])
    setArklineRejectDetails(rejectDetailRows || [])
    setArklineRejectAdjustments(rejectAdjustmentRows || [])
    setArklinePoItemSizes(poItemSizeRows || [])
    if (!silent) setLoading(false)
  }, [today])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTick(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (showPauseConfirm || previewPhoto || rejectDetailSummary || pauseDetailInspector || savingRejectDetail) return
      void loadDashboard(true)
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [loadDashboard, pauseDetailInspector, previewPhoto, rejectDetailSummary, savingRejectDetail, showPauseConfirm])

  const grnOptions = useMemo(
    () => Array.from(new Set(qcItems.map((item) => item.inbound?.grn_number).filter(Boolean))),
    [qcItems]
  )
  const poOptions = useMemo(
    () => Array.from(new Set(arklineQcItems.map((item) => getArklinePoLabel(item)).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [arklineQcItems]
  )
  const arklineProductOptions = useMemo(() => {
    const sourceItems =
      poFilter && poFilter !== 'NO PO'
        ? arklineQcItems.filter((item) => getArklinePoLabel(item) === poFilter)
        : arklineQcItems

    return Array.from(new Set(sourceItems.map((item) => getArklineProductLabel(item)).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    )
  }, [arklineQcItems, poFilter])
  const brandOptions = useMemo(
    () => Array.from(new Set(qcItems.map((item) => getBrandLabel(item)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [qcItems]
  )
  const categoryOptions = useMemo(
    () => Array.from(new Set(qcItems.map((item) => getCategoryLabel(item)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [qcItems]
  )
  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)

  const filteredItems = useMemo(
    () =>
      qcItems.filter((item) => {
        const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(item.finished_at || item.created_at, dateFrom, dateTo)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getBrandLabel(item) === brandFilter
        const matchesCategory = !categoryFilter || getCategoryLabel(item) === categoryFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, dateFrom, dateTo, grnFilter, hasInvalidDateRange, qcItems]
  )

  const filteredArklineItems = useMemo(
    () =>
      arklineQcItems.filter((item) => {
        const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(item.finished_at || item.created_at, dateFrom, dateTo)
        const matchesPo = !poFilter || getArklinePoLabel(item) === poFilter
        const matchesProduct = !arklineProductFilter || getArklineProductLabel(item) === arklineProductFilter
        return matchesDate && matchesPo && matchesProduct
      }),
    [arklineProductFilter, arklineQcItems, dateFrom, dateTo, hasInvalidDateRange, poFilter]
  )

  const filteredAdjustmentRows = useMemo(
    () =>
      qcConfirmRows.filter((item) => {
        if (!item.is_adjustment) {
          return false
        }

        const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(item.created_at, dateFrom, dateTo)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getConfirmBrandLabel(item) === brandFilter
        const matchesCategory = !categoryFilter || getConfirmCategoryLabel(item) === categoryFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, dateFrom, dateTo, grnFilter, hasInvalidDateRange, qcConfirmRows]
  )

  const filteredReturnAdjustmentRows = useMemo(
    () =>
      returnRows.filter((item) => {
        if (!item.is_adjustment) {
          return false
        }

        const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(item.created_at, dateFrom, dateTo)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getReturnBrandLabel(item) === brandFilter
        const matchesCategory = !categoryFilter || getReturnCategoryLabel(item) === categoryFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, dateFrom, dateTo, grnFilter, hasInvalidDateRange, returnRows]
  )

  const filteredRegularPauseLogs = useMemo(
    () =>
      pauseLogs.filter((item) => {
        const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(item.paused_at, dateFrom, dateTo)
        const matchesGrn = !grnFilter || item.qc_item?.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getBrandLabel(item.qc_item || {}) === brandFilter
        const matchesCategory = !categoryFilter || getCategoryLabel(item.qc_item || {}) === categoryFilter
        return Boolean(item.qc_item_id) && matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, dateFrom, dateTo, grnFilter, hasInvalidDateRange, pauseLogs]
  )

  const filteredArklinePauseLogs = useMemo(
    () =>
      pauseLogs.filter((item) => {
        const matchesDate = hasInvalidDateRange ? true : isWithinDateRange(item.paused_at, dateFrom, dateTo)
        const matchesPo = !poFilter || getPauseLogArklinePoLabel(item) === poFilter
        const matchesProduct = !arklineProductFilter || getPauseLogArklineProductLabel(item) === arklineProductFilter
        return Boolean(item.arkline_qc_id) && matchesDate && matchesPo && matchesProduct
      }),
    [arklineProductFilter, dateFrom, dateTo, hasInvalidDateRange, pauseLogs, poFilter]
  )

  const activeItems = useMemo(
    () => (qcMode === 'arkline' ? filteredArklineItems : filteredItems),
    [filteredArklineItems, filteredItems, qcMode]
  )
  const activePauseLogs = useMemo(
    () => (qcMode === 'arkline' ? filteredArklinePauseLogs : filteredRegularPauseLogs),
    [filteredArklinePauseLogs, filteredRegularPauseLogs, qcMode]
  )

  const memberNameMap = useMemo(
    () =>
      qcProfiles.reduce((result, item) => {
        result[String(item.email || '').trim().toLowerCase()] = item.display_name || ''
        return result
      }, {}),
    [qcProfiles]
  )

  const qcResultSummary = useMemo(() => {
    const grouped = new Map()
    const arklineDetailByTaskId = new Map()
    const arklineDetailBySummaryKey = new Map()
    const arklineAdjustmentBySummaryKey = new Map()

    if (qcMode === 'arkline') {
      arklineRejectDetails.forEach((detail) => {
        const current = arklineDetailByTaskId.get(detail.arkline_qc_id) || { qtyB: 0, qtyC: 0 }
        const summaryKey = getRejectDetailSummaryKey(detail)
        const summaryCurrent = arklineDetailBySummaryKey.get(summaryKey) || { qtyB: 0, qtyC: 0 }
        const grade = String(detail.grade || '').toUpperCase()
        if (grade === 'B') current.qtyB += Number(detail.qty || 0)
        if (grade === 'C') current.qtyC += Number(detail.qty || 0)
        if (grade === 'B') summaryCurrent.qtyB += Number(detail.qty || 0)
        if (grade === 'C') summaryCurrent.qtyC += Number(detail.qty || 0)
        arklineDetailByTaskId.set(detail.arkline_qc_id, current)
        arklineDetailBySummaryKey.set(summaryKey, summaryCurrent)
      })

      arklineRejectAdjustments.forEach((adjustment) => {
        const key = getAdjustmentSummaryKey(adjustment)
        const current = arklineAdjustmentBySummaryKey.get(key) || { bcToAQty: 0, inspectorErrorQty: 0 }
        if (adjustment.adjustment_type === 'bc_to_a') current.bcToAQty += Number(adjustment.qty || 0)
        if (adjustment.adjustment_type === 'inspector_data_error') current.inspectorErrorQty += Number(adjustment.qty || 0)
        arklineAdjustmentBySummaryKey.set(key, current)
      })
    }

    activeItems.forEach((item) => {
      const brand = qcMode === 'arkline' ? getArklinePoLabel(item) : getBrandLabel(item)
      const category = qcMode === 'arkline' ? getArklineCategoryLabel(item) : getCategoryLabel(item)
      const taskModel = getTaskModelInfo(item)
      const model = taskModel.model
      const key = `${brand}|||${category}|||${model}`
      const current =
        grouped.get(key) || {
          brand,
          category,
          model,
          photoUrl: taskModel.photoUrl,
          qtyA: 0,
          qtyB: 0,
          qtyC: 0,
          rejectTargetQty: 0,
          checked: 0,
          taskRows: [],
          hasRejectDetails: false,
        }
      const detailQty = arklineDetailByTaskId.get(item.id)
      const effectiveQtyB = qcMode === 'arkline' && detailQty ? detailQty.qtyB : Number(item.qty_b || 0)
      const effectiveQtyC = qcMode === 'arkline' && detailQty ? detailQty.qtyC : Number(item.qty_c || 0)

      current.qtyA += Number(item.qty_a || 0)
      current.qtyB += effectiveQtyB
      current.qtyC += effectiveQtyC
      current.rejectTargetQty += getRejectQty(item)
      current.photoUrl = current.photoUrl || taskModel.photoUrl
      current.hasRejectDetails = current.hasRejectDetails || Boolean(detailQty)
      if (qcMode === 'arkline') current.taskRows.push(item)
      grouped.set(key, current)
    })

    if (qcMode === 'arkline') {
      grouped.forEach((current, key) => {
        const adjustment = arklineAdjustmentBySummaryKey.get(key) || { bcToAQty: 0, inspectorErrorQty: 0 }
        const detailSummary = arklineDetailBySummaryKey.get(key)
        if (detailSummary) {
          current.qtyB = detailSummary.qtyB
          current.qtyC = detailSummary.qtyC
        }
        current.qtyA += adjustment.bcToAQty
        const adjustedRejectTotals = applyInspectorErrorToRejectTotals(current.qtyB, current.qtyC, adjustment.inspectorErrorQty)
        current.qtyB = adjustedRejectTotals.qtyB
        current.qtyC = adjustedRejectTotals.qtyC
        current.checked = current.qtyA + current.qtyB + current.qtyC
      })
    }

    if (qcMode !== 'arkline') filteredAdjustmentRows.forEach((item) => {
      const brand = getConfirmBrandLabel(item)
      const category = getConfirmCategoryLabel(item)
      const model = item.model_name || 'UNKNOWN MODEL'
      const key = `${brand}|||${category}|||${model}`
      const current = grouped.get(key) || { brand, category, model, photoUrl: item.photo_url || '', qtyA: 0, qtyB: 0, qtyC: 0, checked: 0 }
      const grade = String(item.grade || 'A').toUpperCase()
      const qty = Number(item.qty || 0)

      if (grade === 'A') current.qtyA += qty
      if (grade === 'B') current.qtyB += qty
      if (grade === 'C') current.qtyC += qty
      current.checked += qty
      current.photoUrl = current.photoUrl || item.photo_url || ''
      grouped.set(key, current)
    })

    if (qcMode !== 'arkline') filteredReturnAdjustmentRows.forEach((item) => {
      const brand = getReturnBrandLabel(item)
      const category = getReturnCategoryLabel(item)
      const model = item.model_name || 'UNKNOWN MODEL'
      const key = `${brand}|||${category}|||${model}`
      const current = grouped.get(key) || { brand, category, model, photoUrl: '', qtyA: 0, qtyB: 0, qtyC: 0, checked: 0 }
      const grade = String(item.grade || 'A').toUpperCase()
      const qty = Number(item.qty || 0)

      if (grade === 'A') current.qtyA += qty
      if (grade === 'B') current.qtyB += qty
      if (grade === 'C') current.qtyC += qty
      current.checked += qty
      grouped.set(key, current)
    })

    if (qcMode !== 'arkline') {
      grouped.forEach((current) => {
        current.checked = current.qtyA + current.qtyB + current.qtyC
      })
    }

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.brand !== b.brand) return a.brand.localeCompare(b.brand)
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      return a.model.localeCompare(b.model)
    })
  }, [activeItems, arklineRejectAdjustments, arklineRejectDetails, filteredAdjustmentRows, filteredReturnAdjustmentRows, qcMode])

  const arklineRejectDetailQtyBySummary = useMemo(() => {
    const grouped = new Map()
    const taskSummaryKeyById = new Map()

    qcResultSummary.forEach((summary) => {
      ;(summary.taskRows || []).forEach((row) => {
        taskSummaryKeyById.set(row.id, getSummaryRejectKey(summary))
      })
    })

    arklineRejectDetails.forEach((detail) => {
      const key = taskSummaryKeyById.get(detail.arkline_qc_id)
      if (!key) return
      grouped.set(key, (grouped.get(key) || 0) + Number(detail.qty || 0))
    })

    return grouped
  }, [arklineRejectDetails, qcResultSummary])

  const selectedRejectTaskRows = useMemo(
    () => (rejectDetailSummary ? activeItems.filter((item) => isTaskInSummary(item, rejectDetailSummary)) : []),
    [activeItems, rejectDetailSummary]
  )
  const selectedRejectTaskIds = useMemo(
    () => new Set(selectedRejectTaskRows.map((item) => item.id)),
    [selectedRejectTaskRows]
  )
  const selectedRejectSummaryKey = useMemo(
    () => (rejectDetailSummary ? getSummaryRejectKey(rejectDetailSummary) : ''),
    [rejectDetailSummary]
  )
  const selectedRejectExistingDetails = useMemo(
    () =>
      arklineRejectDetails.filter(
        (item) => selectedRejectTaskIds.has(item.arkline_qc_id) || getRejectDetailSummaryKey(item) === selectedRejectSummaryKey
      ),
    [arklineRejectDetails, selectedRejectSummaryKey, selectedRejectTaskIds]
  )
  const selectedRejectReasonOptions = useMemo(() => {
    const grouped = new Map()

    arklineRejectReasons.forEach((item) => {
      grouped.set(item.id, item)
    })

    selectedRejectExistingDetails.forEach((item) => {
      if (item.reject_reason_id && item.reason?.reason_name) {
        grouped.set(item.reject_reason_id, {
          id: item.reject_reason_id,
          reason_name: item.reason.reason_name,
          is_active: true,
        })
      }
    })

    return Array.from(grouped.values()).sort((a, b) => a.reason_name.localeCompare(b.reason_name))
  }, [arklineRejectReasons, selectedRejectExistingDetails])
  const selectedRejectTargetQty = Number(rejectDetailSummary?.rejectTargetQty ?? getRejectQty(rejectDetailSummary || {}))
  const selectedRejectDetailQty = rejectDraftRows.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const selectedRejectAdjustmentQty =
    Number(rejectAdjustmentDraft.bcToAQty || 0) + Number(rejectAdjustmentDraft.inspectorErrorQty || 0)
  const selectedRejectGap = selectedRejectTargetQty - selectedRejectDetailQty - selectedRejectAdjustmentQty
  const selectedRejectPreviewSummary = useMemo(() => {
    const baseQtyA = selectedRejectTaskRows.reduce((sum, item) => sum + Number(item.qty_a || 0), 0)
    const baseQtyB = Number(rejectDetailSummary?.qtyB || 0)
    const baseQtyC = Number(rejectDetailSummary?.qtyC || 0)
    const bcToAQty = Number(rejectAdjustmentDraft.bcToAQty || 0)

    let previewQtyB = 0
    let previewQtyC = 0
    let hasDraftRejectQty = false

    rejectDraftRows.forEach((row) => {
      const grade = String(row.grade || '').toUpperCase()
      const qty = Number(row.qty || 0)
      if (!qty) return
      if (grade === 'B') {
        previewQtyB += qty
        hasDraftRejectQty = true
      }
      if (grade === 'C') {
        previewQtyC += qty
        hasDraftRejectQty = true
      }
    })

    return {
      qtyA: baseQtyA + bcToAQty,
      qtyB: hasDraftRejectQty ? previewQtyB : baseQtyB,
      qtyC: hasDraftRejectQty ? previewQtyC : baseQtyC,
    }
  }, [rejectAdjustmentDraft.bcToAQty, rejectDetailSummary, rejectDraftRows, selectedRejectTaskRows])
  const selectedRejectPreviewChecked =
    selectedRejectPreviewSummary.qtyA + selectedRejectPreviewSummary.qtyB + selectedRejectPreviewSummary.qtyC
  const selectedRejectSizeOptions = useMemo(() => {
    const poItemIds = new Set(selectedRejectTaskRows.map((item) => item.arkline_po_item_id).filter(Boolean))
    const sizes = arklinePoItemSizes
      .filter((item) => poItemIds.has(item.arkline_po_item_id))
      .map((item) => String(item.size || '').trim())
      .filter(Boolean)

    return Array.from(new Set(sizes)).sort(compareApparelSize)
  }, [arklinePoItemSizes, selectedRejectTaskRows])
  const selectedRejectInspectorRows = useMemo(() => {
    const grouped = new Map()

    selectedRejectTaskRows.forEach((item) => {
      const inspectorKey = String(item.assigned_to || '-').trim().toLowerCase() || '-'
      const current = grouped.get(inspectorKey) || {
        inspectorKey,
        inspector: memberNameMap[inspectorKey] || (inspectorKey === '-' ? 'Unassigned' : String(item.assigned_to || inspectorKey)),
        qtyA: 0,
        qtyB: 0,
        qtyC: 0,
        checked: 0,
      }

      current.qtyA += Number(item.qty_a || 0)
      current.qtyB += Number(item.qty_b || 0)
      current.qtyC += Number(item.qty_c || 0)
      current.checked += getCheckedQty(item)
      grouped.set(inspectorKey, current)
    })

    return Array.from(grouped.values()).sort((a, b) => a.inspector.localeCompare(b.inspector))
  }, [memberNameMap, selectedRejectTaskRows])
  const inspectorPerformance = useMemo(() => {
    const grouped = new Map()

    activeItems.forEach((item) => {
      const key = item.assigned_to || '-'
      const totalPcs = getCheckedQty(item)
      const minutes = Number(item.stopwatch_seconds || 0) / 60
      const startedAtMs = item.started_at ? new Date(item.started_at).getTime() : null
      const liveSeconds =
        item.status === 'in_progress' && startedAtMs
          ? Number(item.stopwatch_seconds || 0) + Math.max(0, Math.floor((clockTick - startedAtMs) / 1000))
          : 0
      const workDate = String(item.finished_at || item.created_at || '').slice(0, 10)
      const current =
        grouped.get(key) || {
          inspector: key,
          totalPcs: 0,
          totalMinutes: 0,
          daySet: new Set(),
          avgPerDay: 0,
          rate: 0,
          nonProductiveSeconds: 0,
          pauseLogs: [],
          completedTaskRows: [],
          activeTaskRows: [],
          activeTaskCount: 0,
          activeAllocatedQty: 0,
          activeLiveSeconds: 0,
          runningTaskCount: 0,
        }

      if (item.status === 'done' || hasQcResult(item)) {
        current.totalPcs += totalPcs
        current.totalMinutes += minutes
        if (workDate) current.daySet.add(workDate)
        current.completedTaskRows.push({
          id: item.id,
          source: qcMode === 'arkline' ? getArklinePoLabel(item) : item.inbound?.grn_number || '-',
          category: qcMode === 'arkline' ? getArklineCategoryLabel(item) : getCategoryLabel(item),
          model: getTaskModelInfo(item).model,
          qtyA: Number(item.qty_a || 0),
          qtyB: Number(item.qty_b || 0),
          qtyC: Number(item.qty_c || 0),
          checkedQty: totalPcs,
          seconds: Number(item.stopwatch_seconds || 0),
          rate: minutes > 0 ? Math.round((totalPcs / minutes) * 100) / 100 : 0,
          status: item.status || '-',
          finishedAt: item.finished_at || item.updated_at || item.created_at || '',
        })
      }

      if (item.status !== 'done') {
        current.activeTaskCount += 1
        current.activeAllocatedQty += Number(item.allocated_qty || 0)
        current.activeLiveSeconds += liveSeconds
        if (item.status === 'in_progress') current.runningTaskCount += 1
        current.activeTaskRows.push({
          id: item.id,
          source: qcMode === 'arkline' ? getArklinePoLabel(item) : item.inbound?.grn_number || '-',
          category: qcMode === 'arkline' ? getArklineCategoryLabel(item) : getCategoryLabel(item),
          model: getTaskModelInfo(item).model,
          allocatedQty: Number(item.allocated_qty || 0),
          checkedQty: totalPcs,
          remainingQty: Math.max(0, Number(item.allocated_qty || 0) - Number(item.locked_qty || 0)),
          status: item.status || '-',
        })
      }

      grouped.set(key, current)
    })

    activePauseLogs.forEach((item) => {
      const key = getPauseLogAssignedTo(item)
      const current =
        grouped.get(key) || {
          inspector: key,
          totalPcs: 0,
          totalMinutes: 0,
          daySet: new Set(),
          avgPerDay: 0,
          rate: 0,
          nonProductiveSeconds: 0,
          pauseLogs: [],
          taskRows: [],
        }

      current.nonProductiveSeconds += getPauseDurationSeconds(item)
      current.pauseLogs.push(item)
      grouped.set(key, current)
    })

    return Array.from(grouped.values()).map((item) => {
      const dayCount = item.daySet.size || 1
      const inspectorName = memberNameMap[item.inspector] || (item.inspector === '-' ? 'Unassigned' : 'Unknown Inspector')
      return {
        inspector: inspectorName,
        inspectorKey: item.inspector,
        totalPcs: item.totalPcs,
        avgPerDay: Math.round((item.totalPcs / dayCount) * 100) / 100,
          rate: item.totalMinutes > 0 ? Math.round((item.totalPcs / item.totalMinutes) * 100) / 100 : 0,
          nonProductiveHours: formatMinutes(item.nonProductiveSeconds),
          pauseLogs: [...(item.pauseLogs || [])].sort((a, b) => new Date(b.paused_at || 0).getTime() - new Date(a.paused_at || 0).getTime()),
          completedTaskRows: [...(item.completedTaskRows || [])].sort(
            (a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime()
          ),
          activeTaskRows: [...(item.activeTaskRows || [])].sort((a, b) => String(a.status || '').localeCompare(String(b.status || ''))),
          activeTaskCount: item.activeTaskCount,
          activeAllocatedQty: item.activeAllocatedQty,
          activeLiveSeconds: item.activeLiveSeconds,
          runningTaskCount: item.runningTaskCount,
        }
      })
  }, [activeItems, activePauseLogs, clockTick, memberNameMap, qcMode])

  const categoryTimes = useMemo(() => {
    const grouped = new Map()

    activeItems
      .filter((item) => item.status === 'done' || hasQcResult(item))
      .forEach((item) => {
        const speedLabel =
          qcMode === 'arkline'
            ? getTaskModelInfo(item).model
            : item.inbound_unload?.categories?.full_name || item.inbound_unload?.categories?.category_name || 'UNCATEGORIZED'
        const checkedQty = getCheckedQty(item)
        const current = grouped.get(speedLabel) || { label: speedLabel, totalSeconds: 0, totalPcs: 0 }
        current.totalSeconds += Number(item.stopwatch_seconds || 0)
        current.totalPcs += checkedQty
        grouped.set(speedLabel, current)
      })

    return Array.from(grouped.values()).map((item) => ({
      label: item.label,
      secondsPerPcs: item.totalPcs ? Math.round((item.totalSeconds / item.totalPcs) * 100) / 100 : 0,
    }))
  }, [activeItems, qcMode])

  const totalAllocated = activeItems.reduce((sum, item) => sum + Number(item.allocated_qty || 0), 0)
  const totalLocked = activeItems.reduce((sum, item) => sum + Number(item.locked_qty || 0), 0)
  const totalChecked = qcResultSummary.reduce((sum, item) => sum + Number(item.checked || 0), 0)
  const totalGradeA = qcResultSummary.reduce((sum, item) => sum + Number(item.qtyA || 0), 0)
  const totalGradeB = qcResultSummary.reduce((sum, item) => sum + Number(item.qtyB || 0), 0)
  const totalGradeC = qcResultSummary.reduce((sum, item) => sum + Number(item.qtyC || 0), 0)
  const selectedInspectorPerformance = inspectorPerformance.find((item) => item.inspectorKey === pauseDetailInspector)
  const selectedInspectorPauseLogs = selectedInspectorPerformance?.pauseLogs || []
  const selectedInspectorCompletedTaskRows = selectedInspectorPerformance?.completedTaskRows || []
  const selectedInspectorActiveTaskRows = selectedInspectorPerformance?.activeTaskRows || []
  const selectedInspectorCheckedQty = selectedInspectorCompletedTaskRows.reduce((sum, item) => sum + Number(item.checkedQty || 0), 0)
  const totalRemaining = activeItems.reduce(
    (sum, item) => sum + (Number(item.locked_qty || 0) - Number(item.allocated_qty || 0)),
    0
  )

  function openRejectDetailModal(summary) {
    const summaryTaskRows = activeItems.filter((item) => isTaskInSummary(item, summary))
    const taskIds = new Set(summaryTaskRows.map((item) => item.id))
    const summaryKey = getSummaryRejectKey(summary)
    const existingDetails = arklineRejectDetails.filter(
      (item) => taskIds.has(item.arkline_qc_id) || getRejectDetailSummaryKey(item) === summaryKey
    )
    const existingAdjustments = arklineRejectAdjustments.filter((item) => {
      const samePo = String(item.po_id || 'NO PO').trim().toUpperCase() === summary.brand
      const sameSku = String(item.sku_induk || 'NO SKU').trim().toUpperCase() === summary.category
      const sameModel = String(item.model_name || '').trim().toUpperCase() === String(summary.model || '').trim().toUpperCase()
      return samePo && sameSku && sameModel
    })

    const summaryRejectTargetQty = Number(summary.rejectTargetQty ?? getRejectQty(summary))
    const initialRows = existingDetails.length
      ? buildGroupedRejectDraftRows(existingDetails)
      : [
          ...(Number(summary.qtyB || 0) > 0 ? [createRejectDraftRow({ grade: 'B', qty: String(summary.qtyB || '') })] : []),
          ...(Number(summary.qtyC || 0) > 0 ? [createRejectDraftRow({ grade: 'C', qty: String(summary.qtyC || '') })] : []),
          ...(!summaryRejectTargetQty ? [createRejectDraftRow()] : []),
        ]

    const bcToAAdjustment = existingAdjustments.find((item) => item.adjustment_type === 'bc_to_a')
    const inspectorErrorAdjustment = existingAdjustments.find((item) => item.adjustment_type === 'inspector_data_error')

    setRejectDetailSummary(summary)
    setRejectDetailError('')
    setRejectDraftRows(initialRows.length ? initialRows : [createRejectDraftRow()])
    setRejectAdjustmentDraft({
      bcToAQty: bcToAAdjustment?.qty ? String(bcToAAdjustment.qty) : '',
      bcToANotes: bcToAAdjustment?.notes || '',
      inspectorErrorQty: inspectorErrorAdjustment?.qty ? String(inspectorErrorAdjustment.qty) : '',
      inspectorErrorNotes: inspectorErrorAdjustment?.notes || '',
    })
  }

  function toggleInspectorDetailSection(sectionKey) {
    setInspectorDetailSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  function updateRejectDraftRow(rowId, field, value) {
    setRejectDraftRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row
        const shouldUppercase = field === 'grade' || field === 'newReasonName' || field === 'size'
        const next = { ...row, [field]: shouldUppercase ? String(value).toUpperCase() : value }
        if (field === 'rejectReasonId' && value !== '__new__') {
          next.newReasonName = ''
        }
        return next
      })
    )
  }

  function removeRejectDraftRow(rowId) {
    setRejectDraftRows((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== rowId) : rows))
  }

  async function resolveRejectReasonId(row) {
    if (row.rejectReasonId && row.rejectReasonId !== '__new__') {
      return row.rejectReasonId
    }

    const reasonName = String(row.newReasonName || '').trim().toUpperCase()
    if (!reasonName) {
      throw new Error('Isi reason baru dulu sebelum save.')
    }

    const existingReason = arklineRejectReasons.find((item) => item.reason_name.toLowerCase() === reasonName.toLowerCase())
    if (existingReason) {
      return existingReason.id
    }

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
        throw new Error(insertError.message)
      }
      setArklineRejectReasons((items) => [...items, fallbackReason].sort((a, b) => a.reason_name.localeCompare(b.reason_name)))
      return fallbackReason.id
    }

    setArklineRejectReasons((items) => [...items, data].sort((a, b) => a.reason_name.localeCompare(b.reason_name)))
    return data.id
  }

  async function handleSaveRejectDetail() {
    if (!rejectDetailSummary) return

    setRejectDetailError('')
    setSuccess('')
    setSavingRejectDetail(true)

    try {
      if (!rejectDraftRows.length) {
        throw new Error('Tambahkan minimal satu baris reject detail.')
      }

      const validRows = rejectDraftRows.filter((row) => Number(row.qty || 0) > 0)

      if (!validRows.length && selectedRejectTargetQty > 0) {
        throw new Error('Tambahkan minimal satu baris reject detail.')
      }

      if (selectedRejectTargetQty > 0 && selectedRejectGap !== 0) {
        throw new Error('Total detail + adjustment harus sama dengan total Grade B/C awal.')
      }

      validRows.forEach((row) => {
        if (!['B', 'C'].includes(String(row.grade || '').toUpperCase())) {
          throw new Error('Grade reject hanya bisa B atau C.')
        }
        if (!row.rejectReasonId) {
          throw new Error('Pilih reason untuk setiap baris reject.')
        }
        if (!String(row.size || '').trim()) {
          throw new Error('Pilih size untuk setiap baris reject.')
        }
      })

      const rowsWithReasons = []
      for (const row of validRows) {
        rowsWithReasons.push({ ...row, rejectReasonId: await resolveRejectReasonId(row) })
      }

      const taskRowsByGrade = {
        B: selectedRejectTaskRows.map((item) => ({ ...item, remainingRejectQty: Number(item.qty_b || 0) })),
        C: selectedRejectTaskRows.map((item) => ({ ...item, remainingRejectQty: Number(item.qty_c || 0) })),
      }
      const detailPayload = []

      rowsWithReasons.forEach((row) => {
        let remaining = Number(row.qty || 0)
        const grade = String(row.grade || 'B').toUpperCase()
        const queue = taskRowsByGrade[grade] || []

        queue.forEach((task) => {
          if (remaining <= 0 || Number(task.remainingRejectQty || 0) <= 0) return
          const qty = Math.min(remaining, Number(task.remainingRejectQty || 0))
          detailPayload.push({
            arkline_qc_id: task.id,
            po_id: task.po_id || null,
            arkline_po_item_id: task.arkline_po_item_id || null,
            sku_induk: task.sku_induk || null,
            model_name: task.model_name || rejectDetailSummary.model,
            grade,
            size: String(row.size || '').trim(),
            reject_reason_id: row.rejectReasonId,
            qty,
          })
          task.remainingRejectQty -= qty
          remaining -= qty
        })

        if (remaining > 0 && selectedRejectTaskRows.length) {
          const fallbackTask = selectedRejectTaskRows[0]
          detailPayload.push({
            arkline_qc_id: fallbackTask.id,
            po_id: fallbackTask.po_id || null,
            arkline_po_item_id: fallbackTask.arkline_po_item_id || null,
            sku_induk: fallbackTask.sku_induk || null,
            model_name: fallbackTask.model_name || rejectDetailSummary.model,
            grade,
            size: String(row.size || '').trim(),
            reject_reason_id: row.rejectReasonId,
            qty: remaining,
          })
          remaining = 0
        }

        if (remaining > 0) {
          throw new Error('Reject detail belum bisa disimpan karena task summary tidak ditemukan.')
        }
      })

      const existingDetailIds = selectedRejectExistingDetails.map((item) => item.id).filter(Boolean)
      if (existingDetailIds.length) {
        const { error: deleteDetailError } = await supabase.from('arkline_qc_reject_details').delete().in('id', existingDetailIds)
        if (deleteDetailError) throw new Error(deleteDetailError.message)
      }

      if (detailPayload.length) {
        const { error: insertDetailError } = await supabase.from('arkline_qc_reject_details').insert(detailPayload)
        if (insertDetailError) throw new Error(insertDetailError.message)
      }

      const poId = rejectDetailSummary.brand === 'NO PO' ? null : rejectDetailSummary.brand
      const skuInduk = rejectDetailSummary.category === 'NO SKU' ? null : rejectDetailSummary.category
      let adjustmentDeleteQuery = supabase
        .from('arkline_qc_reject_adjustments')
        .delete()
        .eq('model_name', rejectDetailSummary.model)

      adjustmentDeleteQuery = poId ? adjustmentDeleteQuery.eq('po_id', poId) : adjustmentDeleteQuery.is('po_id', null)
      adjustmentDeleteQuery = skuInduk ? adjustmentDeleteQuery.eq('sku_induk', skuInduk) : adjustmentDeleteQuery.is('sku_induk', null)

      const { error: deleteAdjustmentError } = await adjustmentDeleteQuery

      if (deleteAdjustmentError) throw new Error(deleteAdjustmentError.message)

      const adjustmentPayload = [
        {
          adjustment_type: 'bc_to_a',
          qty: Number(rejectAdjustmentDraft.bcToAQty || 0),
          notes: rejectAdjustmentDraft.bcToANotes.trim() || null,
        },
        {
          adjustment_type: 'inspector_data_error',
          qty: Number(rejectAdjustmentDraft.inspectorErrorQty || 0),
          notes: rejectAdjustmentDraft.inspectorErrorNotes.trim() || null,
        },
      ]
        .filter((item) => item.qty !== 0)
        .map((item) => ({
          ...item,
          po_id: poId,
          arkline_po_item_id: selectedRejectTaskRows[0]?.arkline_po_item_id || null,
          sku_induk: skuInduk,
          model_name: rejectDetailSummary.model,
        }))

      if (adjustmentPayload.length) {
        const { error: insertAdjustmentError } = await supabase.from('arkline_qc_reject_adjustments').insert(adjustmentPayload)
        if (insertAdjustmentError) throw new Error(insertAdjustmentError.message)
      }

      const [
        { data: nextDetailRows, error: nextDetailError },
        { data: nextAdjustmentRows, error: nextAdjustmentError },
      ] = await Promise.all([
        supabase
          .from('arkline_qc_reject_details')
          .select(`
            id,
            arkline_qc_id,
            po_id,
            arkline_po_item_id,
            sku_induk,
            model_name,
            grade,
            size,
            reject_reason_id,
            qty,
            reason:reject_reason_id (
              id,
              reason_name
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('arkline_qc_reject_adjustments').select('*').order('created_at', { ascending: false }),
      ])

      if (nextDetailError || nextAdjustmentError) {
        throw new Error(nextDetailError?.message || nextAdjustmentError?.message)
      }

      setArklineRejectDetails(nextDetailRows || [])
      setArklineRejectAdjustments(nextAdjustmentRows || [])
      setRejectDetailSummary(null)
      setRejectDetailError('')
      setRejectDraftRows([])
      setSuccess('Arkline reject detail saved.')
    } catch (saveError) {
      setRejectDetailError(saveError.message || 'Failed to save Arkline reject detail.')
    } finally {
      setSavingRejectDetail(false)
    }
  }

  async function handlePauseAllQc() {
    setError('')
    setSuccess('')
    setPausingAll(true)

    const runningRegularTasks = qcItems.filter((item) => item.status === 'in_progress')
    const runningArklineTasks = arklineQcItems.filter((item) => item.status === 'in_progress')
    const runningTasks = [
      ...runningRegularTasks.map((item) => ({ ...item, qc_table: 'qc_items' })),
      ...runningArklineTasks.map((item) => ({ ...item, qc_table: 'arkline_qc' })),
    ]

    if (!runningTasks.length) {
      setSuccess('There are no running QC tasks to pause right now.')
      setPausingAll(false)
      return
    }

    const updates = runningTasks.map(async (item) => {
      const baseSeconds = Number(item.stopwatch_seconds || 0)
      const startedAtMs = item.started_at ? new Date(item.started_at).getTime() : null
      const liveSeconds = startedAtMs
        ? baseSeconds + Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
        : baseSeconds
      const pausedAt = new Date().toISOString()
      const updateResult = await supabase
        .from(item.qc_table)
        .update({
          status: 'paused',
          stopwatch_seconds: liveSeconds,
          pause_reason: 'COORDINATOR BREAK',
          paused_at: pausedAt,
          started_at: null,
        })
        .eq('id', item.id)

      return { error: updateResult.error || null }
    })

    const results = await Promise.all(updates)
    const failed = results.find((result) => result.error)

    if (failed?.error) {
      setError(failed.error.message)
      setPausingAll(false)
      return
    }

    const pauseTaskInState = (prev) =>
      prev.map((item) => {
        if (item.status !== 'in_progress') return item
        const baseSeconds = Number(item.stopwatch_seconds || 0)
        const startedAtMs = item.started_at ? new Date(item.started_at).getTime() : null
        const liveSeconds = startedAtMs
          ? baseSeconds + Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
          : baseSeconds

        return {
          ...item,
          status: 'paused',
          stopwatch_seconds: liveSeconds,
          pause_reason: 'COORDINATOR BREAK',
          paused_at: new Date().toISOString(),
          started_at: null,
        }
      })
    setQcItems(pauseTaskInState)
    setArklineQcItems(pauseTaskInState)
    setSuccess('All running QC stopwatches are now paused.')
    setPausingAll(false)
    setShowPauseConfirm(false)
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading QC summary...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>QC Summary</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowPauseConfirm(true)}
            disabled={pausingAll}
            style={{
              height: '42px',
              padding: '0 16px',
              border: 'none',
              borderRadius: '8px',
              background: '#dc2626',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              opacity: pausingAll ? 0.6 : 1,
            }}
          >
            {pausingAll ? 'Pausing...' : 'Pause All QC'}
          </button>
        </div>

        <div style={styles.modeRow}>
          <button
            type="button"
            style={{ ...styles.modeButton, ...(qcMode === 'regular' ? styles.modeButtonActive : {}) }}
            onClick={() => {
              setQcMode('regular')
              setPauseDetailInspector('')
              setArklineProductFilter('')
            }}
          >
            Regular
          </button>
          <button
            type="button"
            style={{ ...styles.modeButton, ...(qcMode === 'arkline' ? styles.modeButtonActive : {}) }}
            onClick={() => {
              setQcMode('arkline')
              setPauseDetailInspector('')
            }}
          >
            Arkline
          </button>
        </div>

        <div style={styles.filters}>
          <div style={styles.field}>
            <label style={styles.label}>Date From</label>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={styles.input} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Date To</label>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={styles.input} />
          </div>

          {qcMode === 'arkline' ? (
            <>
              <div style={styles.field}>
                <label style={styles.label}>PO ID</label>
                <input
                  list="qc-dashboard-po-options"
                  value={poFilter}
                  onChange={(event) => {
                    setPoFilter(event.target.value)
                    setArklineProductFilter('')
                  }}
                  style={styles.input}
                  placeholder="All PO"
                />
                <datalist id="qc-dashboard-po-options">
                  {poOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Product Arkline</label>
                <input
                  list="qc-dashboard-arkline-product-options"
                  value={arklineProductFilter}
                  onChange={(event) => setArklineProductFilter(event.target.value)}
                  style={styles.input}
                  placeholder={poFilter && poFilter !== 'NO PO' ? 'Product in selected PO' : 'All Arkline product'}
                />
                <datalist id="qc-dashboard-arkline-product-options">
                  {arklineProductOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
            </>
          ) : (
            <>
              <div style={styles.field}>
                <label style={styles.label}>GRN Number</label>
                <input
                  list="qc-dashboard-grn-options"
                  value={grnFilter}
                  onChange={(event) => setGrnFilter(event.target.value)}
                  style={styles.input}
                  placeholder="All GRN"
                />
                <datalist id="qc-dashboard-grn-options">
                  {grnOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Brand</label>
                <input
                  list="qc-dashboard-brand-options"
                  value={brandFilter}
                  onChange={(event) => setBrandFilter(event.target.value)}
                  style={styles.input}
                  placeholder="All Brand"
                />
                <datalist id="qc-dashboard-brand-options">
                  {brandOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Category</label>
                <input
                  list="qc-dashboard-category-options"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  style={styles.input}
                  placeholder="All Category"
                />
                <datalist id="qc-dashboard-category-options">
                  {categoryOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
            </>
          )}
        </div>

        {hasInvalidDateRange ? <p style={{ color: '#dc2626', margin: 0 }}>Date From cannot be later than Date To.</p> : null}

        {error ? <p style={{ color: '#dc2626', margin: 0 }}>{error}</p> : null}
        {success ? <p style={{ color: '#16a34a', margin: 0 }}>{success}</p> : null}

        <div style={styles.grid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Allocation</span>
            <strong style={styles.summaryValue}>{totalAllocated}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>
              Graded Qty
              <InfoHint text="Qty yang sudah di QC oleh Grader." />
            </span>
            <strong style={styles.summaryValue}>{totalLocked}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>
              Allocation Gap
              <InfoHint text="Perbedaan Qty antara Qty yang dialokasikan dan Qty yang diQC oleh Grader." />
            </span>
            <strong style={{ ...styles.summaryValue, color: totalRemaining > 0 ? '#16a34a' : totalRemaining < 0 ? '#dc2626' : '#111827' }}>
              {totalRemaining > 0 ? '+' : ''}
              {totalRemaining}
            </strong>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>QC Result Summary</h2>
        {qcMode === 'regular' && !grnFilter ? <p style={styles.emptyText}>Choose a GRN Number first to see QC result summary for that GRN.</p> : null}
        {(qcMode === 'arkline' || grnFilter) ? (
        <>
        <div style={styles.grid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Grade A</span>
            <strong style={styles.summaryValue}>{totalGradeA}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Grade B</span>
            <strong style={styles.summaryValue}>{totalGradeB}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Grade C</span>
            <strong style={styles.summaryValue}>{totalGradeC}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Checked Total</span>
            <strong style={styles.summaryValue}>{totalChecked}</strong>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {qcMode === 'arkline' ? null : <th style={styles.th}>Photo</th>}
                <th style={styles.th}>{qcMode === 'arkline' ? 'PO' : 'Brand'}</th>
                <th style={styles.th}>{qcMode === 'arkline' ? 'SKU' : 'Category'}</th>
                <th style={styles.th}>Model</th>
                <th style={{ ...styles.th, ...styles.thCenter }}>Qty A</th>
                <th style={{ ...styles.th, ...styles.thCenter }}>Qty B</th>
                <th style={{ ...styles.th, ...styles.thCenter }}>Qty C</th>
                <th style={{ ...styles.th, ...styles.thCenter }}>Total Checked</th>
                {qcMode === 'arkline' ? <th style={{ ...styles.th, ...styles.thCenter }}>Detail</th> : null}
              </tr>
            </thead>
            <tbody>
              {qcResultSummary.length ? (
                qcResultSummary.map((item) => {
                  const rejectTargetQty = Number(item.rejectTargetQty ?? getRejectQty(item))
                  const rejectDetailQty = arklineRejectDetailQtyBySummary.get(getSummaryRejectKey(item)) || 0

                  return (
                  <tr key={`${item.brand}-${item.category}-${item.model}`}>
                    {qcMode === 'arkline' ? null : <td style={styles.td}>
                      {item.photoUrl ? (
                        <button type="button" style={styles.previewButton} onClick={() => setPreviewPhoto({ url: item.photoUrl, label: item.model })} title="Preview photo">
                          👁
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>}
                    <td style={styles.td}>{item.brand}</td>
                    <td style={styles.td}>{item.category}</td>
                    <td style={styles.td}>{item.model}</td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>{item.qtyA}</td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>{item.qtyB}</td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>{item.qtyC}</td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>{item.checked}</td>
                    {qcMode === 'arkline' ? (
                      <td style={{ ...styles.td, ...styles.tdCenter }}>
                        <button
                          type="button"
                          style={styles.detailButton}
                          onClick={() => openRejectDetailModal(item)}
                          title={rejectTargetQty ? 'Open Arkline reject detail' : 'Open detail for adjustment'}
                        >
                          Detail
                        </button>
                      </td>
                    ) : null}
                  </tr>
                  )
                })
              ) : (
                <tr>
                  <td style={styles.td} colSpan={qcMode === 'arkline' ? 8 : 9}>
                    No QC result found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
        ) : null}
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Inspector Performance</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Inspector</th>
                <th style={styles.th}>Total PCS</th>
                <th style={styles.th}>Average PCS / Day</th>
                <th style={styles.th}>QC Rate PCS / Minute</th>
                <th style={styles.th}>Non-Productive Minutes</th>
                <th style={styles.th}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {inspectorPerformance.length ? (
                inspectorPerformance.map((item) => (
                  <tr key={item.inspectorKey}>
                    <td style={styles.td}>
                      <div style={styles.inspectorNameCell}>
                        <span>{item.inspector}</span>
                        {item.runningTaskCount ? (
                          <span style={styles.liveTimerBadge} title={`${item.runningTaskCount} running task${item.runningTaskCount > 1 ? 's' : ''}`}>
                            {formatCompactTimer(item.activeLiveSeconds)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td style={styles.td}>{item.totalPcs}</td>
                    <td style={styles.td}>{item.avgPerDay}</td>
                    <td style={styles.td}>{item.rate}</td>
                    <td style={styles.td}>{item.nonProductiveHours}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.detailButton}
                        onClick={() => setPauseDetailInspector(item.inspectorKey)}
                        disabled={!item.pauseLogs.length && !item.completedTaskRows.length && !item.activeTaskRows.length}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={styles.td} colSpan={6}>
                    No inspector data found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>{qcMode === 'arkline' ? 'QC Speed Per Product' : 'QC Speed Per Category'}</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{qcMode === 'arkline' ? 'Product' : 'Category'}</th>
                <th style={styles.th}>Seconds / PCS</th>
              </tr>
            </thead>
            <tbody>
              {categoryTimes.length ? (
                categoryTimes.map((item) => (
                  <tr key={item.label}>
                    <td style={styles.td}>{item.label}</td>
                    <td style={styles.td}>{item.secondsPerPcs}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={styles.td} colSpan={2}>
                    {qcMode === 'arkline' ? 'No product timing data found for this filter.' : 'No category timing data found for this filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPauseConfirm ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>Pause All QC?</h2>
              <p style={styles.subtitle}>All running QC stopwatches will be paused first, then each inspector can resume individually later.</p>
            </div>
            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setShowPauseConfirm(false)} style={{ height: '42px', padding: '0 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#111827', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" onClick={handlePauseAllQc} style={{ height: '42px', padding: '0 16px', border: 'none', borderRadius: '8px', background: '#dc2626', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                {pausingAll ? 'Pausing...' : 'Pause All QC'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewPhoto ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>{previewPhoto.label}</h2>
            </div>
            <Image src={previewPhoto.url} alt={previewPhoto.label} width={720} height={720} unoptimized style={styles.previewImage} />
            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setPreviewPhoto(null)} style={{ height: '42px', padding: '0 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#111827', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectDetailSummary ? (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, ...styles.wideModal }}>
            <div style={styles.headerRow}>
              <div>
                <h2 style={styles.sectionTitle}>Detail</h2>
                <p style={styles.subtitle}>
                  {rejectDetailSummary.brand} / {rejectDetailSummary.category} / {rejectDetailSummary.model}
                </p>
              </div>
              <div style={styles.buttonRow}>
                <button type="button" onClick={() => setRejectDetailSummary(null)} style={styles.secondaryButton}>
                  Close
                </button>
                <button type="button" onClick={handleSaveRejectDetail} disabled={savingRejectDetail} style={styles.primaryButton}>
                  {savingRejectDetail ? 'Saving...' : 'Save Detail'}
                </button>
              </div>
            </div>

            {rejectDetailError ? <p style={{ color: '#dc2626', margin: 0 }}>{rejectDetailError}</p> : null}
            {success ? <p style={{ color: '#16a34a', margin: 0 }}>{success}</p> : null}

            <div style={styles.rejectDetailGrid}>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Grade A</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{selectedRejectPreviewSummary.qtyA}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Grade B</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{selectedRejectPreviewSummary.qtyB}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Grade C</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{selectedRejectPreviewSummary.qtyC}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Checked Preview</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue }}>{selectedRejectPreviewChecked}</strong>
              </div>
              <div style={{ ...styles.summaryCard, ...styles.compactSummaryCard }}>
                <span style={styles.summaryLabel}>Gap</span>
                <strong style={{ ...styles.summaryValue, ...styles.compactSummaryValue, color: selectedRejectGap === 0 ? '#111827' : '#dc2626' }}>
                  {selectedRejectGap > 0 ? '+' : ''}
                  {selectedRejectGap}
                </strong>
              </div>
            </div>

            <div style={styles.inspectorSection}>
              <button type="button" style={{ ...styles.inspectorSectionHeader, cursor: 'default' }}>
                <span style={styles.inspectorSectionTitle}>Detail Summary</span>
                <span style={styles.inspectorSectionMeta}>{selectedRejectInspectorRows.length} inspectors</span>
              </button>
              <div style={styles.inspectorSectionBody}>
                <div style={styles.inspectorTableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, ...styles.inspectorTh }}>Inspector</th>
                        <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Grade A</th>
                        <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Grade B</th>
                        <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Grade C</th>
                        <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Checked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRejectInspectorRows.length ? (
                        selectedRejectInspectorRows.map((item) => (
                          <tr key={item.inspectorKey}>
                            <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.inspector}</td>
                            <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyA}</td>
                            <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyB}</td>
                            <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyC}</td>
                            <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.checked}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td style={{ ...styles.td, ...styles.inspectorTd }} colSpan={5}>
                            No inspector summary found for this detail.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={styles.headerRow}>
                <div>
                  <h3 style={{ ...styles.sectionTitle, fontSize: '16px' }}>Arkline Reject Detail</h3>
                </div>
              </div>

              <datalist id="arkline-reject-size-options">
                {selectedRejectSizeOptions.map((size) => (
                  <option key={size} value={size} />
                ))}
              </datalist>

              <div style={styles.rejectRowHeader}>
                <span style={styles.label}>Grade</span>
                <span style={styles.label}>Reason</span>
                <span style={styles.label}>Qty</span>
                <span style={styles.label}>Size</span>
                <span style={{ ...styles.label, textAlign: 'right' }}>Action</span>
              </div>

              {rejectDraftRows.map((row, index) => (
                <div key={row.id} style={styles.rejectRowGrid}>
                  <div style={styles.field}>
                    <select value={row.grade} onChange={(event) => updateRejectDraftRow(row.id, 'grade', event.target.value)} style={styles.select}>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </div>
                  <div style={styles.field}>
                    <select value={row.rejectReasonId} onChange={(event) => updateRejectDraftRow(row.id, 'rejectReasonId', event.target.value)} style={styles.select}>
                      <option value="">Choose reason</option>
                      {selectedRejectReasonOptions.map((reason) => (
                        <option key={reason.id} value={reason.id}>
                          {reason.reason_name}
                        </option>
                      ))}
                      <option value="__new__">Add new reason</option>
                    </select>
                    {row.rejectReasonId === '__new__' ? (
                      <input
                        value={row.newReasonName}
                        onChange={(event) => updateRejectDraftRow(row.id, 'newReasonName', event.target.value)}
                        style={styles.input}
                        placeholder="New reject reason"
                      />
                    ) : null}
                  </div>
                  <div style={styles.field}>
                    <input
                      type="number"
                      min="0"
                      value={row.qty}
                      onChange={(event) => updateRejectDraftRow(row.id, 'qty', event.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.field}>
                    <input
                      value={row.size}
                      onChange={(event) => updateRejectDraftRow(row.id, 'size', event.target.value)}
                      style={styles.input}
                      list="arkline-reject-size-options"
                      placeholder={selectedRejectSizeOptions.length ? 'Choose size' : 'Size'}
                    />
                  </div>
                  <div style={styles.iconButtonRow}>
                    <button
                      type="button"
                      style={styles.iconSmallButton}
                      onClick={() => setRejectDraftRows((rows) => [...rows, createRejectDraftRow()])}
                      title="Add row"
                      aria-label="Add row"
                    >
                      +
                    </button>
                    {index > 0 ? (
                      <button type="button" style={styles.iconSmallButton} onClick={() => removeRejectDraftRow(row.id)} title="Remove row" aria-label="Remove row">
                        X
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h3 style={{ ...styles.sectionTitle, fontSize: '16px' }}>Adjustment</h3>
                <div style={styles.noteGrid}>
                  <div style={styles.noteCard}>
                    <p style={styles.smallNote}>
                      <strong>Jika data &gt; aktual,</strong>
                    </p>
                    <p style={styles.smallNote}>Isi kolom &apos;Pindah ke Grade A&apos; , jika produk yang awalnya reject dianggap masih ok.</p>
                    <p style={styles.smallNote}>Isi kolom &apos;Salah data QC Inspector&apos; , jika terdapat kesalahan input oleh Inspector pada data awal.</p>
                  </div>
                  <div style={styles.noteCard}>
                    <p style={styles.smallNote}>
                      <strong>Jika data &lt; aktual,</strong>
                    </p>
                    <p style={styles.smallNote}>Isi kolom &apos;Pindah ke Grade A&apos; dengan minus (-), jika ada salah input Grade A.</p>
                    <p style={styles.smallNote}>Isi kolom &apos;Salah data QC Inspector&apos; dengan minus (-), jika ada kekurangan input oleh Inspector pada data awal.</p>
                  </div>
                </div>
              </div>
              {selectedRejectGap !== 0 ? (
                <div style={styles.warningBox}>
                  Gap masih {selectedRejectGap}. Reject detail adalah hasil akhir Grade B/C aktual. Adjustment dipakai untuk rekonsiliasi angka QC awal sampai gap menjadi 0.
                </div>
              ) : null}
              <div style={styles.adjustmentGrid}>
                <div style={styles.summaryCard}>
                  <label style={styles.label}>Pindah ke Grade A</label>
                  <input
                    type="number"
                    value={rejectAdjustmentDraft.bcToAQty}
                    onChange={(event) => setRejectAdjustmentDraft((draft) => ({ ...draft, bcToAQty: event.target.value }))}
                    style={styles.input}
                    placeholder="Qty"
                  />
                  <input
                    value={rejectAdjustmentDraft.bcToANotes}
                    onChange={(event) => setRejectAdjustmentDraft((draft) => ({ ...draft, bcToANotes: event.target.value }))}
                    style={styles.input}
                    placeholder="Notes"
                  />
                </div>
                <div style={styles.summaryCard}>
                  <label style={styles.label}>Salah data QC inspector</label>
                  <input
                    type="number"
                    value={rejectAdjustmentDraft.inspectorErrorQty}
                    onChange={(event) => setRejectAdjustmentDraft((draft) => ({ ...draft, inspectorErrorQty: event.target.value }))}
                    style={styles.input}
                    placeholder="Qty"
                  />
                  <input
                    value={rejectAdjustmentDraft.inspectorErrorNotes}
                    onChange={(event) => setRejectAdjustmentDraft((draft) => ({ ...draft, inspectorErrorNotes: event.target.value }))}
                    style={styles.input}
                    placeholder="Notes"
                  />
                </div>
              </div>
            </div>

            <div style={styles.modalTableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Saved Reason</th>
                    <th style={styles.th}>Grade</th>
                    <th style={styles.th}>Size</th>
                    <th style={styles.th}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRejectExistingDetails.length ? (
                    selectedRejectExistingDetails.map((item, index) => (
                      <tr key={`${item.id}-${item.arkline_qc_id || 'reject'}-${index}`}>
                        <td style={styles.td}>{item.reason?.reason_name || '-'}</td>
                        <td style={styles.td}>{item.grade}</td>
                        <td style={styles.td}>{item.size}</td>
                        <td style={styles.td}>{item.qty}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={styles.td} colSpan={4}>
                        No saved reject detail yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      ) : null}

      {pauseDetailInspector ? (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, ...styles.wideModal, ...styles.inspectorModal }}>
            <div style={styles.inspectorModalHeader}>
              <div style={styles.headerRow}>
                <h2 style={styles.sectionTitle}>
                  Inspector Detail -{' '}
                  {memberNameMap[pauseDetailInspector] || (pauseDetailInspector === '-' ? 'Unassigned' : 'Unknown Inspector')}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setPauseDetailInspector('')
                    setInspectorDetailSections({
                      nonProductive: false,
                      finished: false,
                      active: false,
                    })
                  }}
                  style={{ height: '42px', padding: '0 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#111827', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={styles.inspectorModalContent}>
              <div style={styles.modalGrid}>
                <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Non-Productive Minutes</span>
                  <strong style={styles.summaryValue}>{selectedInspectorPerformance?.nonProductiveHours || 0}</strong>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Qty Checked</span>
                  <strong style={styles.summaryValue}>{selectedInspectorCheckedQty}</strong>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Active Tasks</span>
                  <strong style={styles.summaryValue}>{selectedInspectorPerformance?.activeTaskCount || 0}</strong>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Active Allocated Qty</span>
                  <strong style={styles.summaryValue}>{selectedInspectorPerformance?.activeAllocatedQty || 0}</strong>
                </div>
              </div>

              <div style={styles.inspectorSection}>
                <button type="button" style={styles.inspectorSectionHeader} onClick={() => toggleInspectorDetailSection('nonProductive')}>
                  <span style={styles.inspectorSectionTitle}>Non-Productive Detail</span>
                  <span style={styles.inspectorSectionMeta}>
                    {selectedInspectorPauseLogs.length} rows {inspectorDetailSections.nonProductive ? '▲' : '▼'}
                  </span>
                </button>
                {inspectorDetailSections.nonProductive ? (
                  <div style={styles.inspectorSectionBody}>
                    <div style={styles.inspectorTableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Reason</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Paused At</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Resumed At</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Minutes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInspectorPauseLogs.length ? (
                            selectedInspectorPauseLogs.map((item, index) => (
                              <tr key={`${item.id}-${item.paused_at || 'pause'}-${index}`}>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.pause_reason || '-'}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{formatDisplayDate(item.paused_at)}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{formatDisplayDate(item.resumed_at)}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{formatMinutes(getPauseDurationSeconds(item))}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td style={{ ...styles.td, ...styles.inspectorTd }} colSpan={4}>
                                No non-productive activity detail found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={styles.inspectorSection}>
                <button type="button" style={styles.inspectorSectionHeader} onClick={() => toggleInspectorDetailSection('finished')}>
                  <span style={styles.inspectorSectionTitle}>Qty Checked</span>
                  <span style={styles.inspectorSectionMeta}>
                    {selectedInspectorCompletedTaskRows.length} rows {inspectorDetailSections.finished ? '▲' : '▼'}
                  </span>
                </button>
                {inspectorDetailSections.finished ? (
                  <div style={styles.inspectorSectionBody}>
                    <div style={styles.inspectorTableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>{qcMode === 'arkline' ? 'PO' : 'GRN'}</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>{qcMode === 'arkline' ? 'SKU' : 'Category'}</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Model</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>A</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>B</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>C</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Checked</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Rate</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Finished At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInspectorCompletedTaskRows.length ? (
                            selectedInspectorCompletedTaskRows.map((item, index) => (
                              <tr key={`${item.id}-${item.finishedAt || 'done'}-${index}`}>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.source}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.category}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.model}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyA}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyB}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.qtyC}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.checkedQty}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.rate}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{formatDisplayDate(item.finishedAt)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td style={{ ...styles.td, ...styles.inspectorTd }} colSpan={9}>
                                No finished QC found for this inspector.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={styles.inspectorSection}>
                <button type="button" style={styles.inspectorSectionHeader} onClick={() => toggleInspectorDetailSection('active')}>
                  <span style={styles.inspectorSectionTitle}>Active Allocation</span>
                  <span style={styles.inspectorSectionMeta}>
                    {selectedInspectorActiveTaskRows.length} rows {inspectorDetailSections.active ? '▲' : '▼'}
                  </span>
                </button>
                {inspectorDetailSections.active ? (
                  <div style={styles.inspectorSectionBody}>
                    <div style={styles.inspectorTableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>{qcMode === 'arkline' ? 'PO' : 'GRN'}</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>{qcMode === 'arkline' ? 'SKU' : 'Category'}</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Model</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Allocated</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Checked</th>
                            <th style={{ ...styles.th, ...styles.thCenter, ...styles.inspectorTh }}>Remaining</th>
                            <th style={{ ...styles.th, ...styles.inspectorTh }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInspectorActiveTaskRows.length ? (
                            selectedInspectorActiveTaskRows.map((item, index) => (
                              <tr key={`${item.id}-${item.status || 'active'}-${index}`}>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.source}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.category}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.model}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.allocatedQty}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.checkedQty}</td>
                                <td style={{ ...styles.td, ...styles.tdCenter, ...styles.inspectorTd }}>{item.remainingQty}</td>
                                <td style={{ ...styles.td, ...styles.inspectorTd }}>{item.status}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td style={{ ...styles.td, ...styles.inspectorTd }} colSpan={7}>
                                No active allocation found for this inspector.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
