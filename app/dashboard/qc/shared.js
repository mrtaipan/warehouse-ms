export function inferQcWorker(email) {
  const normalized = String(email || '').toLowerCase()

  if (normalized.includes('qc1')) return 'qc1'
  if (normalized.includes('qc2')) return 'qc2'
  if (normalized.includes('qc3')) return 'qc3'
  if (normalized.includes('qc4')) return 'qc4'

  return ''
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

export function formatSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0))
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0')
  const seconds = String(safeSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}
