export const INBOUND_OVERVIEW_STATUS = {
  COMPLETE: 'complete',
  READY: 'ready',
  FULL_RETURN: 'full_return',
}

function asNumber(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function addToMap(map, key, amount) {
  const safeKey = Number(key || 0)
  if (!safeKey) return
  map.set(safeKey, (map.get(safeKey) || 0) + asNumber(amount))
}

function assertNoError(result) {
  if (result?.error) {
    throw new Error(result.error.message)
  }
}

export function attachInboundOverviewStatuses(rows = [], statusMap = new Map()) {
  return rows.map((row) => ({
    ...row,
    overview_status: statusMap.get(Number(row.id || row.inbound_id || 0)) || '',
  }))
}

export function buildInboundOverviewStatusMap({
  inboundIds = [],
  confirmRows = [],
  validationRows = [],
  breakdownRows = [],
  returnRows = [],
  packingRows = [],
  unloadRows = [],
} = {}) {
  const ids = Array.from(new Set(inboundIds.map((id) => Number(id || 0)).filter(Boolean)))
  const statusMap = new Map()
  const validationMap = new Map()
  const plReceivedQtyByInbound = new Map()
  const breakdownQtyByInbound = new Map()
  const plReturnQtyByInbound = new Map()
  const inboundReturnQtyByInbound = new Map()
  const packingQtyByInbound = new Map()
  const regularIntakeQtyByInbound = new Map()
  const plStatsByInbound = new Map()

  validationRows.forEach((row) => {
    const inboundId = Number(row.inbound_id || 0)
    const sequence = Number(row.source_koli_sequence || 0)
    if (!inboundId || !sequence) return
    validationMap.set(`${inboundId}::${sequence}`, true)
    addToMap(plReceivedQtyByInbound, inboundId, row.received_qty)
  })

  breakdownRows.forEach((row) => addToMap(breakdownQtyByInbound, row.inbound_id, row.qty))
  packingRows.forEach((row) => addToMap(packingQtyByInbound, row.inbound_id, row.qty))

  returnRows.forEach((row) => {
    const phase = String(row.source_phase || '').toLowerCase()
    if (phase === 'inbound') {
      addToMap(inboundReturnQtyByInbound, row.inbound_id, row.qty)
      return
    }

    if (phase === 'packing list' || phase === 'packing_list') {
      addToMap(plReturnQtyByInbound, row.inbound_id, row.qty)
    }
  })

  unloadRows.forEach((row) => {
    if (row.is_sample) return
    addToMap(regularIntakeQtyByInbound, row.inbound_id, row.qty)
  })

  confirmRows.forEach((row) => {
    const inboundId = Number(row.inbound_id || 0)
    const sequence = Number(row.koli_sequence || 0)
    if (!inboundId || !sequence) return

    const current = plStatsByInbound.get(inboundId) || {
      koliSet: new Set(),
      validatedSet: new Set(),
      qcConfirmQty: 0,
    }
    current.koliSet.add(sequence)
    current.qcConfirmQty += asNumber(row.qty)
    if (validationMap.has(`${inboundId}::${sequence}`)) {
      current.validatedSet.add(sequence)
    }
    plStatsByInbound.set(inboundId, current)
  })

  ids.forEach((inboundId) => {
    const plStats = plStatsByInbound.get(inboundId)
    const inboundReturnQty = inboundReturnQtyByInbound.get(inboundId) || 0
    const regularIntakeQty = regularIntakeQtyByInbound.get(inboundId) || 0

    if (plStats?.qcConfirmQty > 0) {
      const pendingKoli = Math.max(0, plStats.koliSet.size - plStats.validatedSet.size)
      const plReceivedQty = plReceivedQtyByInbound.get(inboundId) || 0
      const breakdownQty = breakdownQtyByInbound.get(inboundId) || 0
      const plReturnQty = plReturnQtyByInbound.get(inboundId) || 0
      const packingQty = packingQtyByInbound.get(inboundId) || 0
      const breakdownRemainingQty = plReceivedQty - breakdownQty - plReturnQty
      const storingRemainingQty = Math.max(0, breakdownQty - packingQty)
      const isBreakdownComplete = breakdownRemainingQty === 0 && pendingKoli === 0
      const isFullyReturnedFromPackingList = isBreakdownComplete && breakdownQty === 0 && plReturnQty > 0

      if (isFullyReturnedFromPackingList) {
        statusMap.set(inboundId, INBOUND_OVERVIEW_STATUS.FULL_RETURN)
        return
      }

      if (isBreakdownComplete && storingRemainingQty === 0) {
        statusMap.set(inboundId, INBOUND_OVERVIEW_STATUS.COMPLETE)
      } else if (isBreakdownComplete) {
        statusMap.set(inboundId, INBOUND_OVERVIEW_STATUS.READY)
      }
      return
    }

    if (inboundReturnQty > 0 && regularIntakeQty <= 0) {
      statusMap.set(inboundId, INBOUND_OVERVIEW_STATUS.FULL_RETURN)
    }
  })

  return statusMap
}

export async function fetchInboundOverviewStatusMap(supabase, inboundIds = []) {
  const ids = Array.from(new Set(inboundIds.map((id) => Number(id || 0)).filter(Boolean)))

  if (!ids.length) {
    return new Map()
  }

  const [
    confirmResult,
    validationResult,
    breakdownResult,
    returnResult,
    packingResult,
    unloadResult,
  ] = await Promise.all([
    supabase.from('qc_confirm').select('inbound_id, qty, koli_sequence').in('inbound_id', ids),
    supabase.from('pl_receiving').select('inbound_id, source_koli_sequence, received_qty').in('inbound_id', ids),
    supabase.from('pl_size_breakdown').select('inbound_id, qty').in('inbound_id', ids),
    supabase.from('warehouse_returns').select('inbound_id, qty, source_phase').in('inbound_id', ids),
    supabase.from('pl_packing_items').select('inbound_id, qty').in('inbound_id', ids),
    supabase.from('inbound_unload').select('inbound_id, qty, is_sample').in('inbound_id', ids),
  ])

  ;[confirmResult, validationResult, breakdownResult, returnResult, packingResult, unloadResult].forEach(assertNoError)

  return buildInboundOverviewStatusMap({
    inboundIds: ids,
    confirmRows: confirmResult.data || [],
    validationRows: validationResult.data || [],
    breakdownRows: breakdownResult.data || [],
    returnRows: returnResult.data || [],
    packingRows: packingResult.data || [],
    unloadRows: unloadResult.data || [],
  })
}
