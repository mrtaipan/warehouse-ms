'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'

import shellStyles from '../arkline.module.css'
import styles from './production-planning.module.css'

const supabase = createClient()

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const METHOD_OPTIONS = ['FOB', 'CMT']

function createEmptySizeQuantities() {
  return SIZE_OPTIONS.reduce((accumulator, size) => {
    accumulator[size] = ''
    return accumulator
  }, {})
}

function createEmptyLineDraft() {
  return {
    localId: '',
    dbId: null,
    skuInduk: '',
    namaProdukSnapshot: '',
    kategoriProdukSnapshot: '',
    kategoriPengadaanSnapshot: '',
    allowancePct: '3',
    hpp: '',
    status: 'Initiated',
    notes: '',
    qtyBySize: createEmptySizeQuantities(),
  }
}

function createProductSearchLabel(product) {
  return String(product?.namaProduk || '').trim().toUpperCase()
}

function extractPoNumberInfo(poId) {
  const normalized = String(poId || '').trim().toUpperCase()
  const match = normalized.match(/^PO-([A-Z0-9]+)-?(.*)$/)

  if (!match) {
    return null
  }

  const numericValue = /^\d+$/.test(match[1]) ? Number(match[1]) : null

  return {
    numberText: match[1],
    numberValue: numericValue,
    suffix: match[2] || '',
  }
}

function getPoPrefix(poId) {
  const info = extractPoNumberInfo(poId)
  return info ? `PO-${info.numberText}-` : ''
}

function getPoSuffix(poId) {
  const info = extractPoNumberInfo(poId)
  return info ? info.suffix : String(poId || '').trim().toUpperCase()
}

function isEditablePoSuffix(poId) {
  const normalized = String(poId || '').trim().toUpperCase()
  return /^PO-\d+-TEMPORER$/.test(normalized)
}

function createInitialHeader() {
  return {
    poId: '',
    supplierId: '',
    supplierName: '',
    requestDeliveryDate: '',
    status: 'Initiated',
    notes: '',
  }
}

function normalizeProduct(row) {
  return {
    skuInduk: String(row?.sku_induk || '').trim().toUpperCase(),
    namaProduk: String(row?.nama_produk || '').trim().toUpperCase(),
    kategoriProduk: String(row?.kategori_produk || '').trim().toUpperCase(),
    kategoriPengadaan: String(row?.kategori_pengadaan || '').trim().toUpperCase(),
    isActive: row?.is_active !== false,
  }
}

function normalizeSupplier(row, source) {
  return {
    id: String(row?.id || '').trim(),
    supplierName: String(row?.supplier_name || row?.nama_supplier || '').trim().toUpperCase(),
    supplierGroup: String(row?.group || '').trim().toUpperCase(),
    isActive: row?.is_active !== false,
    source,
  }
}

function normalizePo(row) {
  return {
    id: row?.id || null,
    poId: String(row?.po_id || '').trim().toUpperCase(),
    method: String(row?.method || 'FOB').trim().toUpperCase(),
    status: String(row?.status || 'Draft').trim(),
    requestDeliveryDate: String(row?.request_delivery_date || '').slice(0, 10),
    supplierName: String(row?.supplier_name || '').trim().toUpperCase(),
    createdAt: String(row?.created_at || ''),
  }
}

function normalizeBomLine(row) {
  return {
    id: row?.id || null,
    skuInduk: String(row?.sku_induk || '').trim().toUpperCase(),
    kategoriPengadaan: String(row?.kategori_pengadaan || '').trim().toUpperCase(),
    materialId: String(row?.material_id || row?.material?.id || '').trim(),
    materialName: String(row?.material_name || row?.material?.material_name || '').trim().toUpperCase(),
    unit: String(row?.unit || row?.material?.unit || 'PCS').trim().toUpperCase(),
    sizeVariant: String(row?.size_variant || '').trim().toUpperCase(),
    colorVariant: String(row?.color_variant || '').trim().toUpperCase(),
    qtyPer1: Number(row?.qty_per_1 || row?.qty_per_unit || 0) || 0,
    wastePct: Number(row?.waste_pct || 0) || 0,
    isActive: row?.is_active !== false,
  }
}

function normalizeMaterialLine(row) {
  return {
    materialId: String(row?.material_id || '').trim(),
    materialNameSnapshot: String(row?.material_name_snapshot || '').trim().toUpperCase(),
    unit: String(row?.unit || 'PCS').trim().toUpperCase(),
    sizeVariant: String(row?.size_variant || '').trim().toUpperCase(),
    colorVariant: String(row?.color_variant || '').trim().toUpperCase(),
    generatedQty: Number(row?.generated_qty || 0) || 0,
    finalQty: Number(row?.final_qty || 0) || 0,
    sourceSku: String(row?.source_sku_induk || '').trim().toUpperCase(),
  }
}

function buildMaterialLabel(line) {
  return String(line?.materialNameSnapshot || line?.materialName || '').trim().toUpperCase()
}

function isBomLineMatchingSize(line, size) {
  const variant = String(line?.sizeVariant || '').trim().toUpperCase()
  const requestedSize = String(size || '').trim().toUpperCase()
  if (!variant) return true
  return variant === requestedSize
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const normalized = String(value || '')
    .replace(/[^\d.-]/g, '')
    .trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundQuantity(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function formatQuantity(value) {
  const rounded = roundQuantity(value)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

function formatNumberInput(value) {
  const normalized = String(value || '').replace(/,/g, '').trim()
  if (!normalized) return ''

  const [integerPartRaw, decimalPart] = normalized.split('.')
  const integerPart = integerPartRaw.replace(/\D/g, '')

  if (!integerPart) {
    return decimalPart != null ? `0.${decimalPart.replace(/\D/g, '')}` : ''
  }

  const withSeparator = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const normalizedDecimal = decimalPart?.replace(/\D/g, '') || ''

  return decimalPart != null ? `${withSeparator}.${normalizedDecimal}` : withSeparator
}

function buildNextPoId(records) {
  const { maxNumber, width } = records.reduce(
    (accumulator, item) => {
      const info = extractPoNumberInfo(item?.poId)
      if (!info || !Number.isFinite(info.numberValue)) {
        return accumulator
      }

      return {
        maxNumber: Math.max(accumulator.maxNumber, info.numberValue),
        width: Math.max(accumulator.width, info.numberText.length),
      }
    },
    { maxNumber: 0, width: 3 }
  )

  return `PO-${String(maxNumber + 1).padStart(width, '0')}-`
}

function getLineTotalQty(line) {
  return Object.values(line.qtyBySize || {}).reduce((sum, current) => sum + toNumber(current), 0)
}

function cloneLine(line) {
  return {
    ...line,
    hpp: String(line?.hpp || ''),
    qtyBySize: { ...line.qtyBySize },
  }
}

function addPdfTable(doc, config) {
  const { title, headers, rows, startY } = config
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 14
  const tableWidth = pageWidth - marginX * 2
  const colWidths = headers.map((header) => tableWidth * header.width)
  let y = startY

  const ensureSpace = (heightNeeded) => {
    if (y + heightNeeded <= pageHeight - 16) return
    doc.addPage()
    y = 18
  }

  ensureSpace(16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(title, marginX, y)
  y += 6

  const renderRow = (values, options = {}) => {
    const fontStyle = options.header ? 'bold' : 'normal'
    const bgColor = options.header ? [248, 250, 252] : null
    const lines = values.map((value, index) =>
      doc.splitTextToSize(String(value || '-'), Math.max(colWidths[index] - 4, 12))
    )
    const rowHeight = Math.max(8, Math.max(...lines.map((line) => line.length)) * 4 + 2)

    ensureSpace(rowHeight + 2)

    let x = marginX
    lines.forEach((line, index) => {
      if (bgColor) {
        doc.setFillColor(...bgColor)
        doc.rect(x, y, colWidths[index], rowHeight, 'F')
      }
      doc.setDrawColor(209, 213, 219)
      doc.rect(x, y, colWidths[index], rowHeight)
      doc.setFont('helvetica', fontStyle)
      doc.setFontSize(options.header ? 9 : 8)
      doc.text(line, x + 2, y + 5)
      x += colWidths[index]
    })

    y += rowHeight
  }

  renderRow(headers.map((header) => header.label), { header: true })
  rows.forEach((row) => renderRow(row))
  return y + 8
}

async function createPrintPdfBlob(bundle) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Arkline Production Planning', 14, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`PO ID: ${bundle.poId}`, 14, 26)
  doc.text(`Method: ${bundle.method}`, 80, 26)
  doc.text(`Supplier: ${bundle.header.supplierName || '-'}`, 14, 32)
  doc.text(`Status: ${bundle.header.status || '-'}`, 80, 32)
  doc.text(`Request Delivery: ${bundle.header.requestDeliveryDate || '-'}`, 14, 38)

  let currentY = 46

  const itemRows = bundle.items.map((item) => {
    const sizeBreakdown =
      SIZE_OPTIONS.map((size) => {
        const value = toNumber(item.qtyBySize[size])
        return value > 0 ? `${size}:${formatQuantity(value)}` : ''
      })
        .filter(Boolean)
        .join(', ') || '-'

    return [
      item.skuInduk,
      item.namaProdukSnapshot || '-',
      formatQuantity(getLineTotalQty(item)),
      bundle.method === 'FOB' ? formatQuantity(toNumber(item.hpp)) : '-',
      sizeBreakdown,
    ]
  })

  currentY = addPdfTable(doc, {
    title: 'Planned Items',
    startY: currentY,
    headers: [
      { label: 'SKU', width: 0.2 },
      { label: 'Product', width: 0.34 },
      { label: 'Qty', width: 0.12 },
      { label: 'HPP', width: 0.12 },
      { label: 'Size Breakdown', width: 0.22 },
    ],
    rows: itemRows,
  })

  if (bundle.method === 'CMT' && bundle.materials.length) {
    const materialRows = bundle.materials.map((line) => [
      buildMaterialLabel(line) || '-',
      line.sizeVariant || '-',
      line.colorVariant || '-',
      line.unit || '-',
      formatQuantity(line.generatedQty),
      formatQuantity(line.finalQty),
    ])

    currentY = addPdfTable(doc, {
      title: 'Generated Materials',
      startY: currentY,
      headers: [
        { label: 'Material', width: 0.3 },
        { label: 'Size', width: 0.12 },
        { label: 'Color', width: 0.14 },
        { label: 'Unit', width: 0.1 },
        { label: 'Generated', width: 0.18 },
        { label: 'Final', width: 0.18 },
      ],
      rows: materialRows,
    })
  }

  const noteLines = doc.splitTextToSize(`Notes: ${bundle.header.notes || '-'}`, 180)
  if (currentY + noteLines.length * 5 > doc.internal.pageSize.getHeight() - 16) {
    doc.addPage()
    currentY = 18
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(noteLines, 14, currentY)

  return doc.output('blob')
}

async function loadSuppliers() {
  const { data, error } = await supabase
    .from('dir_suppliers')
    .select('id, supplier_name, supplier_code, "group", is_active')
    .eq('group', 'ARKLINE')
    .order('supplier_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || [])
    .map((item) => normalizeSupplier(item, 'regular'))
    .filter((item) => item.isActive && item.supplierName)
}

async function loadProducts() {
  const { data, error } = await supabase
    .from('arkline_dir_products')
    .select('sku_induk, kategori_pengadaan, kategori_produk, nama_produk, is_active')
    .order('nama_produk', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map(normalizeProduct).filter((item) => item.isActive && item.skuInduk)
}

async function loadExistingPos() {
  const { data, error } = await supabase
    .from('arkline_pos')
    .select('id, po_id, method, status, request_delivery_date, supplier_name, created_at')
    .not('po_id', 'is', null)
    .order('po_id', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || [])
    .map(normalizePo)
    .filter((item) => item.poId && item.status.toUpperCase() !== 'COMPLETED')
    .sort((left, right) => {
      const leftInfo = extractPoNumberInfo(left.poId)
      const rightInfo = extractPoNumberInfo(right.poId)

      if (leftInfo?.numberValue != null && rightInfo?.numberValue != null && leftInfo.numberValue !== rightInfo.numberValue) {
        return leftInfo.numberValue - rightInfo.numberValue
      }

      return left.poId.localeCompare(right.poId, undefined, { numeric: true })
    })
}

async function loadBomLinesForProduct(product) {
  const normalizedSku = String(product?.skuInduk || '').trim().toUpperCase()
  const normalizedKategoriPengadaan = String(product?.kategoriPengadaan || '').trim().toUpperCase()

  const categoryResponse = normalizedKategoriPengadaan
    ? await supabase
        .from('arkline_dir_bom')
        .select('id, kategori_pengadaan, sku_induk, material_id, size_variant, color_variant, qty_per_1, waste_pct, is_active')
        .eq('is_active', true)
        .is('sku_induk', null)
        .eq('kategori_pengadaan', normalizedKategoriPengadaan)
    : { data: [], error: null }

  if (categoryResponse.error && categoryResponse.error.code !== 'PGRST116') {
    throw new Error(categoryResponse.error.message)
  }

  const skuResponse = normalizedSku
    ? await supabase
        .from('arkline_dir_bom')
        .select('id, kategori_pengadaan, sku_induk, material_id, size_variant, color_variant, qty_per_1, waste_pct, is_active')
        .eq('is_active', true)
        .eq('sku_induk', normalizedSku)
    : { data: [], error: null }

  if (skuResponse.error && skuResponse.error.code !== 'PGRST116') {
    throw new Error(skuResponse.error.message)
  }

  const bomRows = [...(categoryResponse.data || []), ...(skuResponse.data || [])]
  const materialIds = Array.from(
    new Set(
      bomRows
        .map((line) => String(line?.material_id || '').trim())
        .filter(Boolean)
    )
  )

  let materialsById = {}

  if (materialIds.length) {
    const { data: materialRows, error: materialError } = await supabase
      .from('arkline_dir_materials')
      .select('id, material_name, unit, is_active')
      .in('id', materialIds)
      .eq('is_active', true)

    if (materialError && materialError.code !== 'PGRST116') {
      throw new Error(materialError.message)
    }

    materialsById = (materialRows || []).reduce((accumulator, item) => {
      accumulator[String(item.id || '').trim()] = item
      return accumulator
    }, {})
  }

  return bomRows
    .map((row) =>
      normalizeBomLine({
        ...row,
        material: materialsById[String(row?.material_id || '').trim()] || null,
      })
    )
    .filter((line) => line.materialId && line.materialName)
}

async function fetchPoBundle(poId) {
  const { data: poRow, error: poError } = await supabase
    .from('arkline_pos')
    .select('*')
    .eq('po_id', poId)
    .maybeSingle()

  if (poError) {
    throw new Error(poError.message)
  }

  if (!poRow) {
    throw new Error('PO not found.')
  }

  const { data: itemRows, error: itemError } = await supabase
    .from('arkline_po_items')
    .select('*')
    .eq('po_id', poRow.po_id)
    .order('created_at', { ascending: true })

  if (itemError) {
    throw new Error(itemError.message)
  }

  const items = itemRows || []
  const itemIds = items.map((item) => item.id).filter(Boolean)

  const { data: sizeRows, error: sizeError } =
    itemIds.length > 0
      ? await supabase
          .from('arkline_po_item_sizes')
          .select('*')
          .in('arkline_po_item_id', itemIds)
          .order('size', { ascending: true })
      : { data: [], error: null }

  if (sizeError) {
    throw new Error(sizeError.message)
  }

  const materialRows = []

  const sizeRowsByItem = (sizeRows || []).reduce((accumulator, row) => {
    const key = String(row.arkline_po_item_id || '')
    if (!accumulator[key]) accumulator[key] = []
    accumulator[key].push(row)
    return accumulator
  }, {})

  const normalizedItems = items.map((item) => {
    const qtyBySize = createEmptySizeQuantities()

    ;(sizeRowsByItem[String(item.id || '')] || []).forEach((sizeRow) => {
      const sizeKey = String(sizeRow.size || '').trim().toUpperCase()
      if (!sizeKey || !Object.prototype.hasOwnProperty.call(qtyBySize, sizeKey)) return
      qtyBySize[sizeKey] = String(sizeRow.qty || '')
    })

    return {
      localId: `loaded-${item.id}`,
      dbId: item.id,
      skuInduk: String(item.sku_induk || '').trim().toUpperCase(),
      namaProdukSnapshot: String(item.nama_produk || '').trim().toUpperCase(),
      kategoriProdukSnapshot: String(item.kategori_produk || '').trim().toUpperCase(),
      kategoriPengadaanSnapshot: String(item.kategori_pengadaan || '').trim().toUpperCase(),
      allowancePct: String(item.allowance_pct ?? '0'),
      hpp: String(item.hpp ?? ''),
      status: String(item.status || 'Initiated'),
      notes: String(item.notes || ''),
      actualQty: Number(item.actual_qty || 0) || 0,
      qtyBySize,
    }
  })

  return {
    po: poRow,
    items: normalizedItems,
    materials: materialRows.map(normalizeMaterialLine),
  }
}

export default function ArklineProductionPlanningPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingMaterials, setGeneratingMaterials] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [lineError, setLineError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPlanningDirty, setIsPlanningDirty] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [pendingNavigationHref, setPendingNavigationHref] = useState('')
  const [isEditingExistingPoSuffix, setIsEditingExistingPoSuffix] = useState(false)
  const [showExistingPoPicker, setShowExistingPoPicker] = useState(false)
  const pendingNavigationHrefRef = useRef('')
  const plannedLinesSectionRef = useRef(null)

  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [existingPos, setExistingPos] = useState([])

  const [mode, setMode] = useState('new')
  const [method, setMethod] = useState('FOB')
  const [selectedExistingPoId, setSelectedExistingPoId] = useState('')
  const [currentPoDbId, setCurrentPoDbId] = useState(null)

  const [header, setHeader] = useState(createInitialHeader())
  const [categoryFilter, setCategoryFilter] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [showProductOptions, setShowProductOptions] = useState(false)
  const [lineDraft, setLineDraft] = useState(createEmptyLineDraft())
  const [poItems, setPoItems] = useState([])
  const [materialPreview, setMaterialPreview] = useState([])
  const [materialWarnings, setMaterialWarnings] = useState([])
  useEffect(() => {
    async function loadPageData() {
      setLoading(true)
      setError('')

      try {
        const [supplierRows, productRows, poRows] = await Promise.all([loadSuppliers(), loadProducts(), loadExistingPos()])

        setSuppliers(supplierRows)
        setProducts(productRows)
        setExistingPos(poRows)
      setHeader((prev) => ({
        ...prev,
        poId: prev.poId || buildNextPoId(poRows),
        }))
      } catch (loadError) {
        setError(loadError.message || 'Failed to load Arkline planning master data.')
      } finally {
        setLoading(false)
      }
    }

    loadPageData()
  }, [])

  const productBySku = useMemo(
    () =>
      products.reduce((accumulator, item) => {
        accumulator[item.skuInduk] = item
        return accumulator
      }, {}),
    [products]
  )

  const categories = useMemo(
    () => Array.from(new Set(products.map((item) => item.kategoriProduk).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [products]
  )

  const nextPoPrefix = useMemo(() => buildNextPoId(existingPos), [existingPos])
  const currentPoPrefix = mode === 'new' ? getPoPrefix(header.poId) || nextPoPrefix : getPoPrefix(header.poId)
  const currentPoSuffix = mode === 'new' ? getPoSuffix(header.poId) : ''
  const filteredExistingPos = useMemo(
    () => existingPos.filter((item) => String(item.method || '').trim().toUpperCase() === method),
    [existingPos, method]
  )

  useEffect(() => {
    if (!selectedExistingPoId) {
      return
    }

    const stillExists = filteredExistingPos.some((item) => item.poId === selectedExistingPoId)
    if (!stillExists) {
      setSelectedExistingPoId('')
    }
  }, [filteredExistingPos, selectedExistingPoId])

  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toUpperCase()

    return products.filter((item) => {
      const matchesCategory = !categoryFilter || item.kategoriProduk === categoryFilter
      const matchesKeyword =
        !keyword ||
        [item.skuInduk, item.namaProduk, item.kategoriProduk, item.kategoriPengadaan]
          .filter(Boolean)
          .join(' ')
          .includes(keyword)

      return matchesCategory && matchesKeyword
    })
  }, [categoryFilter, productSearch, products])

  const selectedDraftProduct = lineDraft.skuInduk ? productBySku[lineDraft.skuInduk] || null : null
  const resolveLineProductDisplay = (line) => {
    const currentProduct = productBySku[line.skuInduk] || null

    return {
      namaProduk: currentProduct?.namaProduk || line.namaProdukSnapshot || line.skuInduk,
      kategoriProduk: currentProduct?.kategoriProduk || line.kategoriProdukSnapshot || '',
    }
  }

  const totalPlannedQty = useMemo(
    () => poItems.reduce((sum, item) => sum + getLineTotalQty(item), 0),
    [poItems]
  )
  const isExistingModeLocked = mode === 'existing' && !selectedExistingPoId
  const isEditingLine = Boolean(lineDraft.localId || lineDraft.dbId)
  const isHppDisabled = method === 'CMT' || isExistingModeLocked

  const totalMaterialLines = materialPreview.length
  const totalMaterialFinalQty = materialPreview.reduce((sum, item) => sum + Number(item.finalQty || 0), 0)

  useEffect(() => {
    if (!isPlanningDirty) {
      return undefined
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const handleDocumentClick = (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!link) return

      const href = link.getAttribute('href') || ''
      if (!href || href.startsWith('#')) return
      if (link.target && link.target !== '_self') return

      const nextUrl = new URL(href, window.location.href)
      const currentUrl = new URL(window.location.href)

      if (nextUrl.href === currentUrl.href) {
        return
      }

      event.preventDefault()
      pendingNavigationHrefRef.current = nextUrl.href
      setPendingNavigationHref(nextUrl.href)
      setShowLeaveConfirm(true)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [isPlanningDirty])

  function resetLineDraft(nextDraft = createEmptyLineDraft()) {
    const nextProductLabel =
      nextDraft?.skuInduk && productBySku[nextDraft.skuInduk]
        ? createProductSearchLabel(productBySku[nextDraft.skuInduk])
        : String(nextDraft?.namaProdukSnapshot || '').trim().toUpperCase()
    const nextCategory =
      nextDraft?.skuInduk && productBySku[nextDraft.skuInduk]?.kategoriProduk
        ? productBySku[nextDraft.skuInduk].kategoriProduk
        : nextDraft?.kategoriProdukSnapshot || ''

    setLineDraft({
      ...createEmptyLineDraft(),
      ...nextDraft,
      hpp: String(nextDraft?.hpp || ''),
      qtyBySize: {
        ...createEmptySizeQuantities(),
        ...(nextDraft?.qtyBySize || {}),
      },
    })
    setProductSearch(nextProductLabel)
    setShowProductOptions(false)
    setLineError('')
    setCategoryFilter(nextCategory)
  }

  function resetPlanningState(nextMode = 'new', poRows = existingPos) {
    setMode(nextMode)
    setMethod('FOB')
    setSelectedExistingPoId('')
    setIsEditingExistingPoSuffix(false)
    setShowExistingPoPicker(nextMode === 'existing')
    setCurrentPoDbId(null)
    setHeader({
      ...createInitialHeader(),
      poId: buildNextPoId(poRows),
    })
    setCategoryFilter('')
    setPoItems([])
    setMaterialPreview([])
    setMaterialWarnings([])
    resetLineDraft()
    setIsPlanningDirty(false)
    setError('')
    setLineError('')
    setSuccess('')
  }

  async function rebuildMaterialPreview(nextItems, nextMethod = method) {
    if (nextMethod !== 'CMT') {
      setMaterialPreview([])
      setMaterialWarnings([])
      return
    }

    if (!nextItems.length) {
      setMaterialPreview([])
      setMaterialWarnings([])
      return
    }

    setGeneratingMaterials(true)
    setError('')

    try {
      const aggregate = new Map()
      const warnings = []

      for (const item of nextItems) {
        const product = productBySku[item.skuInduk] || {
          skuInduk: item.skuInduk,
          kategoriPengadaan: String(item.kategoriPengadaanSnapshot || item.kategoriProdukSnapshot || '').trim().toUpperCase(),
        }

        const bomLines = await loadBomLinesForProduct(product)

        if (!bomLines.length) {
          warnings.push(`BOM not found for ${item.namaProdukSnapshot || item.skuInduk}.`)
          continue
        }

        const allowancePct = toNumber(item.allowancePct)

        SIZE_OPTIONS.forEach((size) => {
          const requestedQty = toNumber(item.qtyBySize[size])
          if (requestedQty <= 0) return

          const matchingLines = bomLines.filter((line) => isBomLineMatchingSize(line, size))

          if (!matchingLines.length) {
            warnings.push(`No BOM line matches ${item.namaProdukSnapshot || item.skuInduk} size ${size}.`)
            return
          }

          matchingLines.forEach((line) => {
            const generatedQty = roundQuantity(requestedQty * toNumber(line.qtyPer1))
            const finalQty = roundQuantity(generatedQty * (1 + (allowancePct + toNumber(line.wastePct)) / 100))
            const key = [line.materialId, line.materialName, line.unit, line.sizeVariant || size, line.colorVariant || '', item.skuInduk].join('|')
            const existing = aggregate.get(key)

            if (!existing) {
              aggregate.set(key, {
                materialId: line.materialId,
                materialNameSnapshot: line.materialName,
                unit: line.unit,
                sizeVariant: line.sizeVariant || size,
                colorVariant: line.colorVariant || '',
                generatedQty,
                finalQty,
                sourceSku: item.skuInduk,
              })
              return
            }

            existing.generatedQty = roundQuantity(existing.generatedQty + generatedQty)
            existing.finalQty = roundQuantity(existing.finalQty + finalQty)
          })
        })
      }

      setMaterialPreview(
        Array.from(aggregate.values()).sort((left, right) =>
          `${buildMaterialLabel(left)}-${left.sizeVariant}-${left.colorVariant}`.localeCompare(
            `${buildMaterialLabel(right)}-${right.sizeVariant}-${right.colorVariant}`
          )
        )
      )
      setMaterialWarnings(warnings)
    } catch (buildError) {
      setMaterialPreview([])
      setMaterialWarnings([])
      setError(buildError.message || 'Failed to generate material preview.')
    } finally {
      setGeneratingMaterials(false)
    }
  }

  function handleModeChange(nextMode) {
    if (nextMode === mode) return
    resetPlanningState(nextMode)
  }

  function handleMethodChange(nextMethod) {
    setMethod(nextMethod)
    setIsPlanningDirty(true)
    setSuccess('')
    setError('')
    setLineError('')

    if (nextMethod === 'FOB') {
      setMaterialPreview([])
      setMaterialWarnings([])
      return
    }

    void rebuildMaterialPreview(poItems, nextMethod)
  }

  function handleHeaderChange(event) {
    const { name, value } = event.target

    if (name === 'poSuffix') {
      setHeader((prev) => ({
        ...prev,
        poId: `${(mode === 'new' ? getPoPrefix(prev.poId) || nextPoPrefix : getPoPrefix(prev.poId)) || nextPoPrefix}${value.toUpperCase()}`,
      }))
      setIsPlanningDirty(true)
      setError('')
      return
    }

    if (name === 'supplierId') {
      const selected = suppliers.find((item) => item.id === value)
      setHeader((prev) => ({
        ...prev,
        supplierId: value,
        supplierName: selected?.supplierName || '',
      }))
      setIsPlanningDirty(true)
      setError('')
      return
    }

    setHeader((prev) => ({
      ...prev,
      [name]: value,
    }))
    setIsPlanningDirty(true)
    setError('')
  }

  function handleDraftSizeChange(size, rawValue) {
    const numericValue = rawValue.replace(/[^\d.]/g, '')
    setLineDraft((prev) => ({
      ...prev,
      qtyBySize: {
        ...prev.qtyBySize,
        [size]: numericValue,
      },
    }))
    setIsPlanningDirty(true)
    setLineError('')
  }

  function handleDraftChange(event) {
    const { name, value } = event.target

    if (name === 'allowancePct') {
      const numericValue = value.replace(/[^\d.]/g, '')
      setLineDraft((prev) => ({
        ...prev,
        allowancePct: numericValue,
      }))
      setIsPlanningDirty(true)
      return
    }

    if (name === 'hpp') {
      const numericValue = value.replace(/,/g, '').replace(/[^\d.]/g, '')
      setLineDraft((prev) => ({
        ...prev,
        hpp: numericValue,
      }))
      setIsPlanningDirty(true)
      setLineError('')
      return
    }

    if (name === 'productSearch') {
      const normalizedValue = value.toUpperCase()
      setProductSearch(normalizedValue)
      setShowProductOptions(true)
      setIsPlanningDirty(true)
      setError('')
      setLineError('')
      setSuccess('')

      const selected = filteredProducts.find((item) => createProductSearchLabel(item) === normalizedValue)

      if (selected) {
        setLineDraft((prev) => ({
          ...prev,
          skuInduk: selected.skuInduk,
          namaProdukSnapshot: selected.namaProduk,
          kategoriProdukSnapshot: selected.kategoriProduk,
          kategoriPengadaanSnapshot: selected.kategoriPengadaan,
        }))
        setProductSearch('')
        setShowProductOptions(false)
        return
      }

      setLineDraft((prev) => ({
        ...prev,
        skuInduk: '',
        namaProdukSnapshot: '',
        kategoriProdukSnapshot: '',
        kategoriPengadaanSnapshot: '',
      }))
      return
    }

    if (name === 'skuInduk') {
      const selected = productBySku[value] || null
      setLineDraft((prev) => ({
        ...prev,
        skuInduk: value,
        namaProdukSnapshot: selected?.namaProduk || '',
        kategoriProdukSnapshot: selected?.kategoriProduk || '',
        kategoriPengadaanSnapshot: selected?.kategoriPengadaan || '',
      }))
      setIsPlanningDirty(true)
      setProductSearch('')
      return
    }

    setLineDraft((prev) => ({
      ...prev,
      [name]: value,
    }))
    setIsPlanningDirty(true)
    setLineError('')
  }

  function handleProductFieldClick() {
    if (lineDraft.skuInduk || productSearch) {
      setLineDraft((prev) => ({
        ...prev,
        skuInduk: '',
        namaProdukSnapshot: '',
        kategoriProdukSnapshot: '',
        kategoriPengadaanSnapshot: '',
      }))
      setProductSearch('')
    }

    setShowProductOptions(true)
    setIsPlanningDirty(true)
    setError('')
    setLineError('')
    setSuccess('')
  }

  function handleProductChange(skuInduk) {
    const product = productBySku[skuInduk] || null

    setLineDraft((prev) => ({
      ...prev,
      skuInduk: product?.skuInduk || '',
      namaProdukSnapshot: product?.namaProduk || '',
      kategoriProdukSnapshot: product?.kategoriProduk || '',
      kategoriPengadaanSnapshot: product?.kategoriPengadaan || '',
    }))
    setIsPlanningDirty(true)
    setProductSearch(product ? createProductSearchLabel(product) : '')
    setShowProductOptions(false)
    setError('')
    setLineError('')
    setSuccess('')
  }

  function validateLineDraft() {
    if (!lineDraft.skuInduk) {
      setLineError('Choose an Arkline product first.')
      return null
    }

    const product = productBySku[lineDraft.skuInduk]
    if (!product) {
      setLineError('Selected product is no longer available.')
      return null
    }

    const totalQty = getLineTotalQty(lineDraft)
    if (totalQty <= 0) {
      setLineError('Enter at least one size quantity before adding the line.')
      return null
    }

    if (method === 'FOB' && toNumber(lineDraft.hpp) <= 0) {
      setLineError('Enter HPP for FOB product lines.')
      return null
    }

    return {
      ...cloneLine(lineDraft),
      localId: lineDraft.localId || `draft-${Date.now()}`,
      namaProdukSnapshot: product.namaProduk,
      kategoriProdukSnapshot: product.kategoriProduk,
      kategoriPengadaanSnapshot: product.kategoriPengadaan,
      allowancePct: String(lineDraft.allowancePct || '0'),
      hpp: method === 'FOB' ? String(lineDraft.hpp || '') : '',
    }
  }

  function handleAddOrUpdateLine() {
    setLineError('')
    setSuccess('')

    const prepared = validateLineDraft()
    if (!prepared) return

    const duplicate = poItems.find((item) => item.skuInduk === prepared.skuInduk && item.localId !== prepared.localId)
    if (duplicate) {
      setLineError('This SKU already exists in the current PO. Edit the existing line instead of adding a duplicate.')
      return
    }

    const nextItems = poItems.some((item) => item.localId === prepared.localId)
      ? poItems.map((item) => (item.localId === prepared.localId ? prepared : item))
      : [...poItems, prepared]

    setPoItems(nextItems)
    setCategoryFilter('')
    setIsPlanningDirty(true)
    resetLineDraft()
    setLineError('')
    setSuccess(prepared.dbId ? 'PO line updated in draft.' : 'PO line added to draft.')

    if (method === 'CMT') {
      void rebuildMaterialPreview(nextItems, method)
    }
  }

  function handleEditLine(localId) {
    const target = poItems.find((item) => item.localId === localId)
    if (!target) return
    resetLineDraft(cloneLine(target))
    setLineError('')
    setSuccess('')
    plannedLinesSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  function handleRemoveLine(localId) {
    const nextItems = poItems.filter((item) => item.localId !== localId)
    setPoItems(nextItems)
    setIsPlanningDirty(true)

    if (lineDraft.localId === localId) {
      resetLineDraft()
    }

    if (method === 'CMT') {
      void rebuildMaterialPreview(nextItems, method)
    }
  }

  async function handleLoadExistingPo(poId) {
    if (!poId) return
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const bundle = await fetchPoBundle(poId)
      const normalizedHeader = {
        poId: String(bundle.po.po_id || '').trim().toUpperCase(),
        supplierId: bundle.po.supplier_id != null ? String(bundle.po.supplier_id) : '',
        supplierName: String(bundle.po.supplier_name || '').trim().toUpperCase(),
        requestDeliveryDate: String(bundle.po.request_delivery_date || '').slice(0, 10),
        status: String(bundle.po.status || 'Draft'),
        notes: String(bundle.po.notes || ''),
      }

      setMode('existing')
      setMethod(String(bundle.po.method || 'FOB').trim().toUpperCase())
      setSelectedExistingPoId(normalizedHeader.poId)
      setShowExistingPoPicker(false)
      setIsEditingExistingPoSuffix(false)
      setCurrentPoDbId(bundle.po.id)
      setHeader(normalizedHeader)
      setCategoryFilter('')
      setPoItems(bundle.items)
      setMaterialPreview(bundle.materials)
      setMaterialWarnings([])
      resetLineDraft()
      setIsPlanningDirty(false)
    } catch (loadError) {
      setError(loadError.message || 'Failed to load existing PO.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshPoListAndKeepSelection(savedPoId) {
    const poRows = await loadExistingPos()
    setExistingPos(poRows)
    setSelectedExistingPoId(savedPoId)
    return poRows
  }

  async function handleSavePo() {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const userEmail = user?.email?.toLowerCase() || null

      if (!header.poId.trim()) {
        throw new Error('PO ID is required.')
      }

      if (mode === 'new' && !getPoSuffix(header.poId)) {
        throw new Error('Isi bagian nomor PO setelah prefix otomatis.')
      }

      if (!header.supplierId) {
        throw new Error('Choose a supplier first.')
      }

      if (!header.requestDeliveryDate) {
        throw new Error('Request delivery date is required.')
      }

      if (!poItems.length) {
        throw new Error('Add at least one product line before saving.')
      }

      if (method === 'CMT') {
        if (materialWarnings.length) {
          throw new Error('Resolve missing BOM lines before saving this CMT PO.')
        }
      }

      let poDbId = currentPoDbId

      const headerPayload = {
        po_id: header.poId.trim().toUpperCase(),
        method,
        supplier_id: header.supplierId ? Number(header.supplierId) || header.supplierId : null,
        supplier_name: header.supplierName || null,
        request_delivery_date: header.requestDeliveryDate || null,
        status: header.status || 'Draft',
        notes: header.notes.trim() || null,
        updated_by: userEmail,
      }

      if (!poDbId) {
        const { data: insertedPo, error: insertPoError } = await supabase
          .from('arkline_pos')
          .insert({
            ...headerPayload,
            created_by: userEmail,
          })
          .select('*')
          .single()

        if (insertPoError) {
          throw new Error(insertPoError.message)
        }

        poDbId = insertedPo.id
      } else {
        const { error: updatePoError } = await supabase.from('arkline_pos').update(headerPayload).eq('id', poDbId)

        if (updatePoError) {
          throw new Error(updatePoError.message)
        }

        const { data: existingItemIds, error: fetchExistingItemError } = await supabase
          .from('arkline_po_items')
          .select('id')
          .eq('po_id', header.poId.trim().toUpperCase())

        if (fetchExistingItemError) {
          throw new Error(fetchExistingItemError.message)
        }

        const itemIds = (existingItemIds || []).map((item) => item.id).filter(Boolean)

        if (itemIds.length) {
          const { error: deleteSizeError } = await supabase.from('arkline_po_item_sizes').delete().in('arkline_po_item_id', itemIds)

          if (deleteSizeError) {
            throw new Error(deleteSizeError.message)
          }
        }

        const { error: deleteItemError } = await supabase
          .from('arkline_po_items')
          .delete()
          .eq('po_id', header.poId.trim().toUpperCase())

        if (deleteItemError) {
          throw new Error(deleteItemError.message)
        }
      }

      const itemPayload = poItems.map((item) => ({
        po_id: header.poId.trim().toUpperCase(),
        sku_induk: item.skuInduk,
        nama_produk: item.namaProdukSnapshot,
        kategori_produk: item.kategoriProdukSnapshot || null,
        allowance_pct: toNumber(item.allowancePct),
        total_qty: getLineTotalQty(item),
        actual_qty: 0,
        hpp: method === 'FOB' ? toNumber(item.hpp) : null,
        status: item.status || 'Initiated',
        notes: item.notes.trim() || null,
        kategori_pengadaan: item.kategoriPengadaanSnapshot || productBySku[item.skuInduk]?.kategoriPengadaan || null,
      }))

      const { data: insertedItems, error: insertItemError } = await supabase
        .from('arkline_po_items')
        .insert(itemPayload)
        .select('*')

      if (insertItemError) {
        throw new Error(insertItemError.message)
      }

      const insertedBySku = (insertedItems || []).reduce((accumulator, item) => {
        accumulator[String(item.sku_induk || '').trim().toUpperCase()] = item
        return accumulator
      }, {})

      const sizePayload = []
      poItems.forEach((item) => {
        const insertedItem = insertedBySku[item.skuInduk]
        if (!insertedItem) return

        SIZE_OPTIONS.forEach((size) => {
          const qty = toNumber(item.qtyBySize[size])
          if (qty <= 0) return

          sizePayload.push({
            arkline_po_item_id: insertedItem.id,
            size,
            qty,
          })
        })
      })

      if (sizePayload.length) {
        const { error: insertSizeError } = await supabase.from('arkline_po_item_sizes').insert(sizePayload)
        if (insertSizeError) {
          throw new Error(insertSizeError.message)
        }
      }

      const refreshedPos = await refreshPoListAndKeepSelection(header.poId)
      resetPlanningState('new', refreshedPos)
      setExistingPos(refreshedPos)
      setSuccess(`PO ${header.poId} saved successfully.`)
    } catch (saveError) {
      setError(saveError.message || 'Failed to save Arkline production planning.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePrint() {
    setError('')
    setSuccess('')

    if (!currentPoDbId && mode !== 'existing') {
      setError('Save the PO first before printing.')
      return
    }

    setPrinting(true)
    const previewWindow = window.open('', '_blank')

    try {
      if (!previewWindow) {
        throw new Error('Popup blocked. Please allow popups to preview the PDF.')
      }

      previewWindow.document.write('<html><body style="font-family: Arial, sans-serif; padding: 24px;">Preparing PDF preview...</body></html>')
      previewWindow.document.close()

      const bundle = await fetchPoBundle(header.poId)
      const printableItems = bundle.items.map((item) => {
        const currentProduct = productBySku[item.skuInduk] || null
        return {
          ...item,
          namaProdukSnapshot: currentProduct?.namaProduk || item.namaProdukSnapshot,
          kategoriProdukSnapshot: currentProduct?.kategoriProduk || item.kategoriProdukSnapshot,
        }
      })
      const pdfBlob = await createPrintPdfBlob({
        poId: header.poId,
        method,
        header,
        items: printableItems,
        materials: bundle.materials,
      })
      const pdfUrl = URL.createObjectURL(pdfBlob)
      previewWindow.location.href = pdfUrl
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
    } catch (printError) {
      previewWindow?.close()
      setError(printError.message || 'Failed to prepare print view.')
    } finally {
      setPrinting(false)
    }
  }

  function handleCancelUpdateLine() {
    resetLineDraft({ ...createEmptyLineDraft(), allowancePct: method === 'CMT' ? '3' : '0' })
    setLineError('')
    setSuccess('')
  }

  function handleEnableExistingPoSuffixEdit() {
    if (!selectedExistingPoId) return
    setIsEditingExistingPoSuffix(true)
    setIsPlanningDirty(true)
  }

  function handleChangeExistingPoSelection() {
    setShowExistingPoPicker(true)
    setIsEditingExistingPoSuffix(false)
    setSelectedExistingPoId('')
    setCurrentPoDbId(null)
    setHeader((prev) => ({
      ...prev,
      poId: '',
    }))
    setPoItems([])
    setMaterialPreview([])
    setMaterialWarnings([])
    resetLineDraft()
    setError('')
    setSuccess('')
  }

  function handleStayOnPlanning() {
    pendingNavigationHrefRef.current = ''
    setPendingNavigationHref('')
    setShowLeaveConfirm(false)
  }

  function handleLeaveWithoutSaving() {
    const nextHref = pendingNavigationHrefRef.current || pendingNavigationHref
    setIsPlanningDirty(false)
    setShowLeaveConfirm(false)
    setPendingNavigationHref('')
    pendingNavigationHrefRef.current = ''

    if (nextHref) {
      window.location.href = nextHref
    }
  }

  const lineTotalQty = getLineTotalQty(lineDraft)

  return (
    <div className={shellStyles.page}>
      <section className={styles.board}>
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.title}>Production Planning</h1>
            <p className={styles.subtitle}>PO planning, size allocation, material generation, save, and print.</p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => resetPlanningState('new')}>
              Reset Planning
            </button>
            <button type="button" className={styles.printButton} onClick={handlePrint} disabled={printing || !header.poId}>
              {printing ? 'Preparing Print...' : 'Print PO'}
            </button>
            <button type="button" className={styles.primaryButton} onClick={handleSavePo} disabled={saving || loading}>
              {saving ? 'Saving...' : 'Save Planning'}
            </button>
          </div>
        </div>
        {(error || success) && (
          <div className={styles.feedbackStrip}>
            {error ? <p className={styles.errorText}>{error}</p> : null}
            {success ? <p className={styles.successText}>{success}</p> : null}
          </div>
        )}

        <div className={styles.planningColumns}>
        <section className={`${styles.sectionCard} ${styles.poPlanningCard}`.trim()}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>PO Planning</h2>
              <p className={styles.sectionCopy}>
                Set the PO details first, then continue the product planning on the right side.
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>PO Mode</label>
              <div className={styles.headerActions}>
                <button
                  type="button"
                  className={`${styles.modeButton} ${mode === 'new' ? styles.modeButtonActive : ''}`.trim()}
                  onClick={() => handleModeChange('new')}
                >
                  New PO
                </button>
                <button
                  type="button"
                  className={`${styles.modeButton} ${mode === 'existing' ? styles.modeButtonActive : ''}`.trim()}
                  onClick={() => handleModeChange('existing')}
                >
                  Existing PO
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Planning Method</label>
              <div className={styles.controlStackInline}>
                <div className={styles.methodGroup}>
                  {METHOD_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`${styles.methodButton} ${method === option ? styles.methodButtonActive : ''}`.trim()}
                      onClick={() => handleMethodChange(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label}>PO ID</label>
                {mode === 'existing' && selectedExistingPoId && !showExistingPoPicker && isEditablePoSuffix(header.poId) ? (
                  <button
                    type="button"
                    className={`${styles.iconButton} ${isEditingExistingPoSuffix ? styles.iconButtonActive : ''}`.trim()}
                    onClick={handleEnableExistingPoSuffixEdit}
                    aria-label="Edit PO suffix"
                    title="Edit PO suffix"
                  >
                    ✎
                  </button>
                ) : null}
              </div>
              {mode === 'new' ? (
                <div className={styles.inlineFieldRow}>
                  <input className={styles.inputReadonly} value={currentPoPrefix} readOnly />
                  <input
                    className={styles.input}
                    name="poSuffix"
                    value={currentPoSuffix}
                    onChange={handleHeaderChange}
                  />
                </div>
              ) : showExistingPoPicker || !selectedExistingPoId || (!isEditablePoSuffix(header.poId) && !isEditingExistingPoSuffix) ? (
                <select
                  className={styles.select}
                  value={selectedExistingPoId}
                  onChange={(event) => {
                    setSelectedExistingPoId(event.target.value)
                    void handleLoadExistingPo(event.target.value)
                  }}
                >
                  <option value="">Select existing PO</option>
                  {filteredExistingPos.map((item) => (
                    <option key={item.poId} value={item.poId}>
                      {item.poId}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={styles.poIdExistingWrap}>
                  <div className={styles.inlineFieldRow}>
                    <input className={styles.inputReadonly} value={getPoPrefix(header.poId)} readOnly />
                    <input
                      className={styles.input}
                      name="poSuffix"
                      value={getPoSuffix(header.poId)}
                      onChange={handleHeaderChange}
                      disabled={!isEditingExistingPoSuffix}
                    />
                  </div>
                  <button type="button" className={styles.ghostButton} onClick={handleChangeExistingPoSelection}>
                    Change PO
                  </button>
                </div>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Supplier</label>
              <select
                className={styles.select}
                name="supplierId"
                value={header.supplierId}
                onChange={handleHeaderChange}
                disabled={isExistingModeLocked}
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={`${supplier.source}-${supplier.id}`} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Request Delivery</label>
              <input
                className={styles.input}
                type="date"
                name="requestDeliveryDate"
                value={header.requestDeliveryDate}
                onChange={handleHeaderChange}
                disabled={isExistingModeLocked}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>PO Notes</label>
              <textarea
                className={styles.textarea}
                name="notes"
                value={header.notes}
                onChange={handleHeaderChange}
                placeholder="Optional planning notes"
                disabled={isExistingModeLocked}
              />
            </div>

            <div className={`${styles.field} ${styles.fullSpan} ${styles.leftOnlyLineNotes}`.trim()}>
              <label className={styles.label}>Line Notes</label>
              <textarea
                className={styles.textarea}
                name="notes"
                value={lineDraft.notes}
                onChange={handleDraftChange}
                placeholder="Optional notes for this product line"
              />
            </div>
          </div>

          <div className={styles.sizeSection}>
            <div className={styles.sizeHeader}>
              <div>
              <h3 className={styles.sizeTitle}>Qty by Size</h3>
              <p className={styles.sizeMeta}>
                {selectedDraftProduct
                  ? selectedDraftProduct.namaProduk
                  : 'Choose a product to start filling the size matrix.'}
              </p>
              </div>
            </div>

            <div className={styles.sizeGrid}>
              {SIZE_OPTIONS.map((size) => (
                <label key={size} className={styles.sizeField}>
                  <span>{size}</span>
                  <input
                    className={styles.sizeInput}
                    inputMode="numeric"
                    value={lineDraft.qtyBySize[size]}
                    onChange={(event) => handleDraftSizeChange(size, event.target.value)}
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className={styles.inlineActions}>
            <button type="button" className={styles.primaryButton} onClick={handleAddOrUpdateLine}>
              {lineDraft.dbId || lineDraft.localId ? 'Update Line' : 'Add Line'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => resetLineDraft({ ...createEmptyLineDraft(), allowancePct: method === 'CMT' ? '3' : '0' })}
            >
              Clear Line
            </button>
            {lineError ? <p className={styles.inlineErrorText}>{lineError}</p> : null}
            {method === 'CMT' ? (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => void rebuildMaterialPreview(poItems, method)}
                disabled={!poItems.length || generatingMaterials}
              >
                {generatingMaterials ? 'Generating...' : 'Generate Materials'}
              </button>
            ) : null}
          </div>
        </section>

        <section ref={plannedLinesSectionRef} className={`${styles.sectionCard} ${styles.plannedLinesCard}`.trim()}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Planned Product Lines</h2>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.categoryField}`.trim()}>
              <label className={styles.label}>Category</label>
              <select
                className={styles.select}
                value={categoryFilter}
                disabled={isExistingModeLocked}
                onChange={(event) => {
                  const nextCategory = event.target.value
                  setCategoryFilter(nextCategory)

                  if (lineDraft.skuInduk && productBySku[lineDraft.skuInduk]?.kategoriProduk !== nextCategory && nextCategory) {
                    resetLineDraft({
                      ...createEmptyLineDraft(),
                      allowancePct: lineDraft.allowancePct,
                    })
                  }
                }}
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.field} ${styles.productField}`.trim()}>
              <label className={styles.label}>Product</label>
              <div className={styles.comboBox}>
                <input
                  className={styles.input}
                  name="productSearch"
                  value={productSearch}
                  disabled={isExistingModeLocked}
                  onChange={handleDraftChange}
                  onFocus={() => setShowProductOptions(true)}
                  onClick={handleProductFieldClick}
                  onBlur={() => {
                    window.setTimeout(() => {
                      setShowProductOptions(false)
                    }, 120)
                  }}
                  placeholder={
                    filteredProducts.length
                      ? 'Type product name'
                      : products.length
                        ? 'No product in this category'
                        : 'No Arkline product found'
                  }
                />
                {showProductOptions && filteredProducts.length ? (
                  <div className={styles.comboList}>
                    {filteredProducts.map((item) => (
                      <button
                        key={`${item.skuInduk}-${createProductSearchLabel(item)}`}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          handleProductChange(item.skuInduk)
                        }}
                        className={styles.comboOption}
                      >
                        <strong>{createProductSearchLabel(item)}</strong>
                        <span className={styles.comboOptionMeta}>
                          {item.kategoriProduk || 'NO CATEGORY'}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className={`${styles.field} ${styles.allowanceField}`.trim()}>
              <label className={styles.label}>Allowance %</label>
              <input
                className={styles.input}
                name="allowancePct"
                value={lineDraft.allowancePct}
                onChange={handleDraftChange}
                placeholder="3"
                disabled={isExistingModeLocked}
              />
            </div>

            <div className={`${styles.field} ${styles.hppField}`.trim()}>
              <label className={styles.label}>HPP</label>
              <input
                className={styles.input}
                name="hpp"
                inputMode="decimal"
                value={method === 'FOB' ? formatNumberInput(lineDraft.hpp ?? '') : ''}
                onChange={handleDraftChange}
                disabled={isHppDisabled}
                placeholder="0"
              />
            </div>

          </div>

          <div className={styles.sizeSection}>
            <div className={styles.sizeHeader}>
              <h3 className={styles.sizeTitle}>Qty by Size</h3>
              <p className={styles.sizeMeta}>
                {selectedDraftProduct
                  ? selectedDraftProduct.namaProduk
                  : 'Choose a product to start filling the size matrix.'}
              </p>
              <div className={styles.draftQtyInline}>Draft Qty: <strong>{formatQuantity(lineTotalQty)}</strong></div>
            </div>

            <div className={styles.sizeGrid}>
              {SIZE_OPTIONS.map((size) => (
                <label key={size} className={styles.sizeField}>
                  <span>{size}</span>
                  <input
                    className={styles.sizeInput}
                    inputMode="numeric"
                    value={lineDraft.qtyBySize[size]}
                    onChange={(event) => handleDraftSizeChange(size, event.target.value)}
                    placeholder="0"
                    disabled={isExistingModeLocked}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.fullSpan}`.trim()}>
              <label className={styles.label}>Product Notes</label>
              <textarea
                className={styles.textarea}
                name="notes"
                value={lineDraft.notes}
                onChange={handleDraftChange}
                placeholder="Optional notes for this product line"
                disabled={isExistingModeLocked}
              />
            </div>
          </div>

          <div className={styles.inlineActions}>
            <button type="button" className={styles.primaryButton} onClick={handleAddOrUpdateLine} disabled={isExistingModeLocked}>
              {isEditingLine ? 'Update Line' : 'Add Line'}
            </button>
            {isEditingLine ? (
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleCancelUpdateLine}
                disabled={isExistingModeLocked}
              >
                Cancel Update
              </button>
            ) : null}
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => resetLineDraft({ ...createEmptyLineDraft(), allowancePct: method === 'CMT' ? '3' : '0' })}
              disabled={isExistingModeLocked}
            >
              Clear Line
            </button>
            {method === 'CMT' ? (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => void rebuildMaterialPreview(poItems, method)}
                disabled={isExistingModeLocked || !poItems.length || generatingMaterials}
              >
                {generatingMaterials ? 'Generating...' : 'Generate Materials'}
              </button>
            ) : null}
            <div className={styles.compactStats}>
              <div className={styles.miniStatCard}>
                <span>Items</span>
                <strong>{poItems.length}</strong>
              </div>
              <div className={styles.miniStatCard}>
                <span>Total Qty</span>
                <strong>{formatQuantity(totalPlannedQty)}</strong>
              </div>
            </div>
          </div>

          {!poItems.length ? (
            <div className={styles.emptyState}>No product line has been added to this PO yet.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Total Qty</th>
                    <th>HPP</th>
                    <th>Size Breakdown</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {poItems.map((item) => {
                    const productDisplay = resolveLineProductDisplay(item)

                    return (
                      <tr key={item.localId}>
                        <td>
                          <strong>{productDisplay.namaProduk}</strong>
                          <div className={styles.cellSubtext}>{item.skuInduk}</div>
                        </td>
                        <td>{formatQuantity(getLineTotalQty(item))}</td>
                        <td>{method === 'FOB' ? formatQuantity(toNumber(item.hpp)) : '-'}</td>
                        <td className={styles.sizeBreakdownCell}>
                          <div className={styles.sizeTagRow}>
                            {SIZE_OPTIONS.map((size) => {
                              const qty = toNumber(item.qtyBySize[size])
                              if (qty <= 0) return null
                              return (
                                <span key={size} className={styles.sizeTag}>
                                  {size}: {formatQuantity(qty)}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                        <td>
                          <div className={styles.actionRow}>
                            <button
                              type="button"
                              className={styles.iconOnlyButton}
                              onClick={() => handleEditLine(item.localId)}
                              aria-label="Edit line"
                              title="Edit line"
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconOnlyButton} ${styles.iconOnlyDangerButton}`.trim()}
                              onClick={() => handleRemoveLine(item.localId)}
                              aria-label="Remove line"
                              title="Remove line"
                            >
                              X
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </div>

        {method === 'CMT' ? (
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Material Preview</h2>
                <p className={styles.sectionCopy}>
                  Material preview is rebuilt from BOM and allowance so the saved result matches the generated planning lines.
                </p>
              </div>
              <div className={styles.statGroup}>
                <div className={styles.statPill}>
                  Material Lines
                  <strong>{totalMaterialLines}</strong>
                </div>
                <div className={styles.statPill}>
                  Final Qty
                  <strong>{formatQuantity(totalMaterialFinalQty)}</strong>
                </div>
              </div>
            </div>

            {materialWarnings.length ? (
              <div className={styles.warningBox}>
                {materialWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            {!materialPreview.length ? (
              <div className={styles.emptyState}>
                Add product lines and generate materials to see the calculated BOM output here.
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Size Variant</th>
                      <th>Color Variant</th>
                      <th>Unit</th>
                      <th>Generated Qty</th>
                      <th>Final Qty</th>
                      <th>Source SKU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialPreview.map((line) => (
                      <tr key={`${line.materialId}-${line.sizeVariant}-${line.colorVariant}-${line.sourceSku}`}>
                        <td>{buildMaterialLabel(line) || '-'}</td>
                        <td>{line.sizeVariant || '-'}</td>
                        <td>{line.colorVariant || '-'}</td>
                        <td>{line.unit || '-'}</td>
                        <td>{formatQuantity(line.generatedQty)}</td>
                        <td>{formatQuantity(line.finalQty)}</td>
                        <td>{line.sourceSku || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

      </section>

      {showLeaveConfirm ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Unsaved Planning Changes</h3>
            <p className={styles.modalCopy}>
              Product line changes are still in draft. `Update Line` belum menyimpan ke database sebelum `Save Planning`.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={handleStayOnPlanning}>
                Stay Here
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleLeaveWithoutSaving}>
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
