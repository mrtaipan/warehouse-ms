'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import shellStyles from '../../arkline.module.css'
import styles from '../production-planning.module.css'

const supabase = createClient()

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const NO_PO_VALUE = '__NO_PO__'
const ORDERED_AS_OPTIONS = ['PT ANUGERAH RETAIL KARYA', 'CV MITRA KARSA GARMINDO']
const SIZE_SORT_ORDER = SIZE_OPTIONS.reduce((accumulator, size, index) => {
  accumulator[size] = index
  return accumulator
}, {})

function createOrderHeaderDraft() {
  return {
    supplierId: '',
    supplierName: '',
    paymentTerms: '',
    requestDeliveryDate: '',
    notes: '',
    includePpn: true,
    orderedAs: '',
  }
}

function createFreeMaterialDraft() {
  return {
    materialId: '',
    qty: '',
  }
}

function createEmptyMaterialDraft() {
  return {
    materialName: '',
    unit: 'PCS',
  }
}

function createEmptySupplierDraft() {
  return {
    supplierCode: '',
    supplierName: '',
    contactPerson: '',
    phone: '',
    address: '',
  }
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value || '').replace(/[^\d.-]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function isMissingColumnError(error, columnName) {
  const normalizedColumn = String(columnName || '').trim().toLowerCase()
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
  return Boolean(normalizedColumn && message.includes(normalizedColumn) && message.includes('column'))
}

function formatQty(value) {
  const number = toNumber(value)
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '')
}

function roundQuantity(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function roundUpQuantity(value) {
  return Math.ceil(Number(value || 0))
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

function sortSuppliersByName(left, right) {
  return String(left?.supplierName || '').localeCompare(String(right?.supplierName || ''), undefined, { numeric: true })
}

async function generateSupplierCode() {
  const { data, error } = await supabase
    .from('dir_suppliers')
    .select('supplier_code')
    .order('supplier_code', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  const lastCode = String(data?.[0]?.supplier_code || '').trim().toUpperCase()
  const match = lastCode.match(/^SUPP-(\d+)$/)
  const nextNumber = match ? Number(match[1]) + 1 : 1
  return `SUPP-${String(nextNumber).padStart(3, '0')}`
}

function normalizeMaterialMaster(row) {
  return {
    id: String(row?.id || '').trim(),
    materialName: String(row?.material_name || '').trim().toUpperCase(),
    unit: String(row?.unit || 'PCS').trim().toUpperCase(),
    isActive: row?.is_active !== false,
  }
}

function sortMaterialsByName(left, right) {
  return String(left?.materialName || '').localeCompare(String(right?.materialName || ''), undefined, { numeric: true })
}

function normalizePoItem(row) {
  return {
    id: String(row?.id || '').trim(),
    poId: String(row?.po_id || '').trim().toUpperCase(),
    skuInduk: String(row?.sku_induk || '').trim().toUpperCase(),
    productName: String(row?.nama_produk || '').trim().toUpperCase(),
    categoryName: String(row?.kategori_produk || '').trim().toUpperCase(),
    kategoriPengadaan: String(row?.kategori_pengadaan || row?.kategori_produk || '').trim().toUpperCase(),
    allowancePct: toNumber(row?.allowance_pct),
  }
}

function normalizeBomLine(row) {
  return {
    id: String(row?.id || '').trim(),
    skuInduk: String(row?.sku_induk || '').trim().toUpperCase(),
    kategoriPengadaan: String(row?.kategori_pengadaan || '').trim().toUpperCase(),
    materialId: String(row?.material_id || row?.material?.id || '').trim(),
    materialName: String(row?.material_name || row?.material?.material_name || '').trim().toUpperCase(),
    unit: String(row?.unit || row?.material?.unit || 'PCS').trim().toUpperCase(),
    sizeVariant: String(row?.size_variant || '').trim().toUpperCase(),
    colorVariant: String(row?.color_variant || '').trim().toUpperCase(),
    qtyPer1: toNumber(row?.qty_per_1 || row?.qty_per_unit),
    wastePct: toNumber(row?.waste_pct),
    isActive: row?.is_active !== false,
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

function compareMaterialRequirementRows(left, right) {
  const leftMaterial = buildMaterialLabel(left)
  const rightMaterial = buildMaterialLabel(right)

  if (left.poId !== right.poId) return left.poId.localeCompare(right.poId, undefined, { numeric: true })
  if ((left.productName || left.skuInduk) !== (right.productName || right.skuInduk)) {
    return (left.productName || left.skuInduk).localeCompare(right.productName || right.skuInduk)
  }
  if (leftMaterial !== rightMaterial) return leftMaterial.localeCompare(rightMaterial)

  const leftSizeOrder = SIZE_SORT_ORDER[left.sizeVariant] ?? 999
  const rightSizeOrder = SIZE_SORT_ORDER[right.sizeVariant] ?? 999
  if (leftSizeOrder !== rightSizeOrder) return leftSizeOrder - rightSizeOrder

  return String(left.colorVariant || '').localeCompare(String(right.colorVariant || ''))
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

function buildOrderSourceFromFreeMaterial(material, qty, poId = '') {
  const normalizedPoId = String(poId || '').trim().toUpperCase()

  return {
    id: `free:${normalizedPoId || 'no-po'}:${material.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    sourceType: 'FREE',
    sourceRowId: '',
    poId: normalizedPoId,
    productName: normalizedPoId ? `FREE MATERIAL - ${normalizedPoId}` : 'FREE MATERIAL',
    skuInduk: '',
    qty,
    label: normalizedPoId ? `${normalizedPoId} - Free Material` : 'Free Material',
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

function buildRemarksHtml(value) {
  const lines = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .flatMap((line) => {
      const trimmed = line.trim()
      if (!trimmed) return []

      const numberedParts = trimmed.match(/\d+\.\s+.*?(?=\s+\d+\.\s+|$)/g)
      return numberedParts?.length > 1 ? numberedParts.map((part) => part.trim()) : [trimmed]
    })

  return lines.length
    ? lines.map((line) => `<div class="mb-1">${escapeHtml(line)}</div>`).join('')
    : `<div>${escapeHtml(value)}</div>`
}

function buildMultilineHtml(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br />')
}

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

function getMaterialDraftSourcePoIds(lines) {
  return Array.from(
    new Set(
      lines.flatMap((line) =>
        (line.sources || [])
          .filter((source) => source.poId)
          .map((source) => String(source.poId || '').trim().toUpperCase())
      )
    )
  )
}

function hasUnlinkedFreeMaterial(lines) {
  return lines.some((line) =>
    (line.sources || []).some((source) => source.sourceType === 'FREE' && !String(source.poId || '').trim())
  )
}

function getSourcePoIdsFromSources(sources) {
  return Array.from(
    new Set(
      (sources || [])
        .map((source) => String(source.poId || '').trim().toUpperCase())
        .filter(Boolean)
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

function getMaterialPoDateCode(date = new Date()) {
  const dayCode = String(date.getDate()).padStart(2, '0')
  const monthCode = ROMAN_MONTHS[date.getMonth()] || ''
  const yearCode = String(date.getFullYear())
  return `${dayCode}${monthCode}${yearCode}`
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getNextMaterialPoSequence(existingNumbers, prefix) {
  const normalizedPrefix = String(prefix || '').trim().toUpperCase()
  const prefixPattern = escapeRegExp(normalizedPrefix)
  const usedNumbers = existingNumbers.reduce((set, value) => {
    const match = String(value || '')
      .trim()
      .toUpperCase()
      .match(new RegExp(`^${prefixPattern}-(\\d+)$`))

    if (match?.[1]) {
      set.add(Number(match[1]))
    }

    return set
  }, new Set())

  let nextNumber = 1
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1
  }

  return String(nextNumber).padStart(3, '0')
}

function buildMaterialPoNumber(lines, existingNumbers, date = new Date()) {
  const sourcePoIds = getMaterialDraftSourcePoIds(lines)

  if (sourcePoIds.length > 1) {
    throw new Error('Material PO draft cannot mix multiple garment POs. Please keep one garment PO per material PO draft.')
  }

  const dateCode = getMaterialPoDateCode(date)
  let sourceCode = 'FREE'

  if (sourcePoIds.length === 1) {
    const garmentPoSequence = extractGarmentPoSequence(sourcePoIds[0])

    if (!garmentPoSequence) {
      throw new Error('Failed to read the garment PO number format for this material PO draft.')
    }

    sourceCode = garmentPoSequence
  }

  const prefix = `MPO-${sourceCode}-${dateCode}`
  return `${prefix}-${getNextMaterialPoSequence(existingNumbers, prefix)}`
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

    if (materialError) {
      throw new Error(materialError.message)
    }

    materialsById = (materialRows || []).reduce((accumulator, item) => {
      accumulator[String(item?.id || '').trim()] = item
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

async function buildGeneratedMaterialRequirements(poId) {
  const normalizedPoId = String(poId || '').trim().toUpperCase()

  const { data: itemRows, error: itemError } = await supabase
    .from('arkline_po_items')
    .select('id, po_id, sku_induk, nama_produk, kategori_produk, kategori_pengadaan, allowance_pct')
    .eq('po_id', normalizedPoId)
    .order('created_at', { ascending: true })

  if (itemError) {
    throw new Error(itemError.message)
  }

  const items = (itemRows || []).map(normalizePoItem).filter((item) => item.id && item.skuInduk)
  const itemIds = items.map((item) => item.id)
  const itemMetaById = items.reduce((accumulator, item) => {
    accumulator[item.id] = {
      productName: item.productName,
      categoryName: item.categoryName,
    }
    return accumulator
  }, {})

  if (!items.length) {
    return { payload: [], warnings: [`No product lines found for ${normalizedPoId}.`], itemMetaById }
  }

  const { data: sizeRows, error: sizeError } = itemIds.length
    ? await supabase
        .from('arkline_po_item_sizes')
        .select('arkline_po_item_id, size, qty')
        .in('arkline_po_item_id', itemIds)
    : { data: [], error: null }

  if (sizeError) {
    throw new Error(sizeError.message)
  }

  const sizesByItem = (sizeRows || []).reduce((accumulator, row) => {
    const key = String(row?.arkline_po_item_id || '').trim()
    if (!accumulator[key]) accumulator[key] = []
    accumulator[key].push({
      size: String(row?.size || '').trim().toUpperCase(),
      qty: toNumber(row?.qty),
    })
    return accumulator
  }, {})

  const aggregate = new Map()
  const warnings = []

  for (const item of items) {
    const sizeQuantities = (sizesByItem[item.id] || []).filter((row) => row.size && row.qty > 0)
    if (!sizeQuantities.length) {
      continue
    }

    const bomLines = await loadBomLinesForProduct({
      skuInduk: item.skuInduk,
      kategoriPengadaan: item.kategoriPengadaan,
    })

    if (!bomLines.length) {
      warnings.push(`BOM not found for ${item.productName || item.skuInduk}.`)
      continue
    }

    sizeQuantities.forEach((sizeRow) => {
      const matchingLines = bomLines.filter((line) => isBomLineMatchingSize(line, sizeRow.size))

      if (!matchingLines.length) {
        warnings.push(`No BOM line matches ${item.productName || item.skuInduk} size ${sizeRow.size}.`)
        return
      }

      matchingLines.forEach((line) => {
        const generatedQty = roundQuantity(sizeRow.qty * toNumber(line.qtyPer1))
        const finalQty = roundUpQuantity(generatedQty * (1 + (item.allowancePct + toNumber(line.wastePct)) / 100))
        const key = [item.id, item.skuInduk, line.materialId, line.materialName, line.unit, line.sizeVariant || '', line.colorVariant || ''].join('|')
        const existing = aggregate.get(key)

        if (!existing) {
          aggregate.set(key, {
            po_id: normalizedPoId,
            arkline_po_item_id: item.id,
            sku_induk: item.skuInduk,
            material_id: line.materialId,
            material_name_snapshot: buildMaterialLabel(line) || '-',
            size_variant: line.sizeVariant || null,
            color_variant: line.colorVariant || null,
            unit: line.unit || 'PCS',
            generated_qty: generatedQty,
            final_qty: finalQty,
          })
          return
        }

        existing.generated_qty = roundQuantity(existing.generated_qty + generatedQty)
        existing.final_qty = roundQuantity(existing.final_qty + finalQty)
      })
    })
  }

  return {
    payload: Array.from(aggregate.values()),
    warnings,
    itemMetaById,
  }
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

  const includePpn = bundle.header.includePpn !== false
  const orderedAs = String(bundle.header.orderedAs || ORDERED_AS_OPTIONS[0]).trim().toUpperCase()
  const subtotal = bundle.items.reduce((sum, item) => sum + item.amount, 0)
  const ppn = includePpn ? subtotal * 0.11 : 0
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
            ${
              [item.variant, item.unit].filter((value) => value && value !== '-').length
                ? `<div class="mt-1 text-[8pt] text-gray-500">${escapeHtml([item.variant, item.unit].filter((value) => value && value !== '-').join(' - '))}</div>`
                : ''
            }
            ${item.notes ? `<div class="mt-1 text-[8pt] leading-relaxed text-gray-500">${buildMultilineHtml(item.notes)}</div>` : ''}
          </td>
          <td class="py-4 px-1 text-center text-gray-600">${escapeHtml(formatQty(item.qty))}</td>
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
            <div class="mb-1 text-[7pt] font-bold uppercase tracking-widest text-gray-500">PO To</div>
            <div class="mb-1 text-[11pt] font-semibold">${escapeHtml(bundle.header.supplierName || '-')}</div>
            <div class="text-[8.5pt] leading-relaxed text-gray-600">
              <div>${buildMultilineHtml(bundle.header.supplierAddress || 'Alamat supplier belum diisi.')}</div>
              ${
                bundle.header.supplierContact
                  ? `<div class="mt-1">Attn: ${escapeHtml(bundle.header.supplierContact)}</div>`
                  : ''
              }
            </div>
          </div>
        </div>

        <div class="flex w-[55%] -mt-2 flex-col items-end">
          <div class="w-full max-w-[320px] text-left">
            <div class="mb-2 h-[34px] w-[230px] overflow-hidden bg-white">
              <img
                src="${escapeHtml(logoUrl)}"
                alt="Arkline"
                class="block h-auto w-[230px] max-w-none -translate-y-[26px] object-contain"
              />
            </div>
            <div class="mb-2 mt-1 text-[11pt] font-semibold tracking-wide">
              <span class="block pl-[18px]">${escapeHtml(orderedAs || '-')}</span>
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
            <th class="w-[12%] px-1 py-3 text-center text-[7pt] font-bold uppercase tracking-widest text-gray-700">Qty</th>
            <th class="w-[22%] px-1 py-3 text-right text-[7pt] font-bold uppercase tracking-widest text-gray-700">Price</th>
            <th class="w-[25%] px-1 py-3 text-right text-[7pt] font-bold uppercase tracking-widest text-gray-700">Amount</th>
          </tr>
        </thead>
        <tbody class="text-[9.5pt]">
          ${itemRowsHtml || `
            <tr>
              <td colspan="4" class="px-1 py-8 text-center text-[9pt] text-gray-500">No material lines found for this purchase order.</td>
            </tr>
          `}
        </tbody>
      </table>

      <div class="print:break-inside-avoid flex min-h-[360px] items-end justify-between">
        <div class="flex min-h-[360px] w-[50%] flex-col justify-between pb-6">
          <div class="m-0 p-0">
            <div class="mb-1 text-[7pt] font-bold uppercase tracking-widest text-gray-500">Remarks</div>
            <div class="max-w-[90%] text-[9pt] leading-relaxed text-gray-600">
              ${buildRemarksHtml(remarks)}
            </div>
          </div>

          <div class="mt-16 text-[36pt] font-bold leading-[0.95] tracking-tighter text-black">
            PURCHASE<br />ORDER
          </div>
        </div>

        <div class="flex min-h-[360px] w-[45%] flex-col justify-between pb-6">
          <table class="w-full text-[9.5pt]">
            <tbody>
              <tr>
                <td class="py-2 text-[7pt] font-bold uppercase tracking-widest text-gray-400">Subtotal</td>
                <td class="py-2 text-right text-gray-700">${escapeHtml(formatIdr(subtotal))}</td>
              </tr>
              ${
                includePpn
                  ? `<tr>
                      <td class="py-2 text-[7pt] font-bold uppercase tracking-widest text-gray-400">PPN 11%</td>
                      <td class="py-2 text-right text-gray-700">${escapeHtml(formatIdr(ppn))}</td>
                    </tr>`
                  : ''
              }
              <tr class="border-t-[1.5px] border-black text-[11.5pt] font-bold">
                <td class="pt-3 text-[7pt] font-bold uppercase tracking-widest text-black">Total</td>
                <td class="pt-3 text-right text-black">${escapeHtml(formatIdr(total))}</td>
              </tr>
            </tbody>
          </table>

          <div class="mt-20 text-right">
            <div class="mb-2 inline-block w-[180px] border-b border-black"></div>
            <div class="text-[10.5pt] font-semibold tracking-wide text-black">Aditya C. S.</div>
            <div class="text-[8.5pt] font-medium text-gray-500">President Director</div>
          </div>
        </div>
      </div>

      <div class="mt-8 border-t border-gray-200 pt-3 text-center text-[7.5pt] leading-relaxed text-gray-500">
        <span class="font-bold uppercase tracking-widest text-gray-600">Warehouse:</span>
        Pergudangan Bizpoint, Point 5 LV No. 85, Tigaraksa, Cikupa, Kab. Tangerang-Banten, Kode pos 15710
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
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [savingMaterial, setSavingMaterial] = useState(false)
  const [supplierCodeLoading, setSupplierCodeLoading] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [showOrderedAsModal, setShowOrderedAsModal] = useState(false)
  const [generatingRequirements, setGeneratingRequirements] = useState(false)
  const [poFilter, setPoFilter] = useState(NO_PO_VALUE)
  const [requirementWarnings, setRequirementWarnings] = useState([])
  const [requirements, setRequirements] = useState([])
  const [poOptions, setPoOptions] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [materialOptions, setMaterialOptions] = useState([])
  const [materialPoNumbers, setMaterialPoNumbers] = useState([])
  const [selectedRequirementIds, setSelectedRequirementIds] = useState([])
  const [orderHeader, setOrderHeader] = useState(createOrderHeaderDraft())
  const [freeMaterialDraft, setFreeMaterialDraft] = useState(createFreeMaterialDraft())
  const [freeMaterialError, setFreeMaterialError] = useState('')
  const [savedMaterialPoNumber, setSavedMaterialPoNumber] = useState('')
  const [isMaterialPoSaved, setIsMaterialPoSaved] = useState(false)
  const [supplierDraft, setSupplierDraft] = useState(createEmptySupplierDraft())
  const [materialDraft, setMaterialDraft] = useState(createEmptyMaterialDraft())
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
        setSuppliers(normalizedSuppliers)
        setMaterialOptions(normalizedMaterials)
        setMaterialPoNumbers((materialPoResponse.data || []).map((item) => String(item.material_po_number || '').trim().toUpperCase()).filter(Boolean))
        setPoFilter((current) => (current === NO_PO_VALUE || nextPoMeta[current] ? current : NO_PO_VALUE))
      } catch (loadError) {
        setRequirements([])
        setPoOptions([])
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

  const selectedPoId = poFilter === NO_PO_VALUE ? '' : poFilter

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
    if (!selectedPoId) return []
    return requirements.filter((item) => item.poId === selectedPoId)
  }, [requirements, selectedPoId])

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
      return savedMaterialPoNumber || (orderLines.length ? buildMaterialPoNumber(orderLines, materialPoNumbers) : '')
    } catch {
      return ''
    }
  }, [materialPoNumbers, orderLines, savedMaterialPoNumber])

  function markMaterialDraftUnsaved(options = {}) {
    setIsMaterialPoSaved(false)
    setSuccess('')

    if (options.clearPoNumber) {
      setSavedMaterialPoNumber('')
    }
  }

  function updateOrderHeader(name, value) {
    markMaterialDraftUnsaved()

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

  async function openSupplierModal() {
    setShowSupplierModal(true)
    setSupplierDraft(createEmptySupplierDraft())
    setSupplierCodeLoading(true)
    setError('')

    try {
      const nextCode = await generateSupplierCode()
      setSupplierDraft((current) => ({ ...current, supplierCode: nextCode }))
    } catch (codeError) {
      setError(codeError.message || 'Failed to generate supplier code.')
    } finally {
      setSupplierCodeLoading(false)
    }
  }

  function closeSupplierModal() {
    if (savingSupplier) return
    setShowSupplierModal(false)
    setSupplierDraft(createEmptySupplierDraft())
  }

  function updateSupplierDraft(name, value) {
    const nextValue = name === 'phone' ? value.replace(/\D/g, '') : value.toUpperCase()
    setSupplierDraft((current) => ({ ...current, [name]: nextValue }))
  }

  async function handleSaveQuickSupplier() {
    setError('')

    if (!supplierDraft.supplierCode.trim() || !supplierDraft.supplierName.trim()) {
      setError('Supplier code and supplier name are required.')
      return
    }

    setSavingSupplier(true)

    try {
      const { data: insertedSupplier, error: insertError } = await supabase
        .from('dir_suppliers')
        .insert({
          supplier_code: supplierDraft.supplierCode.trim().toUpperCase(),
          supplier_name: supplierDraft.supplierName.trim().toUpperCase(),
          group: 'ARKLINE',
          supplier_level: 'MATERIAL',
          contact_person: supplierDraft.contactPerson.trim().toUpperCase() || null,
          phone: supplierDraft.phone.trim() || null,
          address: supplierDraft.address.trim().toUpperCase() || null,
          is_active: true,
        })
        .select('id, supplier_name, supplier_level, contact_person, phone, address, "group", is_active')
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      const normalizedSupplier = normalizeSupplier(insertedSupplier)
      setSuppliers((current) => [...current, normalizedSupplier].sort(sortSuppliersByName))
      markMaterialDraftUnsaved()
      setOrderHeader((current) => ({
        ...current,
        supplierId: normalizedSupplier.id,
        supplierName: normalizedSupplier.supplierName,
      }))
      setSuccess('Material supplier added.')
      setShowSupplierModal(false)
      setSupplierDraft(createEmptySupplierDraft())
    } catch (saveError) {
      setError(saveError.message || 'Failed to save material supplier.')
    } finally {
      setSavingSupplier(false)
    }
  }

  function openMaterialModal() {
    setShowMaterialModal(true)
    setMaterialDraft(createEmptyMaterialDraft())
    setError('')
  }

  function closeMaterialModal() {
    if (savingMaterial) return
    setShowMaterialModal(false)
    setMaterialDraft(createEmptyMaterialDraft())
  }

  function updateMaterialDraft(name, value) {
    setMaterialDraft((current) => ({ ...current, [name]: value.toUpperCase() }))
  }

  async function handleSaveQuickMaterial() {
    setError('')

    if (!materialDraft.materialName.trim()) {
      setError('Material name is required.')
      return
    }

    setSavingMaterial(true)

    try {
      const { data: insertedMaterial, error: insertError } = await supabase
        .from('arkline_dir_materials')
        .insert({
          material_name: materialDraft.materialName.trim().toUpperCase(),
          unit: materialDraft.unit.trim().toUpperCase() || 'PCS',
          is_active: true,
        })
        .select('id, material_name, unit, is_active')
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      const normalizedMaterial = normalizeMaterialMaster(insertedMaterial)
      setMaterialOptions((current) => [...current, normalizedMaterial].sort(sortMaterialsByName))
      setFreeMaterialDraft((current) => ({
        ...current,
        materialId: normalizedMaterial.id,
      }))
      setSuccess('Material added.')
      setShowMaterialModal(false)
      setMaterialDraft(createEmptyMaterialDraft())
    } catch (saveError) {
      setError(saveError.message || 'Failed to save material.')
    } finally {
      setSavingMaterial(false)
    }
  }

  function toggleRequirementSelection(rowId) {
    setSelectedRequirementIds((current) =>
      current.includes(rowId) ? current.filter((item) => item !== rowId) : [...current, rowId]
    )
  }

  function handleMoveSelectedRequirements() {
    setError('')
    setSuccess('')
    setFreeMaterialError('')

    const selectedRows = filteredRequirements.filter((item) => selectedRequirementIds.includes(item.id))

    if (!selectedRows.length) {
      setError('Choose at least one material line first.')
      return
    }

    const existingSourcePoIds = getMaterialDraftSourcePoIds(orderLines)
    const nextSourcePoIds = Array.from(new Set(selectedRows.map((item) => item.poId).filter(Boolean)))

    if (hasUnlinkedFreeMaterial(orderLines)) {
      setError('This draft already uses No PO material. Reset the draft before adding PO-linked material.')
      return
    }

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
    markMaterialDraftUnsaved()
    setSelectedRequirementIds([])
    setSuccess('Selected materials moved to the order panel.')
  }

  function handleAddFreeMaterial() {
    setError('')
    setSuccess('')
    setFreeMaterialError('')

    const selectedMaterial = materialOptions.find((item) => item.id === freeMaterialDraft.materialId)
    const qty = toNumber(freeMaterialDraft.qty)
    const existingSourcePoIds = getMaterialDraftSourcePoIds(orderLines)

    if (!selectedMaterial) {
      setFreeMaterialError('Choose one material first.')
      return
    }

    if (qty <= 0) {
      setFreeMaterialError('Enter a valid quantity first.')
      return
    }

    if (selectedPoId) {
      if (hasUnlinkedFreeMaterial(orderLines)) {
        setError('This draft already uses No PO material. Reset the draft before adding PO-linked material.')
        return
      }

      if (existingSourcePoIds.length === 1 && existingSourcePoIds[0] !== selectedPoId) {
        setError(`This draft already uses ${existingSourcePoIds[0]}. Please use the same PO or reset the draft first.`)
        return
      }
    }

    if (!selectedPoId && existingSourcePoIds.length) {
      setError('This draft is already linked to a PO. Reset the draft before adding No PO material.')
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
      sources: [buildOrderSourceFromFreeMaterial(selectedMaterial, qty, selectedPoId)],
    }

    setOrderLines((current) => mergeSourceIntoLines(current, nextLine))
    markMaterialDraftUnsaved()
    setFreeMaterialDraft(createFreeMaterialDraft())
    setSuccess('Material added to the order panel.')
  }

  async function handleGenerateRequirements() {
    setError('')
    setSuccess('')
    setRequirementWarnings([])

    if (!selectedPoId) {
      setError('Choose one PO number first before generating material requirements.')
      return
    }

    setGeneratingRequirements(true)

    try {
      const { payload, warnings, itemMetaById } = await buildGeneratedMaterialRequirements(selectedPoId)

      const { error: deleteError } = await supabase
        .from('arkline_po_materials')
        .delete()
        .eq('po_id', selectedPoId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      let insertedRows = []

      if (payload.length) {
        const { data: inserted, error: insertError } = await supabase
          .from('arkline_po_materials')
          .insert(payload)
          .select('*')

        if (insertError) {
          throw new Error(insertError.message)
        }

        insertedRows = inserted || []
      }

      const nextRequirements = insertedRows
        .map(normalizeMaterialRequirement)
        .map((item) => ({
          ...item,
          productName: itemMetaById[item.arklinePoItemId]?.productName || '',
          categoryName: itemMetaById[item.arklinePoItemId]?.categoryName || '',
        }))

      setRequirements((current) =>
        [
          ...current.filter((item) => item.poId !== selectedPoId),
          ...nextRequirements,
        ].sort(compareMaterialRequirementRows)
      )
      setSelectedRequirementIds([])
      setRequirementWarnings(Array.from(new Set(warnings)))
      setSuccess(
        payload.length
          ? `Generated ${payload.length} material requirement line(s) for ${selectedPoId}.`
          : `No material requirement generated for ${selectedPoId}. You can still add free material for this PO.`
      )
    } catch (generateError) {
      setError(generateError.message || 'Failed to generate material requirements.')
    } finally {
      setGeneratingRequirements(false)
    }
  }

  function handleRemoveOrderLine(lineKey) {
    markMaterialDraftUnsaved({ clearPoNumber: orderLines.length <= 1 })
    setOrderLines((current) => current.filter((item) => item.key !== lineKey))
  }

  function handleUpdateOrderLineNotes(lineKey, value) {
    markMaterialDraftUnsaved()
    setOrderLines((current) => current.map((item) => (item.key === lineKey ? { ...item, notes: value } : item)))
  }

  function handleUpdateOrderLinePrice(lineKey, value) {
    markMaterialDraftUnsaved()
    setOrderLines((current) => current.map((item) => (item.key === lineKey ? { ...item, price: value } : item)))
  }

  function moveOrderLine(lineKey, direction) {
    markMaterialDraftUnsaved()
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
    setRequirementWarnings([])
    setOrderLines([])
    setFreeMaterialError('')
    setSavedMaterialPoNumber('')
    setIsMaterialPoSaved(false)
    setError('')
    setSuccess('')
  }

  function validateMaterialPoDraft() {
    if (!orderHeader.supplierId) {
      setError('Choose one material supplier first.')
      return false
    }

    if (!orderHeader.requestDeliveryDate) {
      setError('Fill the request delivery date first.')
      return false
    }

    if (!String(orderHeader.paymentTerms || '').trim()) {
      setError('Fill the payment terms first.')
      return false
    }

    if (!orderLines.length) {
      setError('Move or add at least one material line first.')
      return false
    }

    return true
  }

  function handleSaveMaterialPo() {
    setError('')
    setSuccess('')

    if (!validateMaterialPoDraft()) {
      return
    }

    setShowOrderedAsModal(true)
  }

  async function insertMaterialPoHeader(payload, createdBy) {
    const writePayload = {
      ...payload,
      created_by: createdBy,
    }

    let response = await supabase
      .from('arkline_po_material_ordered')
      .insert(writePayload)
      .select('id')
      .single()

    if (response.error && isMissingColumnError(response.error, 'include_ppn')) {
      const fallbackPayload = { ...writePayload }
      delete fallbackPayload.include_ppn
      response = await supabase
        .from('arkline_po_material_ordered')
        .insert(fallbackPayload)
        .select('id')
        .single()
    }

    return response
  }

  async function updateMaterialPoHeader(orderedId, payload) {
    let response = await supabase
      .from('arkline_po_material_ordered')
      .update(payload)
      .eq('id', orderedId)

    if (response.error && isMissingColumnError(response.error, 'include_ppn')) {
      const fallbackPayload = { ...payload }
      delete fallbackPayload.include_ppn
      response = await supabase
        .from('arkline_po_material_ordered')
        .update(fallbackPayload)
        .eq('id', orderedId)
    }

    return response
  }

  async function handleConfirmSaveMaterialPo(orderedAs) {
    setSaving(true)
    setError('')
    setSuccess('')
    setShowOrderedAsModal(false)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const userEmail = user?.email?.toLowerCase() || null
      const normalizedOrderedAs = String(orderedAs || ORDERED_AS_OPTIONS[0]).trim().toUpperCase()
      const materialPoNumber = savedMaterialPoNumber || buildMaterialPoNumber(orderLines, materialPoNumbers)
      const selectedSupplier = suppliers.find((item) => item.id === orderHeader.supplierId) || null
      const sourcePoIds = getMaterialDraftSourcePoIds(orderLines)
      const headerPayload = {
        material_po_number: materialPoNumber,
        supplier_id: Number(orderHeader.supplierId) || null,
        supplier_name_snapshot: selectedSupplier?.supplierName || orderHeader.supplierName || null,
        garment_po_number: sourcePoIds[0] || null,
        request_delivery_date: orderHeader.requestDeliveryDate || null,
        payment_terms: String(orderHeader.paymentTerms || '').trim() || null,
        notes: String(orderHeader.notes || '').trim() || null,
        include_ppn: orderHeader.includePpn !== false,
        ordered_as: normalizedOrderedAs,
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
        const { data: insertedHeader, error: insertHeaderError } = await insertMaterialPoHeader(headerPayload, userEmail)

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

        const { error: updateHeaderError } = await updateMaterialPoHeader(orderedId, headerPayload)

        if (updateHeaderError) {
          throw new Error(updateHeaderError.message)
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
        const lineSourcePoIds = getSourcePoIdsFromSources(line.sources)
        const hasGeneratedSource = (line.sources || []).some((source) => source.sourceType === 'PO')
        const hasFreeSource = (line.sources || []).some((source) => source.sourceType === 'FREE')

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
          source_type: hasGeneratedSource && hasFreeSource ? 'MIXED' : hasGeneratedSource ? 'PO' : 'FREE',
          source_po_id: lineSourcePoIds[0] || null,
        }
      })

      const { error: insertItemsError } = await supabase
        .from('arkline_po_material_ordered_items')
        .insert(itemPayload)

      if (insertItemsError) {
        throw new Error(insertItemsError.message)
      }

      setOrderHeader((current) => ({
        ...current,
        orderedAs: normalizedOrderedAs,
      }))
      setSavedMaterialPoNumber(materialPoNumber)
      setIsMaterialPoSaved(true)
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

    if (!validateMaterialPoDraft()) {
      return
    }

    if (!isMaterialPoSaved || !savedMaterialPoNumber) {
      setError('Save Material PO first before printing.')
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
      const poNumber = savedMaterialPoNumber
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
          includePpn: orderHeader.includePpn !== false,
          orderedAs: orderHeader.orderedAs || ORDERED_AS_OPTIONS[0],
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
              <button
                type="button"
                className={styles.printButton}
                onClick={handlePrintMaterialOrder}
                disabled={printing || loading || saving || !isMaterialPoSaved || !savedMaterialPoNumber}
              >
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
          </div>

          <div className={`${styles.formGrid} ${styles.materialHeaderGrid}`}>
            <div className={styles.field}>
              <label className={styles.label}>PO Number</label>
              <select
                className={styles.select}
                value={poFilter}
                onChange={(event) => {
                  setPoFilter(event.target.value)
                  setSelectedRequirementIds([])
                  setRequirementWarnings([])
                  setError('')
                  setSuccess('')
                }}
              >
                <option value={NO_PO_VALUE}>No PO</option>
                {poOptions.map((po) => (
                  <option key={po.poId} value={po.poId}>
                    {po.poId}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <div className={styles.fieldHeaderRow}>
                <label className={styles.label}>Supplier</label>
                <button
                  type="button"
                  className={styles.inlineAddButton}
                  onClick={() => void openSupplierModal()}
                  title="Add material supplier"
                  aria-label="Add material supplier"
                >
                  +
                </button>
              </div>
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

            <div className={`${styles.field} ${styles.materialTaxField}`.trim()}>
              <label className={styles.label}>{orderHeader.includePpn ? 'With PPN' : 'Without PPN'}</label>
              <label
                className={`${styles.taxToggleCompact} ${orderHeader.includePpn ? styles.taxToggleCompactActive : ''}`.trim()}
                aria-label={orderHeader.includePpn ? 'With PPN' : 'Without PPN'}
              >
                <input
                  type="checkbox"
                  checked={orderHeader.includePpn}
                  onChange={(event) => updateOrderHeader('includePpn', event.target.checked)}
                />
                <span className={styles.taxToggleKnob} aria-hidden="true" />
              </label>
            </div>

            <div className={`${styles.field} ${styles.fullSpan}`}>
              <label className={styles.label}>Remarks</label>
              <textarea
                className={styles.textarea}
                value={orderHeader.notes}
                onChange={(event) => updateOrderHeader('notes', event.target.value)}
                placeholder="Remarks for this material PO."
              />
            </div>
          </div>
        </section>

        <section className={styles.materialWorkflow}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Material Sources</h2>
              </div>
            </div>

            <div className={styles.sourceSubsectionHeader}>
              <div>
                <h3 className={styles.sourceSubsectionTitle}>Free Material</h3>
                <p className={styles.sourceSubsectionCopy}>
                  {selectedPoId ? `Manual material will stay linked to ${selectedPoId}.` : 'Manual material will be saved as No PO purchase.'}
                </p>
              </div>
            </div>

            <div className={styles.freeMaterialGrid}>
              <div className={styles.field}>
                <div className={styles.fieldHeaderRow}>
                  <label className={styles.label}>Material</label>
                  <button
                    type="button"
                    className={styles.inlineAddButton}
                    onClick={openMaterialModal}
                    title="Add material"
                    aria-label="Add material"
                  >
                    +
                  </button>
                </div>
                <select
                  className={styles.select}
                  value={freeMaterialDraft.materialId}
                  onChange={(event) => {
                    setFreeMaterialError('')
                    setFreeMaterialDraft((current) => ({ ...current, materialId: event.target.value }))
                  }}
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
                  onChange={(event) => {
                    setFreeMaterialError('')
                    setFreeMaterialDraft((current) => ({ ...current, qty: event.target.value }))
                  }}
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
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleAddFreeMaterial}
                >
                  Add to Order
                </button>
                {freeMaterialError ? <p className={styles.inlineErrorText}>{freeMaterialError}</p> : null}
              </div>
            </div>

            <div className={styles.sourceDivider} />

            <div className={styles.sourceSubsectionHeader}>
              <div>
                <h3 className={styles.sourceSubsectionTitle}>Generated Materials</h3>
                <p className={styles.sourceSubsectionCopy}>
                  {selectedPoId ? 'Generated requirement is saved as a PO material snapshot.' : 'Select a PO number to generate from BOM.'}
                </p>
              </div>

              {selectedPoId ? (
                <div className={styles.materialTableActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleGenerateRequirements}
                    disabled={generatingRequirements || loading}
                  >
                    {generatingRequirements ? 'Generating...' : 'Generate Material'}
                  </button>
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
                </div>
              ) : null}
            </div>

            {requirementWarnings.length ? (
              <div className={styles.warningBox}>
                {requirementWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            {loading ? (
              <div className={styles.emptyState}>Loading MRP workspace...</div>
            ) : selectedPoId ? (
              filteredRequirements.length ? (
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
                <div className={styles.emptyState}>No generated material lines found for this PO. Generate from BOM or add free material below.</div>
              )
            ) : (
              <div className={styles.emptyState}>No PO selected. Use free material below for non-PO purchases.</div>
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

      {showOrderedAsModal ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalCard} ${styles.orderedAsModal}`.trim()}>
            <h3 className={styles.modalTitle}>Ordered As</h3>
            <p className={styles.modalCopy}>Pilih nama perusahaan yang akan tampil di bawah logo Arkline pada Purchase Order.</p>

            <div className={styles.orderedAsChoices}>
              {ORDERED_AS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void handleConfirmSaveMaterialPo(option)}
                  disabled={saving}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setShowOrderedAsModal(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSupplierModal ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalCard} ${styles.quickSupplierModal}`.trim()}>
            <h3 className={styles.modalTitle}>Add Material Supplier</h3>
            <p className={styles.modalCopy}>Supplier will be saved as ARKLINE / MATERIAL and selected for this Material PO.</p>

            <div className={styles.quickSupplierGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Supplier Code</label>
                <input className={styles.inputReadonly} value={supplierCodeLoading ? 'GENERATING...' : supplierDraft.supplierCode} readOnly />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Supplier Name</label>
                <input
                  className={styles.input}
                  value={supplierDraft.supplierName}
                  onChange={(event) => updateSupplierDraft('supplierName', event.target.value)}
                  placeholder="SUPPLIER NAME"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Contact Person</label>
                <input
                  className={styles.input}
                  value={supplierDraft.contactPerson}
                  onChange={(event) => updateSupplierDraft('contactPerson', event.target.value)}
                  placeholder="CONTACT PERSON"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Phone</label>
                <input
                  className={styles.input}
                  value={supplierDraft.phone}
                  onChange={(event) => updateSupplierDraft('phone', event.target.value)}
                  inputMode="numeric"
                  placeholder="NUMBERS ONLY"
                />
              </div>

              <div className={`${styles.field} ${styles.fullSpan}`.trim()}>
                <label className={styles.label}>Address</label>
                <textarea
                  className={styles.textarea}
                  value={supplierDraft.address}
                  onChange={(event) => updateSupplierDraft('address', event.target.value)}
                  placeholder="ADDRESS"
                />
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeSupplierModal} disabled={savingSupplier}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleSaveQuickSupplier()}
                disabled={savingSupplier || supplierCodeLoading}
              >
                {savingSupplier ? 'Saving...' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showMaterialModal ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalCard} ${styles.quickMaterialModal}`.trim()}>
            <h3 className={styles.modalTitle}>Add Material</h3>
            <p className={styles.modalCopy}>Material will be saved to Arkline material directory and selected in Free Material.</p>

            <div className={styles.quickMaterialGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Material Name</label>
                <input
                  className={styles.input}
                  value={materialDraft.materialName}
                  onChange={(event) => updateMaterialDraft('materialName', event.target.value)}
                  placeholder="MATERIAL NAME"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Unit</label>
                <input
                  className={styles.input}
                  value={materialDraft.unit}
                  onChange={(event) => updateMaterialDraft('unit', event.target.value)}
                  placeholder="PCS"
                />
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeMaterialModal} disabled={savingMaterial}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleSaveQuickMaterial()}
                disabled={savingMaterial}
              >
                {savingMaterial ? 'Saving...' : 'Save Material'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
