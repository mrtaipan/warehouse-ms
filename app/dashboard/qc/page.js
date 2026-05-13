'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
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
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px',
  },
  rejectRowGrid: {
    display: 'grid',
    gridTemplateColumns: '96px minmax(180px, 1.4fr) 96px 96px 44px',
    gap: '10px',
    alignItems: 'end',
  },
  rejectRowHeader: {
    display: 'grid',
    gridTemplateColumns: '96px minmax(180px, 1.4fr) 96px 96px 44px',
    gap: '10px',
    alignItems: 'center',
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
}

function sameDay(dateString, selectedDate) {
  if (!selectedDate) return true
  if (!dateString) return false
  return String(dateString).slice(0, 10) === selectedDate
}

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateOnly(value) {
  return String(value || '').slice(0, 10)
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

function formatHours(seconds) {
  return Math.round((Number(seconds || 0) / 3600) * 100) / 100
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

function getSummaryRejectKey(item) {
  return `${item.brand}|||${item.category}|||${item.model}`
}

function getAdjustmentSummaryKey(item) {
  const po = String(item.po_id || 'NO PO').trim().toUpperCase() || 'NO PO'
  const sku = String(item.sku_induk || 'NO SKU').trim().toUpperCase() || 'NO SKU'
  const model = String(item.model_name || 'UNKNOWN MODEL').trim() || 'UNKNOWN MODEL'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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
  const [selectedDate, setSelectedDate] = useState('')
  const [pauseDetailInspector, setPauseDetailInspector] = useState('')
  const [rejectDetailSummary, setRejectDetailSummary] = useState(null)
  const [rejectDraftRows, setRejectDraftRows] = useState([])
  const [rejectAdjustmentDraft, setRejectAdjustmentDraft] = useState({
    bcToAQty: '',
    bcToANotes: '',
    inspectorErrorQty: '',
    inspectorErrorNotes: '',
  })
  const [savingRejectDetail, setSavingRejectDetail] = useState(false)

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      setError('')

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
        supabase.from('dir_user_roles').select('role, permission_code').eq('permission_code', 'qc.inspection.do'),
        supabase
          .from('qc_pause_logs')
          .select(`
            id,
            qc_item_id,
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
        setLoading(false)
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
      setLoading(false)
    }

    loadDashboard()
  }, [today])

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

  const filteredItems = useMemo(
    () =>
      qcItems.filter((item) => {
        const matchesDate = sameDay(item.finished_at || item.created_at, selectedDate)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getBrandLabel(item) === brandFilter
        const matchesCategory = !categoryFilter || getCategoryLabel(item) === categoryFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, grnFilter, qcItems, selectedDate]
  )

  const filteredArklineItems = useMemo(
    () =>
      arklineQcItems.filter((item) => {
        const matchesDate = sameDay(item.finished_at || item.created_at, selectedDate)
        const matchesPo = !poFilter || getArklinePoLabel(item) === poFilter
        const matchesProduct = !arklineProductFilter || getArklineProductLabel(item) === arklineProductFilter
        return matchesDate && matchesPo && matchesProduct
      }),
    [arklineProductFilter, arklineQcItems, poFilter, selectedDate]
  )

  const filteredAdjustmentRows = useMemo(
    () =>
      qcConfirmRows.filter((item) => {
        if (!item.is_adjustment) {
          return false
        }

        const matchesDate = sameDay(item.created_at, selectedDate)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getConfirmBrandLabel(item) === brandFilter
        const matchesCategory = !categoryFilter || getConfirmCategoryLabel(item) === categoryFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, grnFilter, qcConfirmRows, selectedDate]
  )

  const filteredReturnAdjustmentRows = useMemo(
    () =>
      returnRows.filter((item) => {
        if (!item.is_adjustment) {
          return false
        }

        const matchesDate = sameDay(item.created_at, selectedDate)
        const matchesGrn = !grnFilter || item.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getReturnBrandLabel(item) === brandFilter
        const matchesCategory = !categoryFilter || getReturnCategoryLabel(item) === categoryFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, grnFilter, returnRows, selectedDate]
  )

  const filteredPauseLogs = useMemo(
    () =>
      pauseLogs.filter((item) => {
        const matchesDate = sameDay(item.paused_at, selectedDate)
        const matchesGrn = !grnFilter || item.qc_item?.inbound?.grn_number === grnFilter
        const matchesBrand = !brandFilter || getBrandLabel(item.qc_item || {}) === brandFilter
        const matchesCategory = !categoryFilter || getCategoryLabel(item.qc_item || {}) === categoryFilter
        return matchesDate && matchesGrn && matchesBrand && matchesCategory
      }),
    [brandFilter, categoryFilter, grnFilter, pauseLogs, selectedDate]
  )

  const activeItems = useMemo(
    () => (qcMode === 'arkline' ? filteredArklineItems : filteredItems),
    [filteredArklineItems, filteredItems, qcMode]
  )
  const activePauseLogs = useMemo(
    () => (qcMode === 'arkline' ? [] : filteredPauseLogs),
    [filteredPauseLogs, qcMode]
  )

  const memberNameMap = useMemo(
    () =>
      qcProfiles.reduce((result, item) => {
        result[item.email] = item.display_name || ''
        return result
      }, {}),
    [qcProfiles]
  )

  const qcResultSummary = useMemo(() => {
    const grouped = new Map()
    const arklineDetailByTaskId = new Map()
    const arklineAdjustmentBySummaryKey = new Map()

    if (qcMode === 'arkline') {
      arklineRejectDetails.forEach((detail) => {
        const current = arklineDetailByTaskId.get(detail.arkline_qc_id) || { qtyB: 0, qtyC: 0 }
        const grade = String(detail.grade || '').toUpperCase()
        if (grade === 'B') current.qtyB += Number(detail.qty || 0)
        if (grade === 'C') current.qtyC += Number(detail.qty || 0)
        arklineDetailByTaskId.set(detail.arkline_qc_id, current)
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
        current.qtyA += adjustment.bcToAQty
        if (!current.hasRejectDetails) {
          let remainingErrorQty = adjustment.inspectorErrorQty
          const qtyCAdjustment = Math.min(current.qtyC, remainingErrorQty)
          current.qtyC -= qtyCAdjustment
          remainingErrorQty -= qtyCAdjustment
          const qtyBAdjustment = Math.min(current.qtyB, remainingErrorQty)
          current.qtyB -= qtyBAdjustment
        }
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

  const selectedRejectTaskIds = useMemo(
    () => new Set((rejectDetailSummary?.taskRows || []).map((item) => item.id)),
    [rejectDetailSummary]
  )
  const selectedRejectExistingDetails = useMemo(
    () => arklineRejectDetails.filter((item) => selectedRejectTaskIds.has(item.arkline_qc_id)),
    [arklineRejectDetails, selectedRejectTaskIds]
  )
  const selectedRejectTargetQty = Number(rejectDetailSummary?.rejectTargetQty ?? getRejectQty(rejectDetailSummary || {}))
  const selectedRejectDetailQty = rejectDraftRows.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const selectedRejectAdjustmentQty =
    Number(rejectAdjustmentDraft.bcToAQty || 0) + Number(rejectAdjustmentDraft.inspectorErrorQty || 0)
  const selectedRejectGap = selectedRejectTargetQty - selectedRejectDetailQty - selectedRejectAdjustmentQty
  const selectedRejectSizeOptions = useMemo(() => {
    const poItemIds = new Set((rejectDetailSummary?.taskRows || []).map((item) => item.arkline_po_item_id).filter(Boolean))
    const sizes = arklinePoItemSizes
      .filter((item) => poItemIds.has(item.arkline_po_item_id))
      .map((item) => String(item.size || '').trim())
      .filter(Boolean)

    return Array.from(new Set(sizes)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [arklinePoItemSizes, rejectDetailSummary])
  const inspectorPerformance = useMemo(() => {
    const grouped = new Map()

    activeItems
      .filter((item) => item.status === 'done' || hasQcResult(item))
      .forEach((item) => {
        const key = item.assigned_to || '-'
        const totalPcs = getCheckedQty(item)
        const minutes = Number(item.stopwatch_seconds || 0) / 60
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
            taskRows: [],
          }

        current.totalPcs += totalPcs
        current.totalMinutes += minutes
        if (workDate) current.daySet.add(workDate)
        current.taskRows.push({
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
        grouped.set(key, current)
      })

    activePauseLogs.forEach((item) => {
      const key = item.qc_item?.assigned_to || item.paused_by || '-'
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
        nonProductiveHours: formatHours(item.nonProductiveSeconds),
        pauseLogs: [...(item.pauseLogs || [])].sort((a, b) => new Date(b.paused_at || 0).getTime() - new Date(a.paused_at || 0).getTime()),
        taskRows: [...(item.taskRows || [])].sort((a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime()),
      }
    })
  }, [activeItems, activePauseLogs, memberNameMap, qcMode])

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
  const selectedInspectorTaskRows = selectedInspectorPerformance?.taskRows || []
  const totalRemaining = activeItems.reduce(
    (sum, item) => sum + (Number(item.locked_qty || 0) - Number(item.allocated_qty || 0)),
    0
  )

  function openRejectDetailModal(summary) {
    const taskIds = new Set((summary.taskRows || []).map((item) => item.id))
    const existingDetails = arklineRejectDetails.filter((item) => taskIds.has(item.arkline_qc_id))
    const existingAdjustments = arklineRejectAdjustments.filter((item) => {
      const samePo = String(item.po_id || 'NO PO').trim().toUpperCase() === summary.brand
      const sameSku = String(item.sku_induk || 'NO SKU').trim().toUpperCase() === summary.category
      const sameModel = String(item.model_name || '').trim().toUpperCase() === String(summary.model || '').trim().toUpperCase()
      return samePo && sameSku && sameModel
    })

    const summaryRejectTargetQty = Number(summary.rejectTargetQty ?? getRejectQty(summary))
    const initialRows = existingDetails.length
      ? existingDetails.map((item) =>
          createRejectDraftRow({
            id: item.id,
            grade: String(item.grade || 'B').toUpperCase(),
            rejectReasonId: item.reject_reason_id || '',
            qty: String(item.qty || ''),
            size: item.size || '',
          })
        )
      : [
          ...(Number(summary.qtyB || 0) > 0 ? [createRejectDraftRow({ grade: 'B', qty: String(summary.qtyB || '') })] : []),
          ...(Number(summary.qtyC || 0) > 0 ? [createRejectDraftRow({ grade: 'C', qty: String(summary.qtyC || '') })] : []),
          ...(!summaryRejectTargetQty ? [createRejectDraftRow()] : []),
        ]

    const bcToAAdjustment = existingAdjustments.find((item) => item.adjustment_type === 'bc_to_a')
    const inspectorErrorAdjustment = existingAdjustments.find((item) => item.adjustment_type === 'inspector_data_error')

    setRejectDetailSummary(summary)
    setRejectDraftRows(initialRows.length ? initialRows : [createRejectDraftRow()])
    setRejectAdjustmentDraft({
      bcToAQty: bcToAAdjustment?.qty ? String(bcToAAdjustment.qty) : '',
      bcToANotes: bcToAAdjustment?.notes || '',
      inspectorErrorQty: inspectorErrorAdjustment?.qty ? String(inspectorErrorAdjustment.qty) : '',
      inspectorErrorNotes: inspectorErrorAdjustment?.notes || '',
    })
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

    setError('')
    setSuccess('')
    setSavingRejectDetail(true)

    try {
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
        B: (rejectDetailSummary.taskRows || []).map((item) => ({ ...item, remainingRejectQty: Number(item.qty_b || 0) })),
        C: (rejectDetailSummary.taskRows || []).map((item) => ({ ...item, remainingRejectQty: Number(item.qty_c || 0) })),
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

        if (remaining > 0 && selectedRejectTargetQty > 0) {
          throw new Error(`Qty Grade ${grade} melebihi total Grade ${grade} awal.`)
        }
      })

      const taskIds = (rejectDetailSummary.taskRows || []).map((item) => item.id)
      if (taskIds.length) {
        const { error: deleteDetailError } = await supabase.from('arkline_qc_reject_details').delete().in('arkline_qc_id', taskIds)
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
        .filter((item) => item.qty > 0)
        .map((item) => ({
          ...item,
          po_id: poId,
          arkline_po_item_id: rejectDetailSummary.taskRows?.[0]?.arkline_po_item_id || null,
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
      setRejectDraftRows([])
      setSuccess('Arkline reject detail saved.')
    } catch (saveError) {
      setError(saveError.message || 'Failed to save Arkline reject detail.')
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

      return supabase
        .from(item.qc_table)
        .update({
          status: 'paused',
          stopwatch_seconds: liveSeconds,
          pause_reason: 'COORDINATOR BREAK',
          paused_at: pausedAt,
          started_at: null,
        })
        .eq('id', item.id)
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
            <label style={styles.label}>View Mode</label>
            <select
              value={selectedDate ? 'daily' : 'total'}
              onChange={(event) => {
                if (event.target.value === 'total') {
                  setSelectedDate('')
                } else if (!selectedDate) {
                  setSelectedDate(today)
                }
              }}
              style={styles.select}
            >
              <option value="total">Total</option>
              <option value="daily">Per Day</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              style={styles.input}
              disabled={!selectedDate && false}
            />
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
                {qcMode === 'arkline' ? <th style={{ ...styles.th, ...styles.thCenter }}>Reject Detail</th> : null}
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
                <th style={styles.th}>Non-Productive Hours</th>
                <th style={styles.th}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {inspectorPerformance.length ? (
                inspectorPerformance.map((item) => (
                  <tr key={item.inspectorKey}>
                    <td style={styles.td}>{item.inspector}</td>
                    <td style={styles.td}>{item.totalPcs}</td>
                    <td style={styles.td}>{item.avgPerDay}</td>
                    <td style={styles.td}>{item.rate}</td>
                    <td style={styles.td}>{item.nonProductiveHours}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.detailButton}
                        onClick={() => setPauseDetailInspector(item.inspectorKey)}
                        disabled={qcMode === 'arkline' ? !item.taskRows.length : !item.pauseLogs.length}
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
            <div>
              <h2 style={styles.sectionTitle}>Arkline Reject Detail</h2>
              <p style={styles.subtitle}>
                {rejectDetailSummary.brand} / {rejectDetailSummary.category} / {rejectDetailSummary.model}
              </p>
            </div>

            <div style={styles.modalGrid}>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Grade B</span>
                <strong style={styles.summaryValue}>{rejectDetailSummary.qtyB}</strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Grade C</span>
                <strong style={styles.summaryValue}>{rejectDetailSummary.qtyC}</strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Detail + Adjustment</span>
                <strong style={styles.summaryValue}>{selectedRejectDetailQty + selectedRejectAdjustmentQty}</strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Gap</span>
                <strong style={{ ...styles.summaryValue, color: selectedRejectGap === 0 ? '#111827' : '#dc2626' }}>
                  {selectedRejectGap > 0 ? '+' : ''}
                  {selectedRejectGap}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={styles.headerRow}>
                <div>
                  <h3 style={{ ...styles.sectionTitle, fontSize: '16px' }}>Reject Rows</h3>
                  <p style={styles.subtitle}>Pilih grade, reason, qty, dan size untuk setiap kelompok reject.</p>
                </div>
                <button type="button" style={styles.smallButton} onClick={() => setRejectDraftRows((rows) => [...rows, createRejectDraftRow()])}>
                  Add Row
                </button>
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
                <span />
              </div>

              {rejectDraftRows.map((row) => (
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
                      {arklineRejectReasons.map((reason) => (
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
                  <button type="button" style={styles.smallButton} onClick={() => removeRejectDraftRow(row.id)} title="Remove row">
                    X
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h3 style={{ ...styles.sectionTitle, fontSize: '16px' }}>Adjustment</h3>
                <p style={styles.subtitle}>Isi hanya kalau total detail reject tidak sama dengan Qty Grade B/C awal.</p>
              </div>
              {selectedRejectGap !== 0 ? (
                <div style={styles.warningBox}>
                  Gap masih {selectedRejectGap}. Pakai adjustment untuk barang yang pindah dari Grade B/C ke Grade A, atau untuk salah input data QC inspector.
                </div>
              ) : null}
              <div style={styles.adjustmentGrid}>
                <div style={styles.summaryCard}>
                  <label style={styles.label}>B/C pindah ke Grade A</label>
                  <input
                    type="number"
                    min="0"
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
                    min="0"
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
                    selectedRejectExistingDetails.map((item) => (
                      <tr key={item.id}>
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

            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setRejectDetailSummary(null)} style={styles.secondaryButton}>
                Close
              </button>
              <button type="button" onClick={handleSaveRejectDetail} disabled={savingRejectDetail} style={styles.primaryButton}>
                {savingRejectDetail ? 'Saving...' : 'Save Reject Detail'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pauseDetailInspector ? (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: '760px' }}>
            <div>
              <h2 style={styles.sectionTitle}>
                {qcMode === 'arkline' ? 'Arkline Inspector Detail' : 'Non-Productive Detail'} -{' '}
                {memberNameMap[pauseDetailInspector] || (pauseDetailInspector === '-' ? 'Unassigned' : 'Unknown Inspector')}
              </h2>
              <p style={styles.subtitle}>
                {qcMode === 'arkline'
                  ? 'Detail hasil QC Arkline yang tercatat untuk inspector ini.'
                  : 'Detail kegiatan non-produktif yang tercatat dari pause log inspector ini.'}
              </p>
            </div>
            <div style={styles.modalTableWrap}>
              {qcMode === 'arkline' ? (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>PO</th>
                      <th style={styles.th}>SKU</th>
                      <th style={styles.th}>Model</th>
                      <th style={styles.th}>A</th>
                      <th style={styles.th}>B</th>
                      <th style={styles.th}>C</th>
                      <th style={styles.th}>Total</th>
                      <th style={styles.th}>Minutes</th>
                      <th style={styles.th}>Rate</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInspectorTaskRows.length ? (
                      selectedInspectorTaskRows.map((item) => (
                        <tr key={item.id}>
                          <td style={styles.td}>{item.source}</td>
                          <td style={styles.td}>{item.category}</td>
                          <td style={styles.td}>{item.model}</td>
                          <td style={styles.td}>{item.qtyA}</td>
                          <td style={styles.td}>{item.qtyB}</td>
                          <td style={styles.td}>{item.qtyC}</td>
                          <td style={styles.td}>{item.checkedQty}</td>
                          <td style={styles.td}>{Math.round((Number(item.seconds || 0) / 60) * 100) / 100}</td>
                          <td style={styles.td}>{item.rate}</td>
                          <td style={styles.td}>{item.status}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td style={styles.td} colSpan={10}>
                          No Arkline QC detail found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Reason</th>
                      <th style={styles.th}>Paused At</th>
                      <th style={styles.th}>Resumed At</th>
                      <th style={styles.th}>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInspectorPauseLogs.length ? (
                      selectedInspectorPauseLogs.map((item) => (
                        <tr key={item.id}>
                          <td style={styles.td}>{item.pause_reason || '-'}</td>
                          <td style={styles.td}>{item.paused_at ? new Date(item.paused_at).toLocaleString() : '-'}</td>
                          <td style={styles.td}>{item.resumed_at ? new Date(item.resumed_at).toLocaleString() : '-'}</td>
                          <td style={styles.td}>{formatHours(getPauseDurationSeconds(item))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td style={styles.td} colSpan={4}>
                          No non-productive activity detail found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setPauseDetailInspector('')} style={{ height: '42px', padding: '0 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#111827', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
