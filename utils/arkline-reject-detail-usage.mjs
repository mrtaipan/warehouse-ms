function normalizeQty(value) {
  const quantity = Number(value || 0)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0
}

function getDetailKey(row = {}) {
  const grade = String(row.grade || 'B').trim().toUpperCase()
  const reasonId = String(row.rejectReasonId || row.reject_reason_id || '').trim()
  const size = String(row.size || '').trim().toUpperCase()
  return `${grade}|||${reasonId}|||${size}`
}

export function mergeArklineRejectDraftRows(rows = []) {
  const grouped = new Map()

  for (const row of rows) {
    const key = getDetailKey(row)
    const current = grouped.get(key)
    if (current) {
      current.qty += normalizeQty(row.qty)
    } else {
      grouped.set(key, { ...row, qty: normalizeQty(row.qty) })
    }
  }

  return [...grouped.values()]
}

export function clampArklineRejectDraftQty(value, usedQty) {
  return String(Math.max(normalizeQty(value), normalizeQty(usedQty)))
}

export function getArklineRejectUsageBreakdown(qty, returnQty, storageQty) {
  const totalQty = normalizeQty(qty)
  const sentQty = Math.min(totalQty, normalizeQty(returnQty))
  const storedQty = Math.min(totalQty - sentQty, normalizeQty(storageQty))
  return { sentQty, storedQty, processedQty: sentQty + storedQty, availableQty: totalQty - sentQty - storedQty }
}

export function buildArklineRejectDetailUsage(details = [], returnLines = [], storageLines = []) {
  const detailById = new Map(details.filter((detail) => detail?.id).map((detail) => [String(detail.id), detail]))
  const usedQtyByDetailId = new Map()
  const sentQtyByKey = new Map()
  const storedQtyByKey = new Map()

  for (const [lines, qtyByKey] of [[returnLines, sentQtyByKey], [storageLines, storedQtyByKey]]) {
    for (const line of lines) {
      const detailId = String(line?.reject_detail_id || '')
      const detail = detailById.get(detailId)
      if (!detail) continue
      const qty = normalizeQty(line.qty)
      const key = getDetailKey(detail)
      usedQtyByDetailId.set(detailId, (usedQtyByDetailId.get(detailId) || 0) + qty)
      qtyByKey.set(key, (qtyByKey.get(key) || 0) + qty)
    }
  }

  const usedQtyByKey = new Map()
  const usedQtyByTaskGrade = new Map()

  for (const [detailId, usedQty] of usedQtyByDetailId) {
    const detail = detailById.get(detailId)
    const detailKey = getDetailKey(detail)
    const taskGradeKey = `${detail.arkline_qc_id || ''}|||${String(detail.grade || '').trim().toUpperCase()}`
    usedQtyByKey.set(detailKey, (usedQtyByKey.get(detailKey) || 0) + usedQty)
    usedQtyByTaskGrade.set(taskGradeKey, (usedQtyByTaskGrade.get(taskGradeKey) || 0) + usedQty)
  }

  return { usedQtyByDetailId, usedQtyByKey, usedQtyByTaskGrade, sentQtyByKey, storedQtyByKey }
}
