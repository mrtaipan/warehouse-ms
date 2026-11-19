import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const bucket = 'product-photos'
const variantId = 1658
const oldCode = 'BKM01SSS001-005'
const newCode = 'BKM01SSS008-001'
const sourcePath = 'bkm/01/s-ss/bkm01sss008/bkm01sss001-005.jpg'
const legacyPath = 'bkm/01/s-ss/bkm01sss001/bkm01sss001-005.jpg'
const targetPath = 'bkm/01/s-ss/bkm01sss008/bkm01sss008-001.jpg'
const mode = process.argv[2]

if (!['prepare', 'cleanup'].includes(mode)) throw new Error('Use prepare or cleanup.')
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  throw new Error('Supabase URL and server secret key are required.')
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const storage = supabase.storage.from(bucket)
const marker = `/storage/v1/object/public/${bucket}/`

async function download(path) {
  const { data, error } = await storage.download(path)
  if (error) throw new Error(`Could not read ${path}: ${error.message}`)
  return Buffer.from(await data.arrayBuffer())
}

function checksum(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function exists(path) {
  const folder = path.slice(0, path.lastIndexOf('/'))
  const file = path.slice(path.lastIndexOf('/') + 1)
  const { data, error } = await storage.list(folder, { limit: 1000, search: file })
  if (error) throw new Error(error.message)
  return (data || []).some((entry) => entry.name === file)
}

async function photoIsReferenced(path) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}${marker}${path}`
  for (const [table, column] of [
    ['dir_product_model_variants', 'variant_photo_url'],
    ['inbound_unload', 'photo_url'],
    ['inbound_sample_model_breakdowns', 'photo_url'],
    ['qc_items', 'photo_url'],
    ['qc_confirm', 'photo_url'],
    ['pl_size_breakdown', 'pl_photo_url'],
  ]) {
    const { data, error } = await supabase.from(table).select('id').like(column, `${url}%`).limit(1)
    if (error) throw new Error(`Could not check ${table}: ${error.message}`)
    if (data?.length) return true
  }
  return false
}

const { data: variant, error: variantError } = await supabase
  .from('dir_product_model_variants')
  .select('id, product_model_id, variant_code, variant_photo_url')
  .eq('id', variantId)
  .single()
if (variantError) throw new Error(variantError.message)

if (mode === 'prepare') {
  if (variant.variant_code !== oldCode || variant.product_model_id !== 369 ||
      !variant.variant_photo_url.includes(`${marker}${sourcePath}`)) {
    throw new Error('The variant changed since the audit; stop before copying photos.')
  }
  if (await exists(targetPath)) throw new Error('The destination photo already exists.')

  const sourceBytes = await download(sourcePath)
  const legacyBytes = await download(legacyPath)
  const backupRoot = `rekey-backups/variant-1658-${new Date().toISOString().replace(/[:.]/g, '-')}`

  for (const [path, backupName] of [
    [sourcePath, 'current.jpg'],
    [legacyPath, 'legacy.jpg'],
  ]) {
    const { error } = await storage.copy(path, `${backupRoot}/${backupName}`)
    if (error) throw new Error(`Could not back up ${path}: ${error.message}`)
  }

  const { error: copyError } = await storage.copy(sourcePath, targetPath)
  if (copyError) throw new Error(`Could not copy to ${targetPath}: ${copyError.message}`)
  if (checksum(await download(targetPath)) !== checksum(sourceBytes)) {
    throw new Error('The copied photo differs from the source.')
  }

  console.log(JSON.stringify({ targetPath, backupRoot, sourceSha256: checksum(sourceBytes), legacyMatchesSource: checksum(legacyBytes) === checksum(sourceBytes) }))
} else {
  if (variant.variant_code !== newCode || !variant.variant_photo_url.includes(`${marker}${targetPath}`)) {
    throw new Error('Database correction is not complete; old photos were not removed.')
  }
  await download(targetPath)

  for (const path of [sourcePath, legacyPath]) {
    if (await photoIsReferenced(path)) {
      console.log(`Kept referenced photo: ${path}`)
      continue
    }
    const { error } = await storage.remove([path])
    if (error) throw new Error(`Could not remove ${path}: ${error.message}`)
    console.log(`Removed old photo: ${path}`)
  }
}
