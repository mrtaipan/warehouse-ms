const REJECTION_GRADES = ['A', 'B', 'C']

function sourceKey(row, grade) {
  return [
    Number(row.brand_id || 0),
    Number(row.category_id || 0),
    String(row.model_name || '').trim().toUpperCase(),
    String(row.variant_name || row.model_color || '').trim().toUpperCase(),
    grade,
  ].join('::')
}

function isTemporarySampleTask(row) {
  if (!row.inbound_unload?.is_sample) return false
  if (row.inbound_unload.is_product_temporary) return true

  const model = String(row.model_name || row.inbound_unload.model_name || '').trim().toUpperCase()
  const variant = String(row.variant_name || row.inbound_unload.variant_name || '').trim().toUpperCase()
  return ['', 'SAMPLE', 'TEMPORARY', 'TEMPORARY SAMPLE'].includes(model) ||
    ['', 'SAMPLE', 'TEMPORARY'].includes(variant)
}

export function getGrnRejectionRemaining({
  qcRows = [],
  qcSampleRows = [],
  sampleBreakdownRows = [],
  qcConfirmRows = [],
  returnRows = [],
} = {}) {
  const sampleRowsById = new Map(sampleBreakdownRows.map((row) => [Number(row.id), row]))
  const sampleResolutionByUnload = new Map()
  const qcRowsById = new Map(qcRows.map((row) => [Number(row.id), row]))
  const sourceByKey = new Map()

  for (const row of sampleBreakdownRows) {
    const unloadId = Number(row.inbound_unload_id || 0)
    if (!unloadId) continue
    const current = sampleResolutionByUnload.get(unloadId) || { total: 0, fullReturn: 0 }
    current.total += 1
    if (String(row.resolution_status || '').trim().toLowerCase() === 'full_return') current.fullReturn += 1
    sampleResolutionByUnload.set(unloadId, current)
  }

  const fullReturnSampleIds = new Set(
    [...sampleResolutionByUnload.entries()]
      .filter(([, state]) => state.total > 0 && state.fullReturn === state.total)
      .map(([unloadId]) => unloadId)
  )

  function addSource(row, grade, value) {
    const qty = Number(value || 0)
    if (!Number.isFinite(qty) || qty <= 0) return
    const key = sourceKey(row, grade)
    const current = sourceByKey.get(key) || { grade, source: 0, processed: 0 }
    current.source += qty
    sourceByKey.set(key, current)
  }

  function addProcessed(row, grade, value) {
    const qty = Number(value || 0)
    const current = sourceByKey.get(sourceKey(row, grade))
    if (!current || !Number.isFinite(qty) || qty <= 0) return
    current.processed += qty
  }

  for (const row of qcRows) {
    if (String(row.status || '').toLowerCase() !== 'done') continue
    const unloadId = Number(row.inbound_unload_id || row.inbound_unload?.id || 0)
    const fullReturnSample = Boolean(row.inbound_unload?.is_sample && fullReturnSampleIds.has(unloadId))
    if (!fullReturnSample && isTemporarySampleTask(row)) continue

    const source = {
      brand_id: row.product_model?.brand_id || row.inbound_unload?.brand_id,
      category_id: row.product_model?.category_id || row.inbound_unload?.category_id,
      model_name: row.model_name,
      variant_name: row.variant_name,
    }
    if (fullReturnSample) addSource(source, 'A', row.qty_a)
    addSource(source, 'B', row.qty_b)
    addSource(source, 'C', row.qty_c)
  }

  for (const row of qcSampleRows) {
    const qcRow = qcRowsById.get(Number(row.qc_item_id))
    const sampleRow = sampleRowsById.get(Number(row.sample_breakdown_id))
    if (!qcRow || !sampleRow || String(qcRow.status || '').toLowerCase() !== 'done') continue
    if (fullReturnSampleIds.has(Number(sampleRow.inbound_unload_id || 0))) continue
    addSource(sampleRow, 'B', row.qty_b)
    addSource(sampleRow, 'C', row.qty_c)
  }

  for (const row of qcConfirmRows) {
    const grade = String(row.grade || '').trim().toUpperCase()
    const isTransfer = Boolean(row.is_adjustment) && String(row.adjustment_type || '').trim().toUpperCase() === 'TRANSFER'
    if (!['B', 'C'].includes(grade) && !isTransfer) continue
    addProcessed(row, String(row.source_grade || row.grade || '').trim().toUpperCase(), row.qty)
  }

  for (const row of returnRows) {
    if (String(row.source_phase || '').trim().toLowerCase() !== 'qc') continue
    addProcessed(row, String(row.grade || '').trim().toUpperCase(), row.qty)
  }

  const byGrade = Object.fromEntries(REJECTION_GRADES.map((grade) => [grade, 0]))
  for (const row of sourceByKey.values()) {
    byGrade[row.grade] += Math.max(0, row.source - row.processed)
  }

  return {
    byGrade,
    total: REJECTION_GRADES.reduce((sum, grade) => sum + byGrade[grade], 0),
  }
}
