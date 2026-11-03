import assert from 'node:assert/strict'
import test from 'node:test'
import { getQcProductIdentity } from '../utils/qc-product-identity.mjs'

test('identical labels with different variant IDs remain distinct', () => {
  const first = { model_name: 'Jogger', variant_name: 'Asphalt Grey', product_model_variant_id: 274 }
  const second = { ...first, product_model_variant_id: 275 }
  assert.notEqual(getQcProductIdentity(first), getQcProductIdentity(second))
})

test('SKU is used when a historical row has no variant ID', () => {
  assert.equal(getQcProductIdentity({ source_variant_code: 'sku-001' }), 'sku:SKU-001')
  assert.notEqual(
    getQcProductIdentity({ source_variant_code: 'sku-001' }),
    getQcProductIdentity({ source_variant_code: 'sku-002' })
  )
})

test('nested inbound and sample variant IDs are retained', () => {
  assert.equal(getQcProductIdentity({ inbound_unload: { product_model_variant_id: 274 } }), 'variant-id:274')
  assert.equal(getQcProductIdentity({ sample_breakdown: { product_model_variant_id: 275 } }), 'variant-id:275')
  assert.equal(getQcProductIdentity({ model_name: 'Legacy' }), 'legacy')
})
