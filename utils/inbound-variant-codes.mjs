export function nextAvailableVariantCode(modelCode, variantCodes) {
  const prefix = String(modelCode || '').trim().toUpperCase()
  if (!prefix) throw new Error('The target model has no model code.')

  const used = new Set(
    (variantCodes || []).map((code) => String(code || '').trim().toUpperCase())
  )

  for (let number = 1; number <= 999; number += 1) {
    const code = `${prefix}-${String(number).padStart(3, '0')}`
    if (!used.has(code)) return code
  }

  throw new Error(`Variant codes for ${prefix} have reached 999.`)
}

export function getVariantPhotoMovePaths(photoUrl, targetModelCode, targetVariantCode, bucket = 'product-photos') {
  if (!photoUrl) return null

  const parsed = new URL(photoUrl)
  const marker = `/storage/v1/object/public/${bucket}/`
  const markerIndex = parsed.pathname.indexOf(marker)
  if (markerIndex < 0) throw new Error('The variant photo is not in product photo storage.')

  const sourcePath = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length))
  const parts = sourcePath.split('/')
  if (parts.length < 5) throw new Error('The variant photo path is incomplete.')

  const extension = parts.at(-1).match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
  if (!extension || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    throw new Error('The variant photo has an unsupported file type.')
  }

  const modelFolder = String(targetModelCode || '').trim().toLowerCase()
  const fileName = `${String(targetVariantCode || '').trim().toLowerCase()}.${extension}`
  const destinationPath = [...parts.slice(0, -2), modelFolder, fileName].join('/')
  return { sourcePath, destinationPath }
}
