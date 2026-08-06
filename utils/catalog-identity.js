export function normalizeCatalogIdentityValue(value) {
  return String(value || '').trim().toUpperCase()
}

function addCandidate(map, key, value) {
  if (!key) return
  const current = map.get(key) || []
  current.push(value)
  map.set(key, current)
}

function getUniqueCandidate(map, key) {
  const candidates = map.get(key) || []
  return candidates.length === 1 ? candidates[0] : null
}

function getVariantLabelValues(variant = {}) {
  return [
    variant.variant_code,
    variant.variant_label,
    variant.variant_name,
    variant.selling_name,
    variant.sku_code,
    variant.sku,
  ]
    .map(normalizeCatalogIdentityValue)
    .filter(Boolean)
}

function getItemVariantValue(item = {}) {
  return normalizeCatalogIdentityValue(
    item.model_color ||
      item.variant_name ||
      item.catalogName ||
      item.source_variant_code ||
      item.variant_code ||
      item.variant_label
  )
}

function modelMatchesItem(model = {}, item = {}) {
  const modelName = normalizeCatalogIdentityValue(item.model_name)
  const brandId = Number(item.brand_id || 0)
  const categoryId = Number(item.category_id || 0)

  if (modelName && normalizeCatalogIdentityValue(model.model_name) !== modelName) return false
  if (brandId && Number(model.brand_id || 0) !== brandId) return false
  if (categoryId && Number(model.category_id || 0) !== categoryId) return false
  return true
}

export function buildCatalogIdentityLookup(productModels = [], productModelVariants = []) {
  const modelById = new Map()
  const modelsByName = new Map()
  const modelsByBrandAndName = new Map()
  const modelsByBrandCategoryAndName = new Map()
  const variantById = new Map()
  const variantsByLabel = new Map()
  const variantsByModelAndLabel = new Map()

  productModels.forEach((model) => {
    const modelId = Number(model.id || 0)
    const modelName = normalizeCatalogIdentityValue(model.model_name)
    if (!modelId) return

    modelById.set(modelId, model)
    if (!modelName) return

    addCandidate(modelsByName, modelName, model)
    addCandidate(modelsByBrandAndName, `${Number(model.brand_id || 0)}::${modelName}`, model)
    addCandidate(
      modelsByBrandCategoryAndName,
      `${Number(model.brand_id || 0)}::${Number(model.category_id || 0)}::${modelName}`,
      model
    )
  })

  productModelVariants.forEach((variant) => {
    const variantId = Number(variant.id || 0)
    const modelId = Number(variant.product_model_id || 0)
    if (!variantId) return

    variantById.set(variantId, variant)
    getVariantLabelValues(variant).forEach((label) => {
      addCandidate(variantsByLabel, label, variant)
      addCandidate(variantsByModelAndLabel, `${modelId}::${label}`, variant)
    })
  })

  return {
    modelById,
    modelsByName,
    modelsByBrandAndName,
    modelsByBrandCategoryAndName,
    variantById,
    variantsByLabel,
    variantsByModelAndLabel,
  }
}

export function resolveProductCatalogIdentity(item = {}, catalogLookup = null) {
  const existingModelId = Number(item.product_model_id || 0) || null
  const existingVariantId = Number(item.product_model_variant_id || 0) || null
  const fallbackSourceVariantCode = item.source_variant_code || item.variant_code || null

  if (!catalogLookup) {
    return {
      model: null,
      variant: null,
      product_model_id: existingModelId,
      product_model_variant_id: existingVariantId,
      source_variant_code: fallbackSourceVariantCode,
    }
  }

  const existingVariant = existingVariantId ? catalogLookup.variantById.get(existingVariantId) || null : null
  if (existingVariant) {
    const parentModelId = Number(existingVariant.product_model_id || 0) || null
    return {
      model: parentModelId ? catalogLookup.modelById.get(parentModelId) || null : null,
      variant: existingVariant,
      product_model_id: parentModelId,
      product_model_variant_id: Number(existingVariant.id || 0) || null,
      source_variant_code: existingVariant.variant_code || existingVariant.variant_label || fallbackSourceVariantCode,
    }
  }

  const modelName = normalizeCatalogIdentityValue(item.model_name)
  const variantValue = getItemVariantValue(item)
  const brandId = Number(item.brand_id || 0)
  const categoryId = Number(item.category_id || 0)
  const existingModel = existingModelId ? catalogLookup.modelById.get(existingModelId) || null : null
  let model = existingModel && modelMatchesItem(existingModel, item) ? existingModel : null

  if (!model && modelName && brandId && categoryId) {
    model = getUniqueCandidate(
      catalogLookup.modelsByBrandCategoryAndName,
      `${brandId}::${categoryId}::${modelName}`
    )
  }
  if (!model && modelName && brandId) {
    model = getUniqueCandidate(catalogLookup.modelsByBrandAndName, `${brandId}::${modelName}`)
  }
  if (!model && modelName) {
    model = getUniqueCandidate(catalogLookup.modelsByName, modelName)
  }

  let variant = null
  if (model && variantValue) {
    variant = getUniqueCandidate(
      catalogLookup.variantsByModelAndLabel,
      `${Number(model.id || 0)}::${variantValue}`
    )
  }

  if (!variant && !model && variantValue) {
    const globalCandidates = (catalogLookup.variantsByLabel.get(variantValue) || []).filter((candidate) => {
      const parentModel = catalogLookup.modelById.get(Number(candidate.product_model_id || 0)) || null
      return parentModel ? modelMatchesItem(parentModel, item) : false
    })
    if (globalCandidates.length === 1) {
      variant = globalCandidates[0]
      model = catalogLookup.modelById.get(Number(variant.product_model_id || 0)) || null
    }
  }

  if (variant) {
    const variantModelId = Number(variant.product_model_id || 0) || null
    model = variantModelId ? catalogLookup.modelById.get(variantModelId) || model : model
  }

  return {
    model,
    variant,
    product_model_id: Number(model?.id || 0) || null,
    product_model_variant_id: Number(variant?.id || 0) || null,
    source_variant_code: variant?.variant_code || variant?.variant_label || fallbackSourceVariantCode,
  }
}

export function getProductCatalogIdentityKey(item = {}, resolvedIdentity = null) {
  const identity = resolvedIdentity || item
  const variantId = Number(identity.product_model_variant_id || item.product_model_variant_id || 0)
  if (variantId) return `variant:${variantId}`

  const modelId = Number(identity.product_model_id || item.product_model_id || 0)
  const variantValue = getItemVariantValue(item)
  if (modelId) return `model:${modelId}::${variantValue || 'BASE'}`

  return [
    'legacy',
    Number(item.brand_id || 0) || normalizeCatalogIdentityValue(item.brand_name) || 'UNBRANDED',
    Number(item.category_id || 0) || normalizeCatalogIdentityValue(item.category_name) || 'UNCATEGORIZED',
    normalizeCatalogIdentityValue(item.model_name) || 'MODEL',
    variantValue || 'BASE',
  ].join('::')
}
