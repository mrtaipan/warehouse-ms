import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCatalogIdentityLookup, resolveProductCatalogIdentity } from '../utils/catalog-identity.js'
import { loadProductCatalog, withCurrentProductLabels } from '../utils/product-catalog-display.mjs'
import { getQcProductGroupKey } from '../utils/qc-product-identity.mjs'

const models = [{ id: 10, model_name: 'KEITH HARING TEXT', brand_id: 1, category_id: 2,
  brands: { id: 1, brand_name: 'H&M' }, categories: { id: 2, full_name: 'UNDERWEAR' } }]
const variants = [
  { id: 966, product_model_id: 10, variant_name: 'BLACK', variant_code: 'HNM04MTU010-001' },
  { id: 967, product_model_id: 10, variant_name: 'BLACK', variant_code: 'HNM04MTU010-002' },
]
const catalog = buildCatalogIdentityLookup(models, variants)

test('same labels with different variant IDs and codes remain separate after hydration', () => {
  const rows = variants.map((variant) => withCurrentProductLabels({ product_model_variant_id: variant.id, qty: 4 }, catalog))
  assert.equal(rows[0].model_name, rows[1].model_name)
  assert.equal(rows[0].variant_name, rows[1].variant_name)
  assert.notEqual(getQcProductGroupKey(rows[0]), getQcProductGroupKey(rows[1]))
  assert.notEqual(rows[0].source_variant_code, rows[1].source_variant_code)
})

test('renames use the current directory without changing saved snapshots or quantities', () => {
  const saved = { product_model_variant_id: 966, model_name: 'OLD MODEL', variant_name: 'BLACK (OLD)', qty_a: 48, qty_c: 12 }
  const display = withCurrentProductLabels(saved, catalog)
  assert.equal(display.model_name, models[0].model_name)
  assert.equal(display.variant_name, 'BLACK')
  assert.equal(display.model_color, 'BLACK')
  assert.equal(display.qty_a + display.qty_c, 60)
  assert.equal(saved.variant_name, 'BLACK (OLD)')
  assert.equal(getQcProductGroupKey(display), getQcProductGroupKey(saved))
})

test('QC replacement keeps its own identity, even after inbound selects another variant', () => {
  const row = withCurrentProductLabels({ product_model_variant_id: 967, model_replaced: true,
    inbound_unload: { product_model_variant_id: 966 } }, catalog)
  assert.equal(row.product_model_variant_id, 967)
  assert.equal(row.source_variant_code, variants[1].variant_code)
})

test('legacy replacement without an ID cannot inherit the inbound product', () => {
  const row = withCurrentProductLabels({ model_replaced: true, model_name: 'OTHER PRODUCT',
    inbound_unload: { product_model_variant_id: 966 } }, catalog)
  assert.equal(row.product_model_variant_id, null)
  assert.match(getQcProductGroupKey(row), /^LEGACY/)
})

test('unknown explicit ID never falls back to a same-name directory item', () => {
  const row = { product_model_variant_id: 9999, model_name: models[0].model_name, variant_name: 'BLACK' }
  assert.equal(withCurrentProductLabels(row, catalog).product_model_variant_id, 9999)
  assert.equal(resolveProductCatalogIdentity(row, catalog).product_model_variant_id, 9999)
})

test('an old QC row without variant ID reads renamed labels from its unchanged inbound model', () => {
  const row = withCurrentProductLabels({ product_model_id: 10, model_name: 'OLD MODEL', variant_name: 'OLD BLACK',
    inbound_unload: { product_model_id: 10, product_model_variant_id: 966 } }, catalog)
  assert.equal(row.product_model_variant_id, 966)
  assert.equal(row.variant_name, 'BLACK')
})

test('explicit SKU takes priority over a different inbound identity', () => {
  const row = { source_variant_code: variants[1].variant_code, inbound_unload: { product_model_variant_id: 966 } }
  assert.equal(withCurrentProductLabels(row, catalog).product_model_variant_id, 967)
  assert.equal(getQcProductGroupKey(row), `sku:${variants[1].variant_code}`)
})

test('legacy rows with distinct source codes resolve to distinct directory IDs', () => {
  const rows = variants.map((variant) => withCurrentProductLabels({ model_name: models[0].model_name,
    variant_name: 'BLACK', source_variant_code: variant.variant_code }, catalog))
  assert.deepEqual(rows.map((row) => row.product_model_variant_id), [966, 967])
})

test('ambiguous legacy labels are not assigned arbitrarily to either variant', () => {
  const row = withCurrentProductLabels({ brand_id: 1, category_id: 2, model_name: models[0].model_name,
    variant_name: 'BLACK' }, catalog)
  assert.equal(row.product_model_variant_id, null)
})

test('sample splits use the resolved model identity, not temporary parent identity', () => {
  const row = withCurrentProductLabels({ qc_item: { model_name: 'TEMPORARY SAMPLE' },
    sample_breakdown: { product_model_variant_id: 967, variant_name: 'OLD BLACK' }, qty_a: 4 }, catalog)
  assert.equal(row.sample_breakdown.variant_name, 'BLACK')
  assert.equal(row.sample_breakdown.source_variant_code, variants[1].variant_code)
  assert.equal(row.qty_a, 4)
  const temporary = withCurrentProductLabels({ model_name: 'TEMPORARY SAMPLE', variant_name: 'TEMPORARY',
    inbound_unload: { product_model_variant_id: 966 } }, catalog)
  assert.equal(temporary.model_name, 'TEMPORARY SAMPLE')
})

test('repeated labels on one catalog variant do not make it ambiguous', () => {
  const lookup = buildCatalogIdentityLookup(models, [{ ...variants[0], selling_name: 'BLACK' }])
  assert.equal(withCurrentProductLabels({ product_model_id: 10, variant_name: 'BLACK' }, lookup).product_model_variant_id, 966)
})

test('catalog loader paginates beyond 1000 rows and reports query errors', async () => {
  const allVariants = Array.from({ length: 1001 }, (_, index) => ({ id: index + 1, product_model_id: 10 }))
  const ranges = []
  const client = { from(table) { return { select() { return this }, order() { return this }, async range(from, to) {
    ranges.push([table, from, to])
    return { data: (table === 'dir_product_models' ? models : allVariants).slice(from, to + 1) }
  } } } }
  const result = await loadProductCatalog(client)
  assert.equal(result.error, null)
  assert.equal(result.data.variantById.size, 1001)
  assert.ok(ranges.some(([table, from]) => table === 'dir_product_model_variants' && from === 1000))
  const failing = { from() { return { select() { return this }, order() { return this }, async range() { return { error: { message: 'No access' } } } } } }
  assert.equal((await loadProductCatalog(failing)).error.message, 'No access')
})
