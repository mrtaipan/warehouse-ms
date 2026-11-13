const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

function compareSize(a, b) {
  const indexA = SIZE_ORDER.indexOf(a)
  const indexB = SIZE_ORDER.indexOf(b)
  if (indexA !== -1 && indexB !== -1) return indexA - indexB
  if (indexA !== -1) return -1
  if (indexB !== -1) return 1
  return a.localeCompare(b, undefined, { numeric: true })
}

export function buildRegularReQcSizeBreakdown(groups, queueById) {
  const byGrade = { A: new Map(), B: new Map(), C: new Map() }

  groups.forEach((group) => {
    group.rows.forEach((result) => {
      const gradeRows = byGrade[result.grade]
      if (!gradeRows) return
      const size = String(queueById.get(result.reqc_queue_id)?.size || 'No size').trim().toUpperCase()
      const key = JSON.stringify([group.key, size])
      const current = gradeRows.get(key) || { sku: group.sku, name: group.name, size, qty: 0 }
      current.qty += Number(result.qty || 0)
      gradeRows.set(key, current)
    })
  })

  return Object.fromEntries(Object.entries(byGrade).map(([grade, rows]) => [grade,
    Array.from(rows.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }) ||
      a.sku.localeCompare(b.sku, undefined, { numeric: true }) ||
      compareSize(a.size, b.size)
    ),
  ]))
}
