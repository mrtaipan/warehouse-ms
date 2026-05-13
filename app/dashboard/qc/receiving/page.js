'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { readFileAsDataUrl } from '../shared'

const supabase = createClient()
const ARKLINE_PO_TABLE_CANDIDATES = ['arkline_pos', 'dir_arkline_purchase_orders', 'dir_arkline_po', 'dir_arkline_pos']
const ARKLINE_PO_ITEM_TABLE_CANDIDATES = ['arkline_po_items', 'dir_arkline_purchase_order_items', 'dir_arkline_po_items', 'dir_arkline_pos_items']

function getTodayLocalDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getDateOnly(value) {
  return String(value || '').slice(0, 10)
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '18px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '800',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6b7280',
    fontSize: '13px',
    lineHeight: 1.6,
  },
  sectionTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '800',
  },
  sectionSubtitle: {
    margin: '4px 0 0',
    color: '#6b7280',
    fontSize: '13px',
    lineHeight: 1.6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
  },
  compactGrid: {
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
    minHeight: '40px',
    padding: '0 14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  modeButtonActive: {
    background: '#111827',
    color: '#fff',
    borderColor: '#111827',
  },
  modeButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
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
  helperText: {
    fontSize: '12px',
    color: '#6b7280',
  },
  comboBox: {
    position: 'relative',
  },
  comboList: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    right: 0,
    zIndex: 30,
    maxHeight: '240px',
    overflowY: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#fff',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  comboOption: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    background: '#fff',
    color: '#111827',
    padding: '10px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  comboOptionMeta: {
    fontSize: '11px',
    color: '#6b7280',
    fontWeight: '600',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  input: {
    height: '40px',
    padding: '0 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '10px',
    fontSize: '13px',
    width: '100%',
  },
  inputDisabled: {
    background: '#f3f4f6',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  select: {
    height: '40px',
    padding: '0 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '10px',
    fontSize: '13px',
    background: '#fff',
    width: '100%',
  },
  selectDisabled: {
    background: '#f3f4f6',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  readonlyBox: {
    minHeight: '40px',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    background: '#f9fafb',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  primaryButton: {
    height: '40px',
    padding: '0 16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    height: '40px',
    padding: '0 16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '10px',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  buttonDisabled: {
    background: '#e5e7eb',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  iconButton: {
    width: '34px',
    height: '34px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  iconButtonDisabled: {
    background: '#f3f4f6',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },
  summaryCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#111827',
  },
  sourceList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  sourceChip: {
    minHeight: '34px',
    padding: '0 12px',
    borderRadius: '999px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    background: '#fff',
    color: '#111827',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  sourceChipActive: {
    background: '#111827',
    borderColor: '#111827',
    color: '#fff',
  },
  sourceChipDone: {
    background: '#dcfce7',
    borderColor: '#86efac',
    color: '#166534',
  },
  sourceChipDoneActive: {
    background: '#16a34a',
    borderColor: '#16a34a',
    color: '#fff',
  },
  sourceChipDisabled: {
    background: '#f3f4f6',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  sourceStatusBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid #86efac',
    background: '#f0fdf4',
    color: '#166534',
    fontSize: '13px',
    fontWeight: '700',
    flexWrap: 'wrap',
  },
  modelRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    background: '#fff',
  },
  modelRowTop: {
    display: 'grid',
    gridTemplateColumns: '96px 1.4fr 0.9fr 0.9fr auto',
    gap: '12px',
    alignItems: 'center',
  },
  allocationWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '14px',
    borderTop: '1px solid #e5e7eb',
  },
  thumb: {
    width: '84px',
    height: '84px',
    objectFit: 'cover',
    borderRadius: '14px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  thumbEmpty: {
    width: '84px',
    height: '84px',
    borderRadius: '14px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: '12px',
    fontWeight: '700',
  },
  modelMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  modelName: {
    fontWeight: '700',
    color: '#111827',
    fontSize: '15px',
  },
  infoText: {
    margin: 0,
    color: '#6b7280',
    fontSize: '12px',
  },
  allocationCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
    background: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
  },
  successText: {
    margin: 0,
    color: '#16a34a',
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 40,
  },
  modal: {
    width: '100%',
    maxWidth: '720px',
    background: '#fff',
    borderRadius: '18px',
    padding: '18px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gap: '12px',
  },
  modelCardButton: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '12px',
    background: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
  },
}

function createDefaultModelRow(expectedRow) {
  return {
    id: `expected-${expectedRow.id}`,
    source_id: expectedRow.id,
    model_id: '',
    model_name: expectedRow.model_name || '',
    model_color: expectedRow.model_color || '',
    qty_in: Number(expectedRow.qty || 0),
    qty_qc: String(expectedRow.qty || 0),
    photo_url: expectedRow.photo_url || '',
    allocations: [],
  }
}

function normalizeArklineProduct(row) {
  if (!row || row.is_active === false) {
    return null
  }

  const modelName = row.nama_produk || row.product_name || row.model_name || row.name || row.product_label || ''
  if (!String(modelName).trim()) {
    return null
  }

  return {
    id: String(row.sku_induk || row.id || row.nama_produk || '').trim().toUpperCase(),
    model_name: String(modelName).trim().toUpperCase(),
    model_color: String(row.warna || row.model_color || row.color || row.variant || '').trim().toUpperCase(),
    photo_url: row.foto_url || row.photo_url || row.image_url || row.image || '',
    category_name: String(row.kategori_produk || row.category_name || '').trim().toUpperCase(),
    procurement_category: String(row.kategori_pengadaan || '').trim().toUpperCase(),
    parent_sku: String(row.sku_induk || '').trim().toUpperCase(),
  }
}

function normalizeArklinePo(row) {
  if (!row) {
    return null
  }

  const poNumber = row.po_id || row.po_number || row.po_code || row.code || row.po_name || row.name || ''
  if (!String(poNumber).trim()) {
    return null
  }

  return {
    id: String(row.po_id || row.id || poNumber).trim().toUpperCase(),
    po_number: String(poNumber).trim().toUpperCase(),
  }
}

function normalizeArklinePoItem(row, productsById, poLabel) {
  if (!row) {
    return null
  }

  const linkedProduct =
    productsById[
      String(row.sku_induk || row.product_id || row.arkline_product_id || row.dir_arkline_product_id || '')
        .trim()
        .toUpperCase()
    ] || null
  const modelName =
    row.nama_produk ||
    row.product_name ||
    row.model_name ||
    row.name ||
    linkedProduct?.model_name ||
    linkedProduct?.name ||
    ''

  if (!String(modelName).trim()) {
    return null
  }

  const quantity =
    Number(
      row.qty ??
        row.quantity ??
        row.po_qty ??
        row.ordered_qty ??
        row.total_qty ??
        row.request_qty ??
        0
    ) || 0

  return {
    key: `po-item:${row.id}`,
    id: row.id,
    po_id: String(row.po_id || '').trim().toUpperCase(),
    sku_induk: String(row.sku_induk || linkedProduct?.parent_sku || '').trim().toUpperCase(),
    model_name: String(modelName).trim().toUpperCase(),
    model_color: String(linkedProduct?.model_color || linkedProduct?.warna || row.warna || row.model_color || row.color || `PO ${poLabel}` || '')
      .trim()
      .toUpperCase(),
    photo_url: row.foto_url || row.photo_url || linkedProduct?.foto_url || linkedProduct?.photo_url || '',
    qty_in: quantity,
    po_label: poLabel,
  }
}

function buildModelRowsFromPersisted(baseRows, existingPlanRows) {
  const rowMap = new Map()

  baseRows.forEach((row) => {
    rowMap.set(getModelKey(row.model_name, row.model_color), {
      ...row,
      allocations: row.allocations || [],
    })
  })

  existingPlanRows.forEach((planRow) => {
    const key = getModelKey(planRow.model_name, planRow.model_color)
    const existingRow =
      rowMap.get(key) ||
      {
        id: `saved-${planRow.id}`,
        source_id: null,
        model_id: '',
        model_name: planRow.model_name || '',
        model_color: planRow.model_color || '',
        qty_in: Number(planRow.expected_qty || 0),
        qty_qc: String(planRow.qty_in || 0),
        photo_url: planRow.photo_url || '',
        allocations: [],
      }

    existingRow.qty_qc = String(Math.max(Number(existingRow.qty_qc || 0), Number(planRow.qty_in || 0)))
    existingRow.photo_url = existingRow.photo_url || planRow.photo_url || ''
    existingRow.allocations = [
      ...(existingRow.allocations || []),
      {
        id: `alloc-saved-${planRow.id}`,
        task_id: planRow.id,
        member_email: planRow.assigned_to || '',
        qty: String(planRow.allocated_qty || 0),
        existing_status: planRow.status || 'queued',
        locked_qty: Number(planRow.locked_qty || 0),
      },
    ]

    rowMap.set(key, existingRow)
  })

  return Array.from(rowMap.values()).sort((a, b) => getModelKey(a.model_name, a.model_color).localeCompare(getModelKey(b.model_name, b.model_color)))
}

async function loadFirstExistingRows(tableNames) {
  let lastError = null

  for (const tableName of tableNames) {
    const result = await supabase.from(tableName).select('*')

    if (!result.error) {
      return { data: result.data || [], tableName }
    }

    lastError = result.error
  }

  return { data: [], tableName: null, error: lastError }
}

function getModelKey(modelName, modelColor) {
  return `${String(modelName || '').trim().toUpperCase()}::${String(modelColor || '').trim().toUpperCase()}`
}

function getArklineProductLabel(product) {
  if (!product) {
    return ''
  }

  return product.model_name || ''
}

function getTaskKey(values) {
  return `${String(values.assigned_to || values.member_email || '').trim().toLowerCase()}::${getModelKey(
    values.model_name,
    values.model_color
  )}`
}

function getArklineTaskKey(values) {
  return [
    String(values.assigned_to || values.member_email || '').trim().toLowerCase(),
    String(values.po_id || '').trim().toUpperCase(),
    String(values.arkline_po_item_id || '').trim(),
    String(values.sku_induk || '').trim().toUpperCase(),
  ].join('::')
}

function hydrateArklinePlanRows(rows, fallbackColor) {
  return (rows || []).map((item) => ({
    ...item,
    model_color: String(item.model_color || fallbackColor || '').trim().toUpperCase(),
  }))
}

function getSourceStatus(source, qcItems) {
  if (!source?.sourceId) {
    return 'idle'
  }

  const sourceTasks = (qcItems || []).filter((item) => Number(item.inbound_unload_id) === Number(source.sourceId))

  if (!sourceTasks.length) {
    return 'idle'
  }

  if (sourceTasks.every((item) => item.status === 'done')) {
    return 'completed'
  }

  if (sourceTasks.some((item) => item.status !== 'queued')) {
    return 'started'
  }

  return 'planned'
}

function buildModelRowsForSource(source, unloadRows, qcItems) {
  if (!source) {
    return []
  }

  const rowMap = new Map()
  const expectedRows = source.rows || []
  const existingPlanRows = (qcItems || []).filter((item) => item.inbound_unload_id === source.sourceId)

  expectedRows.forEach((row) => {
    const key = getModelKey(row.model_name, row.model_color)
    const existingRow = rowMap.get(key) || {
      ...createDefaultModelRow(row),
      id: `expected-${source.sourceId}-${key}`,
      qty_in: 0,
      qty_qc: String(row.qty || 0),
      allocations: [],
    }

    existingRow.qty_in += Number(row.qty || 0)
    existingRow.qty_qc = String(Math.max(Number(existingRow.qty_qc || 0), Number(row.qty || 0)))
    existingRow.photo_url = existingRow.photo_url || row.photo_url || ''
    rowMap.set(key, existingRow)
  })

  existingPlanRows.forEach((planRow) => {
    const key = getModelKey(planRow.model_name, planRow.model_color)
    const existingRow =
      rowMap.get(key) ||
      {
        id: `saved-${planRow.id}`,
        source_id: source.sourceId,
        model_id: '',
        model_name: planRow.model_name || '',
        model_color: planRow.model_color || '',
        qty_in: 0,
        qty_qc: String(planRow.qty_in || 0),
        photo_url: planRow.photo_url || '',
        allocations: [],
      }

    existingRow.model_name = existingRow.model_name || planRow.model_name || ''
    existingRow.model_color = existingRow.model_color || planRow.model_color || ''
    existingRow.photo_url = existingRow.photo_url || planRow.photo_url || ''
    existingRow.qty_qc = String(Math.max(Number(existingRow.qty_qc || 0), Number(planRow.qty_in || 0)))
    existingRow.allocations = [
      ...(existingRow.allocations || []),
      {
        id: `alloc-saved-${planRow.id}`,
        task_id: planRow.id,
        member_email: planRow.assigned_to || '',
        qty: String(planRow.allocated_qty || 0),
        existing_status: planRow.status || 'queued',
        locked_qty: Number(planRow.locked_qty || 0),
      },
    ]

    rowMap.set(key, existingRow)
  })

  return Array.from(rowMap.values()).sort((a, b) => getModelKey(a.model_name, a.model_color).localeCompare(getModelKey(b.model_name, b.model_color)))
}

export default function QcReceivingPage() {
  const pathname = usePathname()
  const [viewportWidth, setViewportWidth] = useState(1280)
  const [inbounds, setInbounds] = useState([])
  const [unloadRows, setUnloadRows] = useState([])
  const [productModels, setProductModels] = useState([])
  const [arklineProducts, setArklineProducts] = useState([])
  const [arklinePurchaseOrders, setArklinePurchaseOrders] = useState([])
  const [arklinePoItems, setArklinePoItems] = useState([])
  const [arklineQcItems, setArklineQcItems] = useState([])
  const [qcItems, setQcItems] = useState([])
  const [qcMembers, setQcMembers] = useState([])
  const [qcMode, setQcMode] = useState('regular')
  const [arklinePlannerMode, setArklinePlannerMode] = useState('product')
  const [grnSearch, setGrnSearch] = useState('')
  const [selectedInboundId, setSelectedInboundId] = useState('')
  const [selectedSourceKey, setSelectedSourceKey] = useState('')
  const [selectedArklineProductId, setSelectedArklineProductId] = useState('')
  const [selectedArklineCategory, setSelectedArklineCategory] = useState('')
  const [arklineProductSearch, setArklineProductSearch] = useState('')
  const [showArklineProductOptions, setShowArklineProductOptions] = useState(false)
  const [selectedArklinePoId, setSelectedArklinePoId] = useState('')
  const [selectedArklinePoItemKey, setSelectedArklinePoItemKey] = useState('')
  const [modelRows, setModelRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showChooseModelModal, setShowChooseModelModal] = useState(false)
  const [showModelModal, setShowModelModal] = useState(false)
  const [activeModelRowId, setActiveModelRowId] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [modelModalError, setModelModalError] = useState('')
  const [modelDraft, setModelDraft] = useState({
    model_name: '',
    model_color: '',
    photo_url: '',
  })
  const [modelPhotoFile, setModelPhotoFile] = useState(null)
  const [sourceDetailsExpanded, setSourceDetailsExpanded] = useState(true)

  useEffect(() => {
    function updateViewport() {
      setViewportWidth(window.innerWidth)
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)

    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      setError('')
      const today = getTodayLocalDate()

      const [arklineProductResult, arklinePoResult, arklinePoItemResult] = await Promise.all([
        supabase.from('arkline_dir_products').select('*'),
        loadFirstExistingRows(ARKLINE_PO_TABLE_CANDIDATES),
        loadFirstExistingRows(ARKLINE_PO_ITEM_TABLE_CANDIDATES),
      ])

      const [
        { data: inboundRows, error: inboundError },
        { data: modelRows, error: modelError },
        { data: qcRows, error: qcError },
        { data: arklineQcRows, error: arklineQcError },
        { data: memberRows, error: memberError },
        { data: rolePermissionRows, error: rolePermissionError },
      ] = await Promise.all([
        supabase
          .from('inbound')
          .select('id, grn_number, inbound_date, item_name, suppliers:dir_suppliers!supplier_id (supplier_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('dir_product_models')
          .select('id, model_name, model_color, photo_url')
          .eq('is_active', true)
          .order('model_name', { ascending: true }),
        supabase
          .from('qc_items')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('arkline_qc')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('dir_user_profiles')
          .select('id, email, display_name, role, is_qc_active, qc_active_date')
          .eq('is_qc_active', true)
          .order('display_name', { ascending: true }),
        supabase.from('dir_user_roles').select('role, permission_code').eq('permission_code', 'qc.inspection.do'),
      ])

      if (inboundError || modelError || qcError || arklineQcError || memberError || rolePermissionError) {
        setError(
          inboundError?.message ||
            modelError?.message ||
            qcError?.message ||
            arklineQcError?.message ||
            memberError?.message ||
            rolePermissionError?.message ||
            'Failed to load QC receiving setup.'
        )
        setLoading(false)
        return
      }

      const allowedRoles = new Set((rolePermissionRows || []).map((item) => item.role))
      const eligibleMembers = (memberRows || []).filter(
        (item) =>
          allowedRoles.has(item.role) &&
          item.is_qc_active === true &&
          getDateOnly(item.qc_active_date) === today
      )

      setInbounds(inboundRows || [])
      setProductModels(modelRows || [])
      setQcItems(qcRows || [])
      setArklineQcItems(arklineQcRows || [])
      setQcMembers(eligibleMembers)
      setArklineProducts((arklineProductResult.data || []).map(normalizeArklineProduct).filter(Boolean))
      setArklinePurchaseOrders((arklinePoResult.data || []).map(normalizeArklinePo).filter(Boolean))
      setArklinePoItems(arklinePoItemResult.data || [])
      setLoading(false)
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    async function loadUnloadRows() {
      if (!selectedInboundId) {
        setUnloadRows([])
        setSelectedSourceKey('')
        return
      }

      const { data, error: unloadError } = await supabase
        .from('inbound_unload')
        .select('id, inbound_id, model_name, model_color, qty, pic_name, is_sample, koli_sequence, photo_url')
        .eq('inbound_id', selectedInboundId)
        .order('koli_sequence', { ascending: true })

      if (unloadError) {
        setError(unloadError.message)
        return
      }

      setUnloadRows(data || [])
    }

    loadUnloadRows()
  }, [selectedInboundId])

  const isMobileApp = pathname?.startsWith('/mobile/')
  const isMobileLayout = isMobileApp || viewportWidth <= 820
  const isTabletLayout = isMobileApp || viewportWidth <= 1120
  const shellCardStyle = isMobileLayout ? { ...styles.card, padding: '14px', borderRadius: '16px' } : styles.card
  const headerStyle = isMobileLayout
    ? { ...styles.header, flexDirection: 'column', alignItems: 'stretch', gap: '12px' }
    : styles.header
  const plannerGridStyle = isMobileLayout
    ? { display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }
    : isTabletLayout
      ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }
      : styles.grid
  const arklineChoiceGridStyle = isMobileLayout
    ? { display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }
    : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }
  const modeCardStyle = isMobileLayout
    ? {
        border: '1px solid #d1d5db',
        borderRadius: '16px',
        padding: '14px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }
    : {
        border: '1px solid #d1d5db',
        borderRadius: '16px',
        padding: '18px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }
  const rowTopGridStyle = isMobileLayout
    ? { ...styles.modelRowTop, gridTemplateColumns: '72px 1fr', alignItems: 'start' }
    : isTabletLayout
      ? { ...styles.modelRowTop, gridTemplateColumns: '84px 1.3fr 1fr' }
      : styles.modelRowTop
  const arklineRowTopGridStyle = isMobileLayout
    ? { ...styles.modelRowTop, gridTemplateColumns: '72px 1fr', alignItems: 'start' }
    : isTabletLayout
      ? { ...styles.modelRowTop, gridTemplateColumns: '84px 1.35fr 1fr' }
      : { ...styles.modelRowTop, gridTemplateColumns: '84px 1.5fr 1fr' }
  const allocationGridStyle = isMobileLayout
    ? { display: 'grid', gridTemplateColumns: '1fr', gap: '8px', alignItems: 'stretch' }
    : { display: 'grid', gridTemplateColumns: '1.3fr 0.8fr auto', gap: '8px', alignItems: 'center' }
  const summaryGridStyle = isMobileLayout
    ? { ...styles.summaryGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
    : styles.summaryGrid
  const arklineSummaryGridStyle = isMobileLayout
    ? { ...styles.summaryGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
    : { ...styles.summaryGrid, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }
  const bottomBarStyle = isMobileLayout
    ? {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        position: 'sticky',
        bottom: '10px',
        padding: '12px',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(10px)',
      }
    : styles.buttonRow

  const selectedInbound = inbounds.find((item) => item.id === Number(selectedInboundId)) || null
  const sourceOptions = useMemo(() => {
    const groupedKoli = new Map()
    const sampleRows = []

    unloadRows.forEach((row) => {
      if (row.is_sample) {
        sampleRows.push(row)
        return
      }

      const key = `koli:${row.koli_sequence}`
      if (!groupedKoli.has(key)) {
        groupedKoli.set(key, {
          key,
          label: `Koli ${row.koli_sequence}`,
          type: 'koli',
          sourceId: row.id,
          rows: [],
        })
      }

      groupedKoli.get(key).rows.push(row)
    })

    const result = Array.from(groupedKoli.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))

    if (sampleRows.length) {
      result.push({
        key: 'sample',
        label: 'Sample',
        type: 'sample',
        sourceId: sampleRows[0].id,
        rows: sampleRows,
      })
    }

    return result
  }, [unloadRows])
  const selectedSource = sourceOptions.find((item) => item.key === selectedSourceKey) || null
  const selectedSourceRows = selectedSource?.rows || []
  const selectedSourceId = selectedSource?.sourceId || null
  const arklineProductsById = useMemo(
    () =>
      arklineProducts.reduce((result, item) => {
        const keys = [item.id, item.parent_sku].filter(Boolean)
        keys.forEach((key) => {
          result[String(key).trim().toUpperCase()] = item
        })
        return result
      }, {}),
    [arklineProducts]
  )
  const arklineProductCategories = useMemo(
    () =>
      Array.from(new Set(arklineProducts.map((item) => item.category_name).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    [arklineProducts]
  )
  const arklineFilteredProducts = useMemo(() => {
    const keyword = arklineProductSearch.trim().toUpperCase()

    return arklineProducts.filter((item) => {
      const matchesCategory = !selectedArklineCategory || item.category_name === selectedArklineCategory
      if (!matchesCategory) {
        return false
      }

      if (!keyword) {
        return true
      }

      const haystack = [
        item.model_name,
        item.category_name,
        item.procurement_category,
        item.parent_sku,
      ]
        .filter(Boolean)
        .join(' ')
        .toUpperCase()

      return haystack.includes(keyword)
    })
  }, [arklineProductSearch, arklineProducts, selectedArklineCategory])
  const selectedArklineProduct =
    arklineProducts.find((item) => String(item.id) === String(selectedArklineProductId)) || null
  const selectedArklinePo =
    arklinePurchaseOrders.find((item) => String(item.id) === String(selectedArklinePoId)) || null
  const arklinePoOptions = useMemo(
    () => [...arklinePurchaseOrders].sort((a, b) => a.po_number.localeCompare(b.po_number, undefined, { numeric: true })),
    [arklinePurchaseOrders]
  )
  const arklinePoItemOptions = useMemo(() => {
    if (!selectedArklinePo) {
      return []
    }

    const poId = String(selectedArklinePo.id).trim().toUpperCase()

    return arklinePoItems
      .filter((row) => {
        const candidatePoId = String(
          row.po_id || row.arkline_po_id || row.purchase_order_id || row.dir_arkline_po_id || ''
        )
          .trim()
          .toUpperCase()
        return candidatePoId === poId
      })
      .map((row) => normalizeArklinePoItem(row, arklineProductsById, selectedArklinePo.po_number))
      .filter(Boolean)
      .sort((a, b) => a.model_name.localeCompare(b.model_name))
  }, [arklinePoItems, arklineProductsById, selectedArklinePo])
  const selectedArklinePoItem =
    arklinePoItemOptions.find((item) => item.key === selectedArklinePoItemKey) || null
  const isArklineMode = qcMode === 'arkline'
  const selectedArklineProductSku = String(selectedArklineProduct?.parent_sku || selectedArklineProduct?.id || '')
    .trim()
    .toUpperCase()
  const selectedArklinePoCode = String(selectedArklinePo?.id || '').trim().toUpperCase()
  const selectedArklinePoItemId = String(selectedArklinePoItem?.id || '').trim()

  const qcInQty = modelRows.reduce((sum, row) => sum + Number(row.qty_qc || 0), 0)
  const allocationTotal = modelRows.reduce(
    (sum, row) =>
      sum +
      (row.allocations || []).reduce((allocationSum, split) => allocationSum + Number(split.qty || 0), 0),
    0
  )
  const modelOptions = productModels.filter((item) => {
    if (!modelSearch.trim()) return true
    const label = item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name
    return label.toUpperCase().includes(modelSearch.trim().toUpperCase())
  })
  const currentPlanRows = isArklineMode
    ? arklinePlannerMode === 'product' && selectedArklineProduct
      ? arklineQcItems.filter(
          (item) =>
            !item.po_id &&
            String(item.sku_induk || '').trim().toUpperCase() === selectedArklineProductSku
        )
      : arklinePlannerMode === 'po' && selectedArklinePoItem
        ? arklineQcItems.filter(
          (item) =>
              String(item.po_id || '').trim().toUpperCase() === selectedArklinePoCode &&
              String(item.arkline_po_item_id || '').trim() === selectedArklinePoItemId
          )
        : []
    : selectedSourceId
      ? qcItems.filter((item) => item.inbound_unload_id === Number(selectedSourceId))
      : []
  const hasSavedPlan = currentPlanRows.length > 0
  const selectedSourceStatus = isArklineMode
    ? !currentPlanRows.length
      ? 'idle'
      : currentPlanRows.every((item) => item.status === 'done')
        ? 'completed'
        : currentPlanRows.some((item) => item.status !== 'queued')
          ? 'started'
          : 'planned'
    : selectedSource
      ? getSourceStatus(selectedSource, qcItems)
      : 'idle'
  const isSelectedSourceStarted = selectedSourceStatus === 'started' || selectedSourceStatus === 'completed'
  const isSelectedSourceCompleted = selectedSourceStatus === 'completed'
  const persistedTaskRows = new Map(
    currentPlanRows.map((item) => [isArklineMode ? getArklineTaskKey(item) : getTaskKey(item), item])
  )

  function handleGrnChange(value) {
    setGrnSearch(value)
    const match = inbounds.find((item) => item.grn_number === value)
    setSelectedInboundId(match ? String(match.id) : '')
    setSelectedSourceKey('')
    setModelRows([])
    setError('')
    setSuccess('')
  }

  function handleQcModeChange(nextMode) {
    setQcMode(nextMode)
    setError('')
    setSuccess('')
    setModelRows([])
    setSelectedSourceKey('')
    setSelectedArklineProductId('')
    setSelectedArklineCategory('')
    setArklineProductSearch('')
    setShowArklineProductOptions(false)
    setSelectedArklinePoId('')
    setSelectedArklinePoItemKey('')
  }

  function handleSourceChange(nextSourceKey) {
    setSelectedSourceKey(nextSourceKey)
    setError('')
    setSuccess('')

    if (!nextSourceKey) {
      setModelRows([])
      return
    }

    const nextSource = sourceOptions.find((item) => item.key === nextSourceKey)

    if (!nextSource) {
      setModelRows([])
      setSourceDetailsExpanded(true)
      return
    }

    setSourceDetailsExpanded(getSourceStatus(nextSource, qcItems) !== 'completed')
    setModelRows(buildModelRowsForSource(nextSource, unloadRows, qcItems))
  }

  function handleArklinePlannerModeChange(nextMode) {
    setArklinePlannerMode(nextMode)
    setError('')
    setSuccess('')
    setModelRows([])
    setSelectedArklineProductId('')
    setSelectedArklineCategory('')
    setArklineProductSearch('')
    setShowArklineProductOptions(false)
    setSelectedArklinePoId('')
    setSelectedArklinePoItemKey('')
  }

  function handleArklineCategoryChange(nextCategory) {
    setSelectedArklineCategory(nextCategory)
    setSelectedArklineProductId('')
    setArklineProductSearch('')
    setShowArklineProductOptions(false)
    setModelRows([])
    setError('')
    setSuccess('')
  }

  function handleArklineProductSearchChange(nextValue) {
    setArklineProductSearch(nextValue)
    setShowArklineProductOptions(true)
    setError('')
    setSuccess('')

    const normalizedValue = nextValue.trim().toUpperCase()
    const exactMatch = arklineFilteredProducts.find((item) => getArklineProductLabel(item) === normalizedValue)

    if (exactMatch) {
      handleArklineProductChange(String(exactMatch.id))
      return
    }

    if (!nextValue.trim()) {
      setSelectedArklineProductId('')
      setModelRows([])
      return
    }

    if (selectedArklineProduct && getArklineProductLabel(selectedArklineProduct) !== normalizedValue) {
      setSelectedArklineProductId('')
      setModelRows([])
    }
  }

  function handleArklineProductFieldClick() {
    if (selectedArklineProductId || arklineProductSearch) {
      setSelectedArklineProductId('')
      setArklineProductSearch('')
      setModelRows([])
    }

    setShowArklineProductOptions(true)
    setError('')
    setSuccess('')
  }

  function handleArklineProductChange(productId) {
    setSelectedArklineProductId(productId)
    const product = arklineProducts.find((item) => String(item.id) === String(productId))
    setArklineProductSearch(product ? getArklineProductLabel(product) : '')
    setShowArklineProductOptions(false)
    setSelectedArklinePoId('')
    setSelectedArklinePoItemKey('')
    setError('')
    setSuccess('')

    if (!product) {
      setModelRows([])
      return
    }

    const productSku = String(product.parent_sku || product.id || '').trim().toUpperCase()
    const matchingPlanRows = arklineQcItems.filter(
      (item) => !item.po_id && String(item.sku_induk || '').trim().toUpperCase() === productSku
    )
    const hydratedPlanRows = hydrateArklinePlanRows(matchingPlanRows, product.model_color || 'ARKLINE PRODUCT')

    const baseRows = [
      {
        id: `arkline-product-${product.id}`,
        source_id: null,
        model_id: String(product.id),
        model_name: product.model_name,
        model_color: product.model_color || 'ARKLINE PRODUCT',
        qty_in: 0,
        qty_qc: '',
        photo_url: product.photo_url || '',
        allocations: [],
      },
    ]

    setModelRows(buildModelRowsFromPersisted(baseRows, hydratedPlanRows))
  }

  function handleArklinePoChange(poId) {
    setSelectedArklinePoId(poId)
    setSelectedArklinePoItemKey('')
    setModelRows([])
    setError('')
    setSuccess('')
  }

  function handleArklinePoItemChange(itemKey) {
    setSelectedArklinePoItemKey(itemKey)
    setError('')
    setSuccess('')

    const item = arklinePoItemOptions.find((entry) => entry.key === itemKey)
    if (!item) {
      setModelRows([])
      return
    }

    const matchingPlanRows = arklineQcItems.filter(
      (planItem) =>
        String(planItem.po_id || '').trim().toUpperCase() === String(selectedArklinePo?.id || '').trim().toUpperCase() &&
        String(planItem.arkline_po_item_id || '').trim() === String(item.id)
    )
    const hydratedPlanRows = hydrateArklinePlanRows(matchingPlanRows, item.model_color || `PO ${item.po_label}`)

    const baseRows = [
      {
        id: `arkline-po-${item.id}`,
        source_id: null,
        model_id: '',
        model_name: item.model_name,
        model_color: item.model_color || `PO ${item.po_label}`,
        qty_in: Number(item.qty_in || 0),
        qty_qc: String(item.qty_in || 0),
        photo_url: item.photo_url || '',
        allocations: [],
      },
    ]

    setModelRows(buildModelRowsFromPersisted(baseRows, hydratedPlanRows))
  }

  function addModelRow() {
    setModelRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${prev.length}`,
        model_id: '',
        model_name: '',
        model_color: '',
        qty_in: 0,
        qty_qc: '',
        photo_url: '',
        allocations: [],
      },
    ])
  }

  function updateModelRow(rowId, updates) {
    setModelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row)))
  }

  function addAllocationSplit(rowId) {
    if (isSelectedSourceStarted) {
      setError('Allocation is locked because QC for this source has already started.')
      return
    }

    if (!qcMembers.length) {
      setError('No active QC user found with permission `qc.inspection.do` for today. Activate QC task from Grading Task or User Access.')
      return
    }

    const targetRow = modelRows.find((row) => row.id === rowId)
    if (targetRow && (targetRow.allocations || []).length >= qcMembers.length) {
      setError('All active inspectors have already been used for this model.')
      return
    }

    setError('')
    setModelRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? (row.allocations || []).length >= qcMembers.length
            ? row
            : {
                ...row,
                allocations: [
                  ...(row.allocations || []),
                  {
                    id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    task_id: null,
                    member_email: '',
                    qty: '',
                    existing_status: 'queued',
                    locked_qty: 0,
                  },
                ],
              }
          : row
      )
    )
  }

  function updateAllocationSplit(rowId, splitId, updates) {
    setModelRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              allocations: (row.allocations || []).map((split) => (split.id === splitId ? { ...split, ...updates } : split)),
            }
          : row
      )
    )
  }

  function removeAllocationSplit(rowId, splitId) {
    setModelRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              allocations: (row.allocations || []).filter((split) => split.id !== splitId),
            }
          : row
      )
    )
  }

  function removeModelRow(rowId) {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Remove this model row?')
      if (!confirmed) return
    }
    setModelRows((prev) => prev.filter((row) => row.id !== rowId))
  }

  async function handleModelPhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setModelPhotoFile(file)
      const dataUrl = await readFileAsDataUrl(file)
      setModelDraft((prev) => ({
        ...prev,
        photo_url: dataUrl,
      }))
    } catch (photoError) {
      setModelModalError(photoError.message)
    }
  }

  async function handleSaveModel() {
    setModelModalError('')

    if (!modelDraft.model_name.trim()) {
      setModelModalError('Model name is required.')
      return
    }

    let photoUrl = modelDraft.photo_url || ''

    if (modelPhotoFile) {
      const fileExt = modelPhotoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`
      const filePath = `qc-models/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('product-photos')
        .upload(filePath, modelPhotoFile, { upsert: false })

      if (uploadError) {
        setModelModalError(uploadError.message)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-photos')
        .getPublicUrl(filePath)

      photoUrl = publicUrlData.publicUrl || ''
    }

    const { data: insertedModel, error: insertError } = await supabase
      .from('dir_product_models')
      .insert([
        {
          model_name: modelDraft.model_name.trim().toUpperCase(),
          model_color: modelDraft.model_color.trim().toUpperCase() || null,
          photo_url: photoUrl || null,
          is_active: true,
        },
      ])
      .select('id, model_name, model_color, photo_url')
      .single()

    if (insertError) {
      setModelModalError(insertError.message)
      return
    }

    setProductModels((prev) => [...prev, insertedModel])

    if (activeModelRowId) {
      updateModelRow(activeModelRowId, {
        model_id: String(insertedModel.id),
        model_name: insertedModel.model_name,
        model_color: insertedModel.model_color || '',
        photo_url: insertedModel.photo_url || '',
      })
    }

    setShowModelModal(false)
    setShowChooseModelModal(false)
    setModelDraft({
      model_name: '',
      model_color: '',
      photo_url: '',
    })
    setModelPhotoFile(null)
    setSuccess('Model added successfully.')
  }

  function resetRegularPlanner() {
    setGrnSearch('')
    setSelectedInboundId('')
    setSelectedSourceKey('')
    setUnloadRows([])
    setModelRows([])
  }

  function resetArklinePlanner() {
    setSelectedArklineProductId('')
    setSelectedArklineCategory('')
    setArklineProductSearch('')
    setShowArklineProductOptions(false)
    setSelectedArklinePoId('')
    setSelectedArklinePoItemKey('')
    setModelRows([])
  }

  async function handleSavePlan() {
    setError('')
    setSuccess('')

    if (qcMode === 'arkline') {
      if (!modelRows.length) {
        setError('Choose Arkline product or PO item first.')
        return
      }

      const invalidRow = modelRows.find((row) => {
        const splitTotal = (row.allocations || []).reduce((sum, split) => sum + Number(split.qty || 0), 0)
        const hasInvalidSplit = (row.allocations || []).some(
          (split) => !String(split.member_email || '').trim() || Number(split.qty || 0) <= 0
        )

        return !row.model_name.trim() || Number(row.qty_qc || 0) <= 0 || hasInvalidSplit || splitTotal > Number(row.qty_qc || 0)
      })

      if (invalidRow) {
        setError('Every Arkline row must have a product and QC qty. Allocated qty cannot be greater than QC In.')
        return
      }

      if (!qcMembers.length) {
        setError('No active QC user found with permission `qc.inspection.do` for today. Activate QC task from Grading Task or User Access.')
        return
      }

      setSaving(true)

      const activeTaskKeys = new Set()
      const insertPayload = []
      const updatesForPersistedRows = []
      let blockingError = ''

      modelRows.forEach((row) => {
        ;(row.allocations || []).forEach((split) => {
          if (blockingError) return
          if (!split.member_email || Number(split.qty || 0) <= 0) return

          const taskKey = getArklineTaskKey({
            member_email: split.member_email,
            po_id: arklinePlannerMode === 'po' ? String(selectedArklinePo?.id || '').trim().toUpperCase() || null : null,
            arkline_po_item_id: arklinePlannerMode === 'po' ? row.source_id || selectedArklinePoItem?.id || null : null,
            sku_induk:
              arklinePlannerMode === 'po'
                ? String(selectedArklinePoItem?.sku_induk || '').trim().toUpperCase() || null
                : String(selectedArklineProduct?.parent_sku || selectedArklineProduct?.id || '').trim().toUpperCase() || null,
          })

          activeTaskKeys.add(taskKey)

          const persistedRow = persistedTaskRows.get(taskKey) || null
          const lockedQty = Number(persistedRow?.locked_qty ?? split.locked_qty ?? 0)
          const allocatedQty = Number(split.qty || 0)

          if (allocatedQty < lockedQty) {
            blockingError = `Allocated qty for ${split.member_email} on ${row.model_name} cannot be less than the committed qty (${lockedQty}).`
            return
          }

          const basePayload = {
            po_id: arklinePlannerMode === 'po' ? String(selectedArklinePo?.id || '').trim().toUpperCase() || null : null,
            arkline_po_item_id: arklinePlannerMode === 'po' ? row.source_id || selectedArklinePoItem?.id || null : null,
            sku_induk:
              arklinePlannerMode === 'po'
                ? String(selectedArklinePoItem?.sku_induk || '').trim().toUpperCase() || null
                : String(selectedArklineProduct?.parent_sku || selectedArklineProduct?.id || '').trim().toUpperCase() || null,
            assigned_to: String(split.member_email || '').trim().toLowerCase(),
            allocated_qty: allocatedQty,
            qty_in: Number(row.qty_qc || 0),
            model_name: row.model_name.trim(),
            photo_url: row.photo_url || null,
            locked_qty: lockedQty,
          }

          if (persistedRow) {
            updatesForPersistedRows.push({
              id: persistedRow.id,
              ...basePayload,
              status: persistedRow.status,
              finished_at: persistedRow.finished_at,
            })
          } else {
            insertPayload.push({
              ...basePayload,
              status: 'queued',
              qty_a: 0,
              qty_b: 0,
              qty_c: 0,
              stopwatch_seconds: 0,
            })
          }
        })
      })

      if (blockingError) {
        setError(blockingError)
        setSaving(false)
        return
      }

      const queuedRowsToDelete = currentPlanRows.filter(
        (item) => item.status === 'queued' && !activeTaskKeys.has(getArklineTaskKey(item))
      )

      if (queuedRowsToDelete.length) {
        const { error: deleteError } = await supabase
          .from('arkline_qc')
          .delete()
          .in(
            'id',
            queuedRowsToDelete.map((item) => item.id)
          )

        if (deleteError) {
          setError(deleteError.message)
          setSaving(false)
          return
        }
      }

      for (const updateRow of updatesForPersistedRows) {
        const { error: updateError } = await supabase
          .from('arkline_qc')
          .update(updateRow)
          .eq('id', updateRow.id)

        if (updateError) {
          setError(updateError.message)
          setSaving(false)
          return
        }
      }

      if (insertPayload.length) {
        const { error: insertError } = await supabase.from('arkline_qc').insert(insertPayload)

        if (insertError) {
          setError(insertError.message)
          setSaving(false)
          return
        }
      }

      const { data: nextQcItems, error: refreshError } = await supabase
        .from('arkline_qc')
          .select('*')
          .order('created_at', { ascending: false })

      if (refreshError) {
        setError(refreshError.message)
        setSaving(false)
        return
      }

      setArklineQcItems(nextQcItems || [])

      if (arklinePlannerMode === 'product' && selectedArklineProduct) {
        const matchingPlanRows = hydrateArklinePlanRows(
          (nextQcItems || []).filter(
          (item) =>
            !item.po_id &&
              String(item.sku_induk || '').trim().toUpperCase() === selectedArklineProductSku
          ),
          selectedArklineProduct.model_color || 'ARKLINE PRODUCT'
        )

        setModelRows(
          buildModelRowsFromPersisted(
            [
              {
                id: `arkline-product-${selectedArklineProduct.id}`,
                source_id: null,
                model_id: String(selectedArklineProduct.id),
                model_name: selectedArklineProduct.model_name,
                model_color: selectedArklineProduct.model_color || 'ARKLINE PRODUCT',
                qty_in: 0,
                qty_qc: modelRows[0]?.qty_qc || '',
                photo_url: selectedArklineProduct.photo_url || '',
                allocations: [],
              },
            ],
            matchingPlanRows
          )
        )
      }

      if (arklinePlannerMode === 'po' && selectedArklinePoItem) {
        const matchingPlanRows = hydrateArklinePlanRows(
          (nextQcItems || []).filter(
            (item) =>
              String(item.po_id || '').trim().toUpperCase() === String(selectedArklinePo?.id || '').trim().toUpperCase() &&
              String(item.arkline_po_item_id || '').trim() === String(selectedArklinePoItem.id)
          ),
          selectedArklinePoItem.model_color || `PO ${selectedArklinePoItem.po_label}`
        )

        setModelRows(
          buildModelRowsFromPersisted(
            [
              {
                id: `arkline-po-${selectedArklinePoItem.id}`,
                source_id: selectedArklinePoItem.id,
                model_id: '',
                model_name: selectedArklinePoItem.model_name,
                model_color: selectedArklinePoItem.model_color,
                qty_in: Number(selectedArklinePoItem.qty_in || 0),
                qty_qc: String(selectedArklinePoItem.qty_in || 0),
                photo_url: selectedArklinePoItem.photo_url || '',
                allocations: [],
              },
            ],
            matchingPlanRows
          )
        )
      }

      resetArklinePlanner()
      setSuccess('Arkline QC plan saved.')
      setSaving(false)
      return
    }

    if (!selectedInbound || !selectedSourceId) {
      setError('Choose GRN and Koli/Sample first.')
      return
    }

    const invalidRow = modelRows.find((row) => {
      const splitTotal = (row.allocations || []).reduce((sum, split) => sum + Number(split.qty || 0), 0)
      const hasInvalidSplit = (row.allocations || []).some(
        (split) => !String(split.member_email || '').trim() || Number(split.qty || 0) <= 0
      )

      return !row.model_name.trim() || Number(row.qty_qc || 0) <= 0 || hasInvalidSplit || splitTotal > Number(row.qty_qc || 0)
    })
    if (invalidRow) {
      setError('Every model row must have a model and QC qty. Allocated qty cannot be greater than QC In.')
      return
    }

    if (qcInQty <= 0) {
      setError('QC In must be greater than 0.')
      return
    }

    if (!qcMembers.length) {
      setError('No active QC user found with permission `qc.inspection.do` for today. Activate QC task from Grading Task or User Access.')
      return
    }

    setSaving(true)

    const activeTaskKeys = new Set()
    const insertPayload = []
    const updatesForPersistedRows = []
    let blockingError = ''
    modelRows.forEach((row) => {
      ;(row.allocations || []).forEach((split) => {
        if (blockingError) {
          return
        }
        if (!split.member_email || Number(split.qty || 0) <= 0) {
          return
        }
        const taskKey = getTaskKey({
          member_email: split.member_email,
          model_name: row.model_name,
          model_color: row.model_color,
        })
        activeTaskKeys.add(taskKey)

        const persistedRow = persistedTaskRows.get(taskKey) || null
        const lockedQty = Number(persistedRow?.locked_qty ?? split.locked_qty ?? 0)
        const allocatedQty = Number(split.qty || 0)

        if (allocatedQty < lockedQty) {
          blockingError = `Allocated qty for ${split.member_email} on ${row.model_name} cannot be less than the committed qty (${lockedQty}).`
          return
        }

        const basePayload = {
          inbound_id: selectedInbound.id,
          inbound_unload_id: selectedSourceId,
          assigned_to: String(split.member_email || '').trim().toLowerCase(),
          allocated_qty: allocatedQty,
          expected_qty: Number(row.qty_in || 0),
          qty_in: Number(row.qty_qc || 0),
          model_name: row.model_name.trim(),
          model_color: row.model_color.trim() || null,
          photo_url: row.photo_url || null,
          locked_qty: lockedQty,
        }

        if (persistedRow) {
          updatesForPersistedRows.push({
            id: persistedRow.id,
            ...basePayload,
            status: persistedRow.status,
            finished_at: persistedRow.finished_at,
            started_at: persistedRow.started_at,
            paused_at: persistedRow.paused_at,
            pause_reason: persistedRow.pause_reason,
          })
          return
        }

        insertPayload.push({
          ...basePayload,
          is_confirmed: true,
          status: 'queued',
        })
      })
    })

    if (blockingError) {
      setError(blockingError)
      setSaving(false)
      return
    }

    const queuedRowsToDelete = currentPlanRows.filter(
      (item) => item.status === 'queued' && !activeTaskKeys.has(getTaskKey(item))
    )

    if (queuedRowsToDelete.length) {
      const { error: deleteError } = await supabase
        .from('qc_items')
        .delete()
        .in(
          'id',
          queuedRowsToDelete.map((item) => item.id)
        )

      if (deleteError) {
        setError(deleteError.message)
        setSaving(false)
        return
      }
    }

    let insertedRows = []
    if (insertPayload.length) {
      const insertResponse = await supabase
        .from('qc_items')
        .insert(insertPayload)
        .select('*')

      if (insertResponse.error) {
        setError(insertResponse.error.message)
        setSaving(false)
        return
      }

      insertedRows = insertResponse.data || []
    }

    const updatedRows = []
    for (const row of updatesForPersistedRows) {
      const { data: updatedRow, error: updateError } = await supabase
        .from('qc_items')
        .update({
          inbound_id: row.inbound_id,
          inbound_unload_id: row.inbound_unload_id,
          assigned_to: row.assigned_to,
          allocated_qty: row.allocated_qty,
          expected_qty: row.expected_qty,
          qty_in: row.qty_in,
          model_name: row.model_name,
          model_color: row.model_color,
          photo_url: row.photo_url,
          locked_qty: row.locked_qty,
          status: row.status,
          finished_at: row.finished_at,
          started_at: row.started_at,
          paused_at: row.paused_at,
          pause_reason: row.pause_reason,
        })
        .eq('id', row.id)
        .select('*')
        .single()

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      updatedRows.push(updatedRow)
    }

    const deletedIds = new Set(queuedRowsToDelete.map((item) => item.id))
    const nextQcItems = [
      ...qcItems.filter((item) => !deletedIds.has(item.id) && !updatedRows.some((updated) => updated.id === item.id)),
      ...updatedRows,
      ...insertedRows,
    ]

    setQcItems(nextQcItems)
    resetRegularPlanner()
    setSuccess('QC plan saved.')
    setSaving(false)
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading QC receiving setup...</p>
  }

  return (
    <div style={{ ...styles.wrapper, paddingBottom: isMobileLayout ? '20px' : 0 }}>
      <div style={shellCardStyle}>
        <div>
          <h2 style={styles.sectionTitle}>QC Receiving & Allocation</h2>
        </div>

        <div style={{ ...styles.modeRow, width: isMobileLayout ? '100%' : 'auto' }}>
          <button
            type="button"
            onClick={() => handleQcModeChange('regular')}
            style={{
              ...styles.modeButton,
              ...(qcMode === 'regular' ? styles.modeButtonActive : {}),
              ...(isMobileLayout ? { flex: 1 } : {}),
            }}
          >
            QC Reguler
          </button>
          <button
            type="button"
            disabled
            style={{
              ...styles.modeButton,
              ...styles.modeButtonDisabled,
              ...(isMobileLayout ? { flex: 1 } : {}),
            }}
          >
            Re-QC
          </button>
          <button
            type="button"
            onClick={() => handleQcModeChange('arkline')}
            style={{
              ...styles.modeButton,
              ...(qcMode === 'arkline' ? styles.modeButtonActive : {}),
              ...(isMobileLayout ? { flex: 1 } : {}),
            }}
          >
            QC Arkline
          </button>
        </div>

        {qcMode === 'arkline' ? (
          <>
            <div style={arklineChoiceGridStyle}>
              <button
                type="button"
                onClick={() => handleArklinePlannerModeChange('product')}
                style={{
                  ...modeCardStyle,
                  background: arklinePlannerMode === 'product' ? '#111827' : '#fff',
                  color: arklinePlannerMode === 'product' ? '#fff' : '#111827',
                }}
              >
                <strong style={{ fontSize: isMobileLayout ? '16px' : '18px' }}>QC Product</strong>
              </button>

              <button
                type="button"
                onClick={() => handleArklinePlannerModeChange('po')}
                style={{
                  ...modeCardStyle,
                  background: arklinePlannerMode === 'po' ? '#111827' : '#fff',
                  color: arklinePlannerMode === 'po' ? '#fff' : '#111827',
                }}
              >
                <strong style={{ fontSize: isMobileLayout ? '16px' : '18px' }}>QC PO</strong>
              </button>
            </div>

            {arklinePlannerMode === 'product' ? (
              <div style={arklineChoiceGridStyle}>
                <div style={styles.field}>
                  <label style={styles.label}>Product Category</label>
                  <select
                    value={selectedArklineCategory}
                    onChange={(event) => handleArklineCategoryChange(event.target.value)}
                    style={styles.select}
                  >
                    <option value="">{arklineProductCategories.length ? 'All categories' : 'No category found'}</option>
                    {arklineProductCategories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Product</label>
                  <div style={styles.comboBox}>
                    <input
                      value={arklineProductSearch}
                      onChange={(event) => handleArklineProductSearchChange(event.target.value)}
                      onFocus={() => setShowArklineProductOptions(true)}
                      onClick={handleArklineProductFieldClick}
                      style={styles.input}
                      placeholder={
                        arklineFilteredProducts.length
                          ? 'Type product name'
                          : arklineProducts.length
                            ? 'No product in this category'
                            : 'No Arkline product found'
                      }
                    />
                    {showArklineProductOptions && arklineFilteredProducts.length ? (
                      <div style={styles.comboList}>
                        {arklineFilteredProducts.map((item) => (
                          <button
                            key={`${item.id}-${getArklineProductLabel(item)}`}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              handleArklineProductChange(String(item.id))
                            }}
                            style={styles.comboOption}
                          >
                            <strong>{getArklineProductLabel(item)}</strong>
                            <span style={styles.comboOptionMeta}>
                              {item.category_name || 'NO CATEGORY'}
                              {item.parent_sku ? ` · ${item.parent_sku}` : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span style={styles.helperText}>
                    {selectedArklineCategory ? `Filtered by ${selectedArklineCategory}` : 'Type nama_produk untuk memilih produk.'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={arklineChoiceGridStyle}>
                <div style={styles.field}>
                  <label style={styles.label}>PO</label>
                  <select value={selectedArklinePoId} onChange={(event) => handleArklinePoChange(event.target.value)} style={styles.select}>
                    <option value="">{arklinePoOptions.length ? 'Choose PO' : 'No Arkline PO found'}</option>
                    {arklinePoOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.po_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Product in PO</label>
                  <select
                    value={selectedArklinePoItemKey}
                    onChange={(event) => handleArklinePoItemChange(event.target.value)}
                    style={{ ...styles.select, ...(!selectedArklinePoId ? styles.selectDisabled : {}) }}
                    disabled={!selectedArklinePoId}
                  >
                    <option value="">{selectedArklinePoId ? 'Choose product in PO' : 'Choose PO first'}</option>
                    {arklinePoItemOptions.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {modelRows.length ? (
              <>
                {modelRows.map((row) => (
                  <div key={row.id} style={styles.modelRow}>
                    <div style={arklineRowTopGridStyle}>
                      {row.photo_url ? (
                        <Image src={row.photo_url} alt={row.model_name || 'Arkline model'} width={84} height={84} unoptimized style={styles.thumb} />
                      ) : (
                        <div style={styles.thumbEmpty}>NO PHOTO</div>
                      )}

                      <div style={{ ...styles.modelMeta, ...(isMobileLayout ? { gridColumn: '2 / -1' } : {}) }}>
                        <div style={styles.modelName}>{row.model_name || 'Choose product'}</div>
                        <p style={styles.infoText}>{row.model_color || 'ARKLINE PRODUCT'}</p>
                      </div>

                      <div style={{ ...styles.field, ...(isMobileLayout ? { gridColumn: '1 / -1' } : {}) }}>
                        <label style={styles.label}>QC In</label>
                        <input
                          type="number"
                          min="0"
                          value={row.qty_qc}
                          onChange={(event) =>
                            updateModelRow(row.id, {
                              qty_qc: event.target.value,
                            })
                          }
                          style={{ ...styles.input, ...(hasSavedPlan ? styles.inputDisabled : {}) }}
                          disabled={hasSavedPlan}
                        />
                      </div>

                    </div>

                    <div style={{ ...styles.field, ...styles.allocationWrap }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <label style={styles.label}>Allocation</label>
                        <button
                          type="button"
                          onClick={() => addAllocationSplit(row.id)}
                          style={{ ...styles.secondaryButton, ...(isSelectedSourceStarted ? styles.buttonDisabled : {}) }}
                          disabled={isSelectedSourceStarted}
                        >
                          Allocate
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(row.allocations || []).map((split) => (
                          <div key={split.id} style={allocationGridStyle}>
                            <select
                              value={split.member_email || ''}
                              onChange={(event) => updateAllocationSplit(row.id, split.id, { member_email: event.target.value })}
                              style={{
                                ...styles.select,
                                ...(isSelectedSourceStarted || (split.existing_status && split.existing_status !== 'queued') ? styles.selectDisabled : {}),
                              }}
                              disabled={isSelectedSourceStarted || (split.existing_status && split.existing_status !== 'queued')}
                            >
                              <option value="">Choose inspector</option>
                              {qcMembers
                                .filter(
                                  (member) =>
                                    member.email === split.member_email ||
                                    !(row.allocations || []).some(
                                      (allocation) => allocation.id !== split.id && allocation.member_email === member.email
                                    )
                                )
                                .map((member) => (
                                  <option key={member.id} value={member.email}>
                                    {member.display_name || member.email}
                                  </option>
                                ))}
                            </select>
                            <input
                              type="number"
                              min="0"
                              value={split.qty || ''}
                              onFocus={(event) => {
                                event.target.select()
                              }}
                              onChange={(event) => updateAllocationSplit(row.id, split.id, { qty: event.target.value })}
                              onBlur={(event) => {
                                const otherTotal = (row.allocations || [])
                                  .filter((item) => item.id !== split.id)
                                  .reduce((sum, item) => sum + Number(item.qty || 0), 0)
                                const minAllowed = Number(split.locked_qty || 0)
                                const maxAllowed = Math.max(minAllowed, Number(row.qty_qc || 0) - otherTotal)
                                const rawValue = event.target.value

                                if (rawValue === '') {
                                  updateAllocationSplit(row.id, split.id, {
                                    qty: minAllowed > 0 ? String(minAllowed) : '',
                                  })
                                  return
                                }

                                const nextValue = Number(rawValue || 0)
                                updateAllocationSplit(row.id, split.id, {
                                  qty: String(Math.max(minAllowed, Math.min(nextValue, maxAllowed))),
                                })
                              }}
                              style={{
                                ...styles.input,
                                ...(isSelectedSourceStarted || Boolean(split.existing_status && split.existing_status !== 'queued') ? styles.inputDisabled : {}),
                              }}
                              disabled={isSelectedSourceStarted || Boolean(split.existing_status && split.existing_status !== 'queued')}
                              placeholder="Qty"
                            />
                            <button
                              type="button"
                              onClick={() => removeAllocationSplit(row.id, split.id)}
                              style={{
                                ...styles.secondaryButton,
                                ...(isMobileLayout ? { width: '100%' } : {}),
                                ...(isSelectedSourceStarted ||
                                Number(split.locked_qty || 0) > 0 ||
                                (split.existing_status && split.existing_status !== 'queued')
                                  ? styles.buttonDisabled
                                  : {}),
                              }}
                              disabled={
                                isSelectedSourceStarted ||
                                Number(split.locked_qty || 0) > 0 ||
                                (split.existing_status && split.existing_status !== 'queued')
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}

                        <span style={styles.helperText}>
                          Allocated: {(row.allocations || []).reduce((sum, split) => sum + Number(split.qty || 0), 0)} / {Number(row.qty_qc || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {!qcMembers.length ? (
                  <p style={styles.emptyText}>No active QC user found with permission `qc.inspection.do` for today. Activate QC task from Grading Task or User Access.</p>
                ) : null}

                <div style={arklineSummaryGridStyle}>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryLabel}>QC In</span>
                    <strong style={styles.summaryValue}>{qcInQty}</strong>
                  </div>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryLabel}>QC Assigned Qty</span>
                    <strong style={styles.summaryValue}>{allocationTotal}</strong>
                  </div>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryLabel}>Selected</span>
                    <strong style={styles.summaryValue}>
                      {arklinePlannerMode === 'product'
                        ? selectedArklineProduct?.model_name || '-'
                        : selectedArklinePo?.po_number || selectedArklinePoItem?.model_name || '-'}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <p style={styles.emptyText}>
                {arklinePlannerMode === 'product'
                  ? 'Choose Arkline product first to start QC planning.'
                  : 'Choose PO and product in that PO first to start QC planning.'}
              </p>
            )}
          </>
        ) : (
        <>
        <div style={plannerGridStyle}>
          <div style={styles.field}>
            <label style={styles.label}>GRN Number</label>
            <input
              list="qc-receiving-grn-options"
              value={grnSearch}
              onChange={(event) => handleGrnChange(event.target.value)}
              style={styles.input}
              placeholder="Type or choose GRN Number"
            />
            <datalist id="qc-receiving-grn-options">
              {inbounds.map((item) => (
                <option key={item.id} value={item.grn_number} />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Koli / Sample</label>
              <select
                value={selectedSourceKey}
                onChange={(event) => handleSourceChange(event.target.value)}
                style={{ ...styles.select, ...(!selectedInboundId ? styles.selectDisabled : {}) }}
                disabled={!selectedInboundId}
              >
                <option value="">{selectedInboundId ? 'Choose Koli / Sample' : 'Choose GRN first'}</option>
                {sourceOptions.map((row) => (
                  <option
                    key={row.key}
                    value={row.key}
                    style={
                      getSourceStatus(row, qcItems) === 'completed'
                        ? { color: '#166534', backgroundColor: '#f0fdf4', fontWeight: '700' }
                        : undefined
                    }
                  >
                    {getSourceStatus(row, qcItems) === 'completed' ? `DONE - ${row.label}` : row.label}
                  </option>
                ))}
              </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Barang</label>
            <div style={styles.readonlyBox}>{selectedInbound?.item_name || '-'}</div>
          </div>
        </div>

        {selectedSource ? (
          <>
            <div style={styles.sourceList}>
              {sourceOptions.map((row) => {
                const rowStatus = getSourceStatus(row, qcItems)
                const isActive = row.key === selectedSourceKey

                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => handleSourceChange(row.key)}
                    style={{
                      ...styles.sourceChip,
                      ...(!selectedInboundId ? styles.sourceChipDisabled : {}),
                      ...(rowStatus === 'completed' ? styles.sourceChipDone : {}),
                      ...(isActive ? (rowStatus === 'completed' ? styles.sourceChipDoneActive : styles.sourceChipActive) : {}),
                    }}
                    disabled={!selectedInboundId}
                  >
                    {row.label}
                  </button>
                )
              })}
            </div>

            {isSelectedSourceCompleted ? (
              <div style={styles.sourceStatusBanner}>
                <span>KOLI SUDAH SELESAI DIQC</span>
                <button
                  type="button"
                  onClick={() => setSourceDetailsExpanded((prev) => !prev)}
                  style={styles.secondaryButton}
                >
                  {sourceDetailsExpanded ? 'Collapse Detail' : 'Expand Detail'}
                </button>
              </div>
            ) : null}

            {sourceDetailsExpanded ? modelRows.map((row) => (
              <div key={row.id} style={styles.modelRow}>
                <div style={rowTopGridStyle}>
                {row.photo_url ? (
                  <Image
                    src={row.photo_url}
                    alt={row.model_name || 'QC model'}
                    width={84}
                    height={84}
                    unoptimized
                    style={styles.thumb}
                  />
                ) : (
                  <div style={styles.thumbEmpty}>NO PHOTO</div>
                )}

                <div style={{ ...styles.modelMeta, ...(isMobileLayout ? { gridColumn: '2 / -1' } : {}) }}>
                  <div style={styles.modelName}>{row.model_name || 'Choose model'}</div>
                  <p style={styles.infoText}>{row.model_color || 'NO COLOR'}</p>
                  <div style={styles.buttonRow}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModelRowId(row.id)
                        setShowChooseModelModal(true)
                      }}
                      style={{ ...styles.iconButton, ...(hasSavedPlan ? styles.iconButtonDisabled : {}) }}
                      disabled={hasSavedPlan}
                      title="Choose model"
                      aria-label="Choose model"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeModelRow(row.id)}
                      style={{
                        ...styles.iconButton,
                        ...(hasSavedPlan ||
                        modelRows.length === 1 ||
                        (row.allocations || []).some((split) => Number(split.locked_qty || 0) > 0)
                          ? styles.iconButtonDisabled
                          : {}),
                      }}
                      disabled={
                        hasSavedPlan ||
                        modelRows.length === 1 ||
                        (row.allocations || []).some((split) => Number(split.locked_qty || 0) > 0)
                      }
                      title="Remove row"
                      aria-label="Remove row"
                    >
                      x
                    </button>
                  </div>
                </div>

                <div style={{ ...styles.field, ...(isMobileLayout ? { gridColumn: '1 / -1' } : {}) }}>
                  <label style={styles.label}>Inbound Qty</label>
                  <div style={styles.readonlyBox}>{row.qty_in || 0}</div>
                </div>

                <div style={{ ...styles.field, ...(isMobileLayout ? { gridColumn: '1 / -1' } : {}) }}>
                  <label style={styles.label}>QC In</label>
                  <input
                    type="number"
                    min="0"
                    value={row.qty_qc}
                    onChange={(event) =>
                      updateModelRow(row.id, {
                        qty_qc: event.target.value,
                      })
                    }
                    style={{ ...styles.input, ...(hasSavedPlan ? styles.inputDisabled : {}) }}
                    disabled={hasSavedPlan}
                  />
                </div>
                </div>

                <div style={{ ...styles.field, ...styles.allocationWrap }}>
                  <label style={styles.label}>Allocation</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(row.allocations || []).map((split) => (
                      <div key={split.id} style={allocationGridStyle}>
                        <select
                          value={split.member_email || ''}
                          onChange={(event) => updateAllocationSplit(row.id, split.id, { member_email: event.target.value })}
                          style={{
                            ...styles.select,
                            ...(isSelectedSourceStarted || (split.existing_status && split.existing_status !== 'queued') ? styles.selectDisabled : {}),
                          }}
                          disabled={isSelectedSourceStarted || (split.existing_status && split.existing_status !== 'queued')}
                        >
                          <option value="">Choose inspector</option>
                          {qcMembers
                            .filter(
                              (member) =>
                                member.email === split.member_email ||
                                !(row.allocations || []).some(
                                  (allocation) =>
                                    allocation.id !== split.id && allocation.member_email === member.email
                                )
                            )
                            .map((member) => (
                              <option key={member.id} value={member.email}>
                                {member.display_name || member.email}
                              </option>
                            ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          value={split.qty || ''}
                          onFocus={(event) => {
                            event.target.select()
                          }}
                          onChange={(event) =>
                            updateAllocationSplit(row.id, split.id, {
                              qty: event.target.value,
                            })
                          }
                          onBlur={(event) => {
                            const otherTotal = (row.allocations || [])
                              .filter((item) => item.id !== split.id)
                              .reduce((sum, item) => sum + Number(item.qty || 0), 0)
                            const minAllowed = Number(split.locked_qty || 0)
                            const maxAllowed = Math.max(minAllowed, Number(row.qty_qc || 0) - otherTotal)
                            const rawValue = event.target.value

                            if (rawValue === '') {
                              updateAllocationSplit(row.id, split.id, {
                                qty: minAllowed > 0 ? String(minAllowed) : '',
                              })
                              return
                            }

                            const nextValue = Number(rawValue || 0)
                            updateAllocationSplit(row.id, split.id, {
                              qty: String(Math.max(minAllowed, Math.min(nextValue, maxAllowed))),
                            })
                          }}
                          style={{
                            ...styles.input,
                            ...(isSelectedSourceStarted || Boolean(split.existing_status && split.existing_status !== 'queued') ? styles.inputDisabled : {}),
                          }}
                          disabled={isSelectedSourceStarted || Boolean(split.existing_status && split.existing_status !== 'queued')}
                          placeholder="Qty"
                        />
                        <button
                          type="button"
                          onClick={() => removeAllocationSplit(row.id, split.id)}
                          style={{
                            ...styles.secondaryButton,
                            ...(isMobileLayout ? { width: '100%' } : {}),
                            ...(isSelectedSourceStarted ||
                            Number(split.locked_qty || 0) > 0 ||
                            (split.existing_status && split.existing_status !== 'queued')
                              ? styles.buttonDisabled
                              : {}),
                          }}
                          disabled={
                            isSelectedSourceStarted ||
                            Number(split.locked_qty || 0) > 0 ||
                            (split.existing_status && split.existing_status !== 'queued')
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={styles.helperText}>
                        Allocated: {(row.allocations || []).reduce((sum, split) => sum + Number(split.qty || 0), 0)} / {Number(row.qty_qc || 0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => addAllocationSplit(row.id)}
                        style={{ ...styles.secondaryButton, ...(isSelectedSourceStarted ? styles.buttonDisabled : {}) }}
                        disabled={isSelectedSourceStarted}
                      >
                        Allocate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )) : null}

            {sourceDetailsExpanded ? (
            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={addModelRow}
                style={{ ...styles.secondaryButton, ...(hasSavedPlan ? styles.buttonDisabled : {}) }}
                disabled={hasSavedPlan}
              >
                + Add Model Row
              </button>
            </div>
            ) : null}

            {sourceDetailsExpanded ? (
            <div>
              <h3 style={styles.sectionTitle}>Model Allocation</h3>
              <p style={styles.sectionSubtitle}>
                Each model row can be allocated to one or more inspectors. Allocated qty may be less than QC In, but it cannot be more.
              </p>
              <p style={styles.sectionSubtitle}>
                After QC has started, allocation stays as the original plan so any allocation gap remains visible for planner KPI.
              </p>
            </div>
            ) : null}

            {!qcMembers.length ? (
              <p style={styles.emptyText}>
                No active QC user found with permission `qc.inspection.do` for today. Activate QC task from Grading Task or User Access.
              </p>
            ) : null}

            <div style={summaryGridStyle}>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Inbound Qty</span>
                <strong style={styles.summaryValue}>
                  {selectedSourceRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)}
                </strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>QC In</span>
                <strong style={styles.summaryValue}>{qcInQty}</strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>QC Assigned Qty</span>
                <strong style={styles.summaryValue}>{allocationTotal}</strong>
              </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Selected</span>
                  <strong style={styles.summaryValue}>{selectedSource?.label || '-'}</strong>
                </div>
              </div>
            </>
          ) : (
            <p style={styles.emptyText}>Choose GRN and Koli/Sample first to start QC planning.</p>
          )}
        </>
        )}

        <div style={bottomBarStyle}>
          {error ? <p style={styles.errorText}>{error}</p> : null}
          {success ? <p style={styles.successText}>{success}</p> : null}
          <button
            type="button"
            onClick={handleSavePlan}
            disabled={
              saving ||
              (qcMode === 'arkline'
                ? !modelRows.length || isSelectedSourceStarted
                : !selectedSource || isSelectedSourceStarted)
            }
            style={{
              ...styles.primaryButton,
              ...(isMobileLayout ? { width: '100%' } : {}),
              ...(
                saving ||
                (qcMode === 'arkline'
                  ? !modelRows.length || isSelectedSourceStarted
                  : !selectedSource || isSelectedSourceStarted)
                  ? styles.buttonDisabled
                  : {}
              ),
            }}
          >
            {saving ? 'Saving...' : 'Save QC Plan'}
          </button>
        </div>
      </div>

      {showChooseModelModal ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>Choose Model</h2>
              <p style={styles.sectionSubtitle}>Select the model from the photo list. If it does not exist yet, add a new one.</p>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Search Model</label>
              <input
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                style={styles.input}
                placeholder="Type model name"
              />
            </div>

            <div style={styles.modalGrid}>
              {modelOptions.map((item) => {
                const label = item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (activeModelRowId) {
                        updateModelRow(activeModelRowId, {
                          model_id: String(item.id),
                          model_name: item.model_name,
                          model_color: item.model_color || '',
                          photo_url: item.photo_url || '',
                        })
                      }
                      setShowChooseModelModal(false)
                    }}
                    style={styles.modelCardButton}
                  >
                    {item.photo_url ? (
                      <Image
                        src={item.photo_url}
                        alt={label}
                        width={170}
                        height={120}
                        unoptimized
                        style={{ ...styles.thumb, width: '100%', height: '120px' }}
                      />
                    ) : (
                      <div style={{ ...styles.thumbEmpty, width: '100%', height: '120px' }}>NO PHOTO</div>
                    )}
                    <strong>{item.model_name}</strong>
                    <span>{item.model_color || 'NO COLOR'}</span>
                  </button>
                )
              })}
            </div>

            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setShowModelModal(true)} style={styles.secondaryButton}>
                + Add New Model
              </button>
              <button type="button" onClick={() => setShowChooseModelModal(false)} style={styles.secondaryButton}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showModelModal ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>Add New Model</h2>
              <p style={styles.sectionSubtitle}>Save a missing model from QC.</p>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Nama Model</label>
              <input
                value={modelDraft.model_name}
                onChange={(event) =>
                  setModelDraft((prev) => ({
                    ...prev,
                    model_name: event.target.value.toUpperCase(),
                  }))
                }
                style={styles.input}
                placeholder="MODEL NAME"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Warna Model</label>
              <input
                value={modelDraft.model_color}
                onChange={(event) =>
                  setModelDraft((prev) => ({
                    ...prev,
                    model_color: event.target.value.toUpperCase(),
                  }))
                }
                style={styles.input}
                placeholder="MODEL COLOR"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Foto Produk</label>
              <input type="file" accept="image/*" capture="environment" onChange={handleModelPhotoChange} style={styles.input} />
            </div>

            {modelModalError ? <p style={styles.errorText}>{modelModalError}</p> : null}

            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setShowModelModal(false)} style={styles.secondaryButton}>
                Cancel
              </button>
              <button type="button" onClick={handleSaveModel} style={styles.primaryButton}>
                Save Model
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

