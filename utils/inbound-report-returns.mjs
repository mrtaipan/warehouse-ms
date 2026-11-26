const PAGE_SIZE = 1000

export function summarizeInboundReturns(rows = []) {
  const reasons = new Map()
  let inboundReturnQty = 0

  for (const row of rows) {
    if (row.source_phase !== 'inbound') continue
    const qty = Number(row.qty || 0)
    inboundReturnQty += qty
    const reason = String(row.return_reason || '').trim() || 'Not specified'
    const key = reason.toLocaleLowerCase()
    const current = reasons.get(key) || { reason, qty: 0 }
    current.qty += qty
    reasons.set(key, current)
  }

  return {
    inboundReturnQty,
    returnReasons: [...reasons.values()].sort((a, b) => b.qty - a.qty || a.reason.localeCompare(b.reason)),
  }
}

export async function loadInboundReturnSummary(client, inboundId) {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from('warehouse_returns')
      .select('qty, return_reason, source_phase')
      .eq('inbound_id', inboundId)
      .eq('source_phase', 'inbound')
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) return summarizeInboundReturns(rows)
  }
}
