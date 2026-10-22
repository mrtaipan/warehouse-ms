const MOVEMENT_LABELS = {
  MOVE: 'Move',
  TAKE_OUT: 'Take out',
  TEMPORARY_IN: 'To temporary area',
  TEMPORARY_RETURN: 'Returned from temporary',
  PUTAWAY_IN: 'Stored to shelving',
  CUSTOMER_RETURN_IN: 'Customer return',
  CUSTOMER_REPLACEMENT_OUT: 'Replacement out',
  QC_RECHECK_OUT: 'Re-QC',
  REJECT_OUT: 'To reject storage',
}
const uploadDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
})
const uploadDateLabelFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: 'short', day: 'numeric',
})

function getUploadDay(value) {
  const parts = Object.fromEntries(uploadDayFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function getJakartaDateOffset(offset, now = new Date()) {
  const date = new Date(`${getUploadDay(now)}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function getJakartaDateRange(day) {
  const end = new Date(`${day}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  return {
    start: `${day}T00:00:00+07:00`,
    end: `${end.toISOString().slice(0, 10)}T00:00:00+07:00`,
  }
}

export function getMovementTotals(rows) {
  return rows.reduce((totals, row) => {
    const qty = Number(row.qty || 0)
    if (qty > 0) totals.inbound += qty
    if (qty < 0) totals.outbound -= qty
    return totals
  }, { inbound: 0, outbound: 0 })
}

function normalizeUploadKey(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ')
}

export function getWarehouseLocationLabel(location) {
  return [location.location_type, location.location_id, location.location_code, location.sub_location]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' / ')
}

export function buildMovementScope(locations = [], entries = []) {
  const labels = locations.flatMap((location) => {
    const canonical = getWarehouseLocationLabel(location)
    if (location.sub_location != null && String(location.sub_location).trim()) return [canonical]
    return [canonical, `${canonical} / null`, `${canonical} / `]
  })

  return {
    locationIds: [...new Set(locations.map((location) => Number(location.id)).filter(Number.isFinite))],
    labels: [...new Set(labels)],
    storageIds: [...new Set(entries.map((entry) => Number(entry.id)).filter(Number.isFinite))],
  }
}

export function combineWarehouseMovements({ movements = [], uploads = [], restocks = [], scope }) {
  const labels = new Set(scope.labels.map((label) => label.trim().toUpperCase()))
  const locationIds = new Set(scope.locationIds.map(String))
  const storageIds = new Set(scope.storageIds.map(String))
  const results = []

  movements.forEach((row) => {
    const from = String(row.from_location_label || '').trim()
    const to = String(row.to_location_label || '').trim()
    const fromHere = labels.has(from.toUpperCase())
    const toHere = labels.has(to.toUpperCase())

    if (row.movement_type === 'PUTAWAY_IN' ? !toHere : fromHere === toHere) return

    results.push({
      id: `movement-${row.id}`,
      date: row.created_at,
      label: MOVEMENT_LABELS[row.movement_type] || String(row.movement_type || 'Movement').replaceAll('_', ' '),
      qty: (toHere ? 1 : -1) * Number(row.qty || 0),
      sku_id: row.sku_id,
      item_name: row.item_name,
      size: row.size,
      detail: toHere ? `From ${from || '-'}` : `To ${to || '-'}`,
      actor: row.created_by,
    })
  })

  const uploadGroups = new Map()
  uploads.forEach((row) => {
    if (!locationIds.has(String(row.rack_location_id))) return

    const day = getUploadDay(row.created_at)
    const identity = normalizeUploadKey(row.sku_id) || `NAME:${normalizeUploadKey(row.item_name_snapshot)}`
    const key = JSON.stringify([day, row.movement_type, row.rack_location_id, identity, normalizeUploadKey(row.size)])
    const existing = uploadGroups.get(key)
    if (existing) {
      existing.qty += Number(row.qty_delta || 0)
      existing.entryCount += 1
      if (new Date(row.created_at) > new Date(existing.date)) existing.date = row.created_at
      return
    }

    uploadGroups.set(key, {
      id: `upload-${key}`,
      date: row.created_at,
      dateLabel: uploadDateLabelFormatter.format(new Date(row.created_at)),
      label: row.movement_type === 'REVERSE' ? 'Upload reversal' : 'Sales upload',
      qty: Number(row.qty_delta || 0),
      sku_id: row.sku_id,
      item_name: row.item_name_snapshot,
      size: row.size,
      location: row.location_snapshot?.location_name || getWarehouseLocationLabel(row.location_snapshot || {}),
      entryCount: 1,
      actor: row.created_by,
    })
  })

  uploadGroups.forEach((group) => {
    results.push({
      ...group,
      detail: `${group.entryCount} upload ${group.entryCount === 1 ? 'entry' : 'entries'}${group.location ? ` / ${group.location}` : ''}`,
    })
  })

  restocks.forEach((row) => {
    const sourceLabel = String(row.take_from || '').trim()
    if (!labels.has(sourceLabel.toUpperCase()) && !(sourceLabel === '' && storageIds.has(String(row.storage_id)))) return

    const qty = Number(row.fulfilled_qty ?? row.qty ?? 0)
    if (qty <= 0) return

    results.push({
      id: `restock-${row.id}`,
      date: row.completed_at || row.created_at,
      label: 'Restock',
      qty: -qty,
      sku_id: row.source_sku_id,
      item_name: row.item_name,
      size: row.size,
      detail: row.requester_name ? `For ${row.requester_name}` : 'Picked for restock',
      actor: row.completed_by,
    })
  })

  return results
    .filter((row) => row.qty !== 0)
    .sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0))
}
