'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'
import styles from '../../arkline.module.css'
import progressStyles from '../../progress-overview/progress-overview.module.css'
import useArklineAccess from '../../use-arkline-access'
import {
  buildSizeBreakdown,
  createGarmentPurchaseOrderPreviewHtml,
  createMaterialPurchaseOrderPreviewHtml,
  fetchGarmentPoBundle,
  fetchMaterialPoBundle,
  formatCurrency,
  formatDate,
  formatQuantity,
  getLineTotalQty,
  getStatusTone,
  normalizeBoolean,
  normalizeStatusLabel,
  openPreviewWindow,
  toNumber,
} from '../po-directory-utils'

const supabase = createClient()
const PPN_RATE = 0.11
const ARKLINE_PO_BUCKET = 'arkline-po'
const PAYMENT_REQUEST_BUCKET = 'arkline-payments'
const PO_TYPES = [
  { id: 'garment', label: 'Garment' },
  { id: 'material', label: 'Material' },
]

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 4.75A2.75 2.75 0 0 1 7.75 2h8.5A2.75 2.75 0 0 1 19 4.75v14.5A2.75 2.75 0 0 1 16.25 22h-8.5A2.75 2.75 0 0 1 5 19.25V4.75Zm2.75-.25a.25.25 0 0 0-.25.25v14.5c0 .14.11.25.25.25h8.5c.14 0 .25-.11.25-.25V4.75a.25.25 0 0 0-.25-.25h-8.5Zm1 3.25c0-.41.34-.75.75-.75h5c.41 0 .75.34.75.75s-.34.75-.75.75h-5a.75.75 0 0 1-.75-.75Zm0 3.5c0-.41.34-.75.75-.75h5c.41 0 .75.34.75.75s-.34.75-.75.75h-5a.75.75 0 0 1-.75-.75Zm0 3.5c0-.41.34-.75.75-.75h3c.41 0 .75.34.75.75s-.34.75-.75.75h-3a.75.75 0 0 1-.75-.75Z" />
    </svg>
  )
}

function PrintMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={progressStyles.actionIcon}>
      <path
        d="M7 9V4.8h10V9M7.2 14.5H6.4A2.4 2.4 0 0 1 4 12.1V9.9a2.4 2.4 0 0 1 2.4-2.4h11.2A2.4 2.4 0 0 1 20 9.9v2.2a2.4 2.4 0 0 1-2.4 2.4h-.8M8 12.5h8v6.7H8zM16.6 10.8h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function PlusMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={progressStyles.actionIcon}>
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function AttachmentMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={progressStyles.actionIcon}>
      <path
        d="M8.5 12.3 13 7.8a3 3 0 0 1 4.2 4.2l-6.1 6.1a4.2 4.2 0 0 1-5.9-5.9l6.5-6.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function ChevronIcon({ expanded }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={progressStyles.chevronIcon}>
      <path
        d={expanded ? 'M7 14l5-5 5 5' : 'M9 7l5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  )
}

function comparePoNumber(left, right) {
  return String(left?.poNumber || '').localeCompare(String(right?.poNumber || ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

function getPercentVariance(orderedQty, receivedQty) {
  if (orderedQty <= 0) return { label: 'Shortship', value: '0%' }
  const deltaPct = Math.abs(((receivedQty - orderedQty) / orderedQty) * 100)
  return {
    label: receivedQty > orderedQty ? 'Overship' : 'Shortship',
    value: `${deltaPct.toFixed(1)}%`,
  }
}

function getFinanceQtyForReportLine(line) {
  return String(line?.status || '').trim().toUpperCase() === 'INITIATED' ? toNumber(line.primaryQty) : toNumber(line.secondaryQty)
}

function applyPpnToAmount(value, includePpn) {
  const amount = toNumber(value)
  return roundCurrencyValue(normalizeBoolean(includePpn, true) ? amount * (1 + PPN_RATE) : amount)
}

function roundCurrencyValue(value) {
  const amount = toNumber(value)
  return Number.isFinite(amount) ? Math.round(amount) : 0
}

function getFinanceOutstandingValue(dueValue, paidValue) {
  return Math.max(roundCurrencyValue(dueValue) - roundCurrencyValue(paidValue), 0)
}

function getReportLineGroups(lines, type) {
  if (type !== 'garment') return [{ key: 'active', title: 'Material Lines', items: lines }]

  const completed = []
  const active = []

  ;(lines || []).forEach((line) => {
    if (String(line?.status || '').trim().toUpperCase() === 'COMPLETED') {
      completed.push(line)
    } else {
      active.push(line)
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

function normalizeReportPaymentRow(row) {
  return {
    id: String(row?.id || '').trim(),
    invoiceNumber: String(row?.invoice_number || '').trim().toUpperCase(),
    amount: toNumber(row?.amount),
    notes: String(row?.notes || '').trim(),
    status: String(row?.status || '').trim().toUpperCase(),
    paidAt: row?.paid_at || '',
    createdAt: row?.created_at || '',
    attachments: Array.isArray(row?.attachments) ? row.attachments.map(normalizeReportPaymentAttachmentRow) : [],
  }
}

function normalizeReportPaymentAttachmentRow(row) {
  return {
    id: String(row?.id || '').trim(),
    storageBucket: String(row?.storage_bucket || PAYMENT_REQUEST_BUCKET).trim(),
    storagePath: String(row?.storage_path || '').trim(),
    fileName: String(row?.file_name || 'Attachment').trim(),
    createdAt: row?.created_at || '',
  }
}

function getReportPaymentAttachmentKind(attachment) {
  return String(attachment?.storagePath || '').includes('/payment-proof/') ? 'PAYMENT_PROOF' : 'SUBMISSION_PROOF'
}

function getReportPaymentAttachmentsByKind(payment, kind) {
  return (payment?.attachments || []).filter((attachment) => getReportPaymentAttachmentKind(attachment) === kind)
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
    existing.qty += toNumber(row?.received_qty)
    grouped.set(key, existing)
  })

  return Array.from(grouped.values()).sort((left, right) => {
    const leftTime = new Date(left.receiveDate).getTime() || 0
    const rightTime = new Date(right.receiveDate).getTime() || 0
    if (leftTime !== rightTime) return rightTime - leftTime
    return left.key.localeCompare(right.key, undefined, { numeric: true })
  })
}

function sanitizeStorageFileName(value) {
  return (
    String(value || 'file')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120) || 'file'
  )
}

function getArklinePoStorageFolder(poNumber) {
  return `Arkline PO/${sanitizeStorageFileName(poNumber || 'PO')}`
}

function getSignedPoStorageFolder(poNumber) {
  return `${getArklinePoStorageFolder(poNumber)}/Signed PO`
}

function normalizeSignedPoStorageObject(row, folder) {
  if (!row || row.id === null || !row.name || row.name === '.emptyFolderPlaceholder') return null
  const fileName = String(row.name || 'Signed PO').trim()
  return {
    id: String(row.id || `${folder}/${fileName}`).trim(),
    storageBucket: ARKLINE_PO_BUCKET,
    storagePath: `${folder}/${fileName}`,
    fileName,
    mimeType: String(row.metadata?.mimetype || row.metadata?.mimeType || '').trim(),
    createdAt: row.created_at || row.updated_at || '',
  }
}

async function loadSignedPoFiles(supabaseClient, poNumber) {
  const folder = getSignedPoStorageFolder(poNumber)
  const { data, error } = await supabaseClient.storage.from(ARKLINE_PO_BUCKET).list(folder, {
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

function formatDateTime(value) {
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

async function fetchReportPayments(supabaseClient, row) {
  const poSourceType = row?.type === 'garment' ? 'GARMENT' : 'MATERIAL'
  const paymentRows = await loadOptionalRows(() =>
    supabaseClient
      .from('arkline_payment')
      .select(
        `id, payment_basis, po_source_type, po_number, invoice_number, amount, notes, status, paid_at, created_at,
        attachments:arkline_payment_attachments(id, storage_bucket, storage_path, file_name, mime_type, file_size, uploaded_by, created_at)`
      )
      .eq('payment_basis', 'PO_BASED')
      .eq('po_source_type', poSourceType)
      .eq('po_number', row.poNumber)
      .order('created_at', { ascending: false })
  )

  return paymentRows.map(normalizeReportPaymentRow)
}

async function fetchReportDocumentHistory(supabaseClient, row, bundle) {
  const signedPoFiles = await loadSignedPoFiles(supabaseClient, row?.poNumber)

  if (row?.type !== 'garment') {
    return {
      receipts: [],
      signedPoFiles,
    }
  }

  const itemIds = (bundle?.items || []).map((item) => String(item?.id || '').trim()).filter(Boolean)
  const receiptRows = itemIds.length
    ? await loadOptionalRows(() =>
        supabaseClient
          .from('arkline_po_item_receipts')
          .select('id, arkline_po_item_id, receipt_group_id, receive_date, supplier_sj, received_qty, created_at')
          .in('arkline_po_item_id', itemIds)
          .eq('receipt_type', 'INITIAL')
          .order('receive_date', { ascending: false })
      )
    : []

  return {
    receipts: buildReceiptDocumentRows(receiptRows),
    signedPoFiles,
  }
}


function summarizeGarmentItems(itemRows) {
  return (itemRows || []).reduce((accumulator, item) => {
    const poId = String(item?.po_id || '').trim().toUpperCase()
    if (!poId) return accumulator

    if (!accumulator[poId]) {
      accumulator[poId] = {
        itemCount: 0,
        totalQty: 0,
        actualQty: 0,
        amount: 0,
        firstItem: '',
        itemLabels: [],
        itemKeywords: [],
      }
    }

    const qty = toNumber(item?.total_qty)
    const actualQty = toNumber(item?.actual_qty)
    const price = toNumber(item?.price ?? item?.hpp)
    const label = String(item?.nama_produk || item?.sku_induk || '').trim().toUpperCase()

    accumulator[poId].itemCount += 1
    accumulator[poId].totalQty += qty
    accumulator[poId].actualQty += actualQty
    accumulator[poId].amount += qty * price
    if (!accumulator[poId].firstItem) accumulator[poId].firstItem = label
    if (label) accumulator[poId].itemLabels.push(label)
    accumulator[poId].itemKeywords.push(label, String(item?.sku_induk || '').trim().toUpperCase())

    return accumulator
  }, {})
}

function summarizeMaterialItems(itemRows) {
  return (itemRows || []).reduce((accumulator, item) => {
    const poNumber = String(item?.material_po_number || '').trim().toUpperCase()
    if (!poNumber) return accumulator

    if (!accumulator[poNumber]) {
      accumulator[poNumber] = {
        itemCount: 0,
        totalQty: 0,
        amount: 0,
        firstItem: '',
        itemKeywords: [],
      }
    }

    const label = String(item?.material_name_snapshot || '').trim().toUpperCase()
    accumulator[poNumber].itemCount += 1
    accumulator[poNumber].totalQty += toNumber(item?.qty)
    accumulator[poNumber].amount += toNumber(item?.amount) || toNumber(item?.qty) * toNumber(item?.price)
    if (!accumulator[poNumber].firstItem) accumulator[poNumber].firstItem = label
    accumulator[poNumber].itemKeywords.push(label)

    return accumulator
  }, {})
}

function normalizeGarmentPo(row, summary) {
  return {
    type: 'garment',
    id: String(row?.id || '').trim(),
    poNumber: String(row?.po_id || '').trim().toUpperCase(),
    supplierName: String(row?.supplier_name || '').trim().toUpperCase(),
    secondary: String(row?.method || '').trim().toUpperCase(),
    status: String(row?.status || 'Initiated').trim(),
    requestDeliveryDate: row?.request_delivery_date || '',
    createdAt: row?.created_at || '',
    includePpn: normalizeBoolean(row?.include_ppn, true),
    itemCount: summary?.itemCount || 0,
    totalQty: summary?.totalQty || 0,
    actualQty: summary?.actualQty || 0,
    amount: summary?.amount || 0,
    firstItem: summary?.firstItem || '',
    itemLabels: summary?.itemLabels || [],
    itemKeywords: (summary?.itemKeywords || []).join(' '),
  }
}

function normalizeMaterialPo(row, summary) {
  return {
    type: 'material',
    id: String(row?.id || '').trim(),
    poNumber: String(row?.material_po_number || '').trim().toUpperCase(),
    supplierName: String(row?.supplier_name_snapshot || '').trim().toUpperCase(),
    secondary: String(row?.garment_po_number || 'No PO').trim().toUpperCase(),
    status: String(row?.status || 'ORDERED').trim(),
    requestDeliveryDate: row?.request_delivery_date || '',
    createdAt: row?.created_at || '',
    includePpn: normalizeBoolean(row?.include_ppn, true),
    orderedAs: String(row?.ordered_as || '').trim().toUpperCase(),
    itemCount: summary?.itemCount || 0,
    totalQty: summary?.totalQty || 0,
    actualQty: 0,
    amount: summary?.amount || 0,
    firstItem: summary?.firstItem || '',
    itemKeywords: (summary?.itemKeywords || []).join(' '),
  }
}

function buildGarmentPrintBundle(bundle) {
  const supplierContact = [bundle.supplier?.contactPerson, bundle.supplier?.phone].filter(Boolean).join(' | ')

  return {
    poId: String(bundle.po?.po_id || '').trim().toUpperCase(),
    method: String(bundle.po?.method || '').trim().toUpperCase(),
    poCreatedAt: bundle.po?.created_at,
    header: {
      supplierName: bundle.supplier?.supplierName || String(bundle.po?.supplier_name || '').trim().toUpperCase() || '-',
      supplierAddress: bundle.supplier?.address || '',
      supplierContact,
      requestDeliveryDate: bundle.po?.request_delivery_date || '',
      paymentTerms: String(bundle.po?.payment_terms || bundle.po?.method || '').trim(),
      notes: String(bundle.po?.notes || '').trim(),
      includePpn: normalizeBoolean(bundle.po?.include_ppn, true),
    },
    items: bundle.items,
  }
}

function buildMaterialPrintBundle(bundle) {
  const supplierContact = [bundle.supplier?.contactPerson, bundle.supplier?.phone].filter(Boolean).join(' | ')

  return {
    poNumber: String(bundle.po?.material_po_number || '').trim().toUpperCase(),
    createdAt: bundle.po?.created_at,
    header: {
      supplierName: bundle.supplier?.supplierName || String(bundle.po?.supplier_name_snapshot || '').trim().toUpperCase() || '-',
      supplierAddress: bundle.supplier?.address || '',
      supplierContact,
      requestDeliveryDate: bundle.po?.request_delivery_date || '',
      paymentTerms: String(bundle.po?.payment_terms || '').trim(),
      notes: String(bundle.po?.notes || '').trim(),
      includePpn: normalizeBoolean(bundle.po?.include_ppn, true),
      orderedAs: String(bundle.po?.ordered_as || '').trim().toUpperCase(),
    },
    items: bundle.items,
  }
}

export default function ArklinePurchaseOrderDirectoryPage() {
  const { access } = useArklineAccess()
  const canViewPurchaseOrder = access.directoryPurchaseOrders
  const canPrintPurchaseOrder = access.directoryPurchaseOrdersPrint
  const [activeType, setActiveType] = useState('garment')
  const [garmentRows, setGarmentRows] = useState([])
  const [materialRows, setMaterialRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [poSearch, setPoSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [printingPoNumber, setPrintingPoNumber] = useState('')
  const [reportRow, setReportRow] = useState(null)
  const [reportBundle, setReportBundle] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [uploadingReportSignedPo, setUploadingReportSignedPo] = useState(false)
  const [reportSections, setReportSections] = useState({
    productLists: true,
    finance: false,
    documentHistory: false,
  })

  const canPrintGarment = canPrintPurchaseOrder
  const canPrintMaterial = canPrintPurchaseOrder
  const rows = activeType === 'garment' ? garmentRows : materialRows
  const itemFilterLabel = activeType === 'garment' ? 'Product' : 'Material'

  const loadPurchaseOrders = useCallback(async function loadPurchaseOrders() {
    if (!canViewPurchaseOrder) {
      setGarmentRows([])
      setMaterialRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [garmentPoResponse, materialPoResponse] = await Promise.all([
        supabase.from('arkline_pos').select('*').not('po_id', 'is', null),
        supabase.from('arkline_po_material_ordered').select('*').not('material_po_number', 'is', null),
      ])

      if (garmentPoResponse.error) throw new Error(garmentPoResponse.error.message)
      if (materialPoResponse.error) throw new Error(materialPoResponse.error.message)

      const garmentPoIds = (garmentPoResponse.data || []).map((item) => String(item?.po_id || '').trim().toUpperCase()).filter(Boolean)
      const materialPoNumbers = (materialPoResponse.data || []).map((item) => String(item?.material_po_number || '').trim().toUpperCase()).filter(Boolean)

      const [garmentItemsResponse, materialItemsResponse] = await Promise.all([
        garmentPoIds.length > 0
          ? supabase.from('arkline_po_items').select('id, po_id, sku_induk, nama_produk, total_qty, actual_qty, price, hpp').in('po_id', garmentPoIds)
          : { data: [], error: null },
        materialPoNumbers.length > 0
          ? supabase
              .from('arkline_po_material_ordered_items')
              .select('id, material_po_number, material_name_snapshot, qty, price, amount')
              .in('material_po_number', materialPoNumbers)
          : { data: [], error: null },
      ])

      if (garmentItemsResponse.error) throw new Error(garmentItemsResponse.error.message)
      if (materialItemsResponse.error) throw new Error(materialItemsResponse.error.message)

      const garmentSummary = summarizeGarmentItems(garmentItemsResponse.data)
      const materialSummary = summarizeMaterialItems(materialItemsResponse.data)

      setGarmentRows(
        (garmentPoResponse.data || [])
          .map((item) => normalizeGarmentPo(item, garmentSummary[String(item?.po_id || '').trim().toUpperCase()]))
          .filter((item) => item.poNumber)
          .sort(comparePoNumber)
      )
      setMaterialRows(
        (materialPoResponse.data || [])
          .map((item) => normalizeMaterialPo(item, materialSummary[String(item?.material_po_number || '').trim().toUpperCase()]))
          .filter((item) => item.poNumber)
          .sort(comparePoNumber)
      )
    } catch (loadError) {
      setGarmentRows([])
      setMaterialRows([])
      setError(loadError.message || 'Failed to load purchase orders.')
    } finally {
      setLoading(false)
    }
  }, [canViewPurchaseOrder])

  useEffect(() => {
    void loadPurchaseOrders()
  }, [loadPurchaseOrders])

  useEffect(() => {
    setSupplierFilter('all')
    setStatusFilter('all')
    setMethodFilter('all')
    setItemSearch('')
    setPoSearch('')
    setReportRow(null)
    setReportBundle(null)
    setError('')
    setSuccess('')
  }, [activeType])

  const supplierOptions = useMemo(
    () => Array.from(new Set(rows.map((item) => item.supplierName).filter(Boolean))).sort((left, right) => left.localeCompare(right, undefined, { numeric: true })),
    [rows]
  )

  const productOptions = useMemo(
    () =>
      Array.from(new Set(garmentRows.flatMap((item) => item.itemLabels || []).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true })
      ),
    [garmentRows]
  )

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((item) => String(item.status || '').trim()).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true })
      ),
    [rows]
  )

  const filteredRows = useMemo(() => {
    const poKeyword = poSearch.trim().toUpperCase()
    const itemKeyword = itemSearch.trim().toUpperCase()

    return rows
      .filter((item) => {
        const matchesPo =
          !poKeyword ||
          [item.poNumber, item.secondary, item.supplierName, item.status]
            .filter(Boolean)
            .join(' ')
            .toUpperCase()
            .includes(poKeyword)
        const matchesItem =
          activeType === 'garment'
            ? !itemKeyword || (item.itemLabels || []).includes(itemKeyword)
            : !itemKeyword || [item.firstItem, item.itemKeywords].filter(Boolean).join(' ').toUpperCase().includes(itemKeyword)
        const matchesMethod = activeType !== 'garment' || methodFilter === 'all' || item.secondary === methodFilter
        const matchesSupplier = supplierFilter === 'all' || item.supplierName === supplierFilter
        const matchesStatus = statusFilter === 'all' || String(item.status || '').trim() === statusFilter
        return matchesPo && matchesItem && matchesMethod && matchesSupplier && matchesStatus
      })
      .sort(comparePoNumber)
  }, [activeType, itemSearch, methodFilter, poSearch, rows, statusFilter, supplierFilter])

  async function handleViewReport(row) {
    setReportLoading(true)
    setReportRow(row)
    setReportBundle(null)
    setReportSections({
      productLists: true,
      finance: false,
      documentHistory: false,
    })
    setError('')
    setSuccess('')

    try {
      const bundle = row.type === 'garment' ? await fetchGarmentPoBundle(supabase, row.poNumber) : await fetchMaterialPoBundle(supabase, row.poNumber)
      const payments = await fetchReportPayments(supabase, row)
      const documentHistory = await fetchReportDocumentHistory(supabase, row, bundle)
      setReportBundle({ ...bundle, payments, documentHistory })
    } catch (viewError) {
      setReportRow(null)
      setError(viewError.message || 'Failed to load purchase order report.')
    } finally {
      setReportLoading(false)
    }
  }

  function closeReport() {
    setReportRow(null)
    setReportBundle(null)
    setReportLoading(false)
    setUploadingReportSignedPo(false)
  }

  function toggleReportSection(sectionKey) {
    setReportSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }))
  }

  async function handlePrint(row) {
    if (row.type === 'garment' && !canPrintGarment) return
    if (row.type === 'material' && !canPrintMaterial) return

    setPrintingPoNumber(row.poNumber)
    setError('')
    setSuccess('')

    let previewWindow = null

    try {
      previewWindow = openPreviewWindow('Preparing purchase order preview...')
      const bundle = row.type === 'garment' ? await fetchGarmentPoBundle(supabase, row.poNumber) : await fetchMaterialPoBundle(supabase, row.poNumber)
      const previewHtml =
        row.type === 'garment'
          ? await createGarmentPurchaseOrderPreviewHtml(buildGarmentPrintBundle(bundle))
          : await createMaterialPurchaseOrderPreviewHtml(buildMaterialPrintBundle(bundle))

      previewWindow.document.open()
      previewWindow.document.write(previewHtml)
      previewWindow.document.close()
      setSuccess(`${row.type === 'garment' ? 'Garment' : 'Material'} PO ${row.poNumber} print preview opened.`)
    } catch (printError) {
      previewWindow?.close()
      setError(printError.message || 'Failed to prepare purchase order print preview.')
    } finally {
      setPrintingPoNumber('')
    }
  }

  async function openReportPaymentAttachment(attachment) {
    const storageBucket = String(attachment?.storageBucket || PAYMENT_REQUEST_BUCKET).trim()
    const storagePath = String(attachment?.storagePath || '').trim()
    if (!storageBucket || !storagePath) return

    const { data, error: signedUrlError } = await supabase.storage.from(storageBucket).createSignedUrl(storagePath, 300)
    if (signedUrlError) {
      setError(signedUrlError.message || 'Failed to open attachment.')
      return
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  async function openReportSignedPoAttachment(attachment) {
    const storagePath = String(attachment?.storagePath || '').trim()
    if (!storagePath) return

    const { data, error: signedUrlError } = await supabase.storage.from(ARKLINE_PO_BUCKET).createSignedUrl(storagePath, 300)
    if (signedUrlError) {
      setError(signedUrlError.message || 'Failed to open signed PO.')
      return
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  async function handleReportSignedPoUpload(files) {
    if (!reportRow || !reportBundle || uploadingReportSignedPo) return
    const uploadFiles = Array.from(files || []).filter(Boolean)
    if (!uploadFiles.length) return

    setUploadingReportSignedPo(true)
    setError('')
    setSuccess('')
    const uploadedPaths = []

    try {
      const folder = getSignedPoStorageFolder(reportRow.poNumber)
      for (const file of uploadFiles) {
        const safeName = sanitizeStorageFileName(file.name || 'signed-po')
        const filePath = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from(ARKLINE_PO_BUCKET).upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })
        if (uploadError) throw new Error(uploadError.message || `Failed to upload ${file.name || 'signed PO'}.`)
        uploadedPaths.push(filePath)
      }

      const signedPoFiles = await loadSignedPoFiles(supabase, reportRow.poNumber)
      setReportBundle((current) =>
        current
          ? {
              ...current,
              documentHistory: {
                ...(current.documentHistory || {}),
                signedPoFiles,
              },
            }
          : current
      )
      setSuccess(`${uploadFiles.length} signed PO file(s) uploaded.`)
    } catch (uploadError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(ARKLINE_PO_BUCKET).remove(uploadedPaths)
      }
      setError(uploadError.message || 'Failed to upload signed PO.')
    } finally {
      setUploadingReportSignedPo(false)
    }
  }

  function resetFilters() {
    setPoSearch('')
    setItemSearch('')
    setMethodFilter('all')
    setSupplierFilter('all')
    setStatusFilter('all')
  }

  const canPrintActiveType = activeType === 'garment' ? canPrintGarment : canPrintMaterial
  const reportDetail = useMemo(() => {
    if (!reportRow || !reportBundle) return null

    if (reportRow.type === 'garment') {
      const lines = (reportBundle.items || []).map((line) => {
        const qty = getLineTotalQty(line)
        const receivedQty = toNumber(line.actualQty)
        const price = toNumber(line.price)
        const varianceQty = receivedQty - qty
        const variance = getPercentVariance(qty, receivedQty)

        return {
          key: line.id || line.skuInduk || line.namaProdukSnapshot,
          title: line.namaProdukSnapshot || 'NO PRODUCT',
          subtitle: line.skuInduk || 'NO SKU',
          status: normalizeStatusLabel(line.status),
          primaryQtyLabel: 'Ordered Qty',
          primaryQty: qty,
          secondaryQtyLabel: 'Received Qty',
          secondaryQty: receivedQty,
          varianceLabel: varianceQty > 0 ? 'Overship' : 'Shortship',
          varianceValue: variance.value,
          detail: buildSizeBreakdown(line.qtyBySize) || '-',
          price,
          amount: qty * price,
        }
      })
      const orderedQty = lines.reduce((sum, line) => sum + line.primaryQty, 0)
      const receivedQty = lines.reduce((sum, line) => sum + line.secondaryQty, 0)
      const variance = getPercentVariance(orderedQty, receivedQty)
      const dueNetValue = lines.reduce((sum, line) => sum + getFinanceQtyForReportLine(line) * line.price, 0)
      const dueValue = applyPpnToAmount(dueNetValue, reportRow.includePpn)
      const paidValue = (reportBundle.payments || [])
        .filter((row) => row.status === 'PAID')
        .reduce((sum, row) => sum + toNumber(row.amount), 0)

      return {
        type: 'garment',
        title: 'Product Lists',
        lines,
        orderedQty,
        receivedQty,
        varianceLabel: variance.label,
        varianceValue: variance.value,
        amount: lines.reduce((sum, line) => sum + line.amount, 0),
        finance: {
          dueValue,
          paidValue,
          outstandingValue: getFinanceOutstandingValue(dueValue, paidValue),
        },
        payments: reportBundle.payments || [],
      }
    }

    const lines = (reportBundle.items || []).map((line) => ({
      key: line.id || `${line.materialName}-${line.variant}`,
      title: line.materialName || 'NO MATERIAL',
      subtitle: [line.variant, line.unit].filter((value) => value && value !== '-').join(' / ') || '-',
      status: line.sourcePoId ? `Source ${line.sourcePoId}` : 'Free Material',
      primaryQtyLabel: 'Ordered Qty',
      primaryQty: toNumber(line.qty),
      secondaryQtyLabel: 'Price',
      secondaryQty: toNumber(line.price),
      varianceLabel: 'Notes',
      varianceValue: line.notes || '-',
      detail: line.notes || '-',
      price: toNumber(line.price),
      amount: toNumber(line.amount) || toNumber(line.qty) * toNumber(line.price),
    }))
    const dueNetValue = lines.reduce((sum, line) => sum + line.amount, 0)
    const dueValue = applyPpnToAmount(dueNetValue, reportRow.includePpn)
    const paidValue = (reportBundle.payments || [])
      .filter((row) => row.status === 'PAID')
      .reduce((sum, row) => sum + toNumber(row.amount), 0)

    return {
      type: 'material',
      title: 'Material Lists',
      lines,
      orderedQty: lines.reduce((sum, line) => sum + line.primaryQty, 0),
      receivedQty: lines.length,
      varianceLabel: 'PO Amount',
      varianceValue: formatCurrency(dueValue),
      amount: dueValue,
      finance: {
        dueValue,
        paidValue,
        outstandingValue: getFinanceOutstandingValue(dueValue, paidValue),
      },
      payments: reportBundle.payments || [],
    }
  }, [reportBundle, reportRow])

  if (!canViewPurchaseOrder) {
    return <div className={styles.emptyState}>Your account does not have Arkline purchase order access yet.</div>
  }

  return (
    <div className={styles.page}>
      <section className={styles.directorySection}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.sectionTitle}>Purchase Order</h1>
          </div>

          <button type="button" className={styles.secondaryButton} onClick={() => void loadPurchaseOrders()} disabled={loading}>
            Refresh
          </button>
        </div>

        <div className={styles.purchaseTypeBar}>
          {PO_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              className={`${styles.purchaseTypeButton} ${activeType === type.id ? styles.purchaseTypeButtonActive : ''}`.trim()}
              onClick={() => setActiveType(type.id)}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div
          className={`${styles.toolbar} ${
            activeType === 'garment' ? styles.purchaseOrderToolbarGarment : styles.purchaseOrderToolbar
          }`.trim()}
        >
          <div className={styles.field}>
            <input
              className={styles.input}
              value={poSearch}
              onChange={(event) => setPoSearch(event.target.value.toUpperCase())}
              placeholder="Search PO number"
            />
          </div>

          {activeType === 'garment' ? (
            <div className={styles.field}>
              <select className={styles.select} value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}>
                <option value="all">All methods</option>
                <option value="CMT">CMT</option>
                <option value="FOB">FOB</option>
              </select>
            </div>
          ) : null}

          <div className={styles.field}>
            {activeType === 'garment' ? (
              <select className={styles.select} value={itemSearch || 'all'} onChange={(event) => setItemSearch(event.target.value === 'all' ? '' : event.target.value)}>
                <option value="all">All products</option>
                {productOptions.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={styles.input}
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value.toUpperCase())}
                placeholder={`Filter ${itemFilterLabel.toLowerCase()}`}
              />
            )}
          </div>

          <div className={styles.field}>
            <select className={styles.select} value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
              <option value="all">All suppliers</option>
              {supplierOptions.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {normalizeStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.buttonRow}>
            <button type="button" className={styles.ghostButton} onClick={resetFilters}>
              Reset
            </button>
          </div>
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}
        {success ? <p className={styles.successText}>{success}</p> : null}

        {loading ? (
          <div className={styles.emptyState}>Loading purchase orders...</div>
        ) : !filteredRows.length ? (
          <div className={styles.emptyState}>No purchase order matches the current filters.</div>
        ) : (
          <div className={`${styles.listWrap} ${styles.directoryListWrap}`.trim()}>
            <div className={`${styles.listHead} ${styles.poArchiveListHead}`.trim()}>
              <span>PO Number</span>
              <span>Supplier</span>
              <span>{itemFilterLabel}</span>
              <span>Status</span>
              <span>Qty</span>
              <span>PO Amount</span>
              <span>Action</span>
            </div>

            {filteredRows.map((item) => {
              const statusTone = getStatusTone(item.status)
              return (
                <div key={`${item.type}-${item.poNumber}`} className={`${styles.listRow} ${styles.poArchiveListRow}`.trim()}>
                  <div>
                    <p className={styles.poArchiveNumber}>{item.poNumber}</p>
                    <p className={styles.cellMeta}>Created {formatDate(item.createdAt)}</p>
                  </div>
                  <div>
                    <p className={styles.cellTitle}>{item.supplierName || '-'}</p>
                    <p className={styles.cellMeta}>
                      {item.type === 'garment' ? item.secondary || '-' : item.secondary || 'No PO'}
                      {item.orderedAs ? ` / ${item.orderedAs}` : ''}
                    </p>
                  </div>
                  <div>
                    <strong>{item.firstItem || `${formatQuantity(item.itemCount)} item(s)`}</strong>
                    <p className={styles.cellMeta}>{formatQuantity(item.itemCount)} line(s)</p>
                  </div>
                  <div>
                    <span className={`${styles.poStatusPill} ${styles[`poStatusPill${statusTone}`] || styles.poStatusPillneutral}`.trim()}>
                      {normalizeStatusLabel(item.status)}
                    </span>
                  </div>
                  <div>
                    <strong>{formatQuantity(item.totalQty)}</strong>
                    {item.actualQty > 0 ? <p className={styles.cellMeta}>Actual {formatQuantity(item.actualQty)}</p> : null}
                  </div>
                  <div>{formatCurrency(item.amount)}</div>
                  <div className={`${styles.buttonRow} ${styles.poArchiveActions}`.trim()}>
                    <button
                      type="button"
                      className={styles.poIconButton}
                      onClick={() => void handleViewReport(item)}
                      disabled={reportLoading}
                      title="View PO detail"
                      aria-label={`View PO detail for ${item.poNumber}`}
                    >
                      <ReportIcon />
                    </button>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.directoryEditButton}`.trim()}
                      onClick={() => void handlePrint(item)}
                      disabled={!canPrintActiveType || printingPoNumber === item.poNumber}
                    >
                      {printingPoNumber === item.poNumber ? '...' : 'Print'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {reportRow ? (
        <div className={progressStyles.modalOverlay} onClick={closeReport}>
          <div className={progressStyles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={progressStyles.modalHeader}>
              <div>
                <p className={progressStyles.eyebrow}>PO Detail</p>
                <h3 className={progressStyles.modalTitle}>{reportRow.poNumber}</h3>
                <p className={progressStyles.modalMetaLine}>
                  {reportRow.supplierName || '-'}
                  {reportRow.secondary ? ` / ${reportRow.secondary}` : ''}
                </p>
                <p className={progressStyles.modalMetaLine}>
                  Request Delivery {formatDate(reportRow.requestDeliveryDate)} / {reportRow.includePpn ? 'With PPN' : 'Without PPN'}
                </p>
              </div>
              <button
                type="button"
                className={progressStyles.secondaryButton}
                onClick={closeReport}
              >
                Close
              </button>
            </div>

            {reportLoading || !reportBundle || !reportDetail ? (
              <div className={progressStyles.modalSection}>
                <div className={progressStyles.emptyMini}>Loading report...</div>
              </div>
            ) : (
              <>
                <div className={`${progressStyles.modalGrid} ${progressStyles.compactModalGrid}`.trim()}>
                  <div className={progressStyles.modalMetric}>
                    <span>Ordered Qty</span>
                    <strong>{formatQuantity(reportDetail.orderedQty)}</strong>
                  </div>
                  <div className={progressStyles.modalMetric}>
                    <span>{reportDetail.type === 'garment' ? 'Received Qty' : 'Line Count'}</span>
                    <strong>{formatQuantity(reportDetail.receivedQty)}</strong>
                  </div>
                  <div className={progressStyles.modalMetric}>
                    <span>{reportDetail.varianceLabel}</span>
                    <strong>{reportDetail.varianceValue}</strong>
                  </div>
                </div>

                <div className={progressStyles.modalSection}>
                  <div className={progressStyles.productDetailSectionHead}>
                    <h4 className={progressStyles.modalSectionTitle}>{reportDetail.title}</h4>
                    <button type="button" className={progressStyles.productDetailSectionToggle} onClick={() => toggleReportSection('productLists')}>
                      <ChevronIcon expanded={reportSections.productLists} />
                    </button>
                  </div>

                  {reportSections.productLists ? (
                    <div className={progressStyles.modalList}>
                      {(() => {
                        const groups = getReportLineGroups(reportDetail.lines, reportDetail.type).filter((group) => group.items.length)
                        if (!groups.length) return <div className={progressStyles.emptyMini}>No PO detail lines found.</div>

                        return groups.map((group) => (
                          <div
                            key={group.key}
                            className={`${progressStyles.modalListGroup} ${
                              progressStyles[`modalListGroup${group.key[0].toUpperCase()}${group.key.slice(1)}`]
                            }`.trim()}
                          >
                            <h5 className={progressStyles.modalListGroupTitle}>{group.title}</h5>
                            {group.items.map((line) => (
                              <div key={line.key} className={progressStyles.modalListRow}>
                                <div className={progressStyles.modalListIdentity}>
                                  <span>{line.status || '-'}</span>
                                  <strong>{line.title}</strong>
                                  <span>{line.subtitle}</span>
                                </div>
                                <div className={progressStyles.modalListMeta}>
                                  <div className={progressStyles.modalMetricCard}>
                                    <span>{line.primaryQtyLabel}</span>
                                    <strong>{formatQuantity(line.primaryQty)}</strong>
                                  </div>
                                  <div className={progressStyles.modalMetricCard}>
                                    <span>{line.secondaryQtyLabel}</span>
                                    <strong>
                                      {reportDetail.type === 'material' && line.secondaryQtyLabel === 'Price'
                                        ? formatCurrency(line.secondaryQty)
                                        : formatQuantity(line.secondaryQty)}
                                    </strong>
                                  </div>
                                  <div className={progressStyles.modalMetricCard}>
                                    <span>{reportDetail.type === 'material' ? 'Amount' : line.varianceLabel}</span>
                                    <strong>{reportDetail.type === 'material' ? formatCurrency(line.amount) : line.varianceValue}</strong>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))
                      })()}
                    </div>
                  ) : null}
                </div>

                <div className={progressStyles.modalSection}>
                  <div className={progressStyles.productDetailSectionHead}>
                    <h4 className={progressStyles.modalSectionTitle}>Finance</h4>
                    <button type="button" className={progressStyles.productDetailSectionToggle} onClick={() => toggleReportSection('finance')}>
                      <ChevronIcon expanded={reportSections.finance} />
                    </button>
                  </div>

                  {reportSections.finance ? (
                    <>
                      <div className={progressStyles.financeGrid}>
                        <div className={progressStyles.modalMetric}>
                          <span>Amount Due</span>
                          <strong>{formatCurrency(reportDetail.finance.dueValue)}</strong>
                        </div>
                        <div className={progressStyles.modalMetric}>
                          <span>Amount Paid</span>
                          <strong>{formatCurrency(reportDetail.finance.paidValue)}</strong>
                        </div>
                        <div className={progressStyles.modalMetric}>
                          <span>Outstanding</span>
                          <strong>{formatCurrency(reportDetail.finance.outstandingValue)}</strong>
                        </div>
                      </div>

                      <div className={progressStyles.financeTableWrap}>
                        {reportDetail.payments.length ? (
                          <table className={progressStyles.financeTable}>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Invoice No</th>
                                <th>Nominal Paid</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportDetail.payments.map((payment) => (
                                <tr key={payment.id || `${payment.invoiceNumber}-${payment.createdAt}`}>
                                  <td>{formatDate(payment.paidAt || payment.createdAt)}</td>
                                  <td>{payment.invoiceNumber || '-'}</td>
                                  <td>{formatCurrency(payment.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className={progressStyles.emptyMini}>No payment records.</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className={progressStyles.metricNote}>Open finance to see paid and outstanding amount.</div>
                  )}
                </div>

                <div className={progressStyles.modalSection}>
                  <div className={progressStyles.productDetailSectionHead}>
                    <h4 className={progressStyles.modalSectionTitle}>Document History</h4>
                    <button type="button" className={progressStyles.productDetailSectionToggle} onClick={() => toggleReportSection('documentHistory')}>
                      <ChevronIcon expanded={reportSections.documentHistory} />
                    </button>
                  </div>

                  {reportSections.documentHistory
                    ? (() => {
                        const signedPoFiles = reportBundle.documentHistory?.signedPoFiles || []
                        const signedPoDate = getLatestSignedPoDate(signedPoFiles)
                        const signedPoInputId = `report-signed-po-upload-${sanitizeStorageFileName(reportRow.poNumber || reportRow.id)}`

                        return (
                          <div className={progressStyles.documentHistoryList}>
                            <div className={progressStyles.documentHistoryGroup}>
                              <div className={progressStyles.documentHistoryGroupHead}>
                                <span>Purchase Order</span>
                                <strong>{reportRow.poNumber}</strong>
                              </div>
                              <div className={progressStyles.documentHistoryMiniList}>
                                <div className={progressStyles.documentHistoryMiniRow}>
                                  <strong>Generated PO</strong>
                                  <span>{formatDateTime(reportBundle.po?.created_at || reportRow.createdAt)}</span>
                                  <div className={progressStyles.documentHistoryActions}>
                                    <button
                                      type="button"
                                      className={progressStyles.documentHistoryIconButton}
                                      onClick={() => void handlePrint(reportRow)}
                                      disabled={printingPoNumber === reportRow.poNumber}
                                      title="Print PO"
                                      aria-label="Print PO"
                                    >
                                      <PrintMiniIcon />
                                    </button>
                                  </div>
                                </div>

                                <div className={progressStyles.documentHistoryMiniRow}>
                                  <strong>Signed PO</strong>
                                  <span>{signedPoDate ? formatDateTime(signedPoDate) : 'No signed PO file yet'}</span>
                                  <div className={progressStyles.documentHistoryActions}>
                                    <input
                                      id={signedPoInputId}
                                      type="file"
                                      accept="application/pdf,image/*"
                                      multiple
                                      className={progressStyles.hiddenFileInput}
                                      disabled={uploadingReportSignedPo}
                                      onChange={(event) => {
                                        const files = Array.from(event.target.files || [])
                                        event.target.value = ''
                                        void handleReportSignedPoUpload(files)
                                      }}
                                    />
                                    <label
                                      className={`${progressStyles.documentHistoryIconButton} ${
                                        uploadingReportSignedPo ? progressStyles.documentHistoryIconButtonDisabled : ''
                                      }`}
                                      htmlFor={signedPoInputId}
                                      title={uploadingReportSignedPo ? 'Uploading signed PO...' : 'Upload signed PO'}
                                      aria-label="Upload signed PO"
                                    >
                                      <PlusMiniIcon />
                                    </label>
                                    {signedPoFiles.map((attachment, index) => (
                                      <button
                                        key={attachment.id || attachment.storagePath || index}
                                        type="button"
                                        className={progressStyles.documentHistoryIconButton}
                                        onClick={() => void openReportSignedPoAttachment(attachment)}
                                        title={attachment.fileName || `Signed PO ${index + 1}`}
                                        aria-label={`Open signed PO ${index + 1}`}
                                      >
                                        <AttachmentMiniIcon />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {reportRow.type === 'garment' ? (
                              <div className={progressStyles.documentHistoryGroup}>
                                <div className={progressStyles.documentHistoryGroupHead}>
                                  <span>Receipt History</span>
                                  <strong>{reportBundle.documentHistory?.receipts?.length || 0} receipt date(s)</strong>
                                </div>
                                {(reportBundle.documentHistory?.receipts || []).length ? (
                                  <div className={progressStyles.documentHistoryMiniList}>
                                    {reportBundle.documentHistory.receipts.map((receipt) => (
                                      <div key={receipt.key} className={progressStyles.documentHistoryMiniRow}>
                                        <strong>{formatDate(receipt.receiveDate)}</strong>
                                        <span>{receipt.supplierSj ? `SJ ${receipt.supplierSj}` : 'No supplier SJ'}</span>
                                        <em>{formatQuantity(receipt.qty)} pcs</em>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className={progressStyles.emptyMini}>No receipt rows yet.</div>
                                )}
                              </div>
                            ) : null}

                            <div className={progressStyles.documentHistoryGroup}>
                              <div className={progressStyles.documentHistoryGroupHead}>
                                <span>Payment Arrangement</span>
                                <strong>{reportDetail.payments.length} invoice row(s)</strong>
                              </div>
                              {reportDetail.payments.length ? (
                                <div className={progressStyles.documentHistoryPaymentTable}>
                                  <div className={`${progressStyles.documentHistoryPaymentRow} ${progressStyles.documentHistoryPaymentHeader}`}>
                                    <span>Invoice Number</span>
                                    <span>Submitted At</span>
                                    <span>Proof</span>
                                    <span>Paid At</span>
                                    <span>Proof</span>
                                  </div>
                                  {reportDetail.payments.map((payment) => {
                                    const submissionProofs = getReportPaymentAttachmentsByKind(payment, 'SUBMISSION_PROOF')
                                    const paymentProofs = getReportPaymentAttachmentsByKind(payment, 'PAYMENT_PROOF')
                                    const paidDate = payment.status === 'PAID' || payment.paidAt ? payment.paidAt || payment.createdAt : ''
                                    return (
                                      <div key={`payment-arrangement-${payment.id}`} className={progressStyles.documentHistoryPaymentRow}>
                                        <strong>{payment.invoiceNumber || '-'}</strong>
                                        <span>{formatDateTime(payment.createdAt)}</span>
                                        <div className={progressStyles.documentHistoryActions}>
                                          {submissionProofs.length ? (
                                            submissionProofs.map((attachment, index) => (
                                              <button
                                                key={attachment.id || attachment.storagePath || index}
                                                type="button"
                                                className={progressStyles.documentHistoryIconButton}
                                                onClick={() => void openReportPaymentAttachment(attachment)}
                                                title={attachment.fileName || `Invoice proof ${index + 1}`}
                                                aria-label={`Open invoice proof ${index + 1}`}
                                              >
                                                <AttachmentMiniIcon />
                                              </button>
                                            ))
                                          ) : (
                                            <em>No proof</em>
                                          )}
                                        </div>
                                        <span>{paidDate ? formatDateTime(paidDate) : '-'}</span>
                                        <div className={progressStyles.documentHistoryActions}>
                                          {paymentProofs.length ? (
                                            paymentProofs.map((attachment, index) => (
                                              <button
                                                key={attachment.id || attachment.storagePath || index}
                                                type="button"
                                                className={progressStyles.documentHistoryIconButton}
                                                onClick={() => void openReportPaymentAttachment(attachment)}
                                                title={attachment.fileName || `Payment proof ${index + 1}`}
                                                aria-label={`Open payment proof ${index + 1}`}
                                              >
                                                <AttachmentMiniIcon />
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
                                <div className={progressStyles.emptyMini}>No payment arrangement rows yet.</div>
                              )}
                            </div>
                          </div>
                        )
                      })()
                    : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
