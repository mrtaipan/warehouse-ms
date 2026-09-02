'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
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

function getStatusBadgeClass(status) {
  const normalized = String(status || 'SENT').toUpperCase()
  if (normalized === 'FULLY_RETURNED') return styles.badgeCompleted
  if (normalized === 'PARTIALLY_RETURNED') return styles.badgeWarning
  if (normalized === 'CLOSED_SHORT') return styles.badgeDanger
  return ''
}

function normalizeSize(value) {
  const size = String(value || '').trim().toUpperCase()
  return size || 'NO SIZE'
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

export default function ArklineReturReportClient({ eligibleRows, batches, userEmail, canAdd = false, canEdit = false }) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedIds, setSelectedIds] = useState([])
  const [activeReturnTab, setActiveReturnTab] = useState('arrangement')
  const [repairabilityFilter, setRepairabilityFilter] = useState('all')
  const [rejectReasonFilter, setRejectReasonFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [poFilter, setPoFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [progressPoFilter, setProgressPoFilter] = useState('')
  const [progressProductFilter, setProgressProductFilter] = useState('')
  const [progressRejectReasonFilter, setProgressRejectReasonFilter] = useState('')
  const [progressStatusFilter, setProgressStatusFilter] = useState('')
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [receiptBatch, setReceiptBatch] = useState(null)
  const [returnDate, setReturnDate] = useState(todayValue())
  const [shippingMethod, setShippingMethod] = useState('')
  const [notes, setNotes] = useState('')
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
    const matchesPo = ignoredFilter === 'po' || !poFilter || row.poId === poFilter
    const matchesProduct = ignoredFilter === 'product' || !productFilter || row.modelName === productFilter

    return matchesRepairability && matchesRejectReason && matchesSize && matchesGrade && matchesPo && matchesProduct
  }, [gradeFilter, poFilter, productFilter, rejectReasonFilter, repairabilityFilter, sizeFilter])

  const poOptions = useMemo(
    () =>
      Array.from(new Set(eligibleRows.filter((row) => matchesArrangementFilters(row, 'po')).map((row) => row.poId).filter(Boolean))).sort((a, b) =>
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
            const matchesProduct = !progressProductFilter || batch.modelName === progressProductFilter
            const matchesRejectReason =
              !progressRejectReasonFilter ||
              batch.lines.some((line) => String(line.reasonId || line.reasonName || '').trim() === progressRejectReasonFilter)
            const matchesStatus = !progressStatusFilter || String(batch.status || 'SENT') === progressStatusFilter
            return matchesProduct && matchesRejectReason && matchesStatus
          })
          .map((batch) => batch.poId)
          .filter(Boolean)
      )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [batches, progressProductFilter, progressRejectReasonFilter, progressStatusFilter]
  )
  const progressProductOptions = useMemo(() => {
    const source = batches.filter((batch) => {
      const matchesPo = !progressPoFilter || batch.poId === progressPoFilter
      const matchesRejectReason =
        !progressRejectReasonFilter ||
        batch.lines.some((line) => String(line.reasonId || line.reasonName || '').trim() === progressRejectReasonFilter)
      const matchesStatus = !progressStatusFilter || String(batch.status || 'SENT') === progressStatusFilter
      return matchesPo && matchesRejectReason && matchesStatus
    })
    return Array.from(new Set(source.map((batch) => batch.modelName).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [batches, progressPoFilter, progressRejectReasonFilter, progressStatusFilter])
  const progressRejectReasonOptions = useMemo(() => {
    const source = batches.filter((batch) => {
      const matchesPo = !progressPoFilter || batch.poId === progressPoFilter
      const matchesProduct = !progressProductFilter || batch.modelName === progressProductFilter
      const matchesStatus = !progressStatusFilter || String(batch.status || 'SENT') === progressStatusFilter
      return matchesPo && matchesProduct && matchesStatus
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
  }, [batches, progressPoFilter, progressProductFilter, progressStatusFilter])
  const progressStatusOptions = useMemo(() => {
    const source = batches.filter((batch) => {
      const matchesPo = !progressPoFilter || batch.poId === progressPoFilter
      const matchesProduct = !progressProductFilter || batch.modelName === progressProductFilter
      const matchesRejectReason =
        !progressRejectReasonFilter ||
        batch.lines.some((line) => String(line.reasonId || line.reasonName || '').trim() === progressRejectReasonFilter)
      return matchesPo && matchesProduct && matchesRejectReason
    })
    return Array.from(new Set(source.map((batch) => String(batch.status || 'SENT')).filter(Boolean))).sort((a, b) =>
      formatStatus(a).localeCompare(formatStatus(b), undefined, { numeric: true })
    )
  }, [batches, progressPoFilter, progressProductFilter, progressRejectReasonFilter])
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
        const matchesProduct = !progressProductFilter || batch.modelName === progressProductFilter
        const matchesRejectReason =
          !progressRejectReasonFilter ||
          batch.lines.some((line) => String(line.reasonId || line.reasonName || '').trim() === progressRejectReasonFilter)
        const matchesStatus = !progressStatusFilter || String(batch.status || 'SENT') === progressStatusFilter
        return matchesPo && matchesProduct && matchesRejectReason && matchesStatus
      }),
    [batches, progressPoFilter, progressProductFilter, progressRejectReasonFilter, progressStatusFilter]
  )
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
      const key = `${row.poItemId || row.poId}-${row.qcCycleId || row.id}`
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
        p_po_id: first.poId,
        p_arkline_po_item_id: first.poItemId,
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
      <div className={styles.subPageTabsPage}>
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

        <div className={styles.subPageTabsPanel}>
          {activeReturnTab === 'arrangement' ? (
      <section className={`${styles.card} ${styles.subPageCard}`.trim()}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Arkline</p>
            <h2 className={styles.sectionTitle}>Return Arrangement</h2>
          </div>
          <button type="button" className={styles.primaryButton} onClick={openReturnModal} disabled={!canAdd || !selectedRows.length}>
            Create Return Batch
          </button>
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
              {poOptions.map((po) => <option key={po} value={po}>{po}</option>)}
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

        {error && !returnModalOpen && !receiptBatch ? <p className={styles.error}>{error}</p> : null}

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
                    <td>{row.poId}</td>
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

        <div className={styles.filterGrid}>
          <div className={styles.field}>
            <label htmlFor="return-progress-po-filter">PO</label>
            <select
              id="return-progress-po-filter"
              className={styles.input}
              value={progressPoFilter}
              onChange={(event) => {
                setProgressPoFilter(event.target.value)
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
        </div>
      </div>

      {returnModalOpen ? (
        <div className={styles.overlay} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-return-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="create-return-title">Create Arkline Return</h2>
                <p>{selectedRows.length} reject line(s) selected. Multiple PO products will be split into separate return batches.</p>
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
