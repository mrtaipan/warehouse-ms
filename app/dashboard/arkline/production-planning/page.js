'use client'

import { useEffect, useMemo, useState } from 'react'

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
    allowancePct: '3',
    status: 'Initiated',
    notes: '',
    qtyBySize: createEmptySizeQuantities(),
  }
}

function createInitialHeader() {
  return {
    poId: '',
    supplierId: '',
    supplierName: '',
    requestDeliveryDate: '',
    updatedDeliveryDate: '',
    completionDate: '',
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
    supplierCode: String(row?.supplier_code || '').trim().toUpperCase(),
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
    supplierNameSnapshot: String(row?.supplier_name_snapshot || '').trim().toUpperCase(),
    createdAt: String(row?.created_at || ''),
  }
}

function normalizeBomLine(row) {
  return {
    id: row?.id || null,
    skuInduk: String(row?.sku_induk || '').trim().toUpperCase(),
    kategoriProduk: String(row?.kategori_produk || '').trim().toUpperCase(),
    materialCode: String(row?.material_code || row?.bahan_id || '').trim().toUpperCase(),
    materialName: String(row?.material_name || row?.material_name_snapshot || row?.nama_bahan || '').trim().toUpperCase(),
    unit: String(row?.unit || row?.satuan || 'PCS').trim().toUpperCase(),
    size: String(row?.size || row?.size_label || '').trim().toUpperCase(),
    qtyPer1: Number(row?.qty_per_1 || row?.qty_per_unit || 0) || 0,
    wastePct: Number(row?.waste_pct || 0) || 0,
    isActive: row?.is_active !== false,
  }
}

function normalizeMaterialLine(row) {
  return {
    materialCode: String(row?.material_code || '').trim().toUpperCase(),
    materialNameSnapshot: String(row?.material_name_snapshot || '').trim().toUpperCase(),
    unit: String(row?.unit || 'PCS').trim().toUpperCase(),
    size: String(row?.size || '').trim().toUpperCase(),
    generatedQty: Number(row?.generated_qty || 0) || 0,
    finalQty: Number(row?.final_qty || 0) || 0,
    sourceSku: String(row?.source_sku_induk || '').trim().toUpperCase(),
  }
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

function buildNextPoId(records) {
  const maxNumber = records.reduce((highest, item) => {
    const match = String(item?.poId || '').match(/(\d+)(?!.*\d)/)
    if (!match) return highest
    return Math.max(highest, Number(match[1]))
  }, 0)

  return `ARK-PO-${String(maxNumber + 1).padStart(5, '0')}`
}

function getLineTotalQty(line) {
  return Object.values(line.qtyBySize || {}).reduce((sum, current) => sum + toNumber(current), 0)
}

function cloneLine(line) {
  return {
    ...line,
    qtyBySize: { ...line.qtyBySize },
  }
}

function buildSnapshot(header, items, method) {
  return {
    header: {
      poId: header.poId,
      supplierId: header.supplierId,
      supplierName: header.supplierName,
      requestDeliveryDate: header.requestDeliveryDate,
      updatedDeliveryDate: header.updatedDeliveryDate,
      completionDate: header.completionDate,
      status: header.status,
      notes: header.notes,
      method,
    },
    items: items
      .map((item) => ({
        skuInduk: item.skuInduk,
        allowancePct: String(item.allowancePct || ''),
        status: item.status,
        notes: item.notes,
        totalQty: getLineTotalQty(item),
        qtyBySize: { ...item.qtyBySize },
      }))
      .sort((left, right) => left.skuInduk.localeCompare(right.skuInduk)),
  }
}

function buildHistoryEntries(previousSnapshot, nextSnapshot, poDbId, userEmail) {
  const entries = []
  const timestamp = new Date().toISOString()

  if (!previousSnapshot) {
    entries.push({
      arkline_po_id: poDbId,
      arkline_po_item_id: null,
      change_type: 'create_po',
      field_name: 'po_id',
      old_value: null,
      new_value: nextSnapshot.header.poId,
      created_by: userEmail,
      created_at: timestamp,
    })

    nextSnapshot.items.forEach((item) => {
      entries.push({
        arkline_po_id: poDbId,
        arkline_po_item_id: null,
        change_type: 'create_item',
        field_name: item.skuInduk,
        old_value: null,
        new_value: JSON.stringify(item),
        created_by: userEmail,
        created_at: timestamp,
      })
    })

    return entries
  }

  const watchedHeaderFields = [
    'supplierId',
    'supplierName',
    'requestDeliveryDate',
    'updatedDeliveryDate',
    'completionDate',
    'status',
    'notes',
    'method',
  ]

  watchedHeaderFields.forEach((fieldName) => {
    if ((previousSnapshot.header[fieldName] || '') === (nextSnapshot.header[fieldName] || '')) {
      return
    }

    entries.push({
      arkline_po_id: poDbId,
      arkline_po_item_id: null,
      change_type: 'update_header',
      field_name: fieldName,
      old_value: String(previousSnapshot.header[fieldName] || ''),
      new_value: String(nextSnapshot.header[fieldName] || ''),
      created_by: userEmail,
      created_at: timestamp,
    })
  })

  const previousItems = new Map(previousSnapshot.items.map((item) => [item.skuInduk, item]))
  const nextItems = new Map(nextSnapshot.items.map((item) => [item.skuInduk, item]))

  nextItems.forEach((item, skuInduk) => {
    const previous = previousItems.get(skuInduk)

    if (!previous) {
      entries.push({
        arkline_po_id: poDbId,
        arkline_po_item_id: null,
        change_type: 'add_item',
        field_name: skuInduk,
        old_value: null,
        new_value: JSON.stringify(item),
        created_by: userEmail,
        created_at: timestamp,
      })
      return
    }

    if (JSON.stringify(previous) === JSON.stringify(item)) {
      return
    }

    entries.push({
      arkline_po_id: poDbId,
      arkline_po_item_id: null,
      change_type: 'update_item',
      field_name: skuInduk,
      old_value: JSON.stringify(previous),
      new_value: JSON.stringify(item),
      created_by: userEmail,
      created_at: timestamp,
    })
  })

  previousItems.forEach((item, skuInduk) => {
    if (nextItems.has(skuInduk)) return

    entries.push({
      arkline_po_id: poDbId,
      arkline_po_item_id: null,
      change_type: 'remove_item',
      field_name: skuInduk,
      old_value: JSON.stringify(item),
      new_value: null,
      created_by: userEmail,
      created_at: timestamp,
    })
  })

  return entries
}

function createPrintHtml(bundle) {
  const itemRows = bundle.items
    .map((item) => {
      const sizePairs = SIZE_OPTIONS.map((size) => {
        const value = toNumber(item.qtyBySize[size])
        return value > 0 ? `<span><strong>${size}</strong>: ${formatQuantity(value)}</span>` : ''
      })
        .filter(Boolean)
        .join(' &nbsp; ')

      return `
        <tr>
          <td>${item.skuInduk}</td>
          <td>${item.namaProdukSnapshot}</td>
          <td>${item.kategoriProdukSnapshot || '-'}</td>
          <td>${formatQuantity(getLineTotalQty(item))}</td>
          <td>${item.allowancePct || '0'}%</td>
          <td>${item.status}</td>
          <td>${sizePairs || '-'}</td>
        </tr>
      `
    })
    .join('')

  const materialRows =
    bundle.method === 'CMT'
      ? bundle.materials
          .map(
            (line) => `
            <tr>
              <td>${line.materialCode || '-'}</td>
              <td>${line.materialNameSnapshot || '-'}</td>
              <td>${line.size || '-'}</td>
              <td>${line.unit || '-'}</td>
              <td>${formatQuantity(line.generatedQty)}</td>
              <td>${formatQuantity(line.finalQty)}</td>
              <td>${line.sourceSku || '-'}</td>
            </tr>
          `
          )
          .join('')
      : ''

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${bundle.poId} - Arkline Production Planning</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          h2 { margin: 24px 0 10px; font-size: 18px; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 24px; margin: 18px 0 22px; }
          .meta div { font-size: 13px; }
          .meta strong { display: block; color: #475569; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #d1d5db; padding: 10px; vertical-align: top; font-size: 12px; text-align: left; }
          th { background: #f8fafc; }
          .noteBox { margin-top: 18px; padding: 14px; border: 1px solid #d1d5db; border-radius: 12px; font-size: 12px; background: #fbfdff; }
        </style>
      </head>
      <body>
        <h1>Arkline Production Planning</h1>
        <div class="meta">
          <div><strong>PO ID</strong>${bundle.poId}</div>
          <div><strong>Method</strong>${bundle.method}</div>
          <div><strong>Supplier</strong>${bundle.header.supplierName || '-'}</div>
          <div><strong>Status</strong>${bundle.header.status || '-'}</div>
          <div><strong>Request Delivery</strong>${bundle.header.requestDeliveryDate || '-'}</div>
          <div><strong>Updated Delivery</strong>${bundle.header.updatedDeliveryDate || '-'}</div>
        </div>

        <h2>Planned Items</h2>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Category</th>
              <th>Total Qty</th>
              <th>Allowance</th>
              <th>Status</th>
              <th>Qty by Size</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        ${
          bundle.method === 'CMT'
            ? `
              <h2>Generated Materials</h2>
              <table>
                <thead>
                  <tr>
                    <th>Material Code</th>
                    <th>Material Name</th>
                    <th>Size</th>
                    <th>Unit</th>
                    <th>Generated Qty</th>
                    <th>Final Qty</th>
                    <th>Source SKU</th>
                  </tr>
                </thead>
                <tbody>${materialRows || '<tr><td colspan="7">No material lines.</td></tr>'}</tbody>
              </table>
            `
            : ''
        }

        <div class="noteBox"><strong>Notes:</strong><br />${bundle.header.notes || '-'}</div>
        <script>window.onload = function(){ window.print(); }</script>
      </body>
    </html>
  `
}

async function loadSuppliers() {
  const arklineResponse = await supabase
    .from('dir_arkline_suppliers')
    .select('id, supplier_name, supplier_code, is_active')
    .order('supplier_name', { ascending: true })

  if (!arklineResponse.error) {
    return (arklineResponse.data || [])
      .map((item) => normalizeSupplier(item, 'arkline'))
      .filter((item) => item.isActive && item.supplierName)
  }

  const fallbackResponse = await supabase
    .from('dir_suppliers')
    .select('id, supplier_name, supplier_code, is_active')
    .order('supplier_name', { ascending: true })

  if (fallbackResponse.error) {
    throw new Error(fallbackResponse.error.message)
  }

  return (fallbackResponse.data || [])
    .map((item) => normalizeSupplier(item, 'regular'))
    .filter((item) => item.isActive && item.supplierName)
}

async function loadProducts() {
  const { data, error } = await supabase
    .from('dir_arkline_products')
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
    .select('id, po_id, method, status, request_delivery_date, supplier_name_snapshot, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map(normalizePo)
}

async function loadBomLinesForProduct(product) {
  const directResponse = await supabase
    .from('dir_arkline_bom_lines')
    .select(
      'id, sku_induk, kategori_produk, material_code, material_name, unit, size, qty_per_1, waste_pct, is_active'
    )
    .eq('is_active', true)
    .eq('sku_induk', product.skuInduk)

  if (directResponse.error && directResponse.error.code !== 'PGRST116') {
    throw new Error(directResponse.error.message)
  }

  let lines = (directResponse.data || []).map(normalizeBomLine)

  if (!lines.length && product.kategoriProduk) {
    const categoryResponse = await supabase
      .from('dir_arkline_bom_lines')
      .select(
        'id, sku_induk, kategori_produk, material_code, material_name, unit, size, qty_per_1, waste_pct, is_active'
      )
      .eq('is_active', true)
      .is('sku_induk', null)
      .eq('kategori_produk', product.kategoriProduk)

    if (categoryResponse.error && categoryResponse.error.code !== 'PGRST116') {
      throw new Error(categoryResponse.error.message)
    }

    lines = (categoryResponse.data || []).map(normalizeBomLine)
  }

  return lines
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
    .eq('arkline_po_id', poRow.id)
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

  const { data: materialRows, error: materialError } = await supabase
    .from('arkline_po_material_lines')
    .select('*')
    .eq('arkline_po_id', poRow.id)
    .order('material_name_snapshot', { ascending: true })
    .order('size', { ascending: true })

  if (materialError) {
    throw new Error(materialError.message)
  }

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
      namaProdukSnapshot: String(item.nama_produk_snapshot || '').trim().toUpperCase(),
      kategoriProdukSnapshot: String(item.kategori_produk_snapshot || '').trim().toUpperCase(),
      allowancePct: String(item.allowance_pct ?? '0'),
      status: String(item.status || 'Initiated'),
      notes: String(item.notes || ''),
      actualQty: Number(item.actual_qty || 0) || 0,
      qtyBySize,
    }
  })

  return {
    po: poRow,
    items: normalizedItems,
    materials: (materialRows || []).map(normalizeMaterialLine),
  }
}

export default function ArklineProductionPlanningPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingMaterials, setGeneratingMaterials] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [existingPos, setExistingPos] = useState([])

  const [mode, setMode] = useState('new')
  const [method, setMethod] = useState('FOB')
  const [selectedExistingPoId, setSelectedExistingPoId] = useState('')
  const [currentPoDbId, setCurrentPoDbId] = useState(null)

  const [header, setHeader] = useState(createInitialHeader())
  const [categoryFilter, setCategoryFilter] = useState('')
  const [lineDraft, setLineDraft] = useState(createEmptyLineDraft())
  const [poItems, setPoItems] = useState([])
  const [materialPreview, setMaterialPreview] = useState([])
  const [materialWarnings, setMaterialWarnings] = useState([])
  const [loadedSnapshot, setLoadedSnapshot] = useState(null)

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

  const filteredProducts = useMemo(() => {
    if (!categoryFilter) return products
    return products.filter((item) => item.kategoriProduk === categoryFilter)
  }, [categoryFilter, products])

  const selectedDraftProduct = lineDraft.skuInduk ? productBySku[lineDraft.skuInduk] || null : null

  const totalPlannedQty = useMemo(
    () => poItems.reduce((sum, item) => sum + getLineTotalQty(item), 0),
    [poItems]
  )

  const totalMaterialLines = materialPreview.length
  const totalMaterialFinalQty = materialPreview.reduce((sum, item) => sum + Number(item.finalQty || 0), 0)

  function resetLineDraft(nextDraft = createEmptyLineDraft()) {
    setLineDraft(nextDraft)
    if (nextDraft.kategoriProdukSnapshot) {
      setCategoryFilter(nextDraft.kategoriProdukSnapshot)
    }
  }

  function resetPlanningState(nextMode = 'new', poRows = existingPos) {
    setMode(nextMode)
    setMethod('FOB')
    setSelectedExistingPoId('')
    setCurrentPoDbId(null)
    setHeader({
      ...createInitialHeader(),
      poId: buildNextPoId(poRows),
    })
    setCategoryFilter('')
    setPoItems([])
    setMaterialPreview([])
    setMaterialWarnings([])
    setLoadedSnapshot(null)
    resetLineDraft()
    setError('')
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
          kategoriProduk: item.kategoriProdukSnapshot,
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

          const matchingLines = bomLines.filter((line) => !line.size || line.size === 'ALL' || line.size === size)

          if (!matchingLines.length) {
            warnings.push(`No BOM line matches ${item.namaProdukSnapshot || item.skuInduk} size ${size}.`)
            return
          }

          matchingLines.forEach((line) => {
            const generatedQty = roundQuantity(requestedQty * toNumber(line.qtyPer1))
            const finalQty = roundQuantity(generatedQty * (1 + (allowancePct + toNumber(line.wastePct)) / 100))
            const key = [line.materialCode, line.materialName, line.unit, line.size || size, item.skuInduk].join('|')
            const existing = aggregate.get(key)

            if (!existing) {
              aggregate.set(key, {
                materialCode: line.materialCode,
                materialNameSnapshot: line.materialName,
                unit: line.unit,
                size: line.size || size,
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
          `${left.materialNameSnapshot}-${left.size}`.localeCompare(`${right.materialNameSnapshot}-${right.size}`)
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
    setSuccess('')
    setError('')

    if (nextMethod === 'FOB') {
      setMaterialPreview([])
      setMaterialWarnings([])
      return
    }

    void rebuildMaterialPreview(poItems, nextMethod)
  }

  function handleHeaderChange(event) {
    const { name, value } = event.target

    if (name === 'supplierId') {
      const selected = suppliers.find((item) => item.id === value)
      setHeader((prev) => ({
        ...prev,
        supplierId: value,
        supplierName: selected?.supplierName || '',
      }))
      return
    }

    setHeader((prev) => ({
      ...prev,
      [name]: value,
    }))
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
  }

  function handleDraftChange(event) {
    const { name, value } = event.target

    if (name === 'allowancePct') {
      const numericValue = value.replace(/[^\d.]/g, '')
      setLineDraft((prev) => ({
        ...prev,
        allowancePct: numericValue,
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
      }))
      return
    }

    setLineDraft((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function validateLineDraft() {
    if (!lineDraft.skuInduk) {
      setError('Choose an Arkline product first.')
      return null
    }

    const product = productBySku[lineDraft.skuInduk]
    if (!product) {
      setError('Selected product is no longer available.')
      return null
    }

    const totalQty = getLineTotalQty(lineDraft)
    if (totalQty <= 0) {
      setError('Enter at least one size quantity before adding the line.')
      return null
    }

    return {
      ...cloneLine(lineDraft),
      localId: lineDraft.localId || `draft-${Date.now()}`,
      namaProdukSnapshot: product.namaProduk,
      kategoriProdukSnapshot: product.kategoriProduk,
      allowancePct: method === 'CMT' ? String(lineDraft.allowancePct || '0') : '0',
    }
  }

  function handleAddOrUpdateLine() {
    setError('')
    setSuccess('')

    const prepared = validateLineDraft()
    if (!prepared) return

    const duplicate = poItems.find((item) => item.skuInduk === prepared.skuInduk && item.localId !== prepared.localId)
    if (duplicate) {
      setError('This SKU already exists in the current PO. Edit the existing line instead of adding a duplicate.')
      return
    }

    const nextItems = poItems.some((item) => item.localId === prepared.localId)
      ? poItems.map((item) => (item.localId === prepared.localId ? prepared : item))
      : [...poItems, prepared]

    setPoItems(nextItems)
    resetLineDraft()
    setSuccess(prepared.dbId ? 'PO line updated in draft.' : 'PO line added to draft.')

    if (method === 'CMT') {
      void rebuildMaterialPreview(nextItems, method)
    }
  }

  function handleEditLine(localId) {
    const target = poItems.find((item) => item.localId === localId)
    if (!target) return
    resetLineDraft(cloneLine(target))
    setError('')
    setSuccess('')
  }

  function handleRemoveLine(localId) {
    const nextItems = poItems.filter((item) => item.localId !== localId)
    setPoItems(nextItems)

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
        supplierName: String(bundle.po.supplier_name_snapshot || '').trim().toUpperCase(),
        requestDeliveryDate: String(bundle.po.request_delivery_date || '').slice(0, 10),
        updatedDeliveryDate: String(bundle.po.updated_delivery_date || '').slice(0, 10),
        completionDate: String(bundle.po.completion_date || '').slice(0, 10),
        status: String(bundle.po.status || 'Draft'),
        notes: String(bundle.po.notes || ''),
      }

      setMode('existing')
      setMethod(String(bundle.po.method || 'FOB').trim().toUpperCase())
      setSelectedExistingPoId(normalizedHeader.poId)
      setCurrentPoDbId(bundle.po.id)
      setHeader(normalizedHeader)
      setCategoryFilter('')
      setPoItems(bundle.items)
      setMaterialPreview(bundle.materials)
      setMaterialWarnings([])
      resetLineDraft()
      setLoadedSnapshot(buildSnapshot(normalizedHeader, bundle.items, String(bundle.po.method || 'FOB').trim().toUpperCase()))
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

        if (!materialPreview.length) {
          throw new Error('Generate material preview first for CMT PO.')
        }
      }

      let poDbId = currentPoDbId

      const headerPayload = {
        po_id: header.poId.trim().toUpperCase(),
        mode,
        method,
        supplier_id: header.supplierId ? Number(header.supplierId) || header.supplierId : null,
        supplier_name_snapshot: header.supplierName || null,
        request_delivery_date: header.requestDeliveryDate || null,
        updated_delivery_date: header.updatedDeliveryDate || null,
        completion_date: header.completionDate || null,
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
          .eq('arkline_po_id', poDbId)

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

        const { error: deleteMaterialError } = await supabase.from('arkline_po_material_lines').delete().eq('arkline_po_id', poDbId)

        if (deleteMaterialError) {
          throw new Error(deleteMaterialError.message)
        }

        const { error: deleteItemError } = await supabase.from('arkline_po_items').delete().eq('arkline_po_id', poDbId)

        if (deleteItemError) {
          throw new Error(deleteItemError.message)
        }
      }

      const itemPayload = poItems.map((item) => ({
        arkline_po_id: poDbId,
        sku_induk: item.skuInduk,
        nama_produk_snapshot: item.namaProdukSnapshot,
        kategori_produk_snapshot: item.kategoriProdukSnapshot || null,
        allowance_pct: method === 'CMT' ? toNumber(item.allowancePct) : 0,
        total_qty: getLineTotalQty(item),
        actual_qty: getLineTotalQty(item),
        status: item.status || 'Initiated',
        notes: item.notes.trim() || null,
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

      if (method === 'CMT' && materialPreview.length) {
        const materialPayload = materialPreview.map((line) => ({
          arkline_po_id: poDbId,
          arkline_po_item_id: insertedBySku[line.sourceSku]?.id || null,
          material_code: line.materialCode || null,
          material_name_snapshot: line.materialNameSnapshot || null,
          size: line.size || null,
          generated_qty: roundQuantity(line.generatedQty),
          final_qty: roundQuantity(line.finalQty),
          unit: line.unit || 'PCS',
          source_sku_induk: line.sourceSku || null,
        }))

        const { error: insertMaterialError } = await supabase.from('arkline_po_material_lines').insert(materialPayload)
        if (insertMaterialError) {
          throw new Error(insertMaterialError.message)
        }
      }

      const nextSnapshot = buildSnapshot(header, poItems, method)
      const historyEntries = buildHistoryEntries(loadedSnapshot, nextSnapshot, poDbId, userEmail)
      if (historyEntries.length) {
        const { error: historyError } = await supabase.from('arkline_po_history').insert(historyEntries)
        if (historyError) {
          throw new Error(historyError.message)
        }
      }

      const refreshedPos = await refreshPoListAndKeepSelection(header.poId)
      setCurrentPoDbId(poDbId)
      setMode('existing')
      setSelectedExistingPoId(header.poId)
      setLoadedSnapshot(nextSnapshot)
      resetLineDraft()
      setSuccess(`PO ${header.poId} saved successfully.`)

      if (!currentPoDbId) {
        setHeader((prev) => ({
          ...prev,
          poId: prev.poId,
        }))
      }

      if (mode === 'new') {
        setExistingPos(refreshedPos)
      }
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

    try {
      const bundle = await fetchPoBundle(header.poId)
      const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800')

      if (!printWindow) {
        throw new Error('Popup blocked. Please allow popups to print the PO.')
      }

      printWindow.document.open()
      printWindow.document.write(
        createPrintHtml({
          poId: header.poId,
          method,
          header,
          items: bundle.items,
          materials: bundle.materials,
        })
      )
      printWindow.document.close()
    } catch (printError) {
      setError(printError.message || 'Failed to prepare print view.')
    } finally {
      setPrinting(false)
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
        </div>

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
              <label className={styles.label}>PO ID</label>
              {mode === 'new' ? (
                <input
                  className={styles.input}
                  name="poId"
                  value={header.poId}
                  onChange={handleHeaderChange}
                  placeholder="ARK-PO-00001"
                />
              ) : (
                <select
                  className={styles.select}
                  value={selectedExistingPoId}
                  onChange={(event) => {
                    setSelectedExistingPoId(event.target.value)
                    void handleLoadExistingPo(event.target.value)
                  }}
                >
                  <option value="">Select existing PO</option>
                  {existingPos.map((item) => (
                    <option key={item.poId} value={item.poId}>
                      {item.poId} · {item.method} · {item.status}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Supplier</label>
              <select className={styles.select} name="supplierId" value={header.supplierId} onChange={handleHeaderChange}>
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={`${supplier.source}-${supplier.id}`} value={supplier.id}>
                    {supplier.supplierName}
                    {supplier.supplierCode ? ` · ${supplier.supplierCode}` : ''}
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
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Updated Delivery</label>
              <input
                className={styles.input}
                type="date"
                name="updatedDeliveryDate"
                value={header.updatedDeliveryDate}
                onChange={handleHeaderChange}
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
                  ? `${selectedDraftProduct.namaProduk} · ${selectedDraftProduct.kategoriProduk || 'NO CATEGORY'}`
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

        <section className={`${styles.sectionCard} ${styles.plannedLinesCard}`.trim()}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Planned Product Lines</h2>
              <p className={styles.sectionCopy}>
                Choose the product details, add the size split, then review all planned lines before saving.
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Category</label>
              <select
                className={styles.select}
                value={categoryFilter}
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

            <div className={styles.field}>
              <label className={styles.label}>Product</label>
              <select className={styles.select} name="skuInduk" value={lineDraft.skuInduk} onChange={handleDraftChange}>
                <option value="">Select product</option>
                {filteredProducts.map((item) => (
                  <option key={item.skuInduk} value={item.skuInduk}>
                    {item.namaProduk}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Allowance %</label>
              <input
                className={styles.input}
                name="allowancePct"
                value={method === 'CMT' ? lineDraft.allowancePct : '0'}
                onChange={handleDraftChange}
                disabled={method !== 'CMT'}
                placeholder="3"
              />
            </div>

          </div>

          <div className={styles.sizeSection}>
            <div className={styles.sizeHeader}>
              <h3 className={styles.sizeTitle}>Qty by Size</h3>
              <p className={styles.sizeMeta}>
                {selectedDraftProduct
                  ? `${selectedDraftProduct.namaProduk} Â· ${selectedDraftProduct.kategoriProduk || 'NO CATEGORY'}`
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
              />
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
                    <th>Category</th>
                    <th>Total Qty</th>
                    <th>Allowance</th>
                    <th>Size Split</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {poItems.map((item) => (
                    <tr key={item.localId}>
                      <td>
                        <strong>{item.namaProdukSnapshot}</strong>
                        <div className={styles.cellSubtext}>{item.skuInduk}</div>
                      </td>
                      <td>{item.kategoriProdukSnapshot || '-'}</td>
                      <td>{formatQuantity(getLineTotalQty(item))}</td>
                      <td>{method === 'CMT' ? `${item.allowancePct || '0'}%` : '-'}</td>
                      <td>
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
                          <button type="button" className={styles.secondaryButton} onClick={() => handleEditLine(item.localId)}>
                            Edit
                          </button>
                          <button type="button" className={styles.ghostButton} onClick={() => handleRemoveLine(item.localId)}>
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                      <th>Material Code</th>
                      <th>Material</th>
                      <th>Size</th>
                      <th>Unit</th>
                      <th>Generated Qty</th>
                      <th>Final Qty</th>
                      <th>Source SKU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialPreview.map((line) => (
                      <tr key={`${line.materialCode}-${line.size}-${line.sourceSku}`}>
                        <td>{line.materialCode || '-'}</td>
                        <td>{line.materialNameSnapshot || '-'}</td>
                        <td>{line.size || '-'}</td>
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

        {(error || success) && (
          <div className={styles.feedbackStrip}>
            {error ? <p className={styles.errorText}>{error}</p> : null}
            {success ? <p className={styles.successText}>{success}</p> : null}
          </div>
        )}

        <div className={styles.footerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => resetPlanningState('new')}>
            Reset Planning
          </button>
          <button type="button" className={styles.ghostButton} onClick={handlePrint} disabled={printing || !header.poId}>
            {printing ? 'Preparing Print...' : 'Print PO'}
          </button>
          <button type="button" className={styles.primaryButton} onClick={handleSavePo} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Planning'}
          </button>
        </div>
      </section>
    </div>
  )
}
