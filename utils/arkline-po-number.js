export const TEMPORARY_PO_SUFFIX = 'TEMPORER'

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

export function normalizeArklinePoSuffix(value, fallback = TEMPORARY_PO_SUFFIX) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized || fallback
}

export function extractArklinePoNumberInfo(value) {
  const normalized = String(value || '').trim().toUpperCase()
  const nextFormatMatch = normalized.match(/^PO-?(\d+)-([A-Z0-9]+)(?:\/|-)([A-Z0-9]+)(?:-(.*))?$/)

  if (nextFormatMatch) {
    const sequenceText = String(Number(nextFormatMatch[1] || 0) || nextFormatMatch[1])
    return {
      kind: 'next',
      numberText: sequenceText,
      numberValue: Number(nextFormatMatch[1]),
      ownershipCode: nextFormatMatch[2] || '',
      flowCode: nextFormatMatch[3] || '',
      suffix: nextFormatMatch[4] || '',
      prefix: `PO-${sequenceText}-${nextFormatMatch[2]}/${nextFormatMatch[3]}-`,
    }
  }

  const legacyGarmentMatch = normalized.match(/^PO-([A-Z0-9]+)-?(.*)$/)
  if (legacyGarmentMatch) {
    const numericValue = /^\d+$/.test(legacyGarmentMatch[1]) ? Number(legacyGarmentMatch[1]) : null
    return {
      kind: 'legacy-garment',
      numberText: legacyGarmentMatch[1],
      numberValue: numericValue,
      suffix: legacyGarmentMatch[2] || '',
      prefix: `PO-${legacyGarmentMatch[1]}-`,
    }
  }

  const legacyMaterialMatch = normalized.match(/^MPO-([^-]+)-/)
  if (legacyMaterialMatch) {
    const numericValue = /^\d+$/.test(legacyMaterialMatch[1]) ? Number(legacyMaterialMatch[1]) : null
    return {
      kind: 'legacy-material',
      numberText: legacyMaterialMatch[1],
      numberValue: numericValue,
      suffix: '',
      prefix: '',
    }
  }

  return null
}

export function getArklinePoPrefix(value) {
  return extractArklinePoNumberInfo(value)?.prefix || ''
}

export function getArklinePoSuffix(value) {
  const info = extractArklinePoNumberInfo(value)
  return info ? info.suffix : String(value || '').trim().toUpperCase()
}

export function isTemporaryArklinePo(value) {
  return normalizeArklinePoSuffix(getArklinePoSuffix(value), '') === TEMPORARY_PO_SUFFIX
}

export function getArklinePoSequence(value) {
  const numberValue = extractArklinePoNumberInfo(value)?.numberValue
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

export function getNextArklinePoSequence(values = []) {
  const maxNumber = values.reduce((currentMax, value) => {
    const numberValue = getArklinePoSequence(value)
    return numberValue ? Math.max(currentMax, numberValue) : currentMax
  }, 0)

  return maxNumber + 1
}

export function getArklineOwnershipCode({ includePpn = true, materialType = '' } = {}) {
  if (String(materialType || '').trim().toUpperCase() === 'FABRIC') return 'MKG'
  return includePpn === false ? 'IDV' : 'ARK'
}

export function getArklineMethodCode(method = 'FOB') {
  return String(method || '').trim().toUpperCase() === 'CMT' ? 'C' : 'F'
}

export function getArklineDocumentCode(documentType = 'GARMENT') {
  return String(documentType || '').trim().toUpperCase() === 'MATERIAL' ? 'M' : 'G'
}

export function buildArklinePoPrefix({
  sequence,
  includePpn = true,
  method = 'FOB',
  documentType = 'GARMENT',
  materialType = '',
  flowCode,
} = {}) {
  const nextSequence = Number(sequence || 0)
  const sequenceText = String(Number.isFinite(nextSequence) && nextSequence > 0 ? nextSequence : 1)
  const ownershipCode = getArklineOwnershipCode({ includePpn, materialType })
  const normalizedFlowCode =
    String(flowCode || '').trim().toUpperCase() || `${getArklineMethodCode(method)}${getArklineDocumentCode(documentType)}`

  return `PO-${sequenceText}-${ownershipCode}/${normalizedFlowCode}-`
}

export function buildArklinePoId({
  sequence,
  includePpn = true,
  method = 'FOB',
  documentType = 'GARMENT',
  materialType = '',
  flowCode,
  suffix = TEMPORARY_PO_SUFFIX,
} = {}) {
  return `${buildArklinePoPrefix({ sequence, includePpn, method, documentType, materialType, flowCode })}${normalizeArklinePoSuffix(suffix)}`
}

export function getArklineIssueDateCode(date = new Date()) {
  const issueDate = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(issueDate.getTime())) return ''

  const dayCode = String(issueDate.getDate()).padStart(2, '0')
  const monthCode = ROMAN_MONTHS[issueDate.getMonth()] || ''
  const yearCode = String(issueDate.getFullYear())

  return `${dayCode}${monthCode}${yearCode}`
}

export function buildUniqueArklinePoId(basePoId, existingValues = []) {
  const normalizedBase = String(basePoId || '').trim().toUpperCase()
  if (!normalizedBase) return ''

  const existingSet = new Set((existingValues || []).map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))
  if (!existingSet.has(normalizedBase)) return normalizedBase

  let counter = 2
  let candidate = `${normalizedBase}-${String(counter).padStart(3, '0')}`
  while (existingSet.has(candidate)) {
    counter += 1
    candidate = `${normalizedBase}-${String(counter).padStart(3, '0')}`
  }

  return candidate
}
