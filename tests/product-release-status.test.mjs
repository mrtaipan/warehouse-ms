import assert from 'node:assert/strict'
import test from 'node:test'
import { getDisplayedReleaseCount, getProductReleaseState, matchesProductReleaseFilter } from '../app/dashboard/storage/daftar-barang/product-release-status.js'

test('mixed draft and released rows show Partial before filtering', () => {
  assert.equal(getProductReleaseState(new Set(['draft', 'released'])), 'partial')
  assert.equal(getProductReleaseState(new Set(['released'])), 'released')
  assert.equal(getProductReleaseState(new Set(['draft'])), 'draft')
})

test('release badge counts actual release steps, not combined sizes or histories', () => {
  assert.equal(getDisplayedReleaseCount('released', 1), 1)
  assert.equal(getDisplayedReleaseCount('released', 2), 2)
  assert.equal(getDisplayedReleaseCount('released', 0), 1)
  assert.equal(getDisplayedReleaseCount('partial', 2), 0)
})

test('Released model filter keeps released bundles but not draft components', () => {
  assert.equal(matchesProductReleaseFilter('released', 'released'), true)
  assert.equal(matchesProductReleaseFilter('draft', 'released'), false)
  assert.equal(matchesProductReleaseFilter('partial', 'released'), false)
  assert.equal(matchesProductReleaseFilter('draft', 'all'), true)
})
