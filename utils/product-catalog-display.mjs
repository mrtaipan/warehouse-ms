import { buildCatalogIdentityLookup, resolveProductCatalogIdentity } from './catalog-identity.js'

const normalize = (value) => String(value || '').trim().toUpperCase()

// Fetch every catalog page; a truncated directory can silently leave old labels in use.
export async function loadProductCatalog(client) {
  async function readAll(table, columns) {
    const rows = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from(table).select(columns).order('id').range(offset, offset + 499)
      if (error) throw error
      rows.push(...(data || []))
      if ((data || []).length < 500) return rows
    }
  }

  try {
    const models = await readAll('dir_product_models', '*, brands:dir_brands!brand_id(id, brand_name), categories:dir_categories!category_id(id, category_name, full_name)')
    const variants = await readAll('dir_product_model_variants', '*')
    return { data: buildCatalogIdentityLookup(models, variants), error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export function withCurrentProductLabels(item, catalog) {
  if (!item || !catalog) return item
  const row = { ...item }
  if (row.sample_breakdown) row.sample_breakdown = withCurrentProductLabels(row.sample_breakdown, catalog)

  const isTemporary = row.is_product_temporary || normalize(row.model_name) === 'TEMPORARY SAMPLE'
  if (isTemporary) return row

  let variantId = row.product_model_variant_id || row.product_model_variant?.id
  let modelId = row.product_model_id || row.product_model?.id
  // Inbound is only a missing-identity fallback, never an override of a QC replacement.
  if (!variantId && !row.model_replaced && !row.source_variant_code && row.inbound_unload) {
    const source = row.inbound_unload
    const sameModel = !modelId || Number(modelId) === Number(source.product_model_id)
    if (sameModel) {
      variantId = source.product_model_variant_id
      modelId = modelId || source.product_model_id
    }
  }

  let variant = variantId ? catalog.variantById.get(Number(variantId)) : null
  let model = catalog.modelById.get(Number(variant?.product_model_id || modelId))
  if (!variantId) {
    const code = normalize(row.source_variant_code || row.variant_code)
    const codeMatches = code ? Array.from(catalog.variantById.values()).filter((entry) => normalize(entry.variant_code) === code) : []
    if (codeMatches.length === 1) {
      variant = codeMatches[0]
    } else if (!code || code === normalize(row.variant_name || row.model_color)) {
      // Historical rows may contain a variant label in source_variant_code. Only
      // recover their identity when the catalog match is unambiguous.
      const identity = resolveProductCatalogIdentity({
        ...row,
        product_model_id: modelId,
        brand_id: row.brand_id || row.brands?.id || row.product_model?.brand_id || row.inbound_unload?.brand_id,
        category_id: row.category_id || row.categories?.id || row.product_model?.category_id || row.inbound_unload?.category_id,
      }, catalog)
      variant = identity.variant
      model = model || identity.model
    }
  }
  if (variant) model = catalog.modelById.get(Number(variant.product_model_id)) || model

  return {
    ...row,
    product_model_id: model?.id || modelId || null,
    product_model_variant_id: variant?.id || variantId || null,
    product_model: model || row.product_model,
    product_model_variant: variant || row.product_model_variant,
    source_variant_code: variant?.variant_code || row.source_variant_code || null,
    model_name: model?.model_name || row.model_name,
    variant_name: variant?.variant_name || row.variant_name || row.model_color || '',
    model_color: variant?.variant_name || row.variant_name || row.model_color || '',
    brand_id: model?.brand_id || row.brand_id,
    category_id: model?.category_id || row.category_id,
    brands: model?.brands || row.brands,
    categories: model?.categories || row.categories,
  }
}
