function qty(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function gradesOf(row) {
  return {
    a: qty(row?.qty_a),
    b: qty(row?.qty_b),
    c: qty(row?.qty_c),
  }
}

function addGrades(total, row) {
  const grades = gradesOf(row)
  total.a += grades.a
  total.b += grades.b
  total.c += grades.c
  return total
}

function checkedQty(row) {
  return row.a + row.b + row.c
}

export function buildSampleQcRows({ sampleRows = [], qcItems = [], sampleBreakdowns = [], qcSplits = [] }) {
  const tasksByUnloadId = new Map()
  const breakdownsByUnloadId = new Map()
  const splitsByBreakdownId = new Map()

  for (const task of qcItems) {
    if (task.qc_type && String(task.qc_type).toUpperCase() !== 'INITIAL') continue
    const key = Number(task.inbound_unload_id)
    if (!key) continue
    const tasks = tasksByUnloadId.get(key) || []
    tasks.push(task)
    tasksByUnloadId.set(key, tasks)
  }

  for (const breakdown of sampleBreakdowns) {
    const key = Number(breakdown.inbound_unload_id)
    if (!key) continue
    const rows = breakdownsByUnloadId.get(key) || []
    rows.push(breakdown)
    breakdownsByUnloadId.set(key, rows)
  }

  for (const split of qcSplits) {
    const key = Number(split.sample_breakdown_id)
    if (!key) continue
    const rows = splitsByBreakdownId.get(key) || []
    rows.push(split)
    splitsByBreakdownId.set(key, rows)
  }

  const result = []

  for (const source of sampleRows.filter((row) => row.is_sample)) {
    const tasks = tasksByUnloadId.get(Number(source.id)) || []
    const taskIds = new Set(tasks.map((task) => Number(task.id)))
    const sourceGrades = tasks.reduce(addGrades, { a: 0, b: 0, c: 0 })
    const breakdowns = breakdownsByUnloadId.get(Number(source.id)) || []
    const hasQcSplit = breakdowns.some((breakdown) =>
      (splitsByBreakdownId.get(Number(breakdown.id)) || [])
        .some((split) => taskIds.has(Number(split.qc_item_id)))
    )
    const sourceFields = {
      inbound_unload_id: source.id,
      koli_sequence: source.koli_sequence,
      brand_id: source.brand_id,
      category_id: source.category_id,
      is_sample: true,
    }

    if (!hasQcSplit) {
      result.push({
        ...sourceFields,
        product_model_variant_id: source.product_model_variant_id,
        model_name: source.is_product_temporary || breakdowns.length ? 'Sample not split by model' : source.model_name,
        variant_name: source.is_product_temporary || breakdowns.length ? '' : source.variant_name,
        sampleQty: qty(source.qty),
        ...sourceGrades,
      })
      continue
    }

    const splitGrades = { a: 0, b: 0, c: 0 }
    let breakdownQty = 0

    for (const breakdown of breakdowns) {
      const grades = (splitsByBreakdownId.get(Number(breakdown.id)) || [])
        .filter((split) => taskIds.has(Number(split.qc_item_id)))
        .reduce(addGrades, { a: 0, b: 0, c: 0 })
      addGrades(splitGrades, { qty_a: grades.a, qty_b: grades.b, qty_c: grades.c })
      breakdownQty += qty(breakdown.qty)
      result.push({
        ...sourceFields,
        product_model_variant_id: breakdown.product_model_variant_id,
        model_name: breakdown.model_name,
        variant_name: breakdown.variant_name,
        sampleQty: qty(breakdown.qty),
        ...grades,
      })
    }

    const remainder = {
      a: Math.max(0, sourceGrades.a - splitGrades.a),
      b: Math.max(0, sourceGrades.b - splitGrades.b),
      c: Math.max(0, sourceGrades.c - splitGrades.c),
    }
    const remainingSampleQty = Math.max(0, qty(source.qty) - breakdownQty)

    if (remainingSampleQty || checkedQty(remainder)) {
      result.push({
        ...sourceFields,
        model_name: 'Sample not split by model',
        variant_name: '',
        sampleQty: remainingSampleQty,
        ...remainder,
      })
    }
  }

  return result.map((row) => ({ ...row, checkedQty: checkedQty(row) }))
}

export function groupSampleQcByCategory(rows) {
  const grouped = new Map()

  for (const row of rows) {
    const key = `${row.brand_id || ''}:${row.category_id || ''}`
    const current = grouped.get(key) || {
      brand_id: row.brand_id,
      category_id: row.category_id,
      a: 0,
      b: 0,
      c: 0,
    }
    current.a += qty(row.a)
    current.b += qty(row.b)
    current.c += qty(row.c)
    grouped.set(key, current)
  }

  return [...grouped.values()]
}

export function sampleQcGradePercentage(gradeQty, row) {
  const total = qty(row.a) + qty(row.b) + qty(row.c)
  if (!total) return 0
  return Math.round((qty(gradeQty) / total) * 1000) / 10
}
