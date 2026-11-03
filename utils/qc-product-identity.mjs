export function getQcProductIdentity(item) {
  const variantId = item?.product_model_variant_id
    ?? item?.product_model_variant?.id
    ?? item?.sample_breakdown?.product_model_variant_id
  if (variantId !== null && variantId !== undefined && variantId !== '') {
    return `variant-id:${variantId}`
  }

  const sku = item?.source_variant_code
    || item?.product_model_variant?.variant_code
    || item?.sample_breakdown?.source_variant_code
    || item?.sample_breakdown?.product_model_variant?.variant_code
  const normalizedSku = String(sku || '').trim().toUpperCase()
  if (normalizedSku) return `sku:${normalizedSku}`

  const source = item?.inbound_unload
  if (!item?.model_replaced && source && (!item?.product_model_id || Number(item.product_model_id) === Number(source.product_model_id))) {
    if (source.product_model_variant_id) return `variant-id:${source.product_model_variant_id}`
    if (source.source_variant_code) return `sku:${String(source.source_variant_code).trim().toUpperCase()}`
  }
  return 'legacy'
}

export function getQcProductGroupKey(item) {
  const identity = getQcProductIdentity(item)
  if (identity !== 'legacy') return identity
  return ['legacy', item?.brand_id || item?.brands?.id || 0, item?.category_id || item?.categories?.id || 0,
    item?.product_model_id || '', item?.model_name || '', item?.variant_name || item?.model_color || '']
    .map((value) => String(value).trim().toUpperCase()).join('::')
}
