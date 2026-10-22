const SIZE_TOKENS = ['8XL', '7XL', '6XL', '5XL', '4XL', '3XL', 'XXXL', '2XL', 'XXL', 'XL', 'XXS', 'XS', 'L', 'M', 'S']
const PAIRED_SIZE = /(?:^|[^A-Z0-9])((?:[2-8]XL|X{0,8}[SML]))\s*\/\s*([0-9]{2,3})(?=$|[^A-Z0-9])/

function normalize(value) {
  return String(value ?? '').trim().toUpperCase()
}

export function stockSizeAliases(value) {
  const raw = normalize(value)
  const normalized = raw.replace(/[^A-Z0-9]/g, '')
  const key = canonicalStockSize(normalized)
  const pair = raw.match(PAIRED_SIZE)
  return pair ? [...new Set([key, canonicalStockSize(pair[1]), pair[2]])] : [key]
}

export function canonicalStockSize(value) {
  const key = normalize(value).replace(/[^A-Z0-9]/g, '')
  if (!key || key === 'NS') return '-'
  const repeatedX = key.match(/^(X{2,8})L(TALL|SHORT|REGULAR|LONG)?$/)
  return repeatedX ? `${repeatedX[1].length}XL${repeatedX[2] || ''}` : key
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
  const separated = raw.split(/\s*[,;|:]\s*|\s+\/\s+/).filter(Boolean)
  const sizePart = separated.at(-1) || raw
  const direct = sizePart.replace(/\s+/g, '')
  if (/^[A-Z0-9]+$/.test(sizePart)) return sizePart
  if (/^(?:[2-8]XL|X{0,4}[SML]|[0-9]{2,3}[SML])\s+(?:TALL|SHORT|REGULAR|LONG)$/.test(sizePart)) return direct
  const tokens = sizePart.split(/[-/|,;:()\s]+/).filter(Boolean)
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (SIZE_TOKENS.includes(tokens[index])) return tokens[index]
  }
  return direct
}

export function selectStockRowsForSize(rows, requestedSize) {
  if (!requestedSize) return rows

  const matchedRows = rows.filter((row) => stockSizesMatch(row.size, requestedSize))
  if (matchedRows.length > 0) return matchedRows

  const requestedTokens = normalize(requestedSize).split(/[\s,/|;-]+/).filter(Boolean)
  return rows.filter((row) => {
    const entryTokens = normalize(row.size).split(/[\s,/|;-]+/).filter(Boolean)
    return requestedTokens.some((requested) =>
      entryTokens.some((entry) => canonicalStockSize(entry) === canonicalStockSize(requested))
    )
  })
}
