import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import XLSX from 'xlsx'

const filePath = new URL('./REJECT_updated.xlsx', import.meta.url)
const fileBytes = readFileSync(filePath)
const workbook = XLSX.read(fileBytes, { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Sheet1, { defval: null })
const sourceHash = createHash('sha256').update(fileBytes).digest('hex')
const groups = new Map()
const sizes = /^(ALLSIZE|XXL|XL|XS|L|M|S)/

function stableId(value) {
  const hex = createHash('sha256').update(`arkline-reject-updated-20261022|${value}`).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

rows.forEach((row, index) => {
  const dateMatch = String(row.Tanggal || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const koliMatch = String(row['No Koli'] || '').trim().match(/^Koli\s+(\d+)$/i)
  const sku = String(row.SKU || '').trim().toUpperCase()
  const skuMatch = sku.match(/^(ARK\d{2}[A-Z]{3}\d{3})(.+)$/)
  const size = skuMatch?.[2].match(sizes)?.[1]
  const qty = Number(row['Reject Qty'])
  if (!dateMatch || !koliMatch || !skuMatch || !size || !Number.isInteger(qty) || qty < 1) {
    throw new Error(`Invalid Sheet1 row ${index + 2}`)
  }

  const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
  const storageNumber = String(Number(koliMatch[1]))
  const skuInduk = skuMatch[1]
  const key = `${date}|${storageNumber}|${skuInduk}`
  const group = groups.get(key) || {
    id: stableId(`batch|${key}`),
    storageNumber,
    skuInduk,
    date,
    storedQty: 0,
    lines: [],
  }
  group.storedQty += qty
  group.lines.push({ id: stableId(`line|${index + 2}|${key}|${sku}`), size, qty })
  groups.set(key, group)
})

const payload = [...groups.values()].sort((a, b) =>
  Number(a.storageNumber) - Number(b.storageNumber) || a.skuInduk.localeCompare(b.skuInduk)
)
const summary = {
  sourceHash,
  rows: rows.length,
  batches: payload.length,
  qty: payload.reduce((total, group) => total + group.storedQty, 0),
  koli: new Set(payload.map((group) => group.storageNumber)).size,
}

if (process.argv[2] === '--summary') {
  process.stdout.write(JSON.stringify(summary))
} else if (process.argv[2] === '--chunk') {
  const chunk = Number(process.argv[3])
  if (!Number.isInteger(chunk) || chunk < 0) throw new Error('Invalid chunk index')
  process.stdout.write(JSON.stringify({ sourceHash, groups: payload.slice(chunk * 50, (chunk + 1) * 50) }))
} else {
  throw new Error('Use --summary or --chunk INDEX')
}
