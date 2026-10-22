export function getStorageSearchCandidates(value) {
  const rawValue = String(value || '').trim()
  const normalizedValue = rawValue.toUpperCase()
  const tokens = normalizedValue
    .split(/[\s,/|;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const skuToken = tokens.find((token) => /[A-Z]/.test(token) && /\d/.test(token) && token.length >= 4)

  return Array.from(new Set([rawValue, skuToken, tokens[0]].map((item) => String(item || '').trim()).filter(Boolean)))
}

export async function fetchStorageMatches(supabase, searchTerm, sourceType, columns) {
  const rowsById = new Map()
  const group = String(sourceType || '').trim().toUpperCase()

  if (!group) return []

  for (const candidate of getStorageSearchCandidates(searchTerm)) {
    for (const field of ['item_name', 'sku_id']) {
      let query = supabase
        .from('warehouse_storage')
        .select(`${columns},rack_location:dir_rack_locations!inner(location_type,location_id,location_code,sub_location,group_code)`)
        .eq('rack_location.group_code', group)
      if (group === 'ARKLINE') query = query.eq('rack_location.location_type', 'PALLET')
      const { data, error } = await query
        .ilike(field, `%${candidate}%`)
        .order('qty', { ascending: false })
        .limit(200)

      if (error) throw error

      ;(data || []).forEach((row) => rowsById.set(row.id, row))
    }
  }

  return Array.from(rowsById.values())
}

export async function mapWithConcurrency(items, concurrency, task) {
  if (items.length === 0) return []

  const results = new Array(items.length)
  let nextIndex = 0
  const workerCount = Math.min(Math.max(1, concurrency), items.length)

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await task(items[index], index)
    }
  }))

  return results
}
