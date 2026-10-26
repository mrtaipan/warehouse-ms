'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import { canRegisterUntrackedShelving, getEligibleRejectSources, getJakartaDayRange, requiresRejectSourceChoice, resolveRejectSource } from '@/utils/arkline-reject-registration.mjs'
import styles from './retur-report.module.css'

function todayValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`))
}

function formatStatus(value) {
  return String(value || 'SENT').replaceAll('_', ' ')
}

function formatStorageSourceType(value, inventorySource, stockAppliedAt) {
  const normalized = String(value || 'QC_REJECT').toUpperCase()
  if (normalized === 'DELIVERY_REJECT') return 'Delivery Reject'
  if (normalized === 'PACKING_REJECT') {
    if (inventorySource === 'SHELVING' && !stockAppliedAt) return 'Shelving Reject (Unregistered)'
    if (inventorySource === 'SHELVING') return 'Shelving Reject'
    if (inventorySource === 'PALLET_RESTOCK') return 'Pallet Restock Reject'
    return 'Packing Reject'
  }
  return 'QC Reject'
}

function getRegistrationProductLabel(product) {
  const productName = String(product?.productName || '').trim()
  const skuInduk = String(product?.skuInduk || '').trim()
  return productName && skuInduk ? `${productName} - ${skuInduk}` : productName
}

function getRegistrationReasonLabel(reason) {
  return String(reason?.name || '').trim()
}

const REGISTRATION_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const STORAGE_SIZE_ORDER = new Map(REGISTRATION_SIZE_OPTIONS.map((size, index) => [size, index]))

function compareStorageSizes(left, right) {
  const leftSize = normalizeSize(left)
  const rightSize = normalizeSize(right)
  const leftRank = STORAGE_SIZE_ORDER.get(leftSize)
  const rightRank = STORAGE_SIZE_ORDER.get(rightSize)
  if (leftRank !== undefined || rightRank !== undefined) {
    return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER)
  }
  return leftSize.localeCompare(rightSize, undefined, { numeric: true })
}

function getStatusBadgeClass(status) {
  const normalized = String(status || 'SENT').toUpperCase()
  if (normalized === 'FULLY_RETURNED') return styles.badgeCompleted
  if (normalized === 'PARTIALLY_RETURNED') return styles.badgeWarning
  if (normalized === 'CLOSED_SHORT') return styles.badgeDanger
  return ''
}

function getArrangementCycleType(row) {
  const normalized = String(row?.qcType || 'INITIAL').trim().toUpperCase().replaceAll('-', '_').replaceAll(' ', '_')
  return normalized || 'INITIAL'
}

function getArrangementCycleKey(row) {
  return `${getArrangementCycleType(row)}:${Number(row?.qcRoundNumber || 1)}`
}

function getArrangementCycleLabel(row) {
  const roundNumber = Number(row?.qcRoundNumber || 1)
  const cycleType = getArrangementCycleType(row)
  if (cycleType === 'INITIAL') return `Round ${roundNumber}`
  return `${cycleType.replaceAll('_', '-')} ${roundNumber}`
}

function normalizeSize(value) {
  const size = String(value || '').trim().toUpperCase()
  return size || 'NO SIZE'
}

function getStorageCategory(product, lookup) {
  return lookup.bySku.get(String(product.skuInduk || '').trim().toUpperCase()) ||
    lookup.byName.get(String(product.productName || '').trim().toUpperCase()) || ''
}

function getReceiptSizeKey(size) {
  return `size:${normalizeSize(size)}`
}

function normalizeSizeCorrection(row) {
  return {
    id: row.id,
    returnBatchId: row.return_batch_id || row.returnBatchId,
    fromLineId: row.from_return_batch_line_id || row.fromLineId,
    fromSize: normalizeSize(row.from_size || row.fromSize),
    toSize: normalizeSize(row.to_size || row.toSize),
    qty: Number(row.qty || 0),
    notes: row.notes || '',
    createdBy: row.created_by || row.createdBy || '',
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  }
}

function buildCorrectedReceiptSegments(batch) {
  if (!batch) return []

  return (batch.lines || []).flatMap((line) => {
    const originalSize = normalizeSize(line.size)
    const corrections = (line.corrections || []).map(normalizeSizeCorrection)
    const correctionOutQty = corrections.reduce((sum, correction) => sum + Number(correction.qty || 0), 0)
    const originalQty = Math.max(0, Number(line.qty || 0) - correctionOutQty)
    const segments = []

    if (originalQty > 0 || Number(line.receivedQtyBySize?.[originalSize] || 0) > 0) {
      segments.push({
        ...line,
        size: originalSize,
        qty: originalQty,
        receivedQty: Number(line.receivedQtyBySize?.[originalSize] || 0),
        correctionInQty: 0,
        correctionOutQty,
        isCorrected: false,
      })
    }

    const correctionsBySize = corrections.reduce((groups, correction) => {
      const correctedSize = normalizeSize(correction.toSize)
      const current = groups.get(correctedSize) || { size: correctedSize, qty: 0, corrections: [] }
      current.qty += Number(correction.qty || 0)
      current.corrections.push(correction)
      groups.set(correctedSize, current)
      return groups
    }, new Map())

    correctionsBySize.forEach((correctionGroup) => {
      const correctedSize = normalizeSize(correctionGroup.size)
      segments.push({
        ...line,
        size: correctedSize,
        qty: Number(correctionGroup.qty || 0),
        receivedQty: Number(line.receivedQtyBySize?.[correctedSize] || 0),
        correctionInQty: Number(correctionGroup.qty || 0),
        correctionOutQty: 0,
        corrections: correctionGroup.corrections,
        isCorrected: true,
      })
    })

    return segments
  })
}

function buildReceiptSummary(batch) {
  if (!batch) return { total: 0, sizes: [], sizeRows: [] }

  const sizeMap = new Map()
  buildCorrectedReceiptSegments(batch).forEach((line) => {
    const size = normalizeSize(line.size)
    const current = sizeMap.get(size) || {
      size,
      sentQty: 0,
      receivedQty: 0,
      remainingQty: 0,
      correctionInQty: 0,
      correctionOutQty: 0,
      lines: [],
    }
    const sentQty = Number(line.qty || 0)
    const receivedQty = Number(line.receivedQty || 0)
    const remainingQty = Math.max(0, sentQty - receivedQty)
    current.sentQty += sentQty
    current.receivedQty += receivedQty
    current.remainingQty += remainingQty
    current.correctionInQty += Number(line.correctionInQty || 0)
    current.correctionOutQty += Number(line.correctionOutQty || 0)
    current.lines.push({ ...line, remainingQty })
    sizeMap.set(size, current)
  })

  const sizeRows = Array.from(sizeMap.values()).sort((a, b) => String(a.size).localeCompare(String(b.size), undefined, { numeric: true }))
  const total = sizeRows.reduce((sum, row) => sum + Number(row.remainingQty || 0), 0)
  const sizes = sizeRows.map((row) => ({ size: row.size, qty: row.remainingQty }))

  return { total, sizes, sizeRows }
}

function getCorrectableSizeLines(batch) {
  if (!batch) return []

  const sizeMap = new Map()
  ;(batch.lines || []).forEach((line) => {
    const originalSize = normalizeSize(line.size)
    const correctionOutQty = (line.corrections || []).reduce((sum, correction) => sum + Number(correction.qty || 0), 0)
    const receivedOriginalQty = Number(line.receivedQtyBySize?.[originalSize] || 0)
    const correctableQty = Math.max(0, Number(line.qty || 0) - correctionOutQty - receivedOriginalQty)
    if (correctableQty <= 0) return

    const current = sizeMap.get(originalSize) || { id: originalSize, size: originalSize, correctableQty: 0, lines: [] }
    current.correctableQty += correctableQty
    current.lines.push({ ...line, size: originalSize, correctableQty })
    sizeMap.set(originalSize, current)
  })

  return Array.from(sizeMap.values()).sort((a, b) => String(a.size).localeCompare(String(b.size), undefined, { numeric: true }))
}

function getStorageGroupKey(storage) {
  const storageNumber = String(storage.storageNumber || '').trim()
  return storageNumber ? `storage:${storageNumber.toUpperCase()}` : `batch:${storage.id}`
}

function buildStorageSearchText(parts = []) {
  return parts
    .map((part) => String(part || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
}

function matchesStorageSearch(searchText, query) {
  const tokens = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (!tokens.length) return true
  return tokens.every((token) => String(searchText || '').includes(token))
}

function getStorageProductKey(line) {
  return [
    String(line.skuInduk || '').trim().toUpperCase(),
    String(line.modelName || 'No product').trim().toUpperCase(),
  ].join('|||')
}

function getStorageSizeKey(line) {
  return String(line.size || 'No size').trim().toUpperCase()
}

function getStorageRejectLineKey(line) {
  return [
    String(line.sourceType || 'QC_REJECT').trim().toUpperCase(),
    String(line.grade || '').trim().toUpperCase(),
    String(line.reasonId || line.reasonName || '').trim().toUpperCase(),
  ].join('|||')
}

function buildStorageProductGroups(lines = []) {
  const productMap = new Map()

  lines.forEach((line) => {
    const productKey = getStorageProductKey(line)
    const currentProduct = productMap.get(productKey) || {
      key: `product:${productKey}`,
      productName: line.modelName || 'No product',
      skuInduk: line.skuInduk || '',
      qty: 0,
      sizeGroups: new Map(),
      searchTextParts: [],
    }
    const qty = Number(line.qty || 0)
    const sizeKey = getStorageSizeKey(line)
    const currentSize = currentProduct.sizeGroups.get(sizeKey) || {
      key: `size:${productKey}:${sizeKey}`,
      size: line.size || 'No size',
      qty: 0,
      details: new Map(),
      searchTextParts: [],
    }
    const detailKey = getStorageRejectLineKey(line)
    const currentDetail = currentSize.details.get(detailKey) || {
      ...line,
      rowKey: detailKey,
      qty: 0,
      poIds: new Set(),
      sourceLineCount: 0,
      searchTextParts: [],
    }

    currentDetail.qty += qty
    currentDetail.sourceLineCount += 1
    if (line.poId) currentDetail.poIds.add(line.poId)
    currentDetail.searchTextParts.push(line.searchText)
    currentSize.qty += qty
    currentSize.searchTextParts.push(line.searchText)
    currentProduct.qty += qty
    currentProduct.searchTextParts.push(line.searchText)
    currentSize.details.set(detailKey, currentDetail)
    currentProduct.sizeGroups.set(sizeKey, currentSize)
    productMap.set(productKey, currentProduct)
  })

  return Array.from(productMap.values())
    .map((product) => {
      const sizeGroups = Array.from(product.sizeGroups.values())
        .map((sizeGroup) => {
          const details = Array.from(sizeGroup.details.values())
            .map((detail) => {
              const poIds = Array.from(detail.poIds).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
              return {
                ...detail,
                poIds,
                poLabel: poIds.length ? poIds.join(', ') : '-',
                searchText: buildStorageSearchText([
                  ...poIds,
                  detail.grade,
                  detail.reasonName,
                  detail.sourceType,
                  detail.qty,
                  ...detail.searchTextParts,
                ]),
              }
            })
            .sort((a, b) => {
              const reasonCompare = String(a.reasonName || '').localeCompare(String(b.reasonName || ''), undefined, { numeric: true })
              if (reasonCompare) return reasonCompare
              return String(a.grade || '').localeCompare(String(b.grade || ''), undefined, { numeric: true })
            })

          return {
            ...sizeGroup,
            details,
            searchText: buildStorageSearchText([sizeGroup.size, sizeGroup.qty, ...details.map((detail) => detail.searchText), ...sizeGroup.searchTextParts]),
          }
        })
        .sort((a, b) => compareStorageSizes(a.size, b.size))

      const detailLines = sizeGroups.flatMap((sizeGroup) => sizeGroup.details)

      return {
        ...product,
        sizeGroups,
        lines: detailLines,
        searchText: buildStorageSearchText([
          product.skuInduk,
          product.productName,
          product.qty,
          ...sizeGroups.map((sizeGroup) => sizeGroup.searchText),
          ...product.searchTextParts,
        ]),
      }
    })
    .sort((a, b) => String(a.productName || '').localeCompare(String(b.productName || ''), undefined, { numeric: true }))
}
export default function ArklineReturReportClient({ eligibleRows, batches, storages = [], registrationProducts = [], rejectReasons = [], userEmail, canAdd = false, canEdit = false, storageOnly = false, onStorageChanged }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [selectedIds, setSelectedIds] = useState([])
  const [activeReturnTab, setActiveReturnTab] = useState(storageOnly ? 'storage' : 'arrangement')
  const [repairabilityFilter, setRepairabilityFilter] = useState('all')
  const [rejectReasonFilter, setRejectReasonFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [qcCycleFilter, setQcCycleFilter] = useState('')
  const [poFilter, setPoFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [progressPoFilter, setProgressPoFilter] = useState('')
  const [progressSupplierFilter, setProgressSupplierFilter] = useState('')
  const [progressProductFilter, setProgressProductFilter] = useState('')
  const [progressRejectReasonFilter, setProgressRejectReasonFilter] = useState('')
  const [progressStatusFilter, setProgressStatusFilter] = useState('')
  const [storageViewMode, setStorageViewMode] = useState('koli')
  const [storageMatrixSort, setStorageMatrixSort] = useState({ key: 'name', direction: 'asc' })
  const [storageCategoryFilter, setStorageCategoryFilter] = useState('')
  const [storageSearch, setStorageSearch] = useState('')
  const [storageSizeFilter, setStorageSizeFilter] = useState('')
  const [storageSourceFilter, setStorageSourceFilter] = useState('')
  const [collapsedStorageKeys, setCollapsedStorageKeys] = useState([])
  const [collapsedStorageProductKeys, setCollapsedStorageProductKeys] = useState([])
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [storageModalOpen, setStorageModalOpen] = useState(false)
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false)
  const [receiptBatch, setReceiptBatch] = useState(null)
  const [returnDate, setReturnDate] = useState(todayValue())
  const [shippingMethod, setShippingMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [storageDate, setStorageDate] = useState(todayValue())
  const [storageNumber, setStorageNumber] = useState('')
  const [storageNotes, setStorageNotes] = useState('')
  const [registrationDraft, setRegistrationDraft] = useState({
    storageNumber: '',
    storageDate: todayValue(),
    productId: '',
    productSearch: '',
    size: '',
    rejectReasonId: '',
    rejectReasonSearch: '',
    grade: 'C',
    qty: '',
    inventorySource: '',
    sourceId: '',
    notes: '',
  })
  const [registrationSourceOptions, setRegistrationSourceOptions] = useState([])
  const [registrationSourcesLoading, setRegistrationSourcesLoading] = useState(false)
  const [registrationSourcesError, setRegistrationSourcesError] = useState('')
  const [registrationProductOpen, setRegistrationProductOpen] = useState(false)
  const [registrationProductCursor, setRegistrationProductCursor] = useState(-1)
  const [returnQtyById, setReturnQtyById] = useState({})
  const [receiptDate, setReceiptDate] = useState(todayValue())
  const [receiptNotes, setReceiptNotes] = useState('')
  const [receiptQtyById, setReceiptQtyById] = useState({})
  const [sizeCorrectionOpen, setSizeCorrectionOpen] = useState(false)
  const [sizeCorrectionDraft, setSizeCorrectionDraft] = useState({ fromLineId: '', toSize: '', qty: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedRows = useMemo(
    () => eligibleRows.filter((row) => selectedIds.includes(row.id)),
    [eligibleRows, selectedIds]
  )
  const matchesArrangementFilters = useCallback((row, ignoredFilter = '') => {
    const matchesRepairability =
      ignoredFilter === 'repairability' ||
      repairabilityFilter === 'all' ||
      (repairabilityFilter === 'repairable' ? row.isRepairable : !row.isRepairable)
    const rowReasonKey = String(row.reasonId || row.reasonName || '').trim()
    const matchesRejectReason = ignoredFilter === 'rejectReason' || !rejectReasonFilter || rowReasonKey === rejectReasonFilter
    const matchesSize = ignoredFilter === 'size' || !sizeFilter || String(row.size || '') === sizeFilter
    const matchesGrade = ignoredFilter === 'grade' || !gradeFilter || String(row.grade || '') === gradeFilter
    const matchesQcCycle = ignoredFilter === 'qcCycle' || !qcCycleFilter || getArrangementCycleKey(row) === qcCycleFilter
    const matchesPo = ignoredFilter === 'po' || !poFilter || (row.poId || '__NO_PO__') === poFilter
    const matchesProduct = ignoredFilter === 'product' || !productFilter || row.modelName === productFilter

    return matchesRepairability && matchesRejectReason && matchesSize && matchesGrade && matchesQcCycle && matchesPo && matchesProduct
  }, [gradeFilter, poFilter, productFilter, qcCycleFilter, rejectReasonFilter, repairabilityFilter, sizeFilter])

  const poOptions = useMemo(
    () =>
      Array.from(new Set(eligibleRows.filter((row) => matchesArrangementFilters(row, 'po')).map((row) => row.poId || '__NO_PO__'))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    [eligibleRows, matchesArrangementFilters]
  )
  const productOptions = useMemo(
    () =>
      Array.from(new Set(eligibleRows.filter((row) => matchesArrangementFilters(row, 'product')).map((row) => row.modelName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [eligibleRows, matchesArrangementFilters]
  )
  const sizeOptions = useMemo(
    () =>
      Array.from(new Set(eligibleRows.filter((row) => matchesArrangementFilters(row, 'size')).map((row) => row.size).filter(Boolean))).sort((a, b) =>
        String(a).localeCompare(String(b), undefined, { numeric: true })
      ),
    [eligibleRows, matchesArrangementFilters]
  )
  const gradeOptions = useMemo(
    () =>
      Array.from(new Set(eligibleRows.filter((row) => matchesArrangementFilters(row, 'grade')).map((row) => row.grade).filter(Boolean))).sort((a, b) =>
        String(a).localeCompare(String(b))
      ),
    [eligibleRows, matchesArrangementFilters]
  )
  const qcCycleOptions = useMemo(() => {
    const grouped = new Map()
    eligibleRows.filter((row) => matchesArrangementFilters(row, 'qcCycle')).forEach((row) => {
      const cycleKey = getArrangementCycleKey(row)
      grouped.set(cycleKey, {
        id: cycleKey,
        label: getArrangementCycleLabel(row),
        roundNumber: Number(row.qcRoundNumber || 1),
        cycleType: getArrangementCycleType(row),
      })
    })

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber
      return a.cycleType.localeCompare(b.cycleType, undefined, { numeric: true })
    })
  }, [eligibleRows, matchesArrangementFilters])
  const rejectReasonOptions = useMemo(() => {
    const grouped = new Map()
    eligibleRows.filter((row) => matchesArrangementFilters(row, 'rejectReason')).forEach((row) => {
      const reasonKey = String(row.reasonId || row.reasonName || '').trim()
      if (!reasonKey) return
      grouped.set(reasonKey, row.reasonName || reasonKey)
    })

    return Array.from(grouped.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  }, [eligibleRows, matchesArrangementFilters])
  const progressPoOptions = useMemo(
    () =>
      Array.from(new Set(
        batches
          .filter((batch) => {
            const matchesSupplier = !progressSupplierFilter || batch.supplierName === progressSupplierFilter
            const matchesProduct = !progressProductFilter || batch.modelName === progressProductFilter
            const matchesRejectReason =
              !progressRejectReasonFilter ||
              batch.lines.some((line) => String(line.reasonId || line.reasonName || '').trim() === progressRejectReasonFilter)
            const matchesStatus = !progressStatusFilter || String(batch.status || 'SENT') === progressStatusFilter
            return matchesSupplier && matchesProduct && matchesRejectReason && matchesStatus
          })
          .map((batch) => batch.poId)
          .filter(Boolean)
      )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [batches, progressSupplierFilter, progressProductFilter, progressRejectReasonFilter, progressStatusFilter]
  )
  const progressSupplierOptions = useMemo(
    () =>
      Array.from(new Set(
        batches
          .filter((batch) => {
            const matchesPo = !progressPoFilter || batch.poId === progressPoFilter
            const matchesProduct = !progressProductFilter || batch.modelName === progressProductFilter
            const matchesRejectReason =
              !progressRejectReasonFilter ||
              batch.lines.some((line) => String(line.reasonId || line.reasonName || '').trim() === progressRejectReasonFilter)
            const matchesStatus = !progressStatusFilter || String(batch.status || 'SENT') === progressStatusFilter
            return matchesPo && matchesProduct && matchesRejectReason && matchesStatus
          })
          .map((batch) => batch.supplierName)
          .filter(Boolean)
      )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [batches, progressPoFilter, progressProductFilter, progressRejectReasonFilter, progressStatusFilter]
  )
  const progressProductOptions = useMemo(() => {
    const source = batches.filter((batch) => {
      const matchesPo = !progressPoFilter || batch.poId === progressPoFilter
      const matchesSupplier = !progressSupplierFilter || batch.supplierName === progressSupplierFilter
      const matchesRejectReason =
        !progressRejectReasonFilter ||
        batch.lines.some((line) => String(line.reasonId || line.reasonName || '').trim() === progressRejectReasonFilter)
      const matchesStatus = !progressStatusFilter || String(batch.status || 'SENT') === progressStatusFilter
      return matchesPo && matchesSupplier && matchesRejectReason && matchesStatus
    })
    return Array.from(new Set(source.map((batch) => batch.modelName).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [batches, progressPoFilter, progressSupplierFilter, progressRejectReasonFilter, progressStatusFilter])
  const progressRejectReasonOptions = useMemo(() => {
    const source = batches.filter((batch) => {
      const matchesPo = !progressPoFilter || batch.poId === progressPoFilter
      const matchesSupplier = !progressSupplierFilter || batch.supplierName === progressSupplierFilter
      const matchesProduct = !progressProductFilter || batch.modelName === progressProductFilter
      const matchesStatus = !progressStatusFilter || String(batch.status || 'SENT') === progressStatusFilter
      return matchesPo && matchesSupplier && matchesProduct && matchesStatus
    })
    const grouped = new Map()

    source.forEach((batch) => {
      batch.lines.forEach((line) => {
        const reasonKey = String(line.reasonId || line.reasonName || '').trim()
        if (!reasonKey) return
        grouped.set(reasonKey, line.reasonName || reasonKey)
      })
    })

    return Array.from(grouped.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  }, [batches, progressPoFilter, progressSupplierFilter, progressProductFilter, progressStatusFilter])
  const progressStatusOptions = useMemo(() => {
    const source = batches.filter((batch) => {
      const matchesPo = !progressPoFilter || batch.poId === progressPoFilter
      const matchesSupplier = !progressSupplierFilter || batch.supplierName === progressSupplierFilter
      const matchesProduct = !progressProductFilter || batch.modelName === progressProductFilter
      const matchesRejectReason =
        !progressRejectReasonFilter ||
        batch.lines.some((line) => String(line.reasonId || line.reasonName || '').trim() === progressRejectReasonFilter)
      return matchesPo && matchesSupplier && matchesProduct && matchesRejectReason
    })
    return Array.from(new Set(source.map((batch) => String(batch.status || 'SENT')).filter(Boolean))).sort((a, b) =>
      formatStatus(a).localeCompare(formatStatus(b), undefined, { numeric: true })
    )
  }, [batches, progressPoFilter, progressSupplierFilter, progressProductFilter, progressRejectReasonFilter])
  const filteredEligibleRows = useMemo(
    () =>
      eligibleRows
        .filter((row) => matchesArrangementFilters(row))
        .sort((a, b) => {
          const reasonCompare = String(a.reasonName || '').localeCompare(String(b.reasonName || ''), undefined, { numeric: true })
          if (reasonCompare) return reasonCompare
          const poCompare = String(a.poId || '').localeCompare(String(b.poId || ''), undefined, { numeric: true })
          if (poCompare) return poCompare
          const productCompare = String(a.modelName || '').localeCompare(String(b.modelName || ''), undefined, { numeric: true })
          if (productCompare) return productCompare
          return String(a.size || '').localeCompare(String(b.size || ''), undefined, { numeric: true })
        }),
    [eligibleRows, matchesArrangementFilters]
  )
  const filteredBatches = useMemo(
    () =>
      batches.filter((batch) => {
        const matchesPo = !progressPoFilter || batch.poId === progressPoFilter
        const matchesSupplier = !progressSupplierFilter || batch.supplierName === progressSupplierFilter
        const matchesProduct = !progressProductFilter || batch.modelName === progressProductFilter
        const matchesRejectReason =
          !progressRejectReasonFilter ||
          batch.lines.some((line) => String(line.reasonId || line.reasonName || '').trim() === progressRejectReasonFilter)
        const matchesStatus = !progressStatusFilter || String(batch.status || 'SENT') === progressStatusFilter
        return matchesPo && matchesSupplier && matchesProduct && matchesRejectReason && matchesStatus
      }),
    [batches, progressPoFilter, progressSupplierFilter, progressProductFilter, progressRejectReasonFilter, progressStatusFilter]
  )
  const groupedStorages = useMemo(() => {
    const grouped = new Map()

    storages.forEach((storage) => {
      const key = getStorageGroupKey(storage)
      const current = grouped.get(key) || {
        key,
        storageNumber: storage.storageNumber || 'No storage number',
        storedQty: 0,
        poIds: new Set(),
        products: new Set(),
        suppliers: new Set(),
        dates: new Set(),
        statuses: new Set(),
        notes: [],
        lines: [],
      }

      current.storedQty += Number(storage.storedQty || 0)
      if (storage.poId) current.poIds.add(storage.poId)
      if (storage.modelName) current.products.add(storage.modelName)
      if (storage.supplierName) current.suppliers.add(storage.supplierName)
      if (storage.updatedAt || storage.storageDate) current.dates.add(String(storage.updatedAt || storage.storageDate).slice(0, 10))
      if (storage.status) current.statuses.add(storage.status)
      if (storage.notes && !current.notes.includes(storage.notes)) current.notes.push(storage.notes)

      ;(storage.lines || []).forEach((line) => {
        const enrichedLine = {
          ...line,
          rowKey: `${storage.id}-${line.id}`,
          poId: storage.poId,
          skuInduk: storage.skuInduk,
          modelName: storage.modelName,
          supplierName: storage.supplierName,
          storageDate: storage.storageDate,
          updatedAt: storage.updatedAt,
          storageNumber: storage.storageNumber,
          sourceType: storage.sourceType || line.sourceType || 'QC_REJECT',
          inventorySource: storage.inventorySource || null,
          stockAppliedAt: storage.stockAppliedAt || null,
        }
        current.lines.push({
          ...enrichedLine,
          searchText: buildStorageSearchText([
            storage.storageNumber,
            storage.poId,
            storage.skuInduk,
            storage.modelName,
            storage.supplierName,
            storage.sourceType,
            storage.updatedAt,
            line.sourceType,
            line.reasonName,
            line.grade,
            line.size,
            line.qty,
          ]),
        })
      })

      grouped.set(key, current)
    })

    return Array.from(grouped.values())
      .map((group) => {
        const dates = Array.from(group.dates).sort()
        const poIds = Array.from(group.poIds).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
        const products = Array.from(group.products).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
        const suppliers = Array.from(group.suppliers).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
        const statuses = Array.from(group.statuses)
        const status = statuses.length === 1 ? statuses[0] : statuses.length > 1 ? 'MIXED' : 'STORED'
        const searchText = buildStorageSearchText([
          group.storageNumber,
          group.storedQty,
          ...dates,
          ...poIds,
          ...products,
          ...suppliers,
          ...statuses,
          ...Array.from(new Set(group.lines.map((line) => line.sourceType).filter(Boolean))),
          ...group.notes,
          ...group.lines.map((line) => line.searchText),
        ])

        return {
          ...group,
          dates,
          poIds,
          products,
          suppliers,
          status,
          searchText,
          lines: group.lines.sort((a, b) => {
            const productCompare = String(a.modelName || '').localeCompare(String(b.modelName || ''), undefined, { numeric: true })
            if (productCompare) return productCompare
            const reasonCompare = String(a.reasonName || '').localeCompare(String(b.reasonName || ''), undefined, { numeric: true })
            if (reasonCompare) return reasonCompare
            return String(a.size || '').localeCompare(String(b.size || ''), undefined, { numeric: true })
          }),
        }
      })
      .map((group) => ({
        ...group,
        productGroups: buildStorageProductGroups(group.lines),
      }))
      .sort((a, b) => {
        const dateCompare = String(b.dates[b.dates.length - 1] || '').localeCompare(String(a.dates[a.dates.length - 1] || ''))
        if (dateCompare) return dateCompare
        return String(a.storageNumber || '').localeCompare(String(b.storageNumber || ''), undefined, { numeric: true })
      })
  }, [storages])
  const storageSizeOptions = useMemo(
    () =>
      Array.from(new Set(groupedStorages.flatMap((group) => group.lines.map((line) => line.size).filter(Boolean))))
        .sort(compareStorageSizes),
    [groupedStorages]
  )
  const storageCategoryLookup = useMemo(() => {
    const bySku = new Map()
    const byName = new Map()
    registrationProducts.forEach((product) => {
      const category = String(product.categoryName || '').trim()
      if (!category) return
      if (product.skuInduk) bySku.set(String(product.skuInduk).trim().toUpperCase(), category)
      if (product.productName) byName.set(String(product.productName).trim().toUpperCase(), category)
    })
    return { bySku, byName }
  }, [registrationProducts])
  const storageCategoryOptions = useMemo(() => {
    const categories = groupedStorages.flatMap((group) => group.productGroups.map((product) => getStorageCategory(product, storageCategoryLookup)))
    return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [groupedStorages, storageCategoryLookup])
  const filteredStorageGroups = useMemo(() => {
    const query = storageSearch.trim()

    return groupedStorages
      .filter((group) => matchesStorageSearch(group.searchText, query))
      .map((group) => {
        const matchingProductGroups = group.productGroups
          .filter((product) => !storageCategoryFilter || (storageCategoryFilter === '__uncategorized__'
            ? !getStorageCategory(product, storageCategoryLookup)
            : getStorageCategory(product, storageCategoryLookup) === storageCategoryFilter))
          .filter((product) => matchesStorageSearch(product.searchText, query))
          .map((product) => {
            const matchingSizeGroups = product.sizeGroups
              .filter((sizeGroup) => !storageSizeFilter || String(sizeGroup.size || '') === storageSizeFilter)
              .filter((sizeGroup) => matchesStorageSearch(sizeGroup.searchText, query))
              .map((sizeGroup) => {
                const matchingDetails = sizeGroup.details.filter((detail) =>
                  (!storageSourceFilter || detail.sourceType === storageSourceFilter) && matchesStorageSearch(detail.searchText, query)
                )
                return matchingDetails.length ? {
                  ...sizeGroup,
                  qty: matchingDetails.reduce((sum, detail) => sum + Number(detail.qty || 0), 0),
                  displayDetails: matchingDetails,
                } : null
              })
              .filter(Boolean)
            return matchingSizeGroups.length
              ? {
                  ...product,
                  qty: matchingSizeGroups.reduce((sum, sizeGroup) => sum + sizeGroup.qty, 0),
                  displaySizeGroups: matchingSizeGroups,
                }
              : null
          })
          .filter(Boolean)

        return matchingProductGroups.length
          ? {
              ...group,
              storedQty: matchingProductGroups.reduce((sum, product) => sum + product.qty, 0),
              displayProductGroups: matchingProductGroups,
            }
          : null
      })
      .filter(Boolean)
  }, [groupedStorages, storageSearch, storageSizeFilter, storageSourceFilter, storageCategoryFilter, storageCategoryLookup])
  const storageModelGroups = useMemo(() => {
    const modelMap = new Map()

    filteredStorageGroups.forEach((storage) => {
      const displayProductGroups = storage.displayProductGroups || storage.productGroups
      displayProductGroups.forEach((product) => {
        const current = modelMap.get(product.key) || {
          key: `model:${product.key}`,
          productName: product.productName,
          skuInduk: product.skuInduk,
          qty: 0,
          koliNumbers: new Set(),
          sizeGroups: new Map(),
        }
        current.koliNumbers.add(storage.storageNumber)
        ;(product.displaySizeGroups || product.sizeGroups).forEach((sizeGroup) => {
          const sizeKey = String(sizeGroup.size || 'No size').trim().toUpperCase()
          const currentSize = current.sizeGroups.get(sizeKey) || { key: `${current.key}:size:${sizeKey}`, size: sizeGroup.size, qty: 0, koliNumbers: new Set() }
          currentSize.qty += Number(sizeGroup.qty || 0)
          currentSize.koliNumbers.add(storage.storageNumber)
          current.qty += Number(sizeGroup.qty || 0)
          current.sizeGroups.set(sizeKey, currentSize)
        })
        modelMap.set(product.key, current)
      })
    })

    return Array.from(modelMap.values())
      .map((model) => ({
        ...model,
        koliNumbers: Array.from(model.koliNumbers).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })),
        sizeGroups: Array.from(model.sizeGroups.values())
          .map((sizeGroup) => ({
            ...sizeGroup,
            koliNumbers: Array.from(sizeGroup.koliNumbers).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })),
          }))
          .sort((a, b) => compareStorageSizes(a.size, b.size)),
      }))
      .sort((a, b) => String(a.productName || '').localeCompare(String(b.productName || ''), undefined, { numeric: true }))
  }, [filteredStorageGroups])
  const storageMatrixSizes = useMemo(() => [
    ...REGISTRATION_SIZE_OPTIONS,
    ...Array.from(new Set(storageModelGroups.flatMap((model) => model.sizeGroups.map((group) => normalizeSize(group.size)))))
      .filter((size) => !STORAGE_SIZE_ORDER.has(size))
      .sort(compareStorageSizes),
  ], [storageModelGroups])
  const storageMatrixTotals = useMemo(() => {
    const totals = new Map(storageMatrixSizes.map((size) => [size, 0]))
    storageModelGroups.forEach((model) => model.sizeGroups.forEach((group) => {
      const size = normalizeSize(group.size)
      totals.set(size, Number(totals.get(size) || 0) + Number(group.qty || 0))
    }))
    return totals
  }, [storageMatrixSizes, storageModelGroups])
  const sortedStorageModelGroups = useMemo(() => [...storageModelGroups].sort((a, b) => {
    const comparison = storageMatrixSort.key === 'total'
      ? Number(a.qty || 0) - Number(b.qty || 0)
      : String(a.productName || '').localeCompare(String(b.productName || ''), undefined, { numeric: true })
    if (comparison) return storageMatrixSort.direction === 'asc' ? comparison : -comparison
    return String(a.productName || '').localeCompare(String(b.productName || ''), undefined, { numeric: true })
  }), [storageModelGroups, storageMatrixSort])
  const changeStorageMatrixSort = (key) => setStorageMatrixSort((current) => ({
    key,
    direction: current.key === key ? (current.direction === 'asc' ? 'desc' : 'asc') : (key === 'total' ? 'desc' : 'asc'),
  }))
  const selectedSummary = useMemo(() => {
    const sizeMap = new Map()
    const gradeMap = new Map()
    const total = selectedRows.reduce((sum, row) => {
      const qty = Number(returnQtyById[row.id] ?? row.availableQty ?? 0)
      const size = row.size || 'No size'
      const grade = row.grade || 'No grade'
      sizeMap.set(size, Number(sizeMap.get(size) || 0) + qty)
      gradeMap.set(grade, Number(gradeMap.get(grade) || 0) + qty)
      return sum + qty
    }, 0)
    const sizes = Array.from(sizeMap.entries())
      .map(([size, qty]) => ({ size, qty }))
      .sort((a, b) => String(a.size).localeCompare(String(b.size), undefined, { numeric: true }))
    const grades = Array.from(gradeMap.entries())
      .map(([grade, qty]) => ({ grade, qty }))
      .sort((a, b) => String(a.grade).localeCompare(String(b.grade), undefined, { numeric: true }))

    return { total, sizes, grades }
  }, [returnQtyById, selectedRows])
  const receiptSummary = useMemo(() => buildReceiptSummary(receiptBatch), [receiptBatch])
  const correctableSizeLines = useMemo(() => getCorrectableSizeLines(receiptBatch), [receiptBatch])
  const selectedRegistrationProduct = useMemo(
    () =>
      registrationProducts.find((product) => String(product.id) === String(registrationDraft.productId)) ||
      registrationProducts.find((product) => getRegistrationProductLabel(product).toLowerCase() === registrationDraft.productSearch.trim().toLowerCase()) ||
      null,
    [registrationDraft.productId, registrationDraft.productSearch, registrationProducts]
  )
  const registrationProductMatches = useMemo(() => {
    const query = registrationDraft.productSearch.trim().toLowerCase()
    return registrationProducts
      .filter((product) => !query || getRegistrationProductLabel(product).toLowerCase().includes(query))
      .slice(0, 40)
  }, [registrationDraft.productSearch, registrationProducts])
  const eligibleRegistrationSources = useMemo(
    () => getEligibleRejectSources(registrationSourceOptions, registrationDraft.qty),
    [registrationDraft.qty, registrationSourceOptions]
  )
  const registrationNeedsSourceChoice = requiresRejectSourceChoice(eligibleRegistrationSources, registrationDraft.inventorySource)
  const canUseUntrackedShelving = canRegisterUntrackedShelving(
    registrationDraft.inventorySource,
    registrationSourceOptions,
    registrationSourcesLoading,
    registrationSourcesError
  )
  const selectedRegistrationReason = useMemo(
    () =>
      rejectReasons.find((reason) => String(reason.id) === String(registrationDraft.rejectReasonId)) ||
      rejectReasons.find((reason) => getRegistrationReasonLabel(reason).toLowerCase() === registrationDraft.rejectReasonSearch.trim().toLowerCase()) ||
      null,
    [registrationDraft.rejectReasonId, registrationDraft.rejectReasonSearch, rejectReasons]
  )

  useEffect(() => {
    const sku = selectedRegistrationProduct?.skuInduk
    const size = registrationDraft.size
    const source = registrationDraft.inventorySource
    if (!registrationModalOpen || !sku || !size || !source) {
      setRegistrationSourceOptions([])
      setRegistrationSourcesError('')
      setRegistrationSourcesLoading(false)
      return
    }

    let cancelled = false
    setRegistrationSourcesLoading(true)
    setRegistrationSourcesError('')
    setRegistrationSourceOptions([])

    async function loadSources() {
      try {
        let options
        if (source === 'SHELVING') {
          const { data, error: sourceError } = await supabase
            .from('warehouse_storage')
            .select('id,sku_id,size,qty,rack_location:dir_rack_locations!inner(location_type,location_id,location_code,sub_location,group_code)')
            .eq('rack_location.group_code', 'ARKLINE')
            .eq('rack_location.location_type', 'SHELVING')
            .or(`sku_id.ilike.${sku}%,source_variant_code.ilike.${sku}%`)
            .eq('size', size)
            .order('qty', { ascending: false })
            .limit(50)
          if (sourceError) throw sourceError
          options = (data || []).map((row) => ({
            id: String(row.id),
            qty: Number(row.qty || 0),
            label: [row.rack_location?.location_id, row.rack_location?.location_code, row.rack_location?.sub_location].filter(Boolean).join(' / '),
          }))
        } else {
          const dayRange = getJakartaDayRange(registrationDraft.storageDate)
          if (!dayRange) throw new Error('Choose a valid Storage Date first.')
          const { data, error: sourceError } = await supabase
            .from('restock_request')
            .select('id,qty,fulfilled_qty,rejected_qty,sales_upload_credited_qty,take_from,completed_at,requester_name')
            .eq('source_type', 'ARKLINE')
            .eq('request_status', 'completed')
            .or(`source_sku_id.ilike.${sku}%,search_term.ilike.${sku}%`)
            .eq('size', size)
            .ilike('take_from', 'PALLET%')
            .gte('completed_at', dayRange.start)
            .lt('completed_at', dayRange.end)
            .order('completed_at', { ascending: false })
            .limit(100)
          if (sourceError) throw sourceError
          options = (data || []).map((row) => ({
            id: String(row.id),
            qty: Math.max(0, Math.min(Number(row.qty || 0), Number(row.fulfilled_qty ?? row.qty ?? 0)) - Number(row.rejected_qty || 0) - Number(row.sales_upload_credited_qty || 0)),
            label: `${row.requester_name || 'Unknown requester'} / ${row.completed_at ? new Date(row.completed_at).toLocaleString('id-ID') : 'Completed'}`,
          })).filter((row) => row.qty > 0)
        }
        if (!cancelled) setRegistrationSourceOptions(options)
      } catch (sourceError) {
        if (!cancelled) setRegistrationSourcesError(sourceError.message || 'Could not load reject sources.')
      } finally {
        if (!cancelled) setRegistrationSourcesLoading(false)
      }
    }
    void loadSources()
    return () => { cancelled = true }
  }, [registrationModalOpen, registrationDraft.inventorySource, registrationDraft.size, registrationDraft.storageDate, selectedRegistrationProduct?.skuInduk, supabase])
  const selectedCorrectionLine = useMemo(
    () => correctableSizeLines.find((line) => String(line.id) === String(sizeCorrectionDraft.fromLineId)) || null,
    [correctableSizeLines, sizeCorrectionDraft.fromLineId]
  )
  const correctionToSizeOptions = useMemo(() => {
    if (!receiptBatch || !selectedCorrectionLine) return []
    const selectedSize = normalizeSize(selectedCorrectionLine.size)
    return Array.from(new Set((receiptBatch.sizeOptions || []).map(normalizeSize).filter((size) => size && size !== selectedSize))).sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true })
    )
  }, [receiptBatch, selectedCorrectionLine])
  const receiptInputSummary = useMemo(() => {
    const sizes = receiptSummary.sizeRows
      .map((row) => ({
        size: row.size,
        qty: Number(receiptQtyById[getReceiptSizeKey(row.size)] || 0),
      }))
      .filter((row) => row.qty > 0)
    const total = sizes.reduce((sum, row) => sum + Number(row.qty || 0), 0)

    return { total, sizes }
  }, [receiptQtyById, receiptSummary.sizeRows])
  const allFilteredSelected =
    filteredEligibleRows.length > 0 && filteredEligibleRows.every((row) => selectedIds.includes(row.id))
  const selectedQty = selectedRows.reduce(
    (sum, row) => sum + Number(returnQtyById[row.id] ?? row.availableQty ?? 0),
    0
  )

  function toggleRow(row) {
    setError('')
    setSelectedIds((current) => {
      if (current.includes(row.id)) {
        setReturnQtyById((qtyState) => {
          const next = { ...qtyState }
          delete next[row.id]
          return next
        })
        return current.filter((id) => id !== row.id)
      }

      setReturnQtyById((qtyState) => ({ ...qtyState, [row.id]: row.availableQty }))
      return [...current, row.id]
    })
  }

  function toggleFilteredRows() {
    setError('')
    if (!filteredEligibleRows.length) return

    setSelectedIds((current) => {
      const filteredIds = filteredEligibleRows.map((row) => row.id)
      const isAllSelected = filteredEligibleRows.every((row) => current.includes(row.id))

      if (isAllSelected) {
        setReturnQtyById((qtyState) => {
          const next = { ...qtyState }
          filteredIds.forEach((id) => {
            delete next[id]
          })
          return next
        })
        return current.filter((id) => !filteredIds.includes(id))
      }

      setReturnQtyById((qtyState) => {
        const next = { ...qtyState }
        filteredEligibleRows.forEach((row) => {
          next[row.id] = next[row.id] ?? row.availableQty
        })
        return next
      })

      return Array.from(new Set([...current, ...filteredIds]))
    })
  }

  function toggleStorageGroup(key) {
    setCollapsedStorageKeys((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key)
      return [...current, key]
    })
  }

  function toggleStorageProductGroup(key) {
    setCollapsedStorageProductKeys((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key)
      return [...current, key]
    })
  }

  function openReturnModal() {
    if (!selectedRows.length) {
      setError('Choose at least one Arkline reject row first.')
      return
    }
    setError('')
    setReturnModalOpen(true)
  }

  function closeReturnModal() {
    setReturnModalOpen(false)
    setReturnDate(todayValue())
    setShippingMethod('')
    setNotes('')
    setError('')
  }

  function openStorageModal() {
    if (!selectedRows.length) {
      setError('Choose at least one Arkline reject row first.')
      return
    }
    setError('')
    setStorageModalOpen(true)
  }

  function closeStorageModal() {
    setStorageModalOpen(false)
    setStorageDate(todayValue())
    setStorageNumber('')
    setStorageNotes('')
    setError('')
  }

  function getEmptyRegistrationDraft() {
    return {
      storageNumber: '',
      storageDate: todayValue(),
      productId: '',
      productSearch: '',
      size: '',
      rejectReasonId: '',
      rejectReasonSearch: '',
      grade: 'C',
      qty: '',
      inventorySource: '',
      sourceId: '',
      notes: '',
    }
  }

  function openRegistrationModal() {
    setRegistrationDraft(getEmptyRegistrationDraft())
    setRegistrationProductOpen(false)
    setError('')
    setRegistrationModalOpen(true)
  }

  function closeRegistrationModal() {
    setRegistrationModalOpen(false)
    setRegistrationDraft(getEmptyRegistrationDraft())
    setRegistrationProductOpen(false)
    setError('')
  }

  function updateRegistrationDraft(patch) {
    setRegistrationDraft((current) => ({ ...current, ...patch }))
  }

  function handleRegistrationProductSearchChange(value) {
    const normalized = value.trim().toLowerCase()
    const nextProduct = registrationProducts.find((product) => getRegistrationProductLabel(product).toLowerCase() === normalized)
    setRegistrationDraft((current) => ({
      ...current,
      productSearch: value,
      productId: nextProduct?.id || '',
      sourceId: '',
    }))
    setRegistrationProductCursor(-1)
    setRegistrationProductOpen(true)
  }

  function selectRegistrationProduct(product) {
    setRegistrationDraft((current) => ({
      ...current,
      productId: product.id,
      productSearch: getRegistrationProductLabel(product),
      sourceId: '',
    }))
    setRegistrationProductOpen(false)
  }

  function handleRegistrationReasonSearchChange(value) {
    const normalized = value.trim().toLowerCase()
    const nextReason = rejectReasons.find((reason) => getRegistrationReasonLabel(reason).toLowerCase() === normalized)
    setRegistrationDraft((current) => ({
      ...current,
      rejectReasonSearch: value,
      rejectReasonId: nextReason?.id || '',
    }))
  }

  function openReceiptModal(batch) {
    const initialQty = {}
    buildReceiptSummary(batch).sizeRows.forEach((sizeRow) => {
      initialQty[getReceiptSizeKey(sizeRow.size)] = ''
    })
    setReceiptQtyById(initialQty)
    setReceiptDate(todayValue())
    setReceiptNotes('')
    setSizeCorrectionOpen(false)
    setSizeCorrectionDraft({ fromLineId: '', toSize: '', qty: '', notes: '' })
    setError('')
    setReceiptBatch(batch)
  }

  function closeReceiptModal() {
    setReceiptBatch(null)
    setSizeCorrectionOpen(false)
    setSizeCorrectionDraft({ fromLineId: '', toSize: '', qty: '', notes: '' })
    setError('')
  }

  function openSizeCorrectionModal() {
    const firstLine = correctableSizeLines[0]
    if (!firstLine) {
      setError('No returned size is available for correction.')
      return
    }

    setSizeCorrectionDraft({
      fromLineId: firstLine.id,
      toSize: '',
      qty: '',
      notes: '',
    })
    setSizeCorrectionOpen(true)
    setError('')
  }

  function closeSizeCorrectionModal() {
    setSizeCorrectionOpen(false)
    setSizeCorrectionDraft({ fromLineId: '', toSize: '', qty: '', notes: '' })
    setError('')
  }

  async function saveReturnBatch() {
    const invalidRow = selectedRows.find((row) => {
      const qty = Number(returnQtyById[row.id] ?? row.availableQty)
      return qty <= 0 || qty > Number(row.availableQty || 0)
    })

    if (invalidRow) {
      setError('Return qty must be greater than zero and cannot exceed the available reject qty.')
      return
    }

    const groupedRows = selectedRows.reduce((groups, row) => {
      const key = `${row.poItemId || row.poId || row.skuInduk}-${row.qcCycleId || row.id}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(row)
      return groups
    }, new Map())

    setSaving(true)
    setError('')

    for (const groupRows of groupedRows.values()) {
      const first = groupRows[0]
      const linePayload = groupRows.map((row) => ({
        reject_detail_id: row.id,
        reject_reason_id: row.reasonId,
        grade: row.grade,
        size: row.size,
        qty: Number(returnQtyById[row.id] ?? row.availableQty),
      }))
      const { error: saveError } = await supabase.rpc('create_arkline_qc_return_batch', {
        p_po_id: first.poId || null,
        p_arkline_po_item_id: first.poItemId || null,
        p_sku_induk: first.skuInduk,
        p_model_name: first.modelName,
        p_supplier_name: first.supplierName || '',
        p_source_qc_cycle_id: first.qcCycleId,
        p_round_number: Number(first.qcRoundNumber || 1),
        p_return_date: returnDate,
        p_shipping_method: shippingMethod.trim(),
        p_notes: notes.trim(),
        p_created_by: userEmail || '',
        p_lines: linePayload,
      })

      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }
    }

    setSelectedIds([])
    setReturnQtyById({})
    closeReturnModal()
    setActiveReturnTab('progress')
    setSaving(false)
    router.refresh()
  }

  async function saveStorageBatch() {
    const trimmedStorageNumber = storageNumber.trim()
    if (!trimmedStorageNumber) {
      setError('Storage number is required.')
      return
    }

    const invalidRow = selectedRows.find((row) => {
      const qty = Number(returnQtyById[row.id] ?? row.availableQty)
      return qty <= 0 || qty > Number(row.availableQty || 0)
    })

    if (invalidRow) {
      setError('Storage qty must be greater than zero and cannot exceed the available reject qty.')
      return
    }

    const groupedRows = selectedRows.reduce((groups, row) => {
      const key = `${row.poItemId || row.poId || row.skuInduk}-${row.qcCycleId || row.id}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(row)
      return groups
    }, new Map())

    setSaving(true)
    setError('')

    for (const groupRows of groupedRows.values()) {
      const first = groupRows[0]
      const linePayload = groupRows.map((row) => ({
        reject_detail_id: row.id,
        reject_reason_id: row.reasonId,
        grade: row.grade,
        size: row.size,
        qty: Number(returnQtyById[row.id] ?? row.availableQty),
      }))
      const { error: saveError } = await supabase.rpc('create_arkline_qc_rejection_storage_batch', {
        p_storage_number: trimmedStorageNumber,
        p_po_id: first.poId,
        p_arkline_po_item_id: first.poItemId,
        p_sku_induk: first.skuInduk,
        p_model_name: first.modelName,
        p_supplier_name: first.supplierName || '',
        p_source_qc_cycle_id: first.qcCycleId,
        p_round_number: Number(first.qcRoundNumber || 1),
        p_storage_date: storageDate,
        p_notes: storageNotes.trim(),
        p_created_by: userEmail || '',
        p_lines: linePayload,
      })

      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }
    }

    setSelectedIds([])
    setReturnQtyById({})
    setSaving(false)
    closeStorageModal()
    router.push('/dashboard/storage/overview?mode=reject-storage&source=arkline')
  }

  async function saveRegistrationStorageItem() {
    if (saving) return
    const trimmedStorageNumber = registrationDraft.storageNumber.trim()
    const qty = Number(registrationDraft.qty || 0)

    if (!trimmedStorageNumber) {
      setError('Storage number is required.')
      return
    }

    if (!selectedRegistrationProduct) {
      setError('Choose an Arkline product first.')
      return
    }

    if (!registrationDraft.size) {
      setError('Choose the reject size first.')
      return
    }

    if (!selectedRegistrationReason) {
      setError('Choose the reject reason first.')
      return
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      setError('Qty must be a whole number greater than zero.')
      return
    }

    const selectedSource = resolveRejectSource(eligibleRegistrationSources, registrationDraft.inventorySource, registrationDraft.sourceId)
    if ((!selectedSource && !canUseUntrackedShelving) || registrationSourcesLoading || (selectedSource && qty > selectedSource.qty)) {
      setError(registrationNeedsSourceChoice ? 'Choose the matching reject source.' : 'No matching source has enough available quantity.')
      return
    }

    setSaving(true)
    setError('')

    const { error: saveError } = await supabase.rpc('register_arkline_rejection_storage_item', {
      p_storage_number: trimmedStorageNumber,
      p_sku_induk: selectedRegistrationProduct.skuInduk,
      p_model_name: selectedRegistrationProduct.productName,
      p_size: registrationDraft.size,
      p_reject_reason_id: selectedRegistrationReason.id,
      p_qty: qty,
      p_storage_date: registrationDraft.storageDate,
      p_notes: registrationDraft.notes.trim(),
      p_created_by: userEmail || '',
      p_inventory_source: registrationDraft.inventorySource,
      p_source_warehouse_storage_id: registrationDraft.inventorySource === 'SHELVING' && selectedSource ? Number(selectedSource.id) : null,
      p_source_restock_request_id: registrationDraft.inventorySource === 'PALLET_RESTOCK' ? selectedSource.id : null,
    })

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    closeRegistrationModal()
    setActiveReturnTab('storage')
    onStorageChanged?.()
    router.refresh()
  }

  async function saveReworkReceipt() {
    if (!receiptBatch) return

    const receiptLines = []
    const invalidSize = receiptSummary.sizeRows.find((sizeRow) => Number(receiptQtyById[getReceiptSizeKey(sizeRow.size)] || 0) > Number(sizeRow.remainingQty || 0))

    if (invalidSize) {
      setError('Received qty cannot exceed the remaining qty for its size.')
      return
    }

    receiptSummary.sizeRows.forEach((sizeRow) => {
      let remainingInput = Number(receiptQtyById[getReceiptSizeKey(sizeRow.size)] || 0)
      if (remainingInput <= 0) return

      sizeRow.lines.forEach((line) => {
        if (remainingInput <= 0) return
        const qty = Math.min(remainingInput, Number(line.remainingQty || 0))
        if (qty > 0) {
          receiptLines.push({
            ...line,
            inputQty: qty,
          })
          remainingInput -= qty
        }
      })
    })

    if (!receiptLines.length) {
      setError('Enter at least one received qty.')
      return
    }

    setSaving(true)
    setError('')
    const { error: receiptError } = await supabase.rpc('record_arkline_rework_receipt', {
      p_return_batch_id: receiptBatch.id,
      p_receive_date: receiptDate,
      p_notes: receiptNotes.trim(),
      p_created_by: userEmail || '',
      p_lines: receiptLines.map((line) => ({
        return_batch_line_id: line.id,
        size: normalizeSize(line.size),
        qty: line.inputQty,
      })),
    })

    if (receiptError) {
      setError(receiptError.message)
      setSaving(false)
      return
    }

    setReceiptBatch(null)
    setSaving(false)
    router.refresh()
  }

  async function saveSizeCorrection() {
    if (!receiptBatch || !selectedCorrectionLine) return

    const qty = Number(sizeCorrectionDraft.qty || 0)
    const toSize = normalizeSize(sizeCorrectionDraft.toSize)

    if (!sizeCorrectionDraft.toSize) {
      setError('Choose the corrected size first.')
      return
    }

    if (toSize === normalizeSize(selectedCorrectionLine.size)) {
      setError('Corrected size must be different from the original size.')
      return
    }

    if (qty <= 0 || qty > Number(selectedCorrectionLine.correctableQty || 0)) {
      setError('Correction qty must be greater than zero and cannot exceed the available original size qty.')
      return
    }

    setSaving(true)
    setError('')
    let remainingCorrectionQty = qty
    const correctionPayload = []
    ;(selectedCorrectionLine.lines || []).forEach((line) => {
      if (remainingCorrectionQty <= 0) return
      const lineQty = Math.min(remainingCorrectionQty, Number(line.correctableQty || 0))
      if (lineQty <= 0) return
      correctionPayload.push({
        return_batch_id: receiptBatch.id,
        from_return_batch_line_id: line.id,
        from_size: normalizeSize(line.size),
        to_size: toSize,
        qty: lineQty,
        notes: sizeCorrectionDraft.notes.trim() || null,
        created_by: userEmail || null,
      })
      remainingCorrectionQty -= lineQty
    })

    const { data, error: correctionError } = await supabase
      .from('arkline_qc_return_size_corrections')
      .insert(correctionPayload)
      .select('id, return_batch_id, from_return_batch_line_id, from_size, to_size, qty, notes, created_by, created_at, updated_at')

    if (correctionError) {
      setError(correctionError.message)
      setSaving(false)
      return
    }

    const normalizedCorrections = (data || []).map(normalizeSizeCorrection)
    const correctionsByLine = normalizedCorrections.reduce((groups, correction) => {
      const key = String(correction.fromLineId)
      groups.set(key, [...(groups.get(key) || []), correction])
      return groups
    }, new Map())
    setReceiptBatch((current) => {
      if (!current || current.id !== receiptBatch.id) return current

      return {
        ...current,
        lines: (current.lines || []).map((line) => {
          const newCorrections = correctionsByLine.get(String(line.id))
          if (!newCorrections?.length) return line
          return {
            ...line,
            corrections: [...(line.corrections || []), ...newCorrections],
          }
        }),
        sizeOptions: Array.from(new Set([...(current.sizeOptions || []), toSize])).sort((a, b) =>
          String(a).localeCompare(String(b), undefined, { numeric: true })
        ),
      }
    })
    setReceiptQtyById({})
    closeSizeCorrectionModal()
    setSaving(false)
    router.refresh()
  }

  return (
    <>
      <div className={`${styles.subPageTabsPage} ${storageOnly ? styles.storageEmbeddedPage : ''}`.trim()}>
        {!storageOnly ? (
        <div className={styles.subPageTabsShell}>
          <div className={styles.subPageTabsBar} role="tablist" aria-label="Arkline return workflow">
            <button
              type="button"
              role="tab"
              aria-selected={activeReturnTab === 'arrangement'}
              className={`${styles.subPageTabLink} ${activeReturnTab === 'arrangement' ? styles.subPageTabLinkActive : ''}`.trim()}
              onClick={() => setActiveReturnTab('arrangement')}
            >
              <span className={styles.subPageTabLabel}>Return Arrangement</span>
              <span className={styles.subPageTabUnderline} />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeReturnTab === 'progress'}
              className={`${styles.subPageTabLink} ${activeReturnTab === 'progress' ? styles.subPageTabLinkActive : ''}`.trim()}
              onClick={() => setActiveReturnTab('progress')}
            >
              <span className={styles.subPageTabLabel}>Return Progress</span>
              <span className={styles.subPageTabUnderline} />
            </button>
          </div>
        </div>
        ) : null}

        <div className={`${styles.subPageTabsPanel} ${storageOnly ? styles.storageEmbeddedPanel : ''}`.trim()}>
          {activeReturnTab === 'arrangement' ? (
      <section className={`${styles.card} ${styles.subPageCard}`.trim()}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Arkline</p>
            <h2 className={styles.sectionTitle}>Return Arrangement</h2>
          </div>
          <div className={styles.modalHeaderActions}>
            <button type="button" className={`${styles.secondaryButton} ${styles.rejectStorageButton}`} onClick={openStorageModal} disabled={!canAdd || !selectedRows.length}>
              Move to Reject Storage
            </button>
            <button type="button" className={styles.primaryButton} onClick={openReturnModal} disabled={!canAdd || !selectedRows.length}>
              Create Return Batch
            </button>
          </div>
        </div>

        <div className={styles.filterGrid}>
          <div className={styles.field}>
            <label htmlFor="return-repairability-filter">Repairability</label>
            <select
              id="return-repairability-filter"
              className={styles.input}
              value={repairabilityFilter}
              onChange={(event) => {
                setRepairabilityFilter(event.target.value)
                setSelectedIds([])
              }}
            >
              <option value="all">All reject types</option>
              <option value="repairable">Repairable</option>
              <option value="non_repairable">Non-repairable</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-reject-reason-filter">Reject Reason</label>
            <select
              id="return-reject-reason-filter"
              className={styles.input}
              value={rejectReasonFilter}
              onChange={(event) => {
                setRejectReasonFilter(event.target.value)
                setSelectedIds([])
              }}
            >
              <option value="">All reject reasons</option>
              {rejectReasonOptions.map((reason) => <option key={reason.id} value={reason.id}>{reason.name}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-size-filter">Size</label>
            <select
              id="return-size-filter"
              className={styles.input}
              value={sizeFilter}
              onChange={(event) => {
                setSizeFilter(event.target.value)
                setSelectedIds([])
              }}
            >
              <option value="">All sizes</option>
              {sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-grade-filter">Grade</label>
            <select
              id="return-grade-filter"
              className={styles.input}
              value={gradeFilter}
              onChange={(event) => {
                setGradeFilter(event.target.value)
                setSelectedIds([])
              }}
            >
              <option value="">All grades</option>
              {gradeOptions.map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-qc-cycle-filter">QC Cycle</label>
            <select
              id="return-qc-cycle-filter"
              className={styles.input}
              value={qcCycleFilter}
              onChange={(event) => {
                setQcCycleFilter(event.target.value)
                setSelectedIds([])
              }}
            >
              <option value="">All QC cycles</option>
              {qcCycleOptions.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-po-filter">PO</label>
            <select
              id="return-po-filter"
              className={styles.input}
              value={poFilter}
              onChange={(event) => {
                setPoFilter(event.target.value)
                setProductFilter('')
                setSelectedIds([])
              }}
            >
              <option value="">All PO</option>
              {poOptions.map((po) => <option key={po} value={po}>{po === '__NO_PO__' ? 'No PO' : po}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-product-filter">Product</label>
            <select
              id="return-product-filter"
              className={styles.input}
              value={productFilter}
              onChange={(event) => {
                setProductFilter(event.target.value)
                setSelectedIds([])
              }}
            >
              <option value="">All products</option>
              {productOptions.map((product) => <option key={product} value={product}>{product}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.filteredSummary}>
          <div className={styles.summaryMetric}>
            <span>Selected Total</span>
            <strong>{selectedSummary.total}</strong>
          </div>
          <div className={styles.sizeSummary}>
            <span>Selected Qty per Size</span>
            <div className={styles.sizeChipRow}>
              {selectedSummary.sizes.length ? (
                selectedSummary.sizes.map((item) => (
                  <span key={item.size} className={styles.sizeChip}>
                    {item.size}: <strong>{item.qty}</strong>
                  </span>
                ))
              ) : (
                <span className={styles.sizeChip}>No selected qty</span>
              )}
            </div>
          </div>
          <div className={styles.sizeSummary}>
            <span>Selected Qty per Grade</span>
            <div className={styles.sizeChipRow}>
              {selectedSummary.grades.length ? (
                selectedSummary.grades.map((item) => (
                  <span key={item.grade} className={styles.sizeChip}>
                    Grade {item.grade}: <strong>{item.qty}</strong>
                  </span>
                ))
              ) : (
                <span className={styles.sizeChip}>No selected qty</span>
              )}
            </div>
          </div>
        </div>

        {error && !returnModalOpen && !storageModalOpen && !registrationModalOpen && !receiptBatch ? <p className={styles.error}>{error}</p> : null}

        {!filteredEligibleRows.length ? (
          <div className={styles.empty}>No Arkline reject qty matches the selected filters.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th aria-label="Select">
                    <input
                      className={styles.checkbox}
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleFilteredRows}
                      disabled={!filteredEligibleRows.length}
                      aria-label="Select all filtered reject rows"
                    />
                  </th>
                  <th>PO</th>
                  <th>Product</th>
                  <th>QC Cycle</th>
                  <th>Grade</th>
                  <th>Size</th>
                  <th>Reject Reason</th>
                  <th>Repairability</th>
                  <th className={styles.centerNumberCell}>Available Qty</th>
                </tr>
              </thead>
              <tbody>
                {filteredEligibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleRow(row)}
                      />
                    </td>
                    <td>{row.poId || 'No PO'}</td>
                    <td>{row.modelName}</td>
                    <td>Round {row.qcRoundNumber}</td>
                    <td>{row.grade}</td>
                    <td>{row.size}</td>
                    <td>{row.reasonName}</td>
                    <td>
                      <span className={`${styles.badge} ${row.isRepairable ? styles.badgeRepairable : ''}`}>
                        {row.isRepairable ? 'Repairable' : 'Non-repairable'}
                      </span>
                    </td>
                    <td className={styles.centerNumberCell}>{row.availableQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      {activeReturnTab === 'progress' ? (
      <section className={`${styles.card} ${styles.subPageCard}`.trim()}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Arkline</p>
            <h2 className={styles.sectionTitle}>Return Progress</h2>
          </div>
        </div>

        <div className={`${styles.filterGrid} ${styles.progressFilterGrid}`.trim()}>
          <div className={styles.field}>
            <label htmlFor="return-progress-po-filter">PO</label>
            <select
              id="return-progress-po-filter"
              className={styles.input}
              value={progressPoFilter}
              onChange={(event) => {
                setProgressPoFilter(event.target.value)
                setProgressSupplierFilter('')
                setProgressProductFilter('')
                setProgressRejectReasonFilter('')
                setProgressStatusFilter('')
              }}
            >
              <option value="">All PO</option>
              {progressPoOptions.map((po) => <option key={po} value={po}>{po}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-progress-supplier-filter">Supplier</label>
            <select
              id="return-progress-supplier-filter"
              className={styles.input}
              value={progressSupplierFilter}
              onChange={(event) => {
                setProgressSupplierFilter(event.target.value)
                setProgressProductFilter('')
                setProgressRejectReasonFilter('')
                setProgressStatusFilter('')
              }}
            >
              <option value="">All suppliers</option>
              {progressSupplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-progress-product-filter">Product</label>
            <select
              id="return-progress-product-filter"
              className={styles.input}
              value={progressProductFilter}
              onChange={(event) => {
                setProgressProductFilter(event.target.value)
                setProgressRejectReasonFilter('')
                setProgressStatusFilter('')
              }}
            >
              <option value="">All products</option>
              {progressProductOptions.map((product) => <option key={product} value={product}>{product}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-progress-reason-filter">Reject Reason</label>
            <select
              id="return-progress-reason-filter"
              className={styles.input}
              value={progressRejectReasonFilter}
              onChange={(event) => setProgressRejectReasonFilter(event.target.value)}
            >
              <option value="">All reject reasons</option>
              {progressRejectReasonOptions.map((reason) => <option key={reason.id} value={reason.id}>{reason.name}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="return-progress-status-filter">Status</label>
            <select
              id="return-progress-status-filter"
              className={styles.input}
              value={progressStatusFilter}
              onChange={(event) => setProgressStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {progressStatusOptions.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
            </select>
          </div>
        </div>

        {!batches.length ? (
          <div className={styles.empty}>No Arkline return batch has been created.</div>
        ) : !filteredBatches.length ? (
          <div className={styles.empty}>No Arkline return batch matches the selected filters.</div>
        ) : (
          <div className={styles.batchList}>
            {filteredBatches.map((batch) => {
              const canReceive = !['FULLY_RETURNED', 'CLOSED_SHORT'].includes(batch.status)
              return (
                <article key={batch.id} className={styles.batchCard}>
                  <div className={styles.batchHeader}>
                    <div className={styles.batchTitle}>
                      <strong>{batch.returnNumber}</strong>
                      <span className={`${styles.badge} ${getStatusBadgeClass(batch.status)}`.trim()}>{formatStatus(batch.status)}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => openReceiptModal(batch)}
                      disabled={!canEdit || !canReceive}
                    >
                      Record Returned Goods
                    </button>
                  </div>
                  <div className={styles.batchMeta}>
                    <div className={styles.metric}><span>PO</span><strong>{batch.poId}</strong></div>
                    <div className={styles.metric}><span>Product</span><strong>{batch.modelName}</strong></div>
                    <div className={styles.metric}><span>Sent</span><strong>{batch.sentQty}</strong></div>
                    <div className={styles.metric}><span>Returned</span><strong>{batch.returnedQty}</strong></div>
                    <div className={styles.metric}><span>Short</span><strong>{batch.shortQty}</strong></div>
                  </div>
                  <p className={styles.notice}>
                    Round {batch.roundNumber} sent on {formatDate(batch.returnDate)} to {batch.supplierName || 'supplier not recorded'}.
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </section>
      ) : null}

      {storageOnly ? (
      <section className={`${styles.card} ${styles.subPageCard}`.trim()}>
        <div className={styles.sectionHeader}>
          <div className={styles.storageHeading}>
            <p className={styles.eyebrow}>Arkline</p>
            <h2 className={styles.sectionTitle}>Reject Storage</h2>
            <div className={styles.storageModeToggle} role="group" aria-label="Reject storage view mode">
              <button
                type="button"
                className={`${styles.storageModeButton} ${storageViewMode === 'koli' ? styles.storageModeButtonActive : ''}`.trim()}
                onClick={() => setStorageViewMode('koli')}
                aria-pressed={storageViewMode === 'koli'}
              >
                Koli
              </button>
              <button
                type="button"
                className={`${styles.storageModeButton} ${storageViewMode === 'model' ? styles.storageModeButtonActive : ''}`.trim()}
                onClick={() => setStorageViewMode('model')}
                aria-pressed={storageViewMode === 'model'}
              >
                Model
              </button>
            </div>
          </div>
        </div>

        <div className={styles.storageToolbar}>
          <div className={`${styles.field} ${styles.storageCategoryField}`.trim()}>
            <label htmlFor="storage-category-filter">Category</label>
            <select
              id="storage-category-filter"
              className={styles.input}
              value={storageCategoryFilter}
              onChange={(event) => setStorageCategoryFilter(event.target.value)}
            >
              <option value="">All categories</option>
              {storageCategoryOptions.filter(Boolean).map((category) => <option key={category} value={category}>{category}</option>)}
              {storageCategoryOptions.includes('') ? <option value="__uncategorized__">Uncategorized</option> : null}
            </select>
          </div>
          <div className={`${styles.field} ${styles.storageSizeField}`.trim()}>
            <label htmlFor="storage-size-filter">Size</label>
            <select
              id="storage-size-filter"
              className={styles.input}
              value={storageSizeFilter}
              onChange={(event) => setStorageSizeFilter(event.target.value)}
            >
              <option value="">All sizes</option>
              {storageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <div className={`${styles.field} ${styles.storageSizeField}`.trim()}>
            <label htmlFor="storage-source-filter">Source</label>
            <select
              id="storage-source-filter"
              className={styles.input}
              value={storageSourceFilter}
              onChange={(event) => setStorageSourceFilter(event.target.value)}
            >
              <option value="">All sources</option>
              <option value="QC_REJECT">QC Reject</option>
              <option value="PACKING_REJECT">Packing Reject</option>
              <option value="DELIVERY_REJECT">Delivery Reject</option>
            </select>
          </div>
          <div className={`${styles.field} ${styles.storageSearchField}`.trim()}>
            <label htmlFor="storage-search">Search storage, product, PO, or reject reason</label>
            <input
              id="storage-search"
              className={styles.input}
              value={storageSearch}
              onChange={(event) => setStorageSearch(event.target.value)}
              placeholder="Search product, storage no, PO..."
            />
          </div>
          {storageSearch || storageSizeFilter || storageSourceFilter || storageCategoryFilter ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setStorageSearch('')
                setStorageSizeFilter('')
                setStorageSourceFilter('')
                setStorageCategoryFilter('')
              }}
            >
              Clear
            </button>
          ) : null}
          {canAdd ? (
            <button
              type="button"
              className={styles.storageAddButton}
              onClick={openRegistrationModal}
              disabled={!registrationProducts.length || !rejectReasons.length}
              title="Item Registration"
              aria-label="Open Item Registration"
            >
              +
            </button>
          ) : null}
        </div>

        {!storages.length ? (
          <div className={styles.empty}>No Arkline reject storage batch has been created.</div>
        ) : !filteredStorageGroups.length ? (
          <div className={styles.empty}>No reject storage matches this search.</div>
        ) : storageViewMode === 'model' ? (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.storageMatrixTable}`.trim()}>
              <thead>
                <tr>
                  <th scope="col" aria-sort={storageMatrixSort.key === 'name' ? (storageMatrixSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className={styles.storageMatrixSortButton} onClick={() => changeStorageMatrixSort('name')}>
                      Product Name <span aria-hidden="true">{storageMatrixSort.key === 'name' ? (storageMatrixSort.direction === 'asc' ? 'A-Z' : 'Z-A') : 'Sort'}</span>
                    </button>
                  </th>
                  {storageMatrixSizes.map((size) => <th key={size} scope="col" className={styles.numberCell}>{size}</th>)}
                  <th scope="col" aria-sort={storageMatrixSort.key === 'total' ? (storageMatrixSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${styles.centerNumberCell} ${styles.storageMatrixTotalCell}`.trim()}>
                    <button type="button" className={styles.storageMatrixSortButton} onClick={() => changeStorageMatrixSort('total')}>
                      Total <span aria-hidden="true">{storageMatrixSort.key === 'total' ? (storageMatrixSort.direction === 'asc' ? 'Low-High' : 'High-Low') : 'Sort'}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStorageModelGroups.map((model) => {
                  const qtyBySize = new Map(model.sizeGroups.map((group) => [normalizeSize(group.size), Number(group.qty || 0)]))
                  return (
                    <tr key={model.key}>
                      <th scope="row" className={styles.storageMatrixProduct}>
                        {model.productName}
                      </th>
                      {storageMatrixSizes.map((size) => {
                        const qty = qtyBySize.get(size) || 0
                        return <td key={size} className={styles.numberCell}>{qty || null}</td>
                      })}
                      <td className={`${styles.centerNumberCell} ${styles.storageMatrixTotalCell}`.trim()}>{model.qty || null}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  {storageMatrixSizes.map((size) => <td key={size} className={styles.numberCell}>{storageMatrixTotals.get(size) || null}</td>)}
                  <td className={`${styles.centerNumberCell} ${styles.storageMatrixTotalCell}`.trim()}>{storageModelGroups.reduce((sum, model) => sum + Number(model.qty || 0), 0) || null}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.storageTable}`.trim()}>
              <thead>
                <tr>
                  <th>Koli Number</th>
                  <th className={styles.centerNumberCell}>Stored Qty</th>
                  <th>Updated Date</th>
                  <th className={styles.centerNumberCell}>Number of Products</th>
                  <th className={styles.centerNumberCell}>Number of Sizes</th>
                </tr>
              </thead>
              <tbody>
                {filteredStorageGroups.map((storage) => {
                  const isCollapsed = !collapsedStorageKeys.includes(storage.key)
                  const displayProductGroups = storage.displayProductGroups || storage.productGroups
                  const dateLabel =
                    storage.dates.length > 1
                      ? `${formatDate(storage.dates[0])} - ${formatDate(storage.dates[storage.dates.length - 1])}`
                      : formatDate(storage.dates[0])
                  const visibleSizeCount = new Set(
                    displayProductGroups.flatMap((product) => (product.displaySizeGroups || product.sizeGroups).map((sizeGroup) => sizeGroup.size))
                  ).size

                  return (
                    <Fragment key={storage.key}>
                      <tr className={styles.storageParentRow}>
                        <td>
                          <div className={styles.storageKoliCell}>
                            <button
                              type="button"
                              className={styles.storageTableToggle}
                              onClick={() => toggleStorageGroup(storage.key)}
                              aria-expanded={!isCollapsed}
                              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${storage.storageNumber}`}
                            >
                              {isCollapsed ? '+' : '-'}
                            </button>
                            <strong>{storage.storageNumber}</strong>
                          </div>
                        </td>
                        <td className={styles.centerNumberCell}><strong>{storage.storedQty}</strong></td>
                        <td>{dateLabel}</td>
                        <td className={styles.centerNumberCell}>{displayProductGroups.length}</td>
                        <td className={styles.centerNumberCell}>{visibleSizeCount}</td>
                      </tr>
                      {!isCollapsed ? (
                        <tr className={styles.storageExpandedRow}>
                          <td colSpan={5}>
                            <div className={styles.storageNestedPanel}>
                              <table className={`${styles.table} ${styles.storageProductTable}`.trim()}>
                                <thead>
                                  <tr>
                                    <th>SKU / Product</th>
                                    <th className={styles.centerNumberCell}>Stored Qty</th>
                                    <th className={styles.centerNumberCell}>Number of Sizes</th>
                                    <th className={styles.centerNumberCell}>Reject Details</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {displayProductGroups.map((product) => {
                                    const productCollapseKey = `${storage.key}::${product.key}`
                                    const isProductCollapsed = !collapsedStorageProductKeys.includes(productCollapseKey)
                                    const displaySizeGroups = product.displaySizeGroups || product.sizeGroups
                                    const detailCount = displaySizeGroups.reduce((sum, sizeGroup) => sum + Number((sizeGroup.displayDetails || sizeGroup.details).length || 0), 0)

                                    return (
                                      <Fragment key={productCollapseKey}>
                                        <tr className={styles.storageProductRow}>
                                          <td>
                                            <button
                                              type="button"
                                              className={styles.storageTextToggle}
                                              onClick={() => toggleStorageProductGroup(productCollapseKey)}
                                              aria-expanded={!isProductCollapsed}
                                            >
                                              <span>{isProductCollapsed ? '+' : '-'}</span>
                                              <span className={styles.storageProductName}>{product.productName}</span>
                                              <small>{product.skuInduk || '-'}</small>
                                            </button>
                                          </td>
                                          <td className={styles.centerNumberCell}><strong>{displaySizeGroups.reduce((sum, sizeGroup) => sum + Number(sizeGroup.qty || 0), 0)}</strong></td>
                                          <td className={styles.centerNumberCell}>{displaySizeGroups.length}</td>
                                          <td className={styles.centerNumberCell}>{detailCount}</td>
                                        </tr>
                                        {!isProductCollapsed ? (
                                          <tr className={styles.storageNestedRow}>
                                            <td colSpan={4}>
                                              <table className={`${styles.table} ${styles.storageSizeTable}`.trim()}>
                                                <thead>
                                                  <tr>
                                                    <th>Size</th>
                                                    <th className={styles.centerNumberCell}>Stored Qty</th>
                                                    <th className={styles.centerNumberCell}>Reject Details</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {displaySizeGroups.map((sizeGroup) => {
                                                    const sizeCollapseKey = `${productCollapseKey}::${sizeGroup.key}`
                                                    const isSizeCollapsed = !collapsedStorageProductKeys.includes(sizeCollapseKey)
                                                    const displayDetails = sizeGroup.displayDetails || sizeGroup.details

                                                    return (
                                                      <Fragment key={sizeCollapseKey}>
                                                        <tr className={styles.storageSizeRow}>
                                                          <td>
                                                            <button
                                                              type="button"
                                                              className={styles.storageTextToggle}
                                                              onClick={() => toggleStorageProductGroup(sizeCollapseKey)}
                                                              aria-expanded={!isSizeCollapsed}
                                                            >
                                                              <span>{isSizeCollapsed ? '+' : '-'}</span>
                                                              <strong>{sizeGroup.size}</strong>
                                                            </button>
                                                          </td>
                                                          <td className={styles.centerNumberCell}><strong>{sizeGroup.qty}</strong></td>
                                                          <td className={styles.centerNumberCell}>{displayDetails.length}</td>
                                                        </tr>
                                                        {!isSizeCollapsed ? (
                                                          <tr className={styles.storageNestedRow}>
                                                            <td colSpan={3}>
                                                              <table className={`${styles.table} ${styles.storageDetailTable}`.trim()}>
                                                                <thead>
                                                                  <tr>
                                                                    <th>PO Info</th>
                                                                    <th>Source</th>
                                                                    <th>Grade</th>
                                                                    <th>Reject Reason</th>
                                                                    <th className={styles.centerNumberCell}>Qty</th>
                                                                  </tr>
                                                                </thead>
                                                                <tbody>
                                                                  {displayDetails.map((detail) => (
                                                                    <tr key={detail.rowKey}>
                                                                      <td>{detail.poLabel}</td>
                                                                      <td>{formatStorageSourceType(detail.sourceType, detail.inventorySource, detail.stockAppliedAt)}</td>
                                                                      <td>{detail.grade || '-'}</td>
                                                                      <td>{detail.reasonName}</td>
                                                                      <td className={styles.centerNumberCell}>{detail.qty}</td>
                                                                    </tr>
                                                                  ))}
                                                                </tbody>
                                                              </table>
                                                            </td>
                                                          </tr>
                                                        ) : null}
                                                      </Fragment>
                                                    )
                                                  })}
                                                </tbody>
                                              </table>
                                            </td>
                                          </tr>
                                        ) : null}
                                      </Fragment>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}
        </div>
      </div>
      {returnModalOpen ? (
        <div className={styles.overlay} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-return-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="create-return-title">Create Arkline Return</h2>
                <p>{selectedRows.length} reject line(s) selected. Different products will be split into separate return batches.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeReturnModal} aria-label="Close">X</button>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="return-date">Return Date</label>
                <input id="return-date" className={styles.input} type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="shipping-method">Shipping Method</label>
                <input id="shipping-method" className={styles.input} value={shippingMethod} onChange={(event) => setShippingMethod(event.target.value)} placeholder="Courier or vehicle" />
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label htmlFor="return-notes">Notes</label>
                <textarea id="return-notes" className={styles.textarea} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
            </div>
            <div className={styles.lineList}>
              {selectedRows.map((row) => (
                <div key={row.id} className={styles.lineRow}>
                  <div className={styles.lineName}>
                    <strong>{row.reasonName}</strong>
                    Grade {row.grade} / Size {row.size} / Available {row.availableQty}
                  </div>
                  <span className={`${styles.badge} ${styles.lineBadge} ${row.isRepairable ? styles.badgeRepairable : ''}`}>
                    {row.isRepairable ? 'Repairable' : 'Non-repairable'}
                  </span>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    max={row.availableQty}
                    value={returnQtyById[row.id] ?? row.availableQty}
                    onChange={(event) => setReturnQtyById((current) => ({ ...current, [row.id]: event.target.value }))}
                    aria-label={`Return qty for ${row.reasonName}`}
                  />
                </div>
              ))}
            </div>
            <div className={styles.modalSummaryBox}>
              <div className={styles.modalSummaryTotal}>
                Total qty to return: <strong>{selectedQty}</strong>
              </div>
              <div className={styles.modalSummaryGroup}>
                <span>Per size</span>
                <div className={styles.sizeChipRow}>
                  {selectedSummary.sizes.length ? selectedSummary.sizes.map((item) => (
                    <span key={item.size} className={styles.sizeChip}>{item.size}: <strong>{item.qty}</strong></span>
                  )) : <span className={styles.sizeChip}>No selected qty</span>}
                </div>
              </div>
              <div className={styles.modalSummaryGroup}>
                <span>Per grade</span>
                <div className={styles.sizeChipRow}>
                  {selectedSummary.grades.length ? selectedSummary.grades.map((item) => (
                    <span key={item.grade} className={styles.sizeChip}>Grade {item.grade}: <strong>{item.qty}</strong></span>
                  )) : <span className={styles.sizeChip}>No selected qty</span>}
                </div>
              </div>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeReturnModal} disabled={saving}>Cancel</button>
              <button type="button" className={styles.primaryButton} onClick={saveReturnBatch} disabled={saving}>{saving ? 'Saving...' : 'Save Return Batch'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {registrationModalOpen ? createPortal(
        <div className={styles.overlay} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="item-registration-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="item-registration-title">Item Registration</h2>
                <p>Register Arkline reject into a reject storage koli.</p>
              </div>
              <div className={styles.modalIconActions}>
                <button type="button" className={styles.iconSaveButton} onClick={saveRegistrationStorageItem} disabled={saving} aria-label="Save item">✓</button>
                <button type="button" className={`${styles.closeButton} ${styles.dangerCloseButton}`.trim()} onClick={closeRegistrationModal} aria-label="Close">X</button>
              </div>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="registration-storage-number">Storage Number</label>
                <input
                  id="registration-storage-number"
                  className={styles.input}
                  value={registrationDraft.storageNumber}
                  onChange={(event) => updateRegistrationDraft({ storageNumber: event.target.value.toUpperCase() })}
                  placeholder="Storage number"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="registration-storage-date">Storage Date</label>
                <input
                  id="registration-storage-date"
                  className={styles.input}
                  type="date"
                  value={registrationDraft.storageDate}
                    onChange={(event) => updateRegistrationDraft({ storageDate: event.target.value, sourceId: '' })}
                />
              </div>
              <div
                className={`${styles.field} ${styles.fieldFull} ${styles.registrationProductField}`}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setRegistrationProductOpen(false)
                }}
              >
                <label htmlFor="registration-product">Arkline Product</label>
                <input
                  id="registration-product"
                  className={styles.input}
                  value={registrationDraft.productSearch}
                  onChange={(event) => handleRegistrationProductSearchChange(event.target.value)}
                  onFocus={() => setRegistrationProductOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setRegistrationProductOpen(false)
                    if (event.key === 'ArrowDown' && registrationProductMatches.length) {
                      event.preventDefault()
                      setRegistrationProductOpen(true)
                      setRegistrationProductCursor((current) => (current + 1) % registrationProductMatches.length)
                    }
                    if (event.key === 'ArrowUp' && registrationProductMatches.length) {
                      event.preventDefault()
                      setRegistrationProductOpen(true)
                      setRegistrationProductCursor((current) => (current - 1 + registrationProductMatches.length) % registrationProductMatches.length)
                    }
                    if (event.key === 'Enter' && registrationProductOpen && registrationProductMatches.length) {
                      event.preventDefault()
                      selectRegistrationProduct(registrationProductMatches[Math.max(0, registrationProductCursor)])
                    }
                  }}
                  placeholder="Type or choose Arkline product"
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={registrationProductOpen}
                  aria-controls="registration-product-options"
                />
                {registrationProductOpen && registrationProductMatches.length ? (
                  <div id="registration-product-options" className={styles.registrationProductOptions} role="listbox" aria-label="Arkline products">
                    {registrationProductMatches.map((product, index) => (
                      <button
                        key={product.id}
                        type="button"
                        role="option"
                        aria-selected={index === registrationProductCursor}
                        className={`${styles.registrationProductOption} ${index === registrationProductCursor ? styles.registrationProductOptionActive : ''}`.trim()}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectRegistrationProduct(product)}
                      >
                        <span>{product.productName}</span>
                        <small>{product.skuInduk}</small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={styles.field}>
                <label htmlFor="registration-sku">SKU</label>
                <input id="registration-sku" className={styles.input} value={selectedRegistrationProduct?.skuInduk || ''} readOnly placeholder="Auto" />
              </div>
              <div className={styles.field}>
                <label htmlFor="registration-size">Size</label>
                <select
                  id="registration-size"
                  className={styles.input}
                  value={registrationDraft.size}
                  onChange={(event) => updateRegistrationDraft({ size: event.target.value, sourceId: '' })}
                >
                  <option value="">Choose size</option>
                  {REGISTRATION_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label>Reject From</label>
                <div className={styles.registrationSourceToggle} role="group" aria-label="Reject source">
                  {[
                    ['SHELVING', 'Shelving'],
                    ['PALLET_RESTOCK', 'Restock Pallet'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.storageModeButton} ${registrationDraft.inventorySource === value ? styles.storageModeButtonActive : ''}`.trim()}
                      aria-pressed={registrationDraft.inventorySource === value}
                      onClick={() => updateRegistrationDraft({ inventorySource: value, sourceId: '' })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {registrationDraft.inventorySource && registrationNeedsSourceChoice ? (
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label htmlFor="registration-source-location">{registrationDraft.inventorySource === 'SHELVING' ? 'Shelving Location' : 'Restock For'}</label>
                  <select
                    id="registration-source-location"
                    className={styles.input}
                    value={registrationDraft.sourceId}
                    onChange={(event) => updateRegistrationDraft({ sourceId: event.target.value })}
                    disabled={registrationSourcesLoading || Boolean(registrationSourcesError)}
                  >
                    <option value="">Choose source</option>
                    {eligibleRegistrationSources.map((option) => (
                      <option key={option.id} value={option.id}>{option.label} / {option.qty} available</option>
                    ))}
                  </select>
                </div>
              ) : null}
              {registrationDraft.inventorySource && selectedRegistrationProduct && registrationDraft.size && (registrationSourcesError || registrationSourcesLoading || !eligibleRegistrationSources.length) ? (
                <div className={`${styles.field} ${styles.fieldFull}`} aria-live="polite">
                  {registrationSourcesError ? <span className={styles.registrationSourceError}>{registrationSourcesError}</span> : null}
                  {!registrationSourcesError && registrationSourcesLoading ? <span className={styles.registrationSourceHint}>Checking available source...</span> : null}
                  {canUseUntrackedShelving ? (
                    <span className={styles.registrationSourceHint}>Shelving stock is not registered yet. This reject can be saved without deducting stock; reconcile the shelving record separately.</span>
                  ) : null}
                  {!registrationSourcesError && !registrationSourcesLoading && !eligibleRegistrationSources.length && !canUseUntrackedShelving ? (
                    <span className={styles.registrationSourceError}>No matching {registrationDraft.inventorySource === 'SHELVING' ? 'shelving stock' : 'pallet restock completed on this Storage Date'} has enough quantity.</span>
                  ) : null}
                </div>
              ) : null}
              <div className={styles.field}>
                <label htmlFor="registration-reason">Reject Reason</label>
                <input
                  id="registration-reason"
                  className={styles.input}
                  value={registrationDraft.rejectReasonSearch}
                  onChange={(event) => handleRegistrationReasonSearchChange(event.target.value)}
                  placeholder="Type or choose reject reason"
                  list="registration-reason-options"
                />
                <datalist id="registration-reason-options">
                  {rejectReasons.map((reason) => <option key={reason.id} value={getRegistrationReasonLabel(reason)} />)}
                </datalist>
              </div>
              <div className={styles.field}>
                <label htmlFor="registration-qty">Qty</label>
                <input
                  id="registration-qty"
                  className={styles.input}
                  type="number"
                  min="1"
                  step="1"
                  value={registrationDraft.qty}
                  onChange={(event) => updateRegistrationDraft({ qty: event.target.value, sourceId: '' })}
                  placeholder="0"
                />
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label htmlFor="registration-notes">Notes</label>
                <textarea id="registration-notes" className={styles.textarea} value={registrationDraft.notes} onChange={(event) => updateRegistrationDraft({ notes: event.target.value })} />
              </div>
            </div>
            {selectedRegistrationProduct ? (
              <div className={styles.modalSummaryBox}>
                <div className={styles.modalSummaryTotal}>
                  {selectedRegistrationProduct.productName} / <strong>{selectedRegistrationProduct.skuInduk || '-'}</strong>
                </div>
              </div>
            ) : null}
            {error ? <p className={styles.error}>{error}</p> : null}
          </div>
        </div>,
        document.body
      ) : null}
      {storageModalOpen ? (
        <div className={styles.overlay} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-storage-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="create-storage-title">Move to Reject Storage</h2>
                <p>{selectedRows.length} reject line(s) selected. Multiple PO products will be split into separate storage batches.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeStorageModal} aria-label="Close">X</button>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="storage-number">Storage Number</label>
                <input
                  id="storage-number"
                  className={styles.input}
                  value={storageNumber}
                  onChange={(event) => setStorageNumber(event.target.value.toUpperCase())}
                  placeholder="Storage number"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="storage-date">Storage Date</label>
                <input id="storage-date" className={styles.input} type="date" value={storageDate} onChange={(event) => setStorageDate(event.target.value)} />
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label htmlFor="storage-notes">Notes</label>
                <textarea id="storage-notes" className={styles.textarea} value={storageNotes} onChange={(event) => setStorageNotes(event.target.value)} />
              </div>
            </div>
            <div className={styles.lineList}>
              {selectedRows.map((row) => (
                <div key={row.id} className={styles.lineRow}>
                  <div className={styles.lineName}>
                    <strong>{row.reasonName}</strong>
                    Grade {row.grade} / Size {row.size} / Available {row.availableQty}
                  </div>
                  <span className={`${styles.badge} ${styles.lineBadge} ${row.isRepairable ? styles.badgeRepairable : ''}`}>
                    {row.isRepairable ? 'Repairable' : 'Non-repairable'}
                  </span>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    max={row.availableQty}
                    value={returnQtyById[row.id] ?? row.availableQty}
                    onChange={(event) => setReturnQtyById((current) => ({ ...current, [row.id]: event.target.value }))}
                    aria-label={`Storage qty for ${row.reasonName}`}
                  />
                </div>
              ))}
            </div>
            <div className={styles.modalSummaryBox}>
              <div className={styles.modalSummaryTotal}>
                Total qty to storage: <strong>{selectedQty}</strong>
              </div>
              <div className={styles.modalSummaryGroup}>
                <span>Per size</span>
                <div className={styles.sizeChipRow}>
                  {selectedSummary.sizes.length ? selectedSummary.sizes.map((item) => (
                    <span key={item.size} className={styles.sizeChip}>{item.size}: <strong>{item.qty}</strong></span>
                  )) : <span className={styles.sizeChip}>No selected qty</span>}
                </div>
              </div>
              <div className={styles.modalSummaryGroup}>
                <span>Per grade</span>
                <div className={styles.sizeChipRow}>
                  {selectedSummary.grades.length ? selectedSummary.grades.map((item) => (
                    <span key={item.grade} className={styles.sizeChip}>Grade {item.grade}: <strong>{item.qty}</strong></span>
                  )) : <span className={styles.sizeChip}>No selected qty</span>}
                </div>
              </div>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeStorageModal} disabled={saving}>Cancel</button>
              <button type="button" className={styles.primaryButton} onClick={saveStorageBatch} disabled={saving}>{saving ? 'Saving...' : 'Save Storage Batch'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {receiptBatch ? (
        <div className={styles.overlay} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="receipt-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="receipt-title">Record Returned Goods</h2>
                <p>{receiptBatch.returnNumber} becomes Re-QC Round {Number(receiptBatch.roundNumber || 1) + 1}.</p>
              </div>
              <div className={styles.modalHeaderActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={openSizeCorrectionModal}
                  disabled={!canEdit || saving || !correctableSizeLines.length}
                >
                  Size Correction
                </button>
                <button type="button" className={styles.closeButton} onClick={closeReceiptModal} aria-label="Close">X</button>
              </div>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="receipt-date">Receive Date</label>
                <input id="receipt-date" className={styles.input} type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label htmlFor="receipt-notes">Receiving Notes</label>
                <textarea id="receipt-notes" className={styles.textarea} value={receiptNotes} onChange={(event) => setReceiptNotes(event.target.value)} />
              </div>
            </div>
            <div className={styles.lineList}>
              {receiptSummary.sizeRows.map((sizeRow) => {
                const sizeKey = getReceiptSizeKey(sizeRow.size)
                return (
                  <div key={sizeKey} className={styles.lineRow}>
                    <div className={styles.lineName}>
                      <strong>Size {sizeRow.size}</strong>
                      Sent {sizeRow.sentQty} / Returned {sizeRow.receivedQty} / Remaining {sizeRow.remainingQty}
                      {sizeRow.correctionInQty || sizeRow.correctionOutQty ? (
                        <span className={styles.lineHint}>
                          Correction +{sizeRow.correctionInQty} / -{sizeRow.correctionOutQty}
                        </span>
                      ) : null}
                    </div>
                    <span className={`${styles.badge} ${styles.lineBadge}`}>Remaining {sizeRow.remainingQty}</span>
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      max={sizeRow.remainingQty}
                      value={receiptQtyById[sizeKey] || ''}
                      onChange={(event) => setReceiptQtyById((current) => ({ ...current, [sizeKey]: event.target.value }))}
                      disabled={sizeRow.remainingQty === 0}
                      aria-label={`Received qty for size ${sizeRow.size}`}
                    />
                  </div>
                )
              })}
            </div>
            <div className={styles.modalSummaryBox}>
              <div className={styles.modalSummaryTotal}>
                Total Qty: <strong>{receiptInputSummary.total}</strong>
              </div>
              <div className={styles.modalSummaryGroup}>
                <span>Qty per size</span>
                <div className={styles.sizeChipRow}>
                  {receiptInputSummary.sizes.length ? receiptInputSummary.sizes.map((item) => (
                    <span key={item.size} className={styles.sizeChip}>{item.size}: <strong>{item.qty}</strong></span>
                  )) : <span className={styles.sizeChip}>No returned qty entered</span>}
                </div>
              </div>
            </div>
            {receiptBatch.lines.some((line) => line.corrections?.length) ? (
              <div className={styles.correctionList}>
                <span>Size correction history</span>
                {(receiptBatch.lines || []).flatMap((line) => (line.corrections || []).map((correction) => (
                  <div key={correction.id} className={styles.correctionRow}>
                    <strong>{correction.fromSize} to {correction.toSize}</strong>
                    <span>{correction.qty} pcs</span>
                    <small>{correction.notes || 'No notes'}</small>
                  </div>
                )))}
              </div>
            ) : null}
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeReceiptModal} disabled={saving}>Cancel</button>
              <button type="button" className={styles.primaryButton} onClick={saveReworkReceipt} disabled={saving}>{saving ? 'Saving...' : 'Save Returned Goods'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {sizeCorrectionOpen && receiptBatch ? (
        <div className={styles.overlay} role="presentation">
          <div className={`${styles.modal} ${styles.sizeCorrectionModal}`.trim()} role="dialog" aria-modal="true" aria-labelledby="size-correction-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="size-correction-title">Size Correction</h2>
                <p>Move returned qty from the sent size into the physically correct size.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeSizeCorrectionModal} aria-label="Close">X</button>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="size-correction-from">From Size</label>
                <select
                  id="size-correction-from"
                  className={styles.input}
                  value={sizeCorrectionDraft.fromLineId}
                  onChange={(event) => {
                    setSizeCorrectionDraft((current) => ({ ...current, fromLineId: event.target.value, toSize: '', qty: '' }))
                    setError('')
                  }}
                >
                  {correctableSizeLines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.size} - available {line.correctableQty}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="size-correction-to">Correct Size</label>
                <select
                  id="size-correction-to"
                  className={styles.input}
                  value={sizeCorrectionDraft.toSize}
                  onChange={(event) => {
                    setSizeCorrectionDraft((current) => ({ ...current, toSize: event.target.value }))
                    setError('')
                  }}
                >
                  <option value="">Choose size</option>
                  {correctionToSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="size-correction-qty">Qty</label>
                <input
                  id="size-correction-qty"
                  className={styles.input}
                  type="number"
                  min="1"
                  max={selectedCorrectionLine?.correctableQty || 1}
                  value={sizeCorrectionDraft.qty}
                  onChange={(event) => {
                    const maxQty = Number(selectedCorrectionLine?.correctableQty || 0)
                    const value = Number(event.target.value || 0)
                    setSizeCorrectionDraft((current) => ({ ...current, qty: value > maxQty ? String(maxQty) : event.target.value }))
                    setError('')
                  }}
                  placeholder="0"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="size-correction-notes">Notes</label>
                <input
                  id="size-correction-notes"
                  className={styles.input}
                  value={sizeCorrectionDraft.notes}
                  onChange={(event) => setSizeCorrectionDraft((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
            {selectedCorrectionLine ? (
              <p className={styles.notice}>
                Available to correct from size {selectedCorrectionLine.size}: {selectedCorrectionLine.correctableQty} pcs.
              </p>
            ) : null}
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeSizeCorrectionModal} disabled={saving}>Cancel</button>
              <button type="button" className={styles.primaryButton} onClick={saveSizeCorrection} disabled={saving}>{saving ? 'Saving...' : 'Save Correction'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
