'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()
const VALID_STATUSES = ['packaged', 'ship', 'shipped']
const SIZE_TOKENS = ['8XL', '7XL', '6XL', '5XL', '4XL', '3XL', 'XXXL', '2XL', 'XXL', 'XL', 'XXS', 'XS', 'L', 'M', 'S']
const LINE_INSERT_CHUNK_SIZE = 500

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value || 0))
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase()
}

function normalizeSku(value) {
  return normalizeUpper(value).replace(/[^A-Z0-9]/g, '')
}

function isLikelySku(value) {
  const normalized = normalizeSku(value)
  return normalized.length >= 8 && /[A-Z]/.test(normalized) && /\d/.test(normalized)
}

function getSkuCandidates(...values) {
  const candidates = new Set()

  values.forEach((value) => {
    const rawValue = normalizeText(value)
    if (!rawValue) return

    const normalizedWholeValue = normalizeSku(rawValue)
    if (isLikelySku(normalizedWholeValue)) {
      candidates.add(normalizedWholeValue)
    }

    rawValue
      .split(/[\s|,;/]+/)
      .map((part) => normalizeSku(part))
      .filter(isLikelySku)
      .forEach((candidate) => candidates.add(candidate))
  })

  return Array.from(candidates)
}

function normalizeSize(value) {
  return normalizeUpper(value).replace(/\s+/g, '')
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase()
}

function getCsvValue(row, headerMap, candidates) {
  for (const candidate of candidates) {
    const index = headerMap.get(candidate.toLowerCase())
    if (typeof index === 'number') {
      return normalizeText(row[index])
    }
  }

  return ''
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }

      row.push(cell)
      if (row.some((item) => normalizeText(item))) {
        rows.push(row)
      }
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some((item) => normalizeText(item))) {
    rows.push(row)
  }

  if (inQuotes) {
    throw new Error('CSV format cannot be read: an opening quotation mark has no matching closing quotation mark.')
  }

  return rows
}

function resolveSize(variationRaw) {
  const normalized = normalizeUpper(variationRaw)
  if (!normalized) return ''

  const direct = normalizeSize(normalized)
  if (SIZE_TOKENS.includes(direct)) return direct

  const tokens = normalized
    .split(/[-/|,;:()\s]+/)
    .map((item) => normalizeSize(item))
    .filter(Boolean)

  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (SIZE_TOKENS.includes(tokens[index])) {
      return tokens[index]
    }
  }

  for (const size of SIZE_TOKENS) {
    if (direct.endsWith(size)) {
      return size
    }
  }

  return direct
}

function parseQty(value) {
  const parsed = Number.parseInt(String(value || '').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function getStorageKey(sku, size) {
  return `${normalizeSku(sku)}::${normalizeSize(size)}`
}

function buildShelvingAvailability(storageRows = [], temporarySalesRows = []) {
  const availability = new Map()
  const unsizedSkus = new Set()

  const addRows = (rows, isShelving) => rows.forEach((row) => {
    const locationType = normalizeUpper(row.location?.location_type || row.location_type)
    const skuCandidates = getSkuCandidates(row.sku_id, row.source_variant_code, row.item_name)
    const size = normalizeSize(row.size) || '-'
    const qty = Math.max(0, Number(row.qty_in_area ?? row.qty ?? 0))

    if (isShelving && locationType !== 'SHELVING') return
    if (!skuCandidates.length || qty <= 0) return

    skuCandidates.forEach((sku) => {
      if (size === '-') unsizedSkus.add(sku)
      const key = getStorageKey(sku, size)
      availability.set(key, Number(availability.get(key) || 0) + qty)
    })
  })

  addRows(temporarySalesRows.filter((row) => (
    normalizeStatus(row.status) === 'in_temporary_area' &&
    normalizeUpper(row.area_type || 'SALES') === 'SALES'
  )), false)
  addRows(storageRows, true)

  return { availability, unsizedSkus }
}

function buildImportPreview(csvRows, storageRows, temporarySalesRows = [], bundleRows = [], bundleComponentRows = []) {
  if (!csvRows.length) {
    throw new Error('CSV file is empty.')
  }

  const [headers, ...bodyRows] = csvRows
  if (!headers || headers.length < 2) {
    throw new Error('CSV format cannot be read. Use a comma-separated CSV file with a header row.')
  }

  const headerMap = new Map(headers.map((header, index) => [normalizeText(header).toLowerCase(), index]))
  const requiredHeaderGroups = [
    { label: 'Nomor Pesanan', candidates: ['Nomor Pesanan'] },
    { label: 'Status Pesanan', candidates: ['Status Pesanan'] },
    { label: 'Kode Varian atau Kode Produk', candidates: ['Kode Varian', 'Kode Produk'] },
    { label: 'Variasi', candidates: ['Variasi'] },
    { label: 'Jumlah', candidates: ['Jumlah'] },
  ]
  const missingHeaders = requiredHeaderGroups
    .filter(({ candidates }) => !candidates.some((candidate) => headerMap.has(candidate.toLowerCase())))
    .map(({ label }) => label)

  if (missingHeaders.length > 0) {
    throw new Error(`CSV format cannot be read. Missing required column(s): ${missingHeaders.join(', ')}.`)
  }

  const { availability, unsizedSkus } = buildShelvingAvailability(storageRows, temporarySalesRows)
  const bundleCodes = new Set(bundleRows.map((bundle) => normalizeSku(bundle.bundle_code)).filter(Boolean))
  const bundleByCode = new Map(bundleRows.map((bundle) => [normalizeSku(bundle.bundle_code), bundle]))
  const validStatusSet = new Set(VALID_STATUSES)
  const lines = []
  const duplicateLineKeys = new Map()
  let currentOrderNumber = ''
  let currentStatus = ''

  bodyRows.forEach((row, bodyIndex) => {
    const rowNumber = bodyIndex + 2
    const orderNumber = getCsvValue(row, headerMap, ['Nomor Pesanan'])
    const orderStatus = getCsvValue(row, headerMap, ['Status Pesanan'])
    const productCode = getCsvValue(row, headerMap, ['Kode Produk'])
    const variantCode = getCsvValue(row, headerMap, ['Kode Varian'])
    const productName = getCsvValue(row, headerMap, ['Produk di Pesanan'])
    const variationRaw = getCsvValue(row, headerMap, ['Variasi'])
    const qty = parseQty(getCsvValue(row, headerMap, ['Jumlah']))

    if (orderNumber) currentOrderNumber = orderNumber
    if (orderStatus) currentStatus = normalizeStatus(orderStatus)

    const resolvedOrderNumber = orderNumber || currentOrderNumber
    const resolvedStatus = normalizeStatus(orderStatus || currentStatus)
    const skuId = getSkuCandidates(variantCode, productCode, productName)[0] || normalizeUpper(variantCode || productCode)
    let size = resolveSize(variationRaw)
    const isBundleSku = bundleCodes.has(normalizeSku(skuId))
    if (!size && (unsizedSkus.has(normalizeSku(skuId)) || isBundleSku)) size = '-'
    if (!size) size = '-'
    const validStatus = validStatusSet.has(resolvedStatus)
    let exclusionReason = ''

    if (!skuId) exclusionReason = 'Missing SKU'
    else if (qty <= 0) exclusionReason = 'Qty must be greater than 0'
    else if (!validStatus) exclusionReason = `Status ${resolvedStatus || '-'} is not included`

    const included = !exclusionReason
    const key = getStorageKey(skuId, size)
    let availableQty = included ? Math.max(0, Number(availability.get(key) || 0)) : 0
    let appliedQty = included ? Math.min(qty, availableQty) : 0
    let skippedQty = included ? Math.max(0, qty - appliedQty) : 0

    if (included && isBundleSku) {
      const bundle = bundleByCode.get(normalizeSku(skuId))
      const rawComponents = bundleComponentRows.filter((component) => Number(component.bundle_id) === Number(bundle?.id))
      const components = Array.from(rawComponents.reduce((componentMap, component) => {
        const componentSku = normalizeSku(component.sku)
        const componentSize = normalizeSize(component.size_label) || '-'
        const key = `${componentSku}::${componentSize}`
        const current = componentMap.get(key)
        componentMap.set(key, {
          ...component,
          sku: component.sku,
          size_label: componentSize,
          allocated_qty: Number(current?.allocated_qty || 0) + Number(component.allocated_qty || 0),
        })
        return componentMap
      }, new Map()).values())
      const unitQty = Math.max(1, Number(bundle?.bundle_unit_qty || 1))
      const sizeTotals = new Map()
      components.forEach((component) => {
        const componentSize = normalizeSize(component.size_label) || '-'
        sizeTotals.set(componentSize, Number(sizeTotals.get(componentSize) || 0) + Number(component.allocated_qty || 0))
      })
      const componentRequirements = components.map((component) => {
        const componentSize = normalizeSize(component.size_label) || '-'
        const sizeBundleCount = Math.floor(Number(sizeTotals.get(componentSize) || 0) / unitQty)
        return { component, required: sizeBundleCount > 0 ? Number(component.allocated_qty || 0) / sizeBundleCount : 0 }
      })
      const componentAvailable = componentRequirements.map(({ component, required }) => {
        if (!Number.isInteger(required) || required <= 0) return 0
        const componentSku = normalizeSku(component.sku)
        const componentSize = normalizeSize(component.size_label) || '-'
        const componentStock = componentSize === '-'
          ? Array.from(availability.entries())
            .filter(([stockKey]) => stockKey.startsWith(`${componentSku}::`))
            .reduce((sum, [, stockQty]) => sum + Number(stockQty || 0), 0)
          : Number(availability.get(getStorageKey(componentSku, componentSize)) || 0)
        return Math.floor(componentStock / required)
      })
      availableQty = componentAvailable.length ? Math.min(...componentAvailable) : 0
      appliedQty = Math.min(qty, availableQty)
      skippedQty = Math.max(0, qty - appliedQty)
    }

    if (included && isBundleSku && appliedQty > 0) {
      const bundle = bundleByCode.get(normalizeSku(skuId))
      const components = Array.from(bundleComponentRows
        .filter((component) => Number(component.bundle_id) === Number(bundle?.id))
        .reduce((componentMap, component) => {
          const componentSku = normalizeSku(component.sku)
          const componentSize = normalizeSize(component.size_label) || '-'
          const key = `${componentSku}::${componentSize}`
          const current = componentMap.get(key)
          componentMap.set(key, {
            ...component,
            size_label: componentSize,
            allocated_qty: Number(current?.allocated_qty || 0) + Number(component.allocated_qty || 0),
          })
          return componentMap
        }, new Map()).values())
      const unitQty = Math.max(1, Number(bundle?.bundle_unit_qty || 1))
      const sizeTotals = new Map()
      components
        .forEach((component) => {
          const componentSize = normalizeSize(component.size_label) || '-'
          sizeTotals.set(componentSize, Number(sizeTotals.get(componentSize) || 0) + Number(component.allocated_qty || 0))
        })
      components
        .forEach((component) => {
          const componentSize = normalizeSize(component.size_label) || '-'
          const sizeBundleCount = Math.floor(Number(sizeTotals.get(componentSize) || 0) / unitQty)
          const required = sizeBundleCount > 0 ? Number(component.allocated_qty || 0) / sizeBundleCount : 0
          if (!Number.isInteger(required) || required <= 0) return
          const componentSku = normalizeSku(component.sku)
          const componentKey = getStorageKey(componentSku, componentSize)
          if (componentSize === '-') {
            let remaining = required * appliedQty
            Array.from(availability.keys())
              .filter((stockKey) => stockKey.startsWith(`${componentSku}::`))
              .forEach((stockKey) => {
                const taken = Math.min(remaining, Number(availability.get(stockKey) || 0))
                availability.set(stockKey, Number(availability.get(stockKey) || 0) - taken)
                remaining -= taken
              })
          } else {
            availability.set(componentKey, Math.max(0, Number(availability.get(componentKey) || 0) - required * appliedQty))
          }
        })
    } else if (included) {
      availability.set(key, Math.max(0, availableQty - appliedQty))
    }

    if (included && resolvedOrderNumber && skuId && size) {
      const duplicateKey = `${resolvedOrderNumber}::${skuId}::${size}`
      duplicateLineKeys.set(duplicateKey, Number(duplicateLineKeys.get(duplicateKey) || 0) + 1)
    }

    lines.push({
      rowNumber,
      orderNumber: resolvedOrderNumber,
      orderStatus: resolvedStatus,
      skuId,
      productName,
      variationRaw,
      size,
      qty,
      included,
      exclusionReason,
      availableQtySnapshot: availableQty,
      appliedQty,
      skippedQty,
    })
  })

  const includedLines = lines.filter((line) => line.included)
  const duplicateOrderCount = Array.from(duplicateLineKeys.values()).reduce(
    (sum, count) => sum + Math.max(0, count - 1),
    0
  )

  return {
    lines,
    totalCsvRows: bodyRows.length,
    orderCount: new Set(lines.map((line) => line.orderNumber).filter(Boolean)).size,
    totalOrderLines: lines.filter((line) => line.qty > 0).length,
    includedLines: includedLines.length,
    excludedLines: lines.length - includedLines.length,
    requestedQty: includedLines.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    appliedQty: includedLines.reduce((sum, line) => sum + Number(line.appliedQty || 0), 0),
    skippedQty: includedLines.reduce((sum, line) => sum + Number(line.skippedQty || 0), 0),
    duplicateOrderCount,
    shortageLineCount: includedLines.filter((line) => Number(line.skippedQty || 0) > 0).length,
    missingSkuCount: lines.filter((line) => line.exclusionReason === 'Missing SKU').length,
  }
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function getFileHash(file) {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return bytesToHex(digest)
}

async function getCurrentUserEmail() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.email || null
}

function getSchemaMissingMessage(error) {
  const detail = normalizeText(error?.message || error?.details)
  return `Shelving Upload schema is not ready. Please run supabase/upload_sales_import.sql first.${detail ? ` Detail: ${detail}` : ''}`
}

function isSchemaError(error) {
  const message = normalizeUpper(error?.message || error?.details)
  return message.includes('DOES NOT EXIST') || message.includes('SCHEMA CACHE') || message.includes('COULD NOT FIND')
}

export default function ShelvingUploadClient({
  showHeader = true,
  storageRows = [],
  temporarySalesRows = [],
  bundleRows = [],
  bundleComponentRows = [],
  canUpload = false,
  canManage = false,
  onInventoryChanged,
}) {
  const [batches, setBatches] = useState([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [selectedLines, setSelectedLines] = useState([])
  const [lineSearch, setLineSearch] = useState('')
  const [lineSizeSearch, setLineSizeSearch] = useState('')
  const [lineFilter, setLineFilter] = useState('ALL')
  const [file, setFile] = useState(null)
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [linesLoading, setLinesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const [retryingId, setRetryingId] = useState('')
  const [reversingId, setReversingId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedBatch = useMemo(
    () => batches.find((batch) => String(batch.id) === String(selectedBatchId)) || null,
    [batches, selectedBatchId]
  )

  const issueLines = useMemo(
    () => selectedLines.filter((line) => !line.included),
    [selectedLines]
  )

  const filteredPreviewLines = useMemo(() => {
    const query = normalizeUpper(lineSearch)
    const sizeQuery = normalizeUpper(lineSizeSearch)
    const filteredSource = selectedLines.filter((line) => {
      if (lineFilter === 'APPLIED') return Number(line.applied_qty || 0) > 0
      if (lineFilter === 'SKIPPED') return Number(line.skipped_qty || 0) > 0
      if (lineFilter === 'ISSUES') return !line.included
      return true
    })
    return filteredSource.filter((line) => {
      const matchesSearch = !query || [line.sku_id, line.product_name, line.order_number, line.size]
        .some((value) => normalizeUpper(value).includes(query))
      const matchesSize = !sizeQuery || normalizeUpper(line.size).includes(sizeQuery)
      return matchesSearch && matchesSize
    })
  }, [lineFilter, lineSearch, lineSizeSearch, selectedLines])

  const visiblePreviewLines = useMemo(
    () => !lineSearch && !lineSizeSearch && lineFilter === 'ALL' ? filteredPreviewLines.slice(0, 80) : filteredPreviewLines,
    [filteredPreviewLines, lineFilter, lineSearch, lineSizeSearch]
  )

  const filteredPreviewQty = useMemo(
    () => filteredPreviewLines.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    [filteredPreviewLines]
  )

  async function loadBatches({ keepSelection = false } = {}) {
    setLoading(true)
    setError('')

    const { data, error: batchError } = await supabase
      .from('upload_sales_import_batches')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(30)

    if (batchError) {
      setBatches([])
      setLoading(false)
      setError(isSchemaError(batchError) ? getSchemaMissingMessage(batchError) : batchError.message)
      return
    }

    const rows = data || []
    setBatches(rows)
    setLoading(false)

    if (!keepSelection) {
      setSelectedBatchId(rows[0]?.id || '')
      return
    }

    if (selectedBatchId && !rows.some((batch) => String(batch.id) === String(selectedBatchId))) {
      setSelectedBatchId(rows[0]?.id || '')
    }
  }

  async function loadLines(batchId) {
    if (!batchId) {
      setSelectedLines([])
      return
    }

    setLinesLoading(true)
    const { data, error: lineError } = await supabase
      .from('upload_sales_import_lines')
      .select('*')
      .eq('batch_id', batchId)
      .order('row_number', { ascending: true })

    if (lineError) {
      setSelectedLines([])
      setLinesLoading(false)
      setError(isSchemaError(lineError) ? getSchemaMissingMessage(lineError) : lineError.message)
      return
    }

    setSelectedLines(data || [])
    setLinesLoading(false)
  }

  function downloadBatchCsv(batch) {
    if (!batch || selectedLines.length === 0) return

    const headers = ['Order Number', 'Order Status', 'SKU', 'Product Name', 'Size', 'Qty']
    const escapeCsv = (value) => {
      const text = String(value ?? '')
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const rows = selectedLines.map((line) => [
      line.order_number,
      line.order_status,
      line.sku_id,
      line.product_name,
      line.size,
      line.qty,
    ].map(escapeCsv).join(','))
    const csv = `\uFEFF${headers.join(',')}\n${rows.join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = batch.file_name || `${batch.batch_number || 'upload-batch'}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    loadBatches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadLines(selectedBatchId)
  }, [selectedBatchId])

  async function handleFilePreview() {
    if (!canUpload || saving) return

    if (!file) {
      setError('Choose a CSV file first.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const [fileText, fileHash, uploadedBy] = await Promise.all([
        file.text(),
        getFileHash(file),
        getCurrentUserEmail(),
      ])

      const { data: duplicateBatch, error: duplicateError } = await supabase
        .from('upload_sales_import_batches')
        .select('id, batch_number, status, uploaded_at')
        .eq('file_hash', fileHash)
        .maybeSingle()

      if (duplicateError) {
        throw duplicateError
      }

      if (duplicateBatch) {
        throw new Error(
          `This file was already uploaded as ${duplicateBatch.batch_number} on ${formatDateTime(duplicateBatch.uploaded_at)}.`
        )
      }

      const parsedRows = parseCsv(fileText)
      const nextPreview = buildImportPreview(parsedRows, storageRows, temporarySalesRows, bundleRows, bundleComponentRows)

      if (!nextPreview.lines.length) {
        throw new Error('No importable rows were found in this CSV.')
      }

      setPreview(nextPreview)

      const { data: batchRows, error: insertBatchError } = await supabase
        .from('upload_sales_import_batches')
        .insert([{
          file_name: file.name,
          file_hash: fileHash,
          source_channel: 'jubelio',
          status: 'draft',
          valid_statuses: VALID_STATUSES,
          uploaded_by: uploadedBy,
          uploaded_at: new Date().toISOString(),
          total_csv_rows: nextPreview.totalCsvRows,
          order_count: nextPreview.orderCount,
          total_order_lines: nextPreview.totalOrderLines,
          included_lines: nextPreview.includedLines,
          excluded_lines: nextPreview.excludedLines,
          requested_qty: nextPreview.requestedQty,
          applied_qty: nextPreview.appliedQty,
          skipped_qty: nextPreview.skippedQty,
          duplicate_order_count: nextPreview.duplicateOrderCount,
          shortage_line_count: nextPreview.shortageLineCount,
          missing_sku_count: nextPreview.missingSkuCount,
          raw_retention_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          notes: notes.trim() || null,
        }])
        .select('*')

      if (insertBatchError) {
        throw insertBatchError
      }

      const createdBatch = batchRows?.[0]
      if (!createdBatch?.id) {
        throw new Error('Shelving upload batch was not created.')
      }

      const payload = nextPreview.lines.map((line) => ({
        batch_id: createdBatch.id,
        row_number: line.rowNumber,
        order_number: line.orderNumber || null,
        order_status: line.orderStatus || null,
        sku_id: line.skuId || null,
        product_name: line.productName || null,
        variation_raw: line.variationRaw || null,
        size: line.size || null,
        qty: line.qty,
        included: line.included,
        exclusion_reason: line.exclusionReason || null,
        available_qty_snapshot: line.availableQtySnapshot,
        applied_qty: line.appliedQty,
        skipped_qty: line.skippedQty,
      }))

      for (let index = 0; index < payload.length; index += LINE_INSERT_CHUNK_SIZE) {
        const chunk = payload.slice(index, index + LINE_INSERT_CHUNK_SIZE)
        const { error: insertLineError } = await supabase
          .from('upload_sales_import_lines')
          .insert(chunk)

        if (insertLineError) {
          throw insertLineError
        }
      }

      setFile(null)
      setNotes('')
      setSuccess(`${createdBatch.batch_number} uploaded as draft. Review the preview before posting.`)
      setSelectedBatchId(createdBatch.id)
      await loadBatches({ keepSelection: true })
      await loadLines(createdBatch.id)
    } catch (uploadError) {
      setError(isSchemaError(uploadError) ? getSchemaMissingMessage(uploadError) : uploadError.message || 'Failed to upload CSV.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePostBatch() {
    if (!canManage || !selectedBatch || posting) return

    setPosting(true)
    setError('')
    setSuccess('')

    try {
      const actor = await getCurrentUserEmail()
      const { data, error: postError } = await supabase.rpc('post_upload_sales_import_batch', {
        p_batch_id: selectedBatch.id,
        p_actor_email: actor,
      })

      if (postError) {
        throw postError
      }

      setSuccess(
        `${selectedBatch.batch_number} posted. Applied ${formatNumber(data?.applied_qty)} pcs, skipped ${formatNumber(data?.skipped_qty)} pcs.`
      )
      await loadBatches({ keepSelection: true })
      await loadLines(selectedBatch.id)
      if (typeof onInventoryChanged === 'function') {
        onInventoryChanged()
      }
    } catch (postError) {
      setError(postError.message || 'Failed to post shelving upload.')
    } finally {
      setPosting(false)
    }
  }

  async function handleRetryBatch(batch = selectedBatch) {
    if (!canManage || !batch?.id || batch.status !== 'posted' || Number(batch.skipped_qty || 0) <= 0 || retryingId) return

    setRetryingId(batch.id)
    setError('')
    setSuccess('')

    try {
      const actor = await getCurrentUserEmail()
      const { data, error: retryError } = await supabase.rpc('retry_upload_sales_import_batch', {
        p_batch_id: batch.id,
        p_actor_email: actor,
      })

      if (retryError) {
        throw retryError
      }

      setSuccess(
        `${batch.batch_number} retry completed. Total applied ${formatNumber(data?.applied_qty)} pcs, remaining skipped ${formatNumber(data?.skipped_qty)} pcs.`
      )
      await loadBatches({ keepSelection: true })
      await loadLines(batch.id)
      if (typeof onInventoryChanged === 'function') {
        onInventoryChanged()
      }
    } catch (retryError) {
      setError(retryError.message || 'Failed to retry skipped shelving upload quantities.')
    } finally {
      setRetryingId('')
    }
  }

  async function handleReverseBatch(batch) {
    if (!canManage || !batch?.id || reversingId) return

    setReversingId(batch.id)
    setError('')
    setSuccess('')

    try {
      const actor = await getCurrentUserEmail()
      const { data, error: reverseError } = await supabase.rpc('reverse_upload_sales_import_batch', {
        p_batch_id: batch.id,
        p_actor_email: actor,
      })

      if (reverseError) {
        throw reverseError
      }

      setSuccess(`${batch.batch_number} reversed. Restored ${formatNumber(data?.reversed_qty)} pcs.`)
      await loadBatches({ keepSelection: true })
      await loadLines(batch.id)
      if (typeof onInventoryChanged === 'function') {
        onInventoryChanged()
      }
    } catch (reverseError) {
      setError(reverseError.message || 'Failed to reverse shelving upload.')
    } finally {
      setReversingId('')
    }
  }

  async function handleDeleteBatch() {
    if (!canManage || !deleteCandidate?.id || deletingId) return

    setDeletingId(deleteCandidate.id)
    setError('')
    setSuccess('')

    try {
      const actor = await getCurrentUserEmail()
      const { data, error: deleteError } = await supabase.rpc('delete_upload_sales_import_batch', {
        p_batch_id: deleteCandidate.id,
        p_actor_email: actor,
      })

      if (deleteError) {
        throw deleteError
      }

      setSuccess(`${deleteCandidate.batch_number} deleted. ${formatNumber(data?.deleted_lines)} line(s) removed.`)
      setDeleteCandidate(null)
      if (String(selectedBatchId) === String(deleteCandidate.id)) {
        setSelectedBatchId('')
        setSelectedLines([])
      }
      await loadBatches({ keepSelection: true })
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete upload batch.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section style={styles.shell}>
      {showHeader ? (
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Daily shelving deduction</p>
            <h2 style={styles.title}>Shelving Upload</h2>
          </div>
          <button type="button" onClick={() => loadBatches({ keepSelection: true })} style={styles.secondaryButton}>
            Refresh
          </button>
        </div>
      ) : null}

      {error ? <div style={styles.error}>{error}</div> : null}
      {success ? <div style={styles.success}>{success}</div> : null}

      <div style={styles.grid}>
        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Upload CSV</h3>
              <p style={styles.panelHint}>Only SKU, variation, qty, order number, and status are stored temporarily.</p>
            </div>
          </div>

          <div style={styles.field}>
            <span style={styles.label}>Upload CSV</span>
            <div style={styles.filePickerRow}>
              <label
                style={{
                  ...styles.filePicker,
                  ...(file ? styles.filePickerSelected : {}),
                  ...(!canUpload || saving ? styles.filePickerDisabled : {}),
                }}
              >
                <span style={styles.filePickerName}>{file?.name || 'Choose CSV file'}</span>
                <input
                  key={file?.name || 'empty-file-input'}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  style={styles.hiddenFileInput}
                  disabled={!canUpload || saving}
                />
              </label>
              {file ? (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    setPreview(null)
                  }}
                  disabled={saving}
                  style={saving ? styles.smallButtonDisabled : styles.smallDeleteButton}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <label style={styles.field}>
            <span style={styles.label}>Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              style={styles.textarea}
              placeholder="Optional internal notes for this upload"
              disabled={!canUpload || saving}
            />
          </label>

          <button
            type="button"
            onClick={handleFilePreview}
            disabled={!canUpload || !file || saving}
            style={!canUpload || !file || saving ? styles.primaryButtonDisabled : styles.primaryButton}
          >
            {saving ? 'Uploading...' : 'Upload & Preview'}
          </button>

          {!canUpload ? (
            <p style={styles.mutedText}>You can view batches, but do not have permission to upload CSV files.</p>
          ) : null}
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>{selectedBatch?.batch_number || 'No batch selected'}</h3>
              <p style={styles.panelHint}>
                {selectedBatch ? `${selectedBatch.file_name || 'CSV file'} · ${formatDateTime(selectedBatch.uploaded_at)}` : 'Upload a CSV to create a draft batch.'}
              </p>
            </div>
            {selectedBatch ? <span style={getStatusStyle(selectedBatch.status)}>{selectedBatch.status}</span> : null}
          </div>

          <div style={styles.metricGrid}>
            <Metric label="Orders" value={selectedBatch ? selectedBatch.order_count : preview?.orderCount || 0} />
            <Metric label="Requested" value={selectedBatch ? selectedBatch.requested_qty : preview?.requestedQty || 0} />
            <Metric label="Applied" value={selectedBatch ? selectedBatch.applied_qty : preview?.appliedQty || 0} />
            <Metric label="Skipped" value={selectedBatch ? selectedBatch.skipped_qty : preview?.skippedQty || 0} tone="warning" />
            <Metric
              label="Issues"
              value={selectedBatch
                ? Number(selectedBatch.excluded_lines || 0)
                : (preview?.lines || []).filter((line) => !line.included).length}
              tone="danger"
            />
          </div>
          <p style={styles.metricLegend}>
            Orders = jumlah nomor pesanan unik. Requested = total kolom <strong>Jumlah</strong> pada baris yang valid. Applied = qty yang benar-benar dikurangi dari shelving/Temporary Sales. Skipped = qty yang belum bisa dipenuhi. Issues = jumlah baris yang formatnya tidak valid atau stoknya kurang.
          </p>

          <div style={styles.actionRow}>
            <button
              type="button"
              onClick={handlePostBatch}
              disabled={!canManage || !selectedBatch || selectedBatch.status !== 'draft' || posting}
              style={!canManage || !selectedBatch || selectedBatch.status !== 'draft' || posting ? styles.primaryButtonDisabled : styles.primaryButton}
            >
              {posting ? 'Posting...' : 'Post Deduction'}
            </button>
            <button
              type="button"
              onClick={() => handleRetryBatch(selectedBatch)}
              disabled={!canManage || !selectedBatch || selectedBatch.status !== 'posted' || Number(selectedBatch.skipped_qty || 0) <= 0 || Boolean(retryingId)}
              style={!canManage || !selectedBatch || selectedBatch.status !== 'posted' || Number(selectedBatch.skipped_qty || 0) <= 0 || Boolean(retryingId) ? styles.primaryButtonDisabled : styles.secondaryButton}
            >
              {retryingId === selectedBatch?.id ? 'Retrying...' : 'Retry Skipped'}
            </button>
            <span style={styles.mutedText}>Retry only reprocesses unapplied quantities. Applied rows are never deducted again.</span>
          </div>
        </article>
      </div>

      <article style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h3 style={styles.panelTitle}>Batch History</h3>
            <p style={styles.panelHint}>Recent upload batches and their stock impact.</p>
          </div>
        </div>

        {loading ? (
          <div style={styles.empty}>Loading shelving upload batches...</div>
        ) : !batches.length ? (
          <div style={styles.empty}>No shelving upload batch yet.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Batch</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Uploaded</th>
                  <th style={styles.th}>Orders</th>
                  <th style={styles.th}>Requested</th>
                  <th style={styles.th}>Applied</th>
                  <th style={styles.th}>Skipped</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const isSelected = String(batch.id) === String(selectedBatchId)
                  const canReverse = canManage && batch.status === 'posted'
                  const canDelete = canManage && batch.status === 'draft'

                  return (
                    <tr key={batch.id} style={isSelected ? styles.activeRow : undefined}>
                      <td style={styles.td}>
                        <button type="button" onClick={() => setSelectedBatchId(batch.id)} style={styles.linkButton}>
                          {batch.batch_number}
                        </button>
                        <small style={styles.tableHint}>{batch.file_name || '-'}</small>
                      </td>
                      <td style={styles.td}><span style={getStatusStyle(batch.status)}>{batch.status}</span></td>
                      <td style={styles.td}>{formatDateTime(batch.uploaded_at)}</td>
                      <td style={styles.numberTd}>{formatNumber(batch.order_count)}</td>
                      <td style={styles.numberTd}>{formatNumber(batch.requested_qty)}</td>
                      <td style={styles.numberTd}>{formatNumber(batch.applied_qty)}</td>
                      <td style={styles.numberTd}>{formatNumber(batch.skipped_qty)}</td>
                      <td style={styles.td}>
                        <div style={styles.tableActionGroup}>
                          <button
                            type="button"
                            onClick={() => downloadBatchCsv(batch)}
                            disabled={String(batch.id) !== String(selectedBatchId) || linesLoading || selectedLines.length === 0}
                            style={String(batch.id) === String(selectedBatchId) && !linesLoading && selectedLines.length > 0 ? styles.smallButton : styles.smallButtonDisabled}
                          >
                            Download CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReverseBatch(batch)}
                            disabled={!canReverse || Boolean(reversingId)}
                            style={canReverse && !reversingId ? styles.smallDangerButton : styles.smallButtonDisabled}
                          >
                            {reversingId === batch.id ? 'Reversing...' : 'Reverse'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRetryBatch(batch)}
                            disabled={!canManage || batch.status !== 'posted' || Number(batch.skipped_qty || 0) <= 0 || Boolean(retryingId)}
                            style={canManage && batch.status === 'posted' && Number(batch.skipped_qty || 0) > 0 && !retryingId ? styles.smallButton : styles.smallButtonDisabled}
                          >
                            {retryingId === batch.id ? 'Retrying...' : 'Retry'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteCandidate(batch)}
                            disabled={!canDelete || Boolean(deletingId)}
                            style={canDelete && !deletingId ? styles.smallDeleteButton : styles.smallButtonDisabled}
                          >
                            {deletingId === batch.id ? 'Deleting...' : 'Delete'}
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
      </article>

      {deleteCandidate ? (
        <div style={styles.confirmOverlay}>
          <div style={styles.confirmCard}>
            <div>
              <p style={styles.confirmEyebrow}>Delete draft upload</p>
              <h3 style={styles.confirmTitle}>{deleteCandidate.batch_number}</h3>
              <p style={styles.confirmText}>
                This will remove the draft batch and its temporary line detail. Stock will not change because this batch has not been posted.
              </p>
            </div>
            <div style={styles.confirmActions}>
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                style={styles.secondaryButton}
                disabled={Boolean(deletingId)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBatch}
                style={styles.smallDeleteButton}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? 'Deleting...' : 'Delete Draft'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <article style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h3 style={styles.panelTitle}>Preview & Issues</h3>
            <p style={styles.panelHint}>
            {issueLines.length
                ? `Menampilkan ${formatNumber(issueLines.length)} baris dengan format/data tidak valid. Qty yang tidak cukup tetap masuk ke Skipped.`
                : 'Tidak ada baris dengan format/data bermasalah. Menampilkan maksimal 80 baris preview yang valid.'}
            </p>
          </div>
        </div>

        {linesLoading ? (
          <div style={styles.empty}>Loading line detail...</div>
        ) : selectedBatch?.raw_purged_at ? (
          <div style={styles.empty}>Raw line detail was purged on {formatDateTime(selectedBatch.raw_purged_at)}. Movement audit remains available.</div>
        ) : !selectedLines.length ? (
          <div style={styles.empty}>No line detail is available for this batch.</div>
        ) : (
          <div style={styles.tableWrap}>
            <div style={styles.previewFilterFields}>
              <input
                value={lineSearch}
                onChange={(event) => setLineSearch(event.target.value)}
                style={styles.searchInput}
                placeholder="Search SKU, product, or order"
                aria-label="Search preview and issues"
              />
              <input
                value={lineSizeSearch}
                onChange={(event) => setLineSizeSearch(event.target.value)}
                style={styles.searchInput}
                placeholder="Filter size"
                aria-label="Filter size"
              />
            </div>
            <div style={styles.lineFilterToggle} role="group" aria-label="Filter preview and issues">
              {[
                ['ALL', 'All'],
                ['APPLIED', 'Applied'],
                ['SKIPPED', 'Skipped'],
                ['ISSUES', 'Issues'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLineFilter(value)}
                  style={{
                    ...styles.lineFilterButton,
                    ...(lineFilter === value ? styles.lineFilterButtonActive : {}),
                  }}
                  aria-pressed={lineFilter === value}
                >
                  {label}
                </button>
              ))}
            </div>
            <p style={styles.filteredQtyText}>Filtered qty: <strong>{formatNumber(filteredPreviewQty)}</strong></p>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Row</th>
                  <th style={styles.th}>Order</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>SKU</th>
                  <th style={styles.th}>Size</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Applied</th>
                  <th style={styles.th}>Skipped</th>
                  <th style={styles.th}>Issue</th>
                </tr>
              </thead>
              <tbody>
                {visiblePreviewLines.map((line) => (
                  <tr key={line.id}>
                    <td style={styles.td}>{line.row_number}</td>
                    <td style={styles.td}>{line.order_number || '-'}</td>
                    <td style={styles.td}>{line.order_status || '-'}</td>
                    <td style={styles.td}>{line.sku_id || '-'}</td>
                    <td style={styles.td}>{line.size || '-'}</td>
                    <td style={styles.quantityTd}>{formatNumber(line.qty)}</td>
                    <td style={styles.quantityTd}>{formatNumber(line.applied_qty)}</td>
                    <td style={styles.quantityTd}>{formatNumber(line.skipped_qty)}</td>
                    <td style={styles.td}>{line.exclusion_reason || (line.included ? '-' : 'Excluded')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visiblePreviewLines.length ? <p style={styles.mutedText}>No matching preview or issue rows.</p> : null}
            {!issueLines.length && selectedLines.length > 80 ? (
              <p style={styles.mutedText}>Showing first 80 clean rows. Issue rows are prioritized when available.</p>
            ) : null}
          </div>
        )}
      </article>
    </section>
  )
}

function Metric({ label, value, tone = 'default' }) {
  return (
    <div style={{ ...styles.metricCard, ...(tone === 'warning' ? styles.metricWarning : {}), ...(tone === 'danger' ? styles.metricDanger : {}) }}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{formatNumber(value)}</strong>
    </div>
  )
}

function getStatusStyle(status) {
  const normalized = normalizeStatus(status)
  if (normalized === 'posted') return { ...styles.statusBadge, ...styles.statusPosted }
  if (normalized === 'reversed') return { ...styles.statusBadge, ...styles.statusReversed }
  if (normalized === 'cancelled') return { ...styles.statusBadge, ...styles.statusCancelled }
  return { ...styles.statusBadge, ...styles.statusDraft }
}

const styles = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  eyebrow: {
    margin: '0 0 4px',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '900',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: '28px',
    lineHeight: 1,
    fontWeight: '800',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  panel: {
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    background: '#fff',
    padding: '16px',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.05)',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '14px',
  },
  panelTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '18px',
    fontWeight: '800',
  },
  panelHint: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.45,
  },
  searchInput: {
    width: '100%',
    minHeight: '40px',
    boxSizing: 'border-box',
    marginBottom: '12px',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '0 12px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '14px',
    outline: 'none',
  },
  previewFilterFields: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(140px, 220px)',
    gap: '8px',
  },
  filteredQtyText: {
    margin: '0 0 12px',
    color: '#475569',
    fontSize: '13px',
  },
  lineFilterToggle: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '12px',
  },
  lineFilterButton: {
    minHeight: '34px',
    border: '1px solid #dbe4ef',
    borderRadius: '9px',
    padding: '0 12px',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  lineFilterButtonActive: {
    border: '1px solid #172033',
    background: '#172033',
    color: '#fff',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  label: {
    color: '#334155',
    fontSize: '13px',
    fontWeight: '800',
  },
  fileInput: {
    minHeight: '44px',
    border: '1px solid #dbe4ef',
    borderRadius: '12px',
    padding: '9px 10px',
    background: '#f8fafc',
    color: '#0f172a',
    fontSize: '13px',
  },
  filePicker: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    minHeight: '44px',
    border: '1px solid #dbe4ef',
    borderRadius: '12px',
    padding: '0 12px',
    background: '#fff',
    color: '#64748b',
    fontSize: '13px',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  filePickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  filePickerSelected: {
    background: '#f1f5f9',
    color: '#334155',
  },
  filePickerDisabled: {
    cursor: 'not-allowed',
    opacity: 0.72,
  },
  filePickerName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  hiddenFileInput: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  textarea: {
    minHeight: '84px',
    border: '1px solid #dbe4ef',
    borderRadius: '12px',
    padding: '12px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '13px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  primaryButton: {
    minHeight: '44px',
    border: '1px solid #111827',
    borderRadius: '12px',
    padding: '0 16px',
    background: '#111827',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  primaryButtonDisabled: {
    minHeight: '44px',
    border: '1px solid #dbe4ef',
    borderRadius: '12px',
    padding: '0 16px',
    background: '#f8fafc',
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: '900',
    cursor: 'not-allowed',
  },
  secondaryButton: {
    minHeight: '40px',
    border: '1px solid #dbe4ef',
    borderRadius: '12px',
    padding: '0 14px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  smallDangerButton: {
    minHeight: '32px',
    border: '1px solid #991b1b',
    borderRadius: '10px',
    padding: '0 10px',
    background: '#991b1b',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  smallDeleteButton: {
    minHeight: '32px',
    border: '1px solid #b91c1c',
    borderRadius: '10px',
    padding: '0 10px',
    background: '#fee2e2',
    color: '#991b1b',
    fontSize: '12px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  smallButton: {
    minHeight: '32px',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '0 10px',
    background: '#fff',
    color: '#1e293b',
    fontSize: '12px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  smallButtonDisabled: {
    minHeight: '32px',
    border: '1px solid #dbe4ef',
    borderRadius: '10px',
    padding: '0 10px',
    background: '#f8fafc',
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: '900',
    cursor: 'not-allowed',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '8px',
    marginBottom: '14px',
  },
  metricCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '10px',
    background: '#f8fafc',
  },
  metricWarning: {
    background: '#fff7ed',
    borderColor: '#fed7aa',
  },
  metricDanger: {
    background: '#fef2f2',
    borderColor: '#fecaca',
  },
  metricLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  metricValue: {
    display: 'block',
    marginTop: '4px',
    color: '#0f172a',
    fontSize: '22px',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  metricLegend: {
    margin: '-2px 0 14px',
    color: '#64748b',
    fontSize: '12px',
    lineHeight: 1.55,
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  mutedText: {
    margin: '10px 0 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.45,
  },
  error: {
    border: '1px solid #fecaca',
    borderRadius: '14px',
    padding: '12px 14px',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: '13px',
    fontWeight: '800',
  },
  success: {
    border: '1px solid #bbf7d0',
    borderRadius: '14px',
    padding: '12px 14px',
    background: '#f0fdf4',
    color: '#166534',
    fontSize: '13px',
    fontWeight: '800',
  },
  tableWrap: {
    width: '100%',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '900px',
  },
  th: {
    padding: '10px 8px',
    borderBottom: '1px solid #e2e8f0',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: '900',
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid #eef2f7',
    color: '#0f172a',
    fontSize: '13px',
    verticalAlign: 'top',
  },
  numberTd: {
    padding: '10px 8px',
    borderBottom: '1px solid #eef2f7',
    color: '#0f172a',
    fontSize: '13px',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'top',
  },
  quantityTd: {
    padding: '10px 8px',
    borderBottom: '1px solid #eef2f7',
    color: '#0f172a',
    fontSize: '13px',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'middle',
  },
  activeRow: {
    background: '#f8fafc',
  },
  linkButton: {
    display: 'block',
    border: 'none',
    background: 'transparent',
    padding: 0,
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '900',
    cursor: 'pointer',
    textAlign: 'left',
  },
  tableHint: {
    display: 'block',
    marginTop: '3px',
    color: '#64748b',
    fontSize: '11px',
  },
  tableActionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  empty: {
    border: '1px dashed #cbd5e1',
    borderRadius: '14px',
    padding: '18px',
    color: '#64748b',
    background: '#f8fafc',
    fontSize: '13px',
    textAlign: 'center',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '24px',
    padding: '0 9px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statusDraft: {
    background: '#eff6ff',
    color: '#1d4ed8',
  },
  statusPosted: {
    background: '#dcfce7',
    color: '#166534',
  },
  statusReversed: {
    background: '#f1f5f9',
    color: '#475569',
  },
  statusCancelled: {
    background: '#fee2e2',
    color: '#991b1b',
  },
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'rgba(15, 23, 42, 0.36)',
  },
  confirmCard: {
    width: 'min(100%, 420px)',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    background: '#fff',
    padding: '18px',
    boxShadow: '0 22px 48px rgba(15, 23, 42, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  confirmEyebrow: {
    margin: '0 0 6px',
    color: '#991b1b',
    fontSize: '11px',
    fontWeight: '900',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  confirmTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '18px',
    fontWeight: '900',
  },
  confirmText: {
    margin: '8px 0 0',
    color: '#475569',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
}
