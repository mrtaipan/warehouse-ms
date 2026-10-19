const EXTERNAL_REPLACEMENT_PREFIX = '[REPLACEMENT OUTSIDE STOCK] '

export function getExternalReplacementLines(notes) {
  return String(notes || '')
    .split(/\r?\n/)
    .filter((line) => line.startsWith(EXTERNAL_REPLACEMENT_PREFIX))
    .map((line) => line.slice(EXTERNAL_REPLACEMENT_PREFIX.length))
}
