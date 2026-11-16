import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchAllRows } from '../app/dashboard/arkline/financial-management/live-reporting/fetch-all-rows.mjs'

test('loads every page beyond the Supabase row cap', async () => {
  const source = Array.from({ length: 1015 }, (_, index) => ({ id: index + 1 }))
  const ranges = []
  const result = await fetchAllRows(async (from, to) => {
    ranges.push([from, to])
    return { data: source.slice(from, to + 1), error: null }
  })

  assert.equal(result.data.length, 1015)
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]])
  assert.equal(result.data.at(-1).id, 1015)
})

test('stops after an exact full page and does not return partial data on error', async () => {
  const ranges = []
  const exact = await fetchAllRows(async (from, to) => {
    ranges.push([from, to])
    return { data: from === 0 ? Array.from({ length: 2 }, (_, id) => ({ id })) : [], error: null }
  }, 2)
  assert.equal(exact.data.length, 2)
  assert.deepEqual(ranges, [[0, 1], [2, 3]])

  const failure = new Error('Second page failed')
  const failed = await fetchAllRows(async (from) => from ? { data: null, error: failure } : { data: [{ id: 1 }], error: null }, 1)
  assert.equal(failed.data, null)
  assert.equal(failed.error, failure)
})
