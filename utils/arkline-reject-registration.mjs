export function getEligibleRejectSources(options, qty) {
  const requestedQty = Number(qty)
  return options.filter((option) => option.qty > 0 && (!Number.isInteger(requestedQty) || requestedQty <= 0 || option.qty >= requestedQty))
}

export function getJakartaDayRange(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null
  const start = new Date(`${date}T00:00:00+07:00`)
  if (Number.isNaN(start.getTime())) return null
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 86_400_000).toISOString(),
  }
}

export function requiresRejectSourceChoice(options, inventorySource) {
  if (options.length <= 1) return false
  return inventorySource !== 'SHELVING' || options.some((option) => option.label !== options[0].label)
}

export function resolveRejectSource(options, inventorySource, sourceId) {
  if (sourceId) {
    const selected = options.find((option) => option.id === sourceId)
    if (selected) return selected
  }
  if (requiresRejectSourceChoice(options, inventorySource)) return null
  return options[0] || null
}
