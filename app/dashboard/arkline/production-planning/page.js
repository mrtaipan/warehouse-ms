'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'

import shellStyles from '../arkline.module.css'
import styles from './production-planning.module.css'

const supabase = createClient()

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const METHOD_OPTIONS = ['FOB', 'CMT']
const TEMPORARY_PO_SUFFIX = 'TEMPORER'

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
    price: '',
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
    paymentTerms: '',
    includePpn: true,
    status: 'Initiated',
    notes: '',
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

function normalizeBoolean(value, fallback = true) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return fallback
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

function isMissingColumnError(error, columnName) {
  const normalizedColumn = String(columnName || '').trim().toLowerCase()
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
  return Boolean(normalizedColumn && message.includes(normalizedColumn) && message.includes('column'))
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
    supplierLevel: String(row?.supplier_level || '').trim().toUpperCase(),
    contactPerson: String(row?.contact_person || '').trim(),
    phone: String(row?.phone || '').trim(),
    address: String(row?.address || '').trim(),
    isActive: row?.is_active !== false,
    source,
  }
}

function sortSuppliersByName(left, right) {
  return String(left?.supplierName || '').localeCompare(String(right?.supplierName || ''), undefined, { numeric: true })
}

function normalizePo(row) {
  return {
    id: row?.id || null,
    poId: String(row?.po_id || '').trim().toUpperCase(),
    method: String(row?.method || 'FOB').trim().toUpperCase(),
    status: String(row?.status || 'Draft').trim(),
    requestDeliveryDate: String(row?.request_delivery_date || '').slice(0, 10),
    paymentTerms: String(row?.payment_terms || '').trim(),
    supplierName: String(row?.supplier_name || '').trim().toUpperCase(),
    createdAt: String(row?.created_at || ''),
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

function formatDateLabel(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function buildNextPoId(records) {
  const maxNumber = records.reduce(
    (currentMax, item) => {
      const info = extractPoNumberInfo(item?.poId)
      if (!info || !Number.isFinite(info.numberValue)) {
        return currentMax
      }

      return Math.max(currentMax, info.numberValue)
    },
    0
  )

  return `PO-${maxNumber + 1}-`
}

function buildDefaultPoId(records) {
  return `${buildNextPoId(records)}${TEMPORARY_PO_SUFFIX}`
}

function getLineTotalQty(line) {
  return Object.values(line.qtyBySize || {}).reduce((sum, current) => sum + toNumber(current), 0)
}

function cloneLine(line) {
  return {
    ...line,
    price: String(line?.price || ''),
    qtyBySize: { ...line.qtyBySize },
  }
}

async function createPurchaseOrderPreviewHtml(bundle) {
  const logoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/Gemini_Generated_Image_1pgskj1pgskj1pgs.png`
      : '/Gemini_Generated_Image_1pgskj1pgskj1pgs.png'
  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  const buildRemarksHtml = (value) => {
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
  const buildMultilineHtml = (value) =>
    String(value ?? '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => escapeHtml(line))
      .join('<br />')

  const formatPrintDate = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date)
  }

  const formatIdr = (value) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0))

  const printableItems = bundle.items.map((item) => {
    const qty = getLineTotalQty(item)
    const price = toNumber(item.price)
    const amount = qty * price
    const sizeBreakdown = SIZE_OPTIONS.filter((size) => toNumber(item.qtyBySize?.[size]) > 0)
      .map((size) => `${size} ${formatQuantity(item.qtyBySize[size])}`)
      .join(' • ')

    return {
      name: item.namaProdukSnapshot || '-',
      qty,
      price,
      amount,
      sizeBreakdown,
    }
  })

  const includePpn = bundle.header.includePpn !== false
  const subtotal = printableItems.reduce((sum, item) => sum + item.amount, 0)
  const ppn = includePpn ? subtotal * 0.11 : 0
  const total = subtotal + ppn
  const remarks =
    String(bundle.header.notes || '').trim() ||
    'Mohon cantumkan nomor Purchase Order ini pada Invoice, Surat Jalan, dan dokumen pengiriman lainnya.'

  const itemRowsHtml = printableItems
    .map(
      (item) => `
        <tr class="border-b border-gray-200">
          <td class="py-4 px-1 text-left font-medium">
            <div>${escapeHtml(item.name)}</div>
            ${
              item.sizeBreakdown
                ? `<div class="mt-1 text-[8pt] text-gray-500">${escapeHtml(item.sizeBreakdown)}</div>`
                : ''
            }
          </td>
          <td class="py-4 px-1 text-center text-gray-600">${escapeHtml(formatQuantity(item.qty))}</td>
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
    <title>${escapeHtml(bundle.poId || 'Purchase Order')}</title>
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
            <div class="text-[9.5pt] font-medium">${escapeHtml(bundle.poId || '-')}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Date</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(formatPrintDate(bundle.poCreatedAt))}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Request Delivery Date</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(formatPrintDate(bundle.header.requestDeliveryDate))}</div>
          </div>
          <div>
            <div class="text-[7pt] font-bold uppercase tracking-widest text-gray-500">Payment Terms</div>
            <div class="text-[9.5pt] font-medium">${escapeHtml(bundle.header.paymentTerms || bundle.method || '-')}</div>
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
            <th class="px-1 py-3 text-left text-[7pt] font-bold uppercase tracking-widest text-gray-700">Produk</th>
            <th class="w-[12%] px-1 py-3 text-center text-[7pt] font-bold uppercase tracking-widest text-gray-700">Qty</th>
            <th class="w-[22%] px-1 py-3 text-right text-[7pt] font-bold uppercase tracking-widest text-gray-700">Price</th>
            <th class="w-[25%] px-1 py-3 text-right text-[7pt] font-bold uppercase tracking-widest text-gray-700">Amount</th>
          </tr>
        </thead>
        <tbody class="text-[9.5pt]">
          ${itemRowsHtml || `
            <tr>
              <td colspan="4" class="px-1 py-8 text-center text-[9pt] text-gray-500">No item lines saved for this PO.</td>
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

async function loadSuppliers() {
  const { data, error } = await supabase
    .from('dir_suppliers')
    .select('id, supplier_name, supplier_code, "group", supplier_level, contact_person, phone, address, is_active')
    .eq('group', 'ARKLINE')
    .eq('supplier_level', 'GARMENT')
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
    .filter((item) => {
      const status = item.status.toUpperCase()
      return item.poId && !['COMPLETED', 'ON PROGRESS', 'IN PROGRESS', 'ONGOING'].includes(status)
    })
    .sort((left, right) => {
      const leftInfo = extractPoNumberInfo(left.poId)
      const rightInfo = extractPoNumberInfo(right.poId)

      if (leftInfo?.numberValue != null && rightInfo?.numberValue != null && leftInfo.numberValue !== rightInfo.numberValue) {
        return leftInfo.numberValue - rightInfo.numberValue
      }

      return left.poId.localeCompare(right.poId, undefined, { numeric: true })
    })
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

  let supplier = null

  if (poRow.supplier_id != null) {
    const { data: supplierRow, error: supplierError } = await supabase
      .from('dir_suppliers')
      .select('id, supplier_name, supplier_code, "group", supplier_level, contact_person, phone, address, is_active')
      .eq('id', poRow.supplier_id)
      .maybeSingle()

    if (supplierError && supplierError.code !== 'PGRST116') {
      throw new Error(supplierError.message)
    }

    supplier = supplierRow ? normalizeSupplier(supplierRow, 'regular') : null
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
      price: String(item.price ?? item.hpp ?? ''),
      status: String(item.status || 'Initiated'),
      notes: String(item.notes || ''),
      actualQty: Number(item.actual_qty || 0) || 0,
      qtyBySize,
    }
  })

  return {
    po: poRow,
    supplier,
    items: normalizedItems,
  }
}

export default function ArklineProductionPlanningPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [lineError, setLineError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPlanningDirty, setIsPlanningDirty] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [pendingNavigationHref, setPendingNavigationHref] = useState('')
  const [isEditingExistingPoSuffix, setIsEditingExistingPoSuffix] = useState(false)
  const [showExistingPoPicker, setShowExistingPoPicker] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [supplierCodeLoading, setSupplierCodeLoading] = useState(false)
  const [supplierDraft, setSupplierDraft] = useState(createEmptySupplierDraft())
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
          poId: prev.poId || buildDefaultPoId(poRows),
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
  const isPriceDisabled = isExistingModeLocked
  const canPrintPurchaseOrder = Boolean(currentPoDbId && header.poId && !isPlanningDirty && !saving && !loading)

  const isTemporaryPo = isEditablePoSuffix(header.poId)

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
      price: String(nextDraft?.price || ''),
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
      poId: nextMode === 'new' ? buildDefaultPoId(poRows) : '',
    })
    setCategoryFilter('')
    setPoItems([])
    resetLineDraft()
    setIsPlanningDirty(false)
    setError('')
    setLineError('')
    setSuccess('')
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
  }

  function handleHeaderChange(event) {
    const { name, value, type, checked } = event.target

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
      [name]: type === 'checkbox' ? checked : value,
    }))
    setIsPlanningDirty(true)
    setError('')
  }

  async function openSupplierModal() {
    if (isExistingModeLocked) return
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
          supplier_level: 'GARMENT',
          contact_person: supplierDraft.contactPerson.trim().toUpperCase() || null,
          phone: supplierDraft.phone.trim() || null,
          address: supplierDraft.address.trim().toUpperCase() || null,
          is_active: true,
        })
        .select('id, supplier_name, supplier_code, "group", supplier_level, contact_person, phone, address, is_active')
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      const normalizedSupplier = normalizeSupplier(insertedSupplier, 'regular')
      setSuppliers((current) => [...current, normalizedSupplier].sort(sortSuppliersByName))
      setHeader((current) => ({
        ...current,
        supplierId: normalizedSupplier.id,
        supplierName: normalizedSupplier.supplierName,
      }))
      setIsPlanningDirty(true)
      setSuccess('Garment supplier added.')
      setShowSupplierModal(false)
      setSupplierDraft(createEmptySupplierDraft())
    } catch (saveError) {
      setError(saveError.message || 'Failed to save garment supplier.')
    } finally {
      setSavingSupplier(false)
    }
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

    if (name === 'price') {
      const numericValue = value.replace(/,/g, '').replace(/[^\d.]/g, '')
      setLineDraft((prev) => ({
        ...prev,
        price: numericValue,
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
    if (!isTemporaryPo && totalQty <= 0) {
      setLineError('Enter at least one size quantity before adding the line.')
      return null
    }

    if (!isTemporaryPo && toNumber(lineDraft.price) <= 0) {
      setLineError('Enter Price for this product line.')
      return null
    }

    return {
      ...cloneLine(lineDraft),
      localId: lineDraft.localId || `draft-${Date.now()}`,
      namaProdukSnapshot: product.namaProduk,
      kategoriProdukSnapshot: product.kategoriProduk,
      kategoriPengadaanSnapshot: product.kategoriPengadaan,
      allowancePct: String(lineDraft.allowancePct || '0'),
      price: String(lineDraft.price || ''),
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
        paymentTerms: String(bundle.po.payment_terms || ''),
        includePpn: normalizeBoolean(bundle.po.include_ppn, true),
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

      if (!String(header.paymentTerms || '').trim()) {
        throw new Error('Payment terms is required.')
      }

      if (!poItems.length) {
        throw new Error('Add at least one product line before saving.')
      }

      if (!isTemporaryPo) {
        const missingQtyLine = poItems.find((item) => getLineTotalQty(item) <= 0)
        if (missingQtyLine) {
          throw new Error('Enter qty by size for all product lines before saving final PO.')
        }

        const missingPriceLine = poItems.find((item) => toNumber(item.price) <= 0)
        if (missingPriceLine) {
          throw new Error('Enter price for all product lines before saving final PO.')
        }
      }

      let poDbId = currentPoDbId

      const headerPayload = {
        po_id: header.poId.trim().toUpperCase(),
        method,
        supplier_id: header.supplierId ? Number(header.supplierId) || header.supplierId : null,
        supplier_name: header.supplierName || null,
        request_delivery_date: header.requestDeliveryDate || null,
        payment_terms: String(header.paymentTerms || '').trim() || null,
        include_ppn: header.includePpn !== false,
        status: header.status || 'Draft',
        notes: header.notes.trim() || null,
        updated_by: userEmail,
      }
      const headerPayloadWithoutPpn = { ...headerPayload }
      delete headerPayloadWithoutPpn.include_ppn

      if (!poDbId) {
        let { data: insertedPo, error: insertPoError } = await supabase
          .from('arkline_pos')
          .insert({
            ...headerPayload,
            created_by: userEmail,
          })
          .select('*')
          .single()

        if (insertPoError && isMissingColumnError(insertPoError, 'include_ppn')) {
          const retryResult = await supabase
            .from('arkline_pos')
            .insert({
              ...headerPayloadWithoutPpn,
              created_by: userEmail,
            })
            .select('*')
            .single()
          insertedPo = retryResult.data
          insertPoError = retryResult.error
        }

        if (insertPoError) {
          throw new Error(insertPoError.message)
        }

        poDbId = insertedPo.id
      } else {
        let { error: updatePoError } = await supabase.from('arkline_pos').update(headerPayload).eq('id', poDbId)

        if (updatePoError && isMissingColumnError(updatePoError, 'include_ppn')) {
          const retryResult = await supabase.from('arkline_pos').update(headerPayloadWithoutPpn).eq('id', poDbId)
          updatePoError = retryResult.error
        }

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

      const itemPayload = poItems.map((item) => {
        const itemPrice = toNumber(item.price)

        return {
          po_id: header.poId.trim().toUpperCase(),
          sku_induk: item.skuInduk,
          nama_produk: item.namaProdukSnapshot,
          kategori_produk: item.kategoriProdukSnapshot || null,
          allowance_pct: toNumber(item.allowancePct),
          total_qty: getLineTotalQty(item),
          actual_qty: 0,
          price: itemPrice,
          hpp: method === 'FOB' ? itemPrice : null,
          status: item.status || 'Initiated',
          notes: item.notes.trim() || null,
          kategori_pengadaan: item.kategoriPengadaanSnapshot || productBySku[item.skuInduk]?.kategoriPengadaan || null,
        }
      })

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

    if (!currentPoDbId || isPlanningDirty) {
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
      const supplierContactParts = [bundle.supplier?.contactPerson, bundle.supplier?.phone].filter(Boolean)
      const printableItems = bundle.items.map((item) => {
        const currentProduct = productBySku[item.skuInduk] || null
        return {
          ...item,
          namaProdukSnapshot: currentProduct?.namaProduk || item.namaProdukSnapshot,
          kategoriProdukSnapshot: currentProduct?.kategoriProduk || item.kategoriProdukSnapshot,
        }
      })
      const previewHtml = await createPurchaseOrderPreviewHtml({
        poId: header.poId,
        method,
        poCreatedAt: bundle.po.created_at,
        header: {
          ...header,
          paymentTerms: String(bundle.po.payment_terms || header.paymentTerms || ''),
          supplierAddress: bundle.supplier?.address || '',
          supplierContact: supplierContactParts.join(' | '),
        },
        items: printableItems,
      })
      previewWindow.document.open()
      previewWindow.document.write(previewHtml)
      previewWindow.document.close()
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
            <h1 className={styles.title}>Production Orders</h1>
            <p className={styles.subtitle}>Garment PO setup, size allocation, material generation, save, and print.</p>
          </div>
          <div className={styles.headerControls}>
            <div className={styles.headerActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => resetPlanningState('new')}>
                Reset Planning
              </button>
              <button type="button" className={styles.printButton} onClick={handlePrint} disabled={printing || !canPrintPurchaseOrder}>
                {printing ? 'Preparing Print...' : 'Print Purchase Order'}
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleSavePo} disabled={saving || loading}>
                {saving ? 'Saving...' : 'Save Planning'}
              </button>
            </div>
            {(error || success) && (
              <div className={styles.feedbackStrip}>
                {error ? <p className={styles.errorText}>{error}</p> : null}
                {success ? <p className={styles.successText}>{success}</p> : null}
              </div>
            )}
          </div>
        </div>

        <div className={styles.planningColumns}>
        <section className={`${styles.sectionCard} ${styles.poPlanningCard}`.trim()}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Production Orders</h2>
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

            <div className={`${styles.field} ${styles.methodTaxField}`.trim()}>
              <div className={styles.methodTaxLabels}>
                <label className={styles.label}>Planning Method</label>
                <span className={styles.label}>{header.includePpn ? 'With PPN' : 'Without PPN'}</span>
              </div>
              <div className={styles.methodTaxControls}>
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
                <label
                  className={[
                    styles.taxToggleCompact,
                    header.includePpn ? styles.taxToggleCompactActive : '',
                    isExistingModeLocked ? styles.taxToggleCompactDisabled : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={header.includePpn ? 'With PPN' : 'Without PPN'}
                >
                  <input
                    type="checkbox"
                    name="includePpn"
                    checked={header.includePpn}
                    onChange={handleHeaderChange}
                    disabled={isExistingModeLocked}
                  />
                  <span className={styles.taxToggleKnob} aria-hidden="true" />
                </label>
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label}>
                  PO ID <span className={styles.requiredMark}>*</span>
                </label>
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
              <div className={styles.fieldHeaderRow}>
                <label className={styles.label}>
                  Supplier <span className={styles.requiredMark}>*</span>
                </label>
                <button
                  type="button"
                  className={styles.inlineAddButton}
                  onClick={() => void openSupplierModal()}
                  disabled={isExistingModeLocked}
                  title="Add garment supplier"
                  aria-label="Add garment supplier"
                >
                  +
                </button>
              </div>
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
              <label className={styles.label}>
                Request Delivery <span className={styles.requiredMark}>*</span>
              </label>
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
              <label className={styles.label}>
                Payment Terms <span className={styles.requiredMark}>*</span>
              </label>
              <input
                className={styles.input}
                name="paymentTerms"
                value={header.paymentTerms}
                onChange={handleHeaderChange}
                placeholder="e.g. 30% DP, 70% before shipment"
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

          <div className={styles.remarksSection}>
            <label className={styles.label}>Remarks</label>
            <textarea
              className={`${styles.textarea} ${styles.remarksTextarea}`.trim()}
              name="notes"
              value={header.notes}
              onChange={handleHeaderChange}
              placeholder="Optional remarks"
              disabled={isExistingModeLocked}
            />
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
              <label className={styles.label}>
                Product <span className={styles.requiredMark}>*</span>
              </label>
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
              <label className={styles.label}>
                Price {!isTemporaryPo ? <span className={styles.requiredMark}>*</span> : null}
              </label>
              <input
                className={styles.input}
                name="price"
                inputMode="decimal"
                value={formatNumberInput(lineDraft.price ?? '')}
                onChange={handleDraftChange}
                disabled={isPriceDisabled}
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
              <table className={`${styles.table} ${styles.productLinesTable}`.trim()}>
                <colgroup>
                  <col className={styles.productLineProductColumn} />
                  <col className={styles.productLineQtyColumn} />
                  <col className={styles.productLinePriceColumn} />
                  <col className={styles.productLineSizeColumn} />
                  <col className={styles.productLineActionColumn} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Total Qty</th>
                    <th>Price</th>
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
                        <td>{formatCurrency(toNumber(item.price))}</td>
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

      </section>

      {showSupplierModal ? (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalCard} ${styles.quickSupplierModal}`.trim()}>
            <h3 className={styles.modalTitle}>Add Garment Supplier</h3>
            <p className={styles.modalCopy}>Supplier will be saved as ARKLINE / GARMENT and selected for this PO.</p>

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
