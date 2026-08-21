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
  }
}

async function fetchReportPayments(supabaseClient, row) {
  const poSourceType = row?.type === 'garment' ? 'GARMENT' : 'MATERIAL'
  const paymentRows = await loadOptionalRows(() =>
    supabaseClient
      .from('arkline_payment')
      .select('id, payment_basis, po_source_type, po_number, invoice_number, amount, notes, status, paid_at, created_at')
      .eq('payment_basis', 'PO_BASED')
      .eq('po_source_type', poSourceType)
      .eq('po_number', row.poNumber)
      .order('created_at', { ascending: false })
  )

  return paymentRows.map(normalizeReportPaymentRow)
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
  const [reportSections, setReportSections] = useState({
    productLists: true,
    finance: false,
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
    })
    setError('')
    setSuccess('')

    try {
      const bundle = row.type === 'garment' ? await fetchGarmentPoBundle(supabase, row.poNumber) : await fetchMaterialPoBundle(supabase, row.poNumber)
      const payments = await fetchReportPayments(supabase, row)
      setReportBundle({ ...bundle, payments })
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
      const dueValue = lines.reduce((sum, line) => sum + getFinanceQtyForReportLine(line) * line.price, 0)
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
          outstandingValue: Math.max(dueValue - paidValue, 0),
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
    const dueValue = lines.reduce((sum, line) => sum + line.amount, 0)
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
        outstandingValue: Math.max(dueValue - paidValue, 0),
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
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
