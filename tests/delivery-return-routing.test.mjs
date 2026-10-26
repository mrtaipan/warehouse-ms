import assert from 'node:assert/strict'
import test from 'node:test'
import { isArklineDeliveryProduct, normalizeDeliverySku } from '../utils/delivery-return-routing.mjs'

test('Arkline products follow product identity even in MOB or OI return cases', () => {
  const directorySkus = new Set(['OTHERARKLINESKU'])
  assert.equal(isArklineDeliveryProduct({ group_code: 'MOB', sku: 'ARK01HDO047' }, directorySkus), true)
  assert.equal(isArklineDeliveryProduct({ group_code: 'OI', sku: 'OTHER-ARKLINE-SKU' }, directorySkus), true)
  assert.equal(isArklineDeliveryProduct({ group_code: 'ARKLINE', sku: '' }, directorySkus), true)
})

test('non-Arkline MOB and OI products stay in the regular reject route', () => {
  assert.equal(isArklineDeliveryProduct({ group_code: 'MOB', sku: 'MOB123' }), false)
  assert.equal(isArklineDeliveryProduct({ group_code: 'OI', sku: '' }), false)
  assert.equal(normalizeDeliverySku(' other-arkline-sku '), 'OTHERARKLINESKU')
})
