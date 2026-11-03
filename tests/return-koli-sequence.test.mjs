import assert from 'node:assert/strict'
import test from 'node:test'
import { loadReturnKoliSequences, nextAvailableReturnKoliSequence } from '../utils/return-koli-sequence.mjs'

test('uses first missing positive return koli number', () => {
  assert.equal(nextAvailableReturnKoliSequence([{ koli_sequence: 1 }, { koli_sequence: 2 }, { koli_sequence: 4 }]), 3)
  assert.equal(nextAvailableReturnKoliSequence([{ koli_sequence: 1 }, { koli_sequence: 2 }]), 3)
  assert.equal(nextAvailableReturnKoliSequence([{ koli_sequence: null }, { koli_sequence: 2 }]), 1)
  assert.equal(nextAvailableReturnKoliSequence([{ koli_sequence: 5 }, { koli_sequence: 5 }]), 1)
})

test('loads every sequence page before finding a gap', async () => {
  const sourceRows = Array.from({ length: 1001 }, (_, index) => ({ koli_sequence: index + 1 }))
  sourceRows[500] = { koli_sequence: 1002 }
  const { data, error } = await loadReturnKoliSequences(() => ({
    range: async (start, end) => ({ data: sourceRows.slice(start, end + 1), error: null }),
  }))
  assert.equal(error, null)
  assert.equal(data.length, 1001)
  assert.equal(nextAvailableReturnKoliSequence(data), 501)
})
