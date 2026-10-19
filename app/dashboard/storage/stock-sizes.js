const SIZE_TOKENS = ['8XL', '7XL', '6XL', '5XL', '4XL', '3XL', 'XXXL', '2XL', 'XXL', 'XL', 'XXS', 'XS', 'L', 'M', 'S']
const PAIRED_SIZE = /(?:^|[^A-Z0-9])((?:[2-8]XL|X{0,3}[SML]))\s*\/\s*([0-9]{2,3})(?=$|[^A-Z0-9])/

function normalize(value) {
  return String(value ?? '').trim().toUpperCase()
}

export function stockSizeAliases(value) {
  const raw = normalize(value)
  const key = raw.replace(/[^A-Z0-9]/g, '') || '-'
  const pair = raw.match(PAIRED_SIZE)
  return pair ? [...new Set([key, pair[1], pair[2]])] : [key]
}

export function stockSizesMatch(stockSize, requestedSize, variationRaw = '') {
  const requested = stockSizeAliases(requestedSize)
  const variation = stockSizeAliases(variationRaw)
  // Only an explicit pair such as S/95 can connect letter and numeric sizes.
  if (variation.length > 1 && variation.some((size) => requested.includes(size))) {
    requested.push(...variation)
  }
  return stockSizeAliases(stockSize).some((size) => requested.includes(size))
}

export function resolveUploadSize(value) {
  const raw = normalize(value)
  if (!raw) return ''
  const pair = raw.match(PAIRED_SIZE)
  if (pair) return `${pair[1]}/${pair[2]}`
  const direct = raw.replace(/\s+/g, '')
  if (SIZE_TOKENS.includes(direct)) return direct
  const tokens = raw.split(/[-/|,;:()\s]+/).filter(Boolean)
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (SIZE_TOKENS.includes(tokens[index])) return tokens[index]
  }
  for (const size of SIZE_TOKENS) {
    if (direct.endsWith(size)) return size
  }
  return direct
}
