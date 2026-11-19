import assert from 'node:assert/strict'
import test from 'node:test'
import { getVariantPhotoMovePaths, nextAvailableVariantCode } from '../utils/inbound-variant-codes.mjs'

test('reuses the first free code after a model move', () => {
  assert.equal(
    nextAvailableVariantCode('BKM01LSS017', ['BKM01LSS017-002', 'bkm01lss017-003']),
    'BKM01LSS017-001'
  )
  assert.equal(
    nextAvailableVariantCode('BKM01LSS018', ['BKM01LSS018-001']),
    'BKM01LSS018-002'
  )
})

test('refuses a model whose first 999 codes are occupied', () => {
  const codes = Array.from({ length: 999 }, (_, index) => `BKM01LSS017-${String(index + 1).padStart(3, '0')}`)
  assert.throws(() => nextAvailableVariantCode('BKM01LSS017', codes), /reached 999/)
})

test('moves a product photo into the target model folder and filename', () => {
  assert.deepEqual(
    getVariantPhotoMovePaths(
      'https://example.supabase.co/storage/v1/object/public/product-photos/bkm/01/s-ls/bkm01lss017/bkm01lss017-001.jpg?rev=old',
      'BKM01LSS018',
      'BKM01LSS018-002'
    ),
    {
      sourcePath: 'bkm/01/s-ls/bkm01lss017/bkm01lss017-001.jpg',
      destinationPath: 'bkm/01/s-ls/bkm01lss018/bkm01lss018-002.jpg',
    }
  )
})
