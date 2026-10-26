import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canRegisterUntrackedShelving,
  getEligibleRejectSources,
  getJakartaDayRange,
  requiresRejectSourceChoice,
  resolveRejectSource,
} from '../utils/arkline-reject-registration.mjs'

test('one matching source is chosen without asking for a location', () => {
  const sources = [{ id: '1', qty: 3, label: 'A8.6.A' }]
  assert.equal(requiresRejectSourceChoice(sources, 'SHELVING'), false)
  assert.equal(resolveRejectSource(sources, 'SHELVING', '')?.id, '1')
})

test('duplicate rows in the same dedicated shelf choose a row with enough stock', () => {
  const sources = [
    { id: '1', qty: 1, label: 'A8.6.A' },
    { id: '2', qty: 4, label: 'A8.6.A' },
  ]
  const eligible = getEligibleRejectSources(sources, 2)
  assert.equal(requiresRejectSourceChoice(eligible, 'SHELVING'), false)
  assert.equal(resolveRejectSource(eligible, 'SHELVING', '')?.id, '2')
})

test('different shelves or completed restocks require an explicit source', () => {
  const sources = [
    { id: '1', qty: 2, label: 'A8.6.A' },
    { id: '2', qty: 2, label: 'A8.7.A' },
  ]
  assert.equal(requiresRejectSourceChoice(sources, 'SHELVING'), true)
  assert.equal(resolveRejectSource(sources, 'SHELVING', ''), null)
  assert.equal(requiresRejectSourceChoice(sources, 'PALLET_RESTOCK'), true)
  assert.equal(resolveRejectSource(sources, 'PALLET_RESTOCK', '2')?.id, '2')
})

test('a stale choice falls back only when one eligible source remains', () => {
  const sources = [{ id: '2', qty: 4, label: 'A8.6.A' }]
  assert.equal(resolveRejectSource(sources, 'SHELVING', '1')?.id, '2')
})

test('unregistered shelving is allowed only when no matching stock row exists', () => {
  assert.equal(canRegisterUntrackedShelving('SHELVING', [], false, ''), true)
  assert.equal(canRegisterUntrackedShelving('SHELVING', [{ id: '1', qty: 0 }], false, ''), false)
  assert.equal(canRegisterUntrackedShelving('SHELVING', [], true, ''), false)
  assert.equal(canRegisterUntrackedShelving('SHELVING', [], false, 'Lookup failed'), false)
  assert.equal(canRegisterUntrackedShelving('PALLET_RESTOCK', [], false, ''), false)
})

test('Restock For uses the selected WIB calendar day', () => {
  const range = getJakartaDayRange('2026-10-21')
  assert.deepEqual(range, {
    start: '2026-10-20T17:00:00.000Z',
    end: '2026-10-21T17:00:00.000Z',
  })
  assert.equal(getJakartaDayRange(''), null)
})
