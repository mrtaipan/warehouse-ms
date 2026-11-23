import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { getGrnRejectionRemaining } from '../utils/grn-rejection-remaining.mjs'

const source = await readFile(new URL('../app/dashboard/page.js', import.meta.url), 'utf8')
function extractFunction(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`))
  assert.notEqual(start, -1)
  return source.slice(start, source.indexOf('\n}', start) + 2)
}
const context = vm.createContext({})
vm.runInContext([
  'fetchAllRows', 'filterVisibleBirthdayGiftRows', 'getBirthdayGiftAnnouncementFilter',
  'cleanSummaryText', 'dedupeSummaryParts', 'getGradeBreakdownLabel',
  'buildDashboardGrnQuery', 'loadAdminGrnSummary',
].map(extractFunction).join('\n'), context)

function selectionFor(table) {
  return source.match(new RegExp(`\\.from\\('${table}'\\)\\s*\\.select\\(\x60([\\s\\S]*?)\x60\\)`))[1]
}

test('QC and PL projections have no wildcard and retain summary fields', () => {
  const qc = selectionFor('qc_items')
  const pl = selectionFor('pl_size_breakdown')
  assert.equal(qc.includes('*'), false)
  assert.equal(pl.includes('*'), false)
  for (const field of ['id', 'inbound_unload_id', 'allocated_qty', 'status', 'qty_a', 'qty_b', 'qty_c', 'model_name', 'variant_name', 'brand_id', 'category_id', 'is_sample', 'is_product_temporary']) {
    assert.match(qc, new RegExp(`\\b${field}\\b`))
  }
  for (const field of ['qty', 'pl_name', 'model_name', 'variant_name', 'source_variant_code', 'categories', 'category_name', 'full_name']) {
    assert.match(pl, new RegExp(`\\b${field}\\b`))
  }
})

function mockGrnClient(rows = [], error = null) {
  const calls = []
  return {
    calls,
    from(table) {
      assert.equal(table, 'inbound')
      const call = { filters: [], orders: [] }
      calls.push(call)
      return {
        select(value) { call.select = value; return this },
        eq(field, value) { call.filters.push([field, value]); return this },
        order(field, options) { call.orders.push([field, options.ascending]); return this },
        async range(from, to) { return { data: rows.slice(from, to + 1), error } },
        async maybeSingle() { return { data: null, error } },
      }
    },
  }
}

test('GRN dropdown filters waiting returns inside the initial inbound query', async () => {
  const client = mockGrnClient([{ id: 1, grn_number: 'ACTIVE-GRN' }])
  const result = await context.loadAdminGrnSummary(client)
  assert.equal(result.grnOptions.length, 1)
  assert.equal(result.grnOptions[0].grn_number, 'ACTIVE-GRN')
  assert.equal(client.calls.length, 1)
  assert.match(client.calls[0].select, /warehouse_returns!returns_inbound_id_fkey!inner\(\)/)
  assert.deepEqual(client.calls[0].filters, [['waiting_returns.status', 'waiting']])
  assert.deepEqual(client.calls[0].orders, [['created_at', false], ['id', false]])
})

test('manually typed GRN also requires waiting returns and does not load summary when absent', async () => {
  const client = mockGrnClient()
  const result = await context.loadAdminGrnSummary(client, 'COMPLETED-GRN')
  assert.equal(result.selectedInbound, null)
  assert.equal(result.summary, null)
  assert.equal(client.calls.length, 2)
  assert.deepEqual(client.calls[1].filters, [['waiting_returns.status', 'waiting'], ['grn_number', 'COMPLETED-GRN']])
})

test('GRN query errors remain visible instead of falling back to unfiltered inbound', async () => {
  const client = mockGrnClient([], { message: 'Query failed' })
  const result = await context.loadAdminGrnSummary(client)
  assert.equal(result.error, 'Query failed')
  assert.equal(result.grnOptions.length, 0)
  assert.equal(client.calls.length, 1)
})

test('row pagination still returns every page rather than limiting totals', async () => {
  const rows = Array.from({ length: 2501 }, (_, id) => ({ id }))
  const ranges = []
  const result = await context.fetchAllRows(() => ({ range: async (from, to) => {
    ranges.push([from, to])
    return { data: rows.slice(from, to + 1), error: null }
  } }))
  assert.equal(result.data.length, 2501)
  assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999]])
})

test('narrowed QC rows preserve reject calculations including transfer adjustments', () => {
  const row = {
    id: 1, inbound_unload_id: 11, allocated_qty: 25, status: 'done',
    qty_a: 12, qty_b: 8, qty_c: 5, model_name: 'Tee', variant_name: 'Black',
    inbound_unload: { id: 11, brand_id: 2, category_id: 3, is_sample: false },
    product_model: { brand_id: 2, category_id: 3 },
  }
  const processed = { brand_id: 2, category_id: 3, model_name: 'Tee', variant_name: 'Black' }
  const options = {
    qcConfirmRows: [{ ...processed, grade: 'A', source_grade: 'B', is_adjustment: true, adjustment_type: 'TRANSFER', qty: 3 }],
    returnRows: [{ ...processed, source_phase: 'qc', grade: 'C', qty: 2 }],
  }
  const narrow = getGrnRejectionRemaining({ ...options, qcRows: [row] })
  const full = getGrnRejectionRemaining({ ...options, qcRows: [{ ...row, photo_url: 'unused', stopwatch_seconds: 600, locked_qty: 25 }] })
  assert.deepEqual(narrow, full)
  assert.deepEqual(narrow, { byGrade: { A: 0, B: 5, C: 3 }, total: 8 })
  assert.equal(context.getGradeBreakdownLabel({ pl_name: 'Short Sleeve Tee', pl_notes: 'unused' }), 'Short Sleeve Tee')
})

test('birthday prefilter retains submitted requests and the full approval-day boundary', () => {
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  cutoff.setDate(cutoff.getDate() - 3)
  assert.equal(context.getBirthdayGiftAnnouncementFilter(now),
    `status.eq.SUBMITTED,and(status.eq.APPROVED,approved_at.gte.${cutoff.toISOString()})`)
  const rows = [
    { id: 1, status: 'SUBMITTED', approved_at: null },
    { id: 2, status: 'APPROVED', approved_at: cutoff.toISOString() },
    { id: 3, status: 'APPROVED', approved_at: new Date(cutoff.getTime() - 1).toISOString() },
    { id: 4, status: 'REJECTED', approved_at: now.toISOString() },
    { id: 5, status: 'APPROVED', approved_at: null },
  ]
  const queried = rows.filter((row) => row.status === 'SUBMITTED' ||
    (row.status === 'APPROVED' && row.approved_at && new Date(row.approved_at) >= cutoff))
  assert.deepEqual(Array.from(context.filterVisibleBirthdayGiftRows(rows), (row) => row.id), [1, 2])
  assert.deepEqual(Array.from(context.filterVisibleBirthdayGiftRows(queried), (row) => row.id), [1, 2])
  assert.match(source, /\.or\(getBirthdayGiftAnnouncementFilter\(\)\)/)
})
