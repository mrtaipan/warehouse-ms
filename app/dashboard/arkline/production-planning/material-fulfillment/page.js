'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import shellStyles from '../../arkline.module.css'
import styles from '../production-planning.module.css'

const supabase = createClient()

const MRP_MODE_OPTIONS = [
  { id: 'existing-po', label: 'PO Material Purchase' },
  { id: 'free-material', label: 'Free Material Purchase' },
]

function createOrderHeaderDraft() {
  return {
    supplierId: '',
    supplierName: '',
    paymentTerms: '',
    requestDeliveryDate: '',
    notes: '',
  }
}

function createFreeMaterialDraft() {
  return {
    materialId: '',
    qty: '',
  }
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value || '').replace(/[^\d.-]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function formatQty(value) {
  const number = toNumber(value)
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '')
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function normalizeMaterialRequirement(row) {
  return {
    id: String(row?.id || '').trim(),
    poId: String(row?.po_id || '').trim().toUpperCase(),
    arklinePoItemId: String(row?.arkline_po_item_id || '').trim(),
    skuInduk: String(row?.sku_induk || '').trim().toUpperCase(),
    materialId: String(row?.material_id || '').trim(),
    materialNameSnapshot: String(row?.material_name_snapshot || '').trim().toUpperCase(),
    sizeVariant: String(row?.size_variant || '').trim().toUpperCase(),
    colorVariant: String(row?.color_variant || '').trim().toUpperCase(),
    unit: String(row?.unit || 'PCS').trim().toUpperCase(),
    generatedQty: toNumber(row?.generated_qty),
    finalQty: toNumber(row?.final_qty),
  }
}

function normalizePo(row) {
  return {
    poId: String(row?.po_id || '').trim().toUpperCase(),
    supplierName: String(row?.supplier_name || '').trim().toUpperCase(),
    requestDeliveryDate: String(row?.request_delivery_date || '').slice(0, 10),
    method: String(row?.method || '').trim().toUpperCase(),
    status: String(row?.status || '').trim().toUpperCase(),
  }
}

function normalizeSupplier(row) {
  return {
    id: String(row?.id || '').trim(),
    supplierName: String(row?.supplier_name || row?.nama_supplier || '').trim().toUpperCase(),
    supplierLevel: String(row?.supplier_level || '').trim().toUpperCase(),
    contactPerson: String(row?.contact_person || '').trim(),
    phone: String(row?.phone || '').trim(),
    address: String(row?.address || '').trim(),
    isActive: row?.is_active !== false,
  }
}

function normalizeMaterialMaster(row) {
  return {
    id: String(row?.id || '').trim(),
    materialName: String(row?.material_name || '').trim().toUpperCase(),
    unit: String(row?.unit || 'PCS').trim().toUpperCase(),
    isActive: row?.is_active !== false,
  }
}

function buildOrderLineKey({ materialId, sizeVariant, colorVariant, unit }) {
  return [
    String(materialId || '').trim(),
    String(sizeVariant || '').trim().toUpperCase(),
    String(colorVariant || '').trim().toUpperCase(),
    String(unit || '').trim().toUpperCase(),
  ].join('::')
}

function buildOrderSourceFromRequirement(requirement) {
  return {
    id: `po:${requirement.id}`,
    sourceType: 'PO',
    sourceRowId: requirement.id,
    poId: requirement.poId,
    productName: requirement.productName || requirement.skuInduk || '-',
    skuInduk: requirement.skuInduk,
    qty: requirement.finalQty,
    label: `${requirement.poId} - ${requirement.productName || requirement.skuInduk || '-'}`,
    secondaryLabel: [requirement.sizeVariant, requirement.colorVariant].filter(Boolean).join(' / ') || '-',
  }
}

function buildOrderSourceFromFreeMaterial(material, qty) {
  return {
    id: `free:${material.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    sourceType: 'FREE',
    sourceRowId: '',
    poId: '',
    productName: 'FREE MATERIAL',
    skuInduk: '',
    qty,
    label: 'Free Material',
    secondaryLabel: material.materialName,
  }
}

function mergeSourceIntoLines(lines, nextLine) {
  const existingIndex = lines.findIndex((item) => item.key === nextLine.key)

  if (existingIndex === -1) {
    return [...lines, nextLine]
  }

  const existing = lines[existingIndex]
  const existingSourceIds = new Set(existing.sources.map((source) => source.id))
  const mergedSources = [...existing.sources]

  nextLine.sources.forEach((source) => {
    if (!existingSourceIds.has(source.id)) {
      mergedSources.push(source)
    }
  })

  const mergedLine = {
    ...existing,
    totalQty: existing.totalQty + nextLine.totalQty,
    sources: mergedSources,
  }

  return lines.map((item, index) => (index === existingIndex ? mergedLine : item))
}

function formatPrintDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

function getMaterialDraftSourcePoIds(lines) {
  return Array.from(
    new Set(
      lines.flatMap((line) =>
        (line.sources || [])
          .filter((source) => source.sourceType === 'PO' && source.poId)
          .map((source) => String(source.poId || '').trim().toUpperCase())
      )
    )
  )
}

function extractGarmentPoSequence(poId) {
  const match = String(poId || '')
    .trim()
    .toUpperCase()
    .match(/^PO-([^-]+)-/)
  return match?.[1] || ''
}

function getMaterialPoMonthCode(date = new Date()) {
  const monthCode = ROMAN_MONTHS[date.getMonth()] || ''
  const yearCode = String(date.getFullYear()).slice(-2)
  return `${monthCode}${yearCode}`
}

function getNextFreeMaterialPoSequence(existingNumbers, monthCode) {
  const usedNumbers = existingNumbers.reduce((set, value) => {
    const match = String(value || '')
      .trim()
      .toUpperCase()
      .match(new RegExp(`^MPO-F(\\d+)-${monthCode}$`))

    if (match?.[1]) {
      set.add(Number(match[1]))
    }

    return set
  }, new Set())

  let nextNumber = 1
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1
  }

  return `F${String(nextNumber).padStart(2, '0')}`
}

function buildMaterialPoNumber(lines, existingNumbers, date = new Date()) {
  const sourcePoIds = getMaterialDraftSourcePoIds(lines)

  if (sourcePoIds.length > 1) {
    throw new Error('Material PO draft cannot mix multiple garment POs. Please keep one garment PO per material PO draft.')
  }

  const monthCode = getMaterialPoMonthCode(date)

  if (sourcePoIds.length === 1) {
    const garmentPoSequence = extractGarmentPoSequence(sourcePoIds[0])

    if (!garmentPoSequence) {
      throw new Error('Failed to read the garment PO number format for this material PO draft.')
    }

    return `MPO-${garmentPoSequence}-${monthCode}`
  }

  return `MPO-${getNextFreeMaterialPoSequence(existingNumbers, monthCode)}-${monthCode}`
}

async function createMaterialPurchaseOrderPreviewHtml(bundle) {
  const logoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/Gemini_Generated_Image_1pgskj1pgskj1pgs.png`
      : '/Gemini_Generated_Image_1pgskj1pgskj1pgs.png'

  const formatIdr = (value) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0))

  const subtotal = bundle.items.reduce((sum, item) => sum + item.amount, 0)
  const ppn = subtotal * 0.11
  const total = subtotal + ppn
  const remarks =
    String(bundle.header.notes || '').trim() ||
    'Mohon cantumkan nomor Purchase Order ini pada Invoice, Surat Jalan, dan dokumen pengiriman lainnya.'

  const itemRowsHtml = bundle.items
    .map(
      (item) => `
        <tr class="border-b border-gray-200">
          <td class="py-4 px-1 text-left font-medium">
            <div>${escapeHtml(item.materialName || '-')}</div>
            ${item.notes ? `<div class="mt-1 text-[8pt] text-gray-500">${escapeHtml(item.notes)}</div>` : ''}
          </td>
          <td class="py-4 px-1 text-center text-gray-600">${escapeHtml(item.variant || '-')}</td>
          <td class="py-4 px-1 text-center text-gray-600">${escapeHtml(formatQty(item.qty))}</td>
          <td class="py-4 px-1 text-center text-gray-600">${escapeHtml(item.unit || '-')}</td>
          <td class="py-4 px-1 text-right text-gray-600">${escapeHtml(formatIdr(item.price))}</td>
          <td class="py-4 px-1 text-right font-medium">${escapeHtml(formatIdr(item.amount))}</td>
        </tr>
      `
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(bundle.poNumber || 'Material Purchase Order')}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      @page {
        size: A4;
        margin: 0;
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style>
  </head>
  <body class="bg-gray-100 min-h-screen py-10 print:bg-white print:py-0">
    <div class="print:hidden sticky top-0 z-10 flex justify-center gap-3 bg-gray-100/90 px-4 pb-4">
      <button onclick="window.print()" class="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-800">
        Print PDF
      </button>
      <button onclick="window.close()" class="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
        Close
      </button>
    </div>

    <div class="mx-auto min-h-[297mm] w-[210mm] bg-white p-[20mm] font-sans text-[#111] shadow-lg print:min-h-0 print:w-full print:p-[20mm] print:shadow-none">
      <div class="mb-14 flex items-start justify-between">
        <div class="flex w-[45%] flex-col gap-3">
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">PO Number</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(bundle.poNumber || '-')}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Date</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(formatPrintDate(bundle.createdAt))}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Request Delivery Date</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(formatPrintDate(bundle.header.requestDeliveryDate))}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Payment Terms</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(bundle.header.paymentTerms || '-')}</div>
          </div>

          <div class="mt-6">
            <div class="mb-1 text-[7pt] font-bold uppercase tracking-widest text-gray-500">To</div>
            <div class="mb-1 text-[11pt] font-semibold">${escapeHtml(bundle.header.supplierName || '-')}</div>
            <div class="text-[8.5pt] leading-relaxed text-gray-600">
              ${escapeHtml(bundle.header.supplierAddress || 'Alamat supplier belum diisi.')}<br />
              ${escapeHtml(bundle.header.supplierContact || 'Kontak supplier belum diisi.')}
            </div>
          </div>
        </div>

        <div class="flex w-[55%] flex-col items-end">
          <div class="w-full max-w-[320px] text-left">
            <div class="mb-1 inline-flex bg-white p-1">
              <img
                src="${escapeHtml(logoUrl)}"
                alt="Arkline"
                class="block h-auto max-w-[220px] object-contain"
              />
            </div>
            <div class="mb-2 mt-1 text-[11pt] font-semibold tracking-wide">
              <span class="block pl-[18px]">PT ANUGERAH RETAIL KARYA</span>
            </div>
            <div class="pl-[18px] text-[8.5pt] leading-relaxed text-gray-600">
              North Point Commercial blok NP 22,<br />
              Jl. BSD Boulevard Utara, Lengkong Kulon,<br />
              Pagedangan, Tangerang Regency,<br />
              Banten 1533
            </div>
          </div>
        </div>
      </div>

      <table class="mb-16 w-full border-collapse">
        <thead>
          <tr class="border-b-[1.5px] border-black">
            <th class="px-1 py-3 text-left text-[7pt] font-bold uppercase tracking-widest text-gray-700">Material</th>
            <th class="w-[16%] px-1 py-3 text-center text-[7pt] font-bold uppercase tracking-widest text-gray-700">Variant</th>
            <th class="w-[10%] px-1 py-3 text-center text-[7pt] font-bold uppercase tracking-widest text-gray-700">Qty</th>
            <th class="w-[10%] px-1 py-3 text-center text-[7pt] font-bold uppercase tracking-widest text-gray-700">Unit</th>
            <th class="w-[18%] px-1 py-3 text-right text-[7pt] font-bold uppercase tracking-widest text-gray-700">Price</th>
            <th class="w-[20%] px-1 py-3 text-right text-[7pt] font-bold uppercase tracking-widest text-gray-700">Amount</th>
          </tr>
        </thead>
        <tbody class="text-[9.5pt]">
          ${itemRowsHtml || `
            <tr>
              <td colspan="6" class="px-1 py-8 text-center text-[9pt] text-gray-500">No material lines found for this purchase order.</td>
            </tr>
          `}
        </tbody>
      </table>

      <div class="print:break-inside-avoid flex items-end justify-between">
        <div class="flex min-h-[280px] w-[50%] flex-col justify-between">
          <div class="m-0 p-0">
            <div class="mb-1 text-[7pt] font-bold uppercase tracking-widest text-gray-500">Remarks</div>
            <div class="max-w-[90%] text-[9pt] leading-relaxed text-gray-600">
              ${escapeHtml(remarks)}
            </div>
          </div>

          <div class="mt-auto text-[36pt] font-bold leading-[0.95] tracking-tighter text-black">
            MATERIAL<br />PURCHASE ORDER
          </div>
        </div>

        <div class="flex min-h-[280px] w-[45%] flex-col justify-between">
          <table class="w-full text-[9.5pt]">
            <tbody>
              <tr>
                <td class="py-2 text-[7pt] font-bold uppercase tracking-widest text-gray-400">Subtotal</td>
                <td class="py-2 text-right text-gray-700">${escapeHtml(formatIdr(subtotal))}</td>
              </tr>
              <tr>
                <td class="py-2 text-[7pt] font-bold uppercase tracking-widest text-gray-400">PPN 11%</td>
                <td class="py-2 text-right text-gray-700">${escapeHtml(formatIdr(ppn))}</td>
              </tr>
              <tr class="border-t-[1.5px] border-black text-[11.5pt] font-bold">
                <td class="pt-3 text-[7pt] font-bold uppercase tracking-widest text-black">Total</td>
                <td class="pt-3 text-right text-black">${escapeHtml(formatIdr(total))}</td>
              </tr>
            </tbody>
          </table>

          <div class="mt-auto pt-12 text-right">
            <div class="mb-2 inline-block w-[180px] border-b border-black"></div>
            <div class="text-[10.5pt] font-semibold tracking-wide text-black">Aditya C. S.</div>
            <div class="text-[8.5pt] font-medium text-gray-500">President Director</div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`
}

export default function ArklineMaterialFulfillmentPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [mode, setMode] = useState('existing-po')
  const [poFilter, setPoFilter] = useState('')
  const [requirements, setRequirements] = useState([])
  const [poOptions, setPoOptions] = useState([])
  const [poMeta, setPoMeta] = useState({})
  const [suppliers, setSuppliers] = useState([])
  const [materialOptions, setMaterialOptions] = useState([])
  const [materialPoNumbers, setMaterialPoNumbers] = useState([])
  const [selectedRequirementIds, setSelectedRequirementIds] = useState([])
  const [orderHeader, setOrderHeader] = useState(createOrderHeaderDraft())
  const [freeMaterialDraft, setFreeMaterialDraft] = useState(createFreeMaterialDraft())
  const [orderLines, setOrderLines] = useState([])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const { data: materialRows, error: materialError } = await supabase
          .from('arkline_po_materials')
          .select('*')
          .order('po_id', { ascending: true })

        if (materialError) throw new Error(materialError.message)

        const normalizedRequirements = (materialRows || []).map(normalizeMaterialRequirement)
        const itemIds = Array.from(new Set(normalizedRequirements.map((item) => item.arklinePoItemId).filter(Boolean)))

        const [poResponse, itemResponse, supplierResponse, materialMasterResponse, materialPoResponse] = await Promise.all([
          supabase
            .from('arkline_pos')
            .select('po_id, supplier_name, request_delivery_date, method, status')
            .eq('method', 'CMT')
            .eq('status', 'Initiated')
            .order('po_id', { ascending: true }),
          itemIds.length
            ? supabase.from('arkline_po_items').select('id, nama_produk, kategori_produk').in('id', itemIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('dir_suppliers')
            .select('id, supplier_name, supplier_level, contact_person, phone, address, "group", is_active')
            .eq('group', 'ARKLINE')
            .eq('supplier_level', 'MATERIAL')
            .eq('is_active', true)
            .order('supplier_name', { ascending: true }),
          supabase.from('arkline_dir_materials').select('id, material_name, unit, is_active').eq('is_active', true).order('material_name', { ascending: true }),
          supabase.from('arkline_po_material_ordered').select('material_po_number'),
        ])

        if (poResponse.error) throw new Error(poResponse.error.message)
        if (itemResponse.error) throw new Error(itemResponse.error.message)
        if (supplierResponse.error) throw new Error(supplierResponse.error.message)
        if (materialMasterResponse.error) throw new Error(materialMasterResponse.error.message)
        if (materialPoResponse.error) throw new Error(materialPoResponse.error.message)

        const normalizedPoOptions = (poResponse.data || []).map(normalizePo).filter((item) => item.poId)
        const nextPoMeta = normalizedPoOptions.reduce((accumulator, item) => {
          accumulator[item.poId] = item
          return accumulator
        }, {})

        const itemMetaById = (itemResponse.data || []).reduce((accumulator, item) => {
          accumulator[String(item.id || '').trim()] = {
            productName: String(item.nama_produk || '').trim().toUpperCase(),
            categoryName: String(item.kategori_produk || '').trim().toUpperCase(),
          }
          return accumulator
        }, {})

        const enrichedRequirements = normalizedRequirements
          .filter((item) => nextPoMeta[item.poId])
          .map((item) => ({
            ...item,
            productName: itemMetaById[item.arklinePoItemId]?.productName || '',
            categoryName: itemMetaById[item.arklinePoItemId]?.categoryName || '',
          }))

        const normalizedSuppliers = (supplierResponse.data || [])
          .map(normalizeSupplier)
          .filter((item) => item.isActive && item.supplierName)
        const normalizedMaterials = (materialMasterResponse.data || [])
          .map(normalizeMaterialMaster)
          .filter((item) => item.isActive && item.materialName)

        setRequirements(enrichedRequirements)
        setPoOptions(normalizedPoOptions)
        setPoMeta(nextPoMeta)
        setSuppliers(normalizedSuppliers)
        setMaterialOptions(normalizedMaterials)
        setMaterialPoNumbers((materialPoResponse.data || []).map((item) => String(item.material_po_number || '').trim().toUpperCase()).filter(Boolean))
        setPoFilter((current) => (current && nextPoMeta[current] ? current : normalizedPoOptions[0]?.poId || ''))
      } catch (loadError) {
        setRequirements([])
        setPoOptions([])
        setPoMeta({})
        setSuppliers([])
        setMaterialOptions([])
        setMaterialPoNumbers([])
        setError(loadError.message || 'Failed to load material requirement planning.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const assignedRequirementIds = useMemo(() => {
    const ids = new Set()
    orderLines.forEach((line) => {
      line.sources.forEach((source) => {
        if (source.sourceType === 'PO' && source.sourceRowId) {
          ids.add(source.sourceRowId)
        }
      })
    })
    return ids
  }, [orderLines])

  const filteredRequirements = useMemo(() => {
    if (!poFilter) return []
    return requirements.filter((item) => item.poId === poFilter)
  }, [poFilter, requirements])

  const orderDraftSummary = useMemo(
    () =>
      orderLines.reduce(
        (accumulator, line) => {
          accumulator.lines += 1
          accumulator.totalQty += line.totalQty
          return accumulator
        },
        { lines: 0, totalQty: 0 }
      ),
    [orderLines]
  )

  const materialDraftPoNumber = useMemo(() => {
    try {
      return orderLines.length ? buildMaterialPoNumber(orderLines, materialPoNumbers) : ''
    } catch {
      return ''
    }
  }, [materialPoNumbers, orderLines])

  function updateOrderHeader(name, value) {
    if (name === 'supplierId') {
      const selectedSupplier = suppliers.find((item) => item.id === value)
      setOrderHeader((current) => ({
        ...current,
        supplierId: value,
        supplierName: selectedSupplier?.supplierName || '',
      }))
      return
    }

    setOrderHeader((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function toggleRequirementSelection(rowId) {
    setSelectedRequirementIds((current) =>
      current.includes(rowId) ? current.filter((item) => item !== rowId) : [...current, rowId]
    )
  }

  function handleMoveSelectedRequirements() {
    setError('')
    setSuccess('')

    const selectedRows = filteredRequirements.filter((item) => selectedRequirementIds.includes(item.id))

    if (!selectedRows.length) {
      setError('Choose at least one material line first.')
      return
    }

    const existingSourcePoIds = getMaterialDraftSourcePoIds(orderLines)
    const nextSourcePoIds = Array.from(new Set(selectedRows.map((item) => item.poId).filter(Boolean)))

    if (existingSourcePoIds.length > 1) {
      setError('Material PO draft cannot mix multiple garment POs.')
      return
    }

    if (
      existingSourcePoIds.length === 1 &&
      nextSourcePoIds.length === 1 &&
      existingSourcePoIds[0] !== nextSourcePoIds[0]
    ) {
      setError(`This draft already uses ${existingSourcePoIds[0]}. Please use the same PO or reset the draft first.`)
      return
    }

    let nextLines = [...orderLines]

    selectedRows.forEach((row) => {
      if (assignedRequirementIds.has(row.id)) return

      const nextLine = {
        key: buildOrderLineKey(row),
        materialId: row.materialId,
        materialName: row.materialNameSnapshot,
        unit: row.unit,
        sizeVariant: row.sizeVariant,
        colorVariant: row.colorVariant,
        totalQty: row.finalQty,
        price: '',
        notes: '',
        sources: [buildOrderSourceFromRequirement(row)],
      }

      nextLines = mergeSourceIntoLines(nextLines, nextLine)
    })

    setOrderLines(nextLines)
    setSelectedRequirementIds([])
    setSuccess('Selected materials moved to the order panel.')
  }

  function handleAddFreeMaterial() {
    setError('')
    setSuccess('')

    const selectedMaterial = materialOptions.find((item) => item.id === freeMaterialDraft.materialId)
    const qty = toNumber(freeMaterialDraft.qty)

    if (!selectedMaterial) {
      setError('Choose one material first.')
      return
    }

    if (qty <= 0) {
      setError('Enter a valid quantity first.')
      return
    }

    const nextLine = {
      key: buildOrderLineKey({
        materialId: selectedMaterial.id,
        sizeVariant: '',
        colorVariant: '',
        unit: selectedMaterial.unit,
      }),
      materialId: selectedMaterial.id,
      materialName: selectedMaterial.materialName,
      unit: selectedMaterial.unit,
      sizeVariant: '',
      colorVariant: '',
      totalQty: qty,
      price: '',
      notes: '',
      sources: [buildOrderSourceFromFreeMaterial(selectedMaterial, qty)],
    }

    setOrderLines((current) => mergeSourceIntoLines(current, nextLine))
    setFreeMaterialDraft(createFreeMaterialDraft())
    setSuccess('Material added to the order panel.')
  }

  function handleRemoveOrderLine(lineKey) {
    setOrderLines((current) => current.filter((item) => item.key !== lineKey))
  }

  function handleUpdateOrderLineNotes(lineKey, value) {
    setOrderLines((current) => current.map((item) => (item.key === lineKey ? { ...item, notes: value } : item)))
  }

  function handleUpdateOrderLinePrice(lineKey, value) {
    setOrderLines((current) => current.map((item) => (item.key === lineKey ? { ...item, price: value } : item)))
  }

  function moveOrderLine(lineKey, direction) {
    setOrderLines((current) => {
      const index = current.findIndex((item) => item.key === lineKey)
      if (index === -1) return current

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.length) return current

      const next = [...current]
      const [line] = next.splice(index, 1)
      next.splice(targetIndex, 0, line)
      return next
    })
  }

  function handleResetDraft() {
    setOrderHeader(createOrderHeaderDraft())
    setFreeMaterialDraft(createFreeMaterialDraft())
    setSelectedRequirementIds([])
    setOrderLines([])
    setError('')
    setSuccess('')
  }

  async function handleSaveMaterialPo() {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const userEmail = user?.email?.toLowerCase() || null

      if (!orderHeader.supplierId) {
        throw new Error('Choose one material supplier first.')
      }

      if (!orderHeader.requestDeliveryDate) {
        throw new Error('Fill the request delivery date first.')
      }

      if (!String(orderHeader.paymentTerms || '').trim()) {
        throw new Error('Fill the payment terms first.')
      }

      if (!orderLines.length) {
        throw new Error('Move or add at least one material line first.')
      }

      const materialPoNumber = buildMaterialPoNumber(orderLines, materialPoNumbers)
      const selectedSupplier = suppliers.find((item) => item.id === orderHeader.supplierId) || null
      const sourcePoIds = getMaterialDraftSourcePoIds(orderLines)
      const headerPayload = {
        material_po_number: materialPoNumber,
        supplier_id: Number(orderHeader.supplierId) || null,
        supplier_name_snapshot: selectedSupplier?.supplierName || orderHeader.supplierName || null,
        garment_po_number: sourcePoIds[0] || null,
        source_type: sourcePoIds.length ? 'PO' : 'FREE',
        request_delivery_date: orderHeader.requestDeliveryDate || null,
        payment_terms: String(orderHeader.paymentTerms || '').trim() || null,
        notes: String(orderHeader.notes || '').trim() || null,
        status: 'ORDERED',
        updated_by: userEmail,
      }

      const { data: existingHeader, error: existingHeaderError } = await supabase
        .from('arkline_po_material_ordered')
        .select('id')
        .eq('material_po_number', materialPoNumber)
        .maybeSingle()

      if (existingHeaderError) {
        throw new Error(existingHeaderError.message)
      }

      let orderedId = existingHeader?.id || null

      if (!orderedId) {
        const { data: insertedHeader, error: insertHeaderError } = await supabase
          .from('arkline_po_material_ordered')
          .insert({
            ...headerPayload,
            created_by: userEmail,
          })
          .select('id')
          .single()

        if (insertHeaderError) {
          throw new Error(insertHeaderError.message)
        }

        orderedId = insertedHeader.id
      } else {
        const { data: blockingLogs, error: blockingLogsError } = await supabase
          .from('arkline_po_material_logs')
          .select('id, log_type')
          .eq('material_po_ordered_id', orderedId)
          .in('log_type', ['RECEIVED', 'SENT'])
          .limit(1)

        if (blockingLogsError) {
          throw new Error(blockingLogsError.message)
        }

        if ((blockingLogs || []).length) {
          throw new Error('This Material PO already has received or sent logs, so the draft can no longer be replaced.')
        }

        const { error: updateHeaderError } = await supabase
          .from('arkline_po_material_ordered')
          .update(headerPayload)
          .eq('id', orderedId)

        if (updateHeaderError) {
          throw new Error(updateHeaderError.message)
        }

        const { error: deleteOrderedLogsError } = await supabase
          .from('arkline_po_material_logs')
          .delete()
          .eq('material_po_ordered_id', orderedId)
          .eq('log_type', 'ORDERED')

        if (deleteOrderedLogsError) {
          throw new Error(deleteOrderedLogsError.message)
        }

        const { error: deleteItemsError } = await supabase
          .from('arkline_po_material_ordered_items')
          .delete()
          .eq('material_po_ordered_id', orderedId)

        if (deleteItemsError) {
          throw new Error(deleteItemsError.message)
        }
      }

      const itemPayload = orderLines.map((line) => {
        const lineSourcePoIds = Array.from(
          new Set(
            (line.sources || [])
              .filter((source) => source.sourceType === 'PO' && source.poId)
              .map((source) => String(source.poId || '').trim().toUpperCase())
          )
        )

        return {
          material_po_ordered_id: orderedId,
          material_po_number: materialPoNumber,
          material_id: line.materialId || null,
          material_name_snapshot: line.materialName || null,
          size_variant: line.sizeVariant || null,
          color_variant: line.colorVariant || null,
          unit: line.unit || null,
          qty: toNumber(line.totalQty),
          price: toNumber(line.price),
          amount: toNumber(line.price) * toNumber(line.totalQty),
          notes: String(line.notes || '').trim() || null,
          source_type: lineSourcePoIds.length ? ((line.sources || []).some((source) => source.sourceType === 'FREE') ? 'MIXED' : 'PO') : 'FREE',
          source_po_id: lineSourcePoIds[0] || null,
        }
      })

      const { data: insertedItems, error: insertItemsError } = await supabase
        .from('arkline_po_material_ordered_items')
        .insert(itemPayload)
        .select('id, material_id, material_name_snapshot, size_variant, color_variant, unit, qty, notes, source_po_id')

      if (insertItemsError) {
        throw new Error(insertItemsError.message)
      }

      const orderedLogPayload = (insertedItems || []).map((item) => ({
        arkline_po_material_id: null,
        po_id: sourcePoIds[0] || materialPoNumber,
        arkline_po_item_id: null,
        log_type: 'ORDERED',
        qty: Number(item.qty || 0),
        event_date: orderHeader.requestDeliveryDate || new Date().toISOString().slice(0, 10),
        supplier_name: selectedSupplier?.supplierName || orderHeader.supplierName || null,
        notes: item.notes || orderHeader.notes || null,
        created_by: userEmail,
        material_po_number: materialPoNumber,
        material_po_ordered_id: orderedId,
        material_po_ordered_item_id: item.id,
        material_id: item.material_id || null,
        material_name_snapshot: item.material_name_snapshot || null,
        size_variant: item.size_variant || null,
        color_variant: item.color_variant || null,
        unit: item.unit || null,
      }))

      if (orderedLogPayload.length) {
        const { error: insertLogsError } = await supabase.from('arkline_po_material_logs').insert(orderedLogPayload)
        if (insertLogsError) {
          throw new Error(insertLogsError.message)
        }
      }

      setMaterialPoNumbers((current) => (current.includes(materialPoNumber) ? current : [...current, materialPoNumber]))
      setSuccess(`Material PO ${materialPoNumber} saved.`)
    } catch (saveError) {
      setError(saveError.message || 'Failed to save material purchase order.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePrintMaterialOrder() {
    setError('')
    setSuccess('')

    if (!orderHeader.supplierId) {
      setError('Choose one material supplier first.')
      return
    }

    if (!orderHeader.requestDeliveryDate) {
      setError('Fill the request delivery date first.')
      return
    }

    if (!String(orderHeader.paymentTerms || '').trim()) {
      setError('Fill the payment terms first.')
      return
    }

    if (!orderLines.length) {
      setError('Move or add at least one material line first.')
      return
    }

    setPrinting(true)
    const previewWindow = window.open('', '_blank')

    try {
      if (!previewWindow) {
        throw new Error('Popup blocked. Please allow popups to preview the PDF.')
      }

      previewWindow.document.write('<html><body style="font-family: Arial, sans-serif; padding: 24px;">Preparing material purchase order preview...</body></html>')
      previewWindow.document.close()

      const selectedSupplier = suppliers.find((item) => item.id === orderHeader.supplierId) || null
      const supplierContactParts = [selectedSupplier?.contactPerson, selectedSupplier?.phone].filter(Boolean)
      const createdAt = new Date().toISOString()
      const poNumber = buildMaterialPoNumber(orderLines, materialPoNumbers, new Date(createdAt))
      const printableItems = orderLines.map((line) => ({
        materialName: line.materialName,
        variant: [line.sizeVariant, line.colorVariant].filter(Boolean).join(' / ') || '-',
        qty: line.totalQty,
        unit: line.unit,
        price: toNumber(line.price),
        amount: toNumber(line.price) * line.totalQty,
        notes: line.notes,
      }))

      const previewHtml = await createMaterialPurchaseOrderPreviewHtml({
        poNumber,
        createdAt,
        header: {
          ...orderHeader,
          supplierName: selectedSupplier?.supplierName || orderHeader.supplierName || '-',
          supplierAddress: selectedSupplier?.address || '',
          supplierContact: supplierContactParts.join(' | '),
        },
        items: printableItems,
      })

      previewWindow.document.open()
      previewWindow.document.write(previewHtml)
      previewWindow.document.close()
    } catch (printError) {
      previewWindow?.close()
      setError(printError.message || 'Failed to prepare material purchase order print view.')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className={shellStyles.page}>
      <section className={styles.board}>
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.title}>Material Requirement Planning</h1>
            <p className={styles.subtitle}>Material PO setup, purchasing information, material allocation, save, and print.</p>
          </div>
          <div className={styles.headerControls}>
            <div className={styles.headerActions}>
              <button type="button" className={styles.secondaryButton} onClick={handleResetDraft}>
                Reset Draft
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleSaveMaterialPo} disabled={saving || loading || printing}>
                {saving ? 'Saving...' : 'Save Material PO'}
              </button>
              <button type="button" className={styles.printButton} onClick={handlePrintMaterialOrder} disabled={printing || loading}>
                {printing ? 'Preparing Print...' : 'Print Purchase Order'}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className={styles.feedbackStrip}>
            <p className={styles.errorText}>{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className={styles.feedbackStrip} style={{ borderColor: '#d1fae5', background: '#ecfdf5' }}>
            <p className={styles.successText}>{success}</p>
          </div>
        ) : null}

        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Material Order</h2>
            </div>

            <div className={styles.materialModeRow}>
              {MRP_MODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.modeButton} ${mode === option.id ? styles.modeButtonActive : ''}`.trim()}
                  onClick={() => {
                    setMode(option.id)
                    setError('')
                    setSuccess('')
                    setSelectedRequirementIds([])
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`${styles.formGrid} ${styles.materialHeaderGrid}`}>
            <div className={styles.field}>
              <label className={styles.label}>Supplier</label>
              <select className={styles.select} value={orderHeader.supplierId} onChange={(event) => updateOrderHeader('supplierId', event.target.value)}>
                <option value="">Select material supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Request Delivery Date</label>
              <input
                className={styles.input}
                type="date"
                value={orderHeader.requestDeliveryDate}
                onChange={(event) => updateOrderHeader('requestDeliveryDate', event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Payment Terms</label>
              <input
                className={styles.input}
                value={orderHeader.paymentTerms}
                onChange={(event) => updateOrderHeader('paymentTerms', event.target.value)}
                placeholder="NET 30 / CASH / CUSTOM TERMS"
              />
            </div>

            <div className={`${styles.field} ${styles.fullSpan}`}>
              <label className={styles.label}>PO Notes</label>
              <textarea
                className={styles.textarea}
                value={orderHeader.notes}
                onChange={(event) => updateOrderHeader('notes', event.target.value)}
                placeholder="General notes for this material PO."
              />
            </div>
          </div>
        </section>

        {mode === 'existing-po' ? (
          <section className={styles.sectionCard}>
            <div className={styles.field}>
              <label className={styles.label}>PO Number</label>
              <select className={styles.select} value={poFilter} onChange={(event) => setPoFilter(event.target.value)}>
                <option value="">Select initiated CMT PO</option>
                {poOptions.map((po) => (
                  <option key={po.poId} value={po.poId}>
                    {po.poId}
                  </option>
                ))}
              </select>
            </div>
          </section>
        ) : null}

        <section className={styles.materialWorkflow}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>{mode === 'existing-po' ? 'Generated Materials' : 'Free Material Input'}</h2>
              </div>
              {mode === 'existing-po' ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleMoveSelectedRequirements}
                  disabled={!selectedRequirementIds.length}
                  title="Move selected materials"
                  aria-label="Move selected materials"
                >
                  →
                </button>
              ) : null}
            </div>

            {loading ? (
              <div className={styles.emptyState}>Loading MRP workspace...</div>
            ) : mode === 'existing-po' ? (
              !poFilter ? (
                <div className={styles.emptyState}>Choose one initiated CMT PO first.</div>
              ) : filteredRequirements.length ? (
                <div className={styles.linesTableWrap}>
                  <table className={styles.linesTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '48px' }}>Pick</th>
                        <th>Product</th>
                        <th>Material</th>
                        <th>Variant</th>
                        <th>Qty Needed</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequirements.map((row) => {
                        const isAssigned = assignedRequirementIds.has(row.id)
                        const isChecked = selectedRequirementIds.includes(row.id)

                        return (
                          <tr key={row.id} className={isAssigned ? styles.materialRowAssigned : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isAssigned}
                                onChange={() => toggleRequirementSelection(row.id)}
                              />
                            </td>
                            <td>
                              <div className={styles.materialCellTitle}>{row.productName || row.skuInduk || '-'}</div>
                              <div className={styles.materialCellMeta}>{row.poId}</div>
                            </td>
                            <td>{row.materialNameSnapshot || '-'}</td>
                            <td>{[row.sizeVariant, row.colorVariant].filter(Boolean).join(' / ') || '-'}</td>
                            <td>{formatQty(row.finalQty)}</td>
                            <td>{row.unit || '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.emptyState}>No generated material lines found for this PO.</div>
              )
            ) : (
              <div className={styles.freeMaterialGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Material</label>
                  <select
                    className={styles.select}
                    value={freeMaterialDraft.materialId}
                    onChange={(event) => setFreeMaterialDraft((current) => ({ ...current, materialId: event.target.value }))}
                  >
                    <option value="">Select material</option>
                    {materialOptions.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.materialName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Qty</label>
                  <input
                    className={styles.input}
                    value={freeMaterialDraft.qty}
                    onChange={(event) => setFreeMaterialDraft((current) => ({ ...current, qty: event.target.value }))}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Unit</label>
                  <input
                    className={styles.inputReadonly}
                    value={materialOptions.find((item) => item.id === freeMaterialDraft.materialId)?.unit || '-'}
                    readOnly
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>&nbsp;</label>
                  <button type="button" className={styles.primaryButton} onClick={handleAddFreeMaterial}>
                    Add to Order
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Material PO Draft</h2>
              </div>

              <div className={styles.compactStats}>
                {materialDraftPoNumber ? (
                  <span className={styles.miniStatCard}>
                    Material PO <strong>{materialDraftPoNumber}</strong>
                  </span>
                ) : null}
                <span className={styles.miniStatCard}>
                  Items <strong>{formatQty(orderDraftSummary.lines)}</strong>
                </span>
                <span className={styles.miniStatCard}>
                  Total Qty <strong>{formatQty(orderDraftSummary.totalQty)}</strong>
                </span>
              </div>
            </div>

            {orderLines.length ? (
              <div className={styles.orderDraftList}>
                {orderLines.map((line) => (
                  <article key={line.key} className={styles.orderDraftCard}>
                    <div className={styles.orderDraftHeader}>
                      <div className={styles.orderDraftCopy}>
                        <strong className={styles.orderDraftTitle}>{line.materialName || '-'}</strong>
                        <span className={styles.orderDraftMeta}>
                          {[line.sizeVariant, line.colorVariant].filter(Boolean).join(' / ') || 'No Variant'} - {line.unit || '-'}
                        </span>
                      </div>

                      <div className={styles.orderDraftActions}>
                        <button
                          type="button"
                          className={`${styles.ghostButton} ${styles.orderDraftMoveUpButton}`.trim()}
                          onClick={() => moveOrderLine(line.key, 'up')}
                          title="Move up"
                          aria-label="Move line up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={`${styles.ghostButton} ${styles.orderDraftMoveDownButton}`.trim()}
                          onClick={() => moveOrderLine(line.key, 'down')}
                          title="Move down"
                          aria-label="Move line down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className={`${styles.ghostButton} ${styles.orderDraftRemoveButton}`.trim()}
                          onClick={() => handleRemoveOrderLine(line.key)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className={styles.orderDraftPriceRow}>
                      <div className={styles.orderDraftQtyCard}>
                        <span className={styles.orderDraftAmountLabel}>Qty</span>
                        <strong className={styles.orderDraftAmountValue}>{formatQty(line.totalQty)}</strong>
                      </div>
                      <div className={`${styles.field} ${styles.orderDraftPriceField}`.trim()}>
                        <label className={styles.label}>Price</label>
                        <input
                          className={styles.input}
                          value={line.price}
                          onChange={(event) => handleUpdateOrderLinePrice(line.key, event.target.value)}
                          placeholder="0"
                          inputMode="decimal"
                        />
                      </div>
                      <div className={styles.orderDraftAmountCard}>
                        <span className={styles.orderDraftAmountLabel}>Amount</span>
                        <strong className={styles.orderDraftAmountValue}>{formatCurrency(toNumber(line.price) * line.totalQty)}</strong>
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Purchase Notes</label>
                      <textarea
                        className={styles.textarea}
                        value={line.notes}
                        onChange={(event) => handleUpdateOrderLineNotes(line.key, event.target.value)}
                        placeholder="Notes for this material purchase line."
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>No material has been moved into the order draft yet.</div>
            )}
          </section>
        </section>
      </section>
    </div>
  )
}
