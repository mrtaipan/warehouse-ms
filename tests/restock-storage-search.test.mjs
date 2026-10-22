import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchStorageMatches,
  getStorageSearchCandidates,
  mapWithConcurrency,
} from '../utils/restock-storage-search.mjs'

test('search candidates preserve full input, SKU, and leading token order', () => {
  assert.deepEqual(getStorageSearchCandidates('ARK01HDO005 | Sovereign Hoodie'), [
    'ARK01HDO005 | Sovereign Hoodie',
    'ARK01HDO005',
  ])
  assert.deepEqual(getStorageSearchCandidates('Sovereign Hoodie'), [
    'Sovereign Hoodie',
    'SOVEREIGN',
  ])
})

test('storage search filters by rack group and keeps the existing candidate and field order', async () => {
  const calls = []
  const rows = [
    { id: 1, item_name: 'ARK01HDO005 | Sovereign Hoodie', sku_id: 'ARK01HDO005', group: 'ARKLINE', locationType: 'PALLET' },
    { id: 2, item_name: 'ARK01HDO005 | Sovereign Hoodie', sku_id: 'ARK01HDO005', group: 'MOB', locationType: 'SHELVING' },
    { id: 3, item_name: 'ARK01HDO005 | Sovereign Hoodie', sku_id: 'ARK01HDO005', group: 'ARKLINE', locationType: 'SHELVING' },
  ]
  const supabase = {
    from(table) {
      assert.equal(table, 'warehouse_storage')
      const query = { table }
      const builder = {
        select(columns) {
          assert.match(columns, /rack_location:dir_rack_locations!inner/)
          query.columns = columns
          return builder
        },
        eq(field, value) {
          query.filters ||= {}
          query.filters[field] = value
          return builder
        },
        order(field, options) {
          assert.equal(field, 'qty')
          assert.deepEqual(options, { ascending: false })
          return builder
        },
        limit(value) {
          assert.equal(value, 200)
          return builder
        },
        ilike(field, value) {
          query.field = field
          query.value = value
          return builder
        },
        then(resolve, reject) {
          calls.push({ filters: { ...query.filters }, field: query.field, value: query.value })
          const term = query.value.slice(1, -1).toUpperCase()
          return Promise.resolve({
            data: rows.filter((row) => row.group === query.filters['rack_location.group_code'] && (!query.filters['rack_location.location_type'] || row.locationType === query.filters['rack_location.location_type']) && String(row[query.field]).toUpperCase().includes(term)),
            error: null,
          }).then(resolve, reject)
        },
      }
      return builder
    },
  }

  const matches = await fetchStorageMatches(supabase, 'ARK01HDO005 | Sovereign Hoodie', 'ARKLINE', 'id,item_name,qty')
  assert.deepEqual(matches.map((row) => row.id), [1])
  assert.deepEqual(calls.map((call) => [call.filters['rack_location.group_code'], call.filters['rack_location.location_type'], call.field]), [
    ['ARKLINE', 'PALLET', 'item_name'],
    ['ARKLINE', 'PALLET', 'sku_id'],
    ['ARKLINE', 'PALLET', 'item_name'],
    ['ARKLINE', 'PALLET', 'sku_id'],
  ])
  assert.ok(calls.every((call) => !call.value.includes('undefined')))

  const mobMatches = await fetchStorageMatches(supabase, 'ARK01HDO005', 'MOB', 'id,item_name,qty')
  assert.deepEqual(mobMatches.map((row) => row.id), [2])
  assert.ok(calls.slice(4).every((call) => call.filters['rack_location.location_type'] === undefined))
})

test('concurrent mapping preserves output order and caps active requests', async () => {
  let active = 0
  let peak = 0
  const values = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, value % 2 ? 5 : 1))
    active -= 1
    return value * 2
  })

  assert.deepEqual(values, [2, 4, 6, 8, 10, 12])
  assert.equal(peak, 2)
})
