function normalizeQty(value) {
  const quantity = Number(value || 0)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0
}

function getDetailKey(row = {}) {
  const grade = String(row.grade || 'B').trim().toUpperCase()
  const reasonId = String(row.reject_reason_id || '').trim()
  const size = String(row.size || '').trim().toUpperCase()
  return `${grade}|||${reasonId}|||${size}`
}

export function buildArklineRejectDetailUsage(details = [], returnLines = [], storageLines = []) {
  const detailById = new Map(details.filter((detail) => detail?.id).map((detail) => [String(detail.id), detail]))
  const usedQtyByDetailId = new Map()

  for (const line of [...returnLines, ...storageLines]) {
    const detailId = String(line?.reject_detail_id || '')
    if (!detailById.has(detailId)) continue
    usedQtyByDetailId.set(detailId, (usedQtyByDetailId.get(detailId) || 0) + normalizeQty(line.qty))
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

  return { usedQtyByDetailId, usedQtyByKey, usedQtyByTaskGrade }
}
