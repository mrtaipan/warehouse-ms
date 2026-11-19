import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const changes = [
  { id: 1595, oldCode: 'BKM01LSS017-001', newCode: 'BKM01LSS018-002' },
  { id: 1604, oldCode: 'BKM01LSS016-004', newCode: 'BKM01LSS017-001' },
  { id: 1607, oldCode: 'BKM01LSS019-002', newCode: 'BKM01LSS017-002' },
  { id: 1610, oldCode: 'BKM01LSS018-002', newCode: 'BKM01LSS017-003' },
  { id: 1613, oldCode: 'BKM01LSS015-005', newCode: 'BKM01LSS017-004' },
  { id: 1616, oldCode: 'BKM01LSS014-002', newCode: 'BKM01LSS017-005' },
]

const bucket = 'product-photos'
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const mode = process.argv[2]

if (!baseUrl || !secretKey || !['prepare', 'cleanup'].includes(mode)) {
  throw new Error('Provide Supabase environment variables and prepare or cleanup mode.')
}

const supabase = createClient(baseUrl, secretKey, { auth: { persistSession: false } })
const storage = supabase.storage.from(bucket)
const marker = `/storage/v1/object/public/${bucket}/`

function objectPath(url) {
  const pathname = new URL(url).pathname
  const markerIndex = pathname.indexOf(marker)
  if (markerIndex < 0) throw new Error(`Unexpected photo URL: ${url}`)
  return decodeURIComponent(pathname.slice(markerIndex + marker.length))
}

function canonicalPath(sourcePath, newCode) {
  const folder = sourcePath.slice(0, sourcePath.lastIndexOf('/'))
  const extension = sourcePath.slice(sourcePath.lastIndexOf('.'))
  return `${folder}/${newCode.toLowerCase()}${extension}`
}

async function download(path) {
  const { data, error } = await storage.download(path)
  if (error) throw new Error(`Download ${path}: ${error.message}`)
  return Buffer.from(await data.arrayBuffer())
}

async function upload(path, bytes, upsert = false) {
  const { error } = await storage.upload(path, bytes, {
    upsert,
    contentType: 'image/jpeg',
    cacheControl: '0',
  })
  if (error) throw new Error(`Upload ${path}: ${error.message}`)
}

const { data: variants, error: variantError } = await supabase
  .from('dir_product_model_variants')
  .select('id, variant_code, variant_photo_url')
  .in('id', changes.map((change) => change.id))

if (variantError || variants?.length !== changes.length) {
  throw new Error(variantError?.message || 'Expected all six variants to exist.')
}

const byId = new Map(variants.map((variant) => [variant.id, variant]))

if (mode === 'prepare') {
  const backupRoot = `rekey-backups/grn-034-${new Date().toISOString().replace(/[:.]/g, '-')}`

  for (const change of changes) {
    const variant = byId.get(change.id)
    if (variant.variant_code !== change.oldCode) throw new Error(`Variant ${change.id} changed; stop before copying.`)

    const sourcePath = objectPath(variant.variant_photo_url)
    const targetPath = canonicalPath(sourcePath, change.newCode)
    const folder = targetPath.slice(0, targetPath.lastIndexOf('/'))
    const targetName = targetPath.slice(targetPath.lastIndexOf('/') + 1)
    const { data: files, error: listError } = await storage.list(folder, { limit: 1000 })
    if (listError) throw new Error(`List ${folder}: ${listError.message}`)

    if (files.some((file) => file.name === targetName)) {
      const existingBytes = await download(targetPath)
      await upload(`${backupRoot}/${targetName}`, existingBytes)
    }

    const sourceBytes = await download(sourcePath)
    await upload(targetPath, sourceBytes, true)
    const copiedBytes = await download(targetPath)
    const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex')
    if (checksum(sourceBytes) !== checksum(copiedBytes)) throw new Error(`Photo mismatch after copying ${change.id}.`)
    console.log(`Prepared ${change.id}: ${sourcePath} -> ${targetPath}`)
  }

  console.log(`Existing destination backups: ${backupRoot}`)
} else {
  const oldPaths = []

  for (const change of changes) {
    const variant = byId.get(change.id)
    if (variant.variant_code !== change.newCode) throw new Error(`Variant ${change.id} was not rekeyed.`)

    const oldPath = canonicalPath(objectPath(variant.variant_photo_url), change.oldCode)
    const newPath = objectPath(variant.variant_photo_url)
    if (newPath === oldPath) throw new Error(`Photo path for ${change.id} was not updated.`)
    await download(newPath)

    const oldUrl = `${baseUrl.replace(/\/$/, '')}${marker}${oldPath}`
    const [{ data: variantRefs, error: variantRefError }, { data: unloadRefs, error: unloadRefError }, { data: sampleRefs, error: sampleRefError }] = await Promise.all([
      supabase.from('dir_product_model_variants').select('id').like('variant_photo_url', `${oldUrl}%`).limit(1),
      supabase.from('inbound_unload').select('id').like('photo_url', `${oldUrl}%`).limit(1),
      supabase.from('inbound_sample_model_breakdowns').select('id').like('photo_url', `${oldUrl}%`).limit(1),
    ])
    if (variantRefError || unloadRefError || sampleRefError) {
      throw new Error(`Could not check references to ${oldPath}.`)
    }
    if (variantRefs?.length || unloadRefs?.length || sampleRefs?.length) {
      throw new Error(`Old photo is still referenced: ${oldPath}`)
    }
    oldPaths.push(oldPath)
  }

  const { error } = await storage.remove(oldPaths)
  if (error) throw new Error(`Cleanup failed: ${error.message}`)
  console.log(`Removed ${oldPaths.length} old photo paths; backups remain outside the model folders.`)
}
