export function nextAvailableReturnKoliSequence(rows) {
  const used = new Set(rows.map((row) => Number(row.koli_sequence)).filter((value) => Number.isInteger(value) && value > 0))
  let sequence = 1
  while (used.has(sequence)) sequence += 1
  return sequence
}

export async function loadReturnKoliSequences(buildQuery) {
  const pageSize = 1000
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return { data: rows, error: null }
  }
}
