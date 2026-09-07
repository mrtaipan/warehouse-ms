import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const LEGACY_URL = process.env.LEGACY_DELIVERY_SUPABASE_URL || 'https://opgqhmwtqemozzkvcntr.supabase.co'
const BATCH_SIZE = Number(process.env.DELIVERY_MIGRATION_BATCH_SIZE || 500)

const PIC_MAP = new Map([
  ['AN', 'HALIMAH MUNISAH SADIYYAH'],
  ['WF', 'WIDIA FITALOCA'],
  ['US', 'USWATUN HASANAH'],
  ['NLS', 'NURLAILA SARI'],
  ['FS', 'FITRIA SALSABILA'],
  ['WS', 'WINDA SINTIA'],
  ['LS', 'LASTRIA SEPTIYANTI'],
])

const GROUP_OWNER_FALLBACK = new Map([
  ['ARKLINE', 'HALIMAH MUNISAH SADIYYAH'],
  ['MOB', 'WIDIA FITALOCA'],
  ['OI', 'FITRIA SALSABILA'],
])

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), '.env.local')
  try {
    const content = readFileSync(envPath, 'utf8')
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=')
          const key = line.slice(0, index).trim()
          const rawValue = line.slice(index + 1).trim()
          const value = rawValue.replace(/^['"]|['"]$/g, '')
          return [key, value]
        }),
    )
  } catch {
    return {}
  }
}

const localEnv = loadLocalEnv()
const env = { ...localEnv, ...process.env }

function requireEnv(key, fallback) {
  const value = fallback || env[key]
  if (!value) throw new Error(`${key} is required`)
  return value
}

function cleanText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function cleanUpper(value) {
  const text = cleanText(value)
  return text ? text.toUpperCase() : null
}

function mapKnownPerson(value) {
  const normalized = cleanUpper(value)
  if (!normalized) return null
  return PIC_MAP.get(normalized) || cleanText(value)
}

function resolveLegacyPic(value, groupOrder) {
  const normalized = cleanUpper(value)
  if (normalized && PIC_MAP.has(normalized)) return PIC_MAP.get(normalized)
  return GROUP_OWNER_FALLBACK.get(cleanUpper(groupOrder)) || null
}

function pick(row, keys) {
  return Object.fromEntries(keys.map((key) => [key, row[key] ?? null]))
}

function normalizeBoolean(value) {
  if (value === null || value === undefined || value === '') return null
  return Boolean(value)
}

function mapDeliveryBarcode(row) {
  return {
    barcode: cleanText(row.barcode),
    timestamp_delivery: row.timestamp_delivery ?? null,
    group_order: cleanUpper(row.group_order),
    courier: cleanUpper(row.courier),
    is_defined: normalizeBoolean(row.is_defined),
    timestamp_packing: row.timestamp_packing ?? null,
    packing_team: cleanUpper(row.packing_team),
    is_packed: normalizeBoolean(row.is_packed),
    is_delivered: normalizeBoolean(row.is_delivered),
    delivery_scanned_by: mapKnownPerson(row.delivery_scanned_by),
    packing_scanned_by: mapKnownPerson(row.packing_scanned_by),
  }
}

function mapDeliveryOrder(row) {
  return {
    ...pick(row, ['id', 'delivery_date', 'delivery_category', 'group_order', 'channel', 'part_no', 'courier', 'quantity', 'keterangan', 'updated_time']),
    delivery_category: cleanUpper(row.delivery_category),
    group_order: cleanUpper(row.group_order),
    channel: cleanUpper(row.channel),
    courier: cleanUpper(row.courier),
    created_by: mapKnownPerson(row.created_by),
    updated_by: mapKnownPerson(row.updated_by),
  }
}

function mapReturnCase(row) {
  const createdBy = resolveLegacyPic(row.pic, row.group_order)
  return {
    ...pick(row, [
      'id',
      'created_at',
      'updated_at',
      'tanggal_pengajuan',
      'batas_tanggal_retur',
      'internal_external',
      'kode_kejadian',
      'order_id',
      'nama_customer',
      'no_handphone',
      'no_resi_pengiriman',
      'nomor_tim',
      'courier_name',
      'courier_service',
      'retur_reason',
      'retur_action',
      'produk_diretur',
      'produk_pengganti',
      'ongkir_masuk',
      'ongkir_keluar',
      'nilai_refund_kompensasi',
      'keterangan_tambahan',
      'status_barang',
      'total_retur',
      'alamat',
      'note_konsumen',
      'need_prioritized',
    ]),
    group_order: cleanUpper(row.group_order),
    kode_kejadian: cleanUpper(row.kode_kejadian),
    order_id: cleanUpper(row.order_id),
    nama_customer: cleanUpper(row.nama_customer),
    no_resi_pengiriman: cleanText(row.no_resi_pengiriman),
    nomor_tim: cleanUpper(row.nomor_tim),
    courier_name: cleanUpper(row.courier_name),
    courier_service: cleanUpper(row.courier_service),
    need_prioritized: normalizeBoolean(row.need_prioritized) || false,
    created_by: createdBy,
    updated_by: createdBy,
  }
}

function mapOrderIssue(row) {
  const createdBy = resolveLegacyPic(row.pic, row.group_order)
  return {
    ...pick(row, [
      'id',
      'created_at',
      'updated_at',
      'order_id',
      'nama',
      'no_hp',
      'produk_bermasalah',
      'alasan_bermasalah',
      'tindak_lanjut',
      'produk_pengganti',
      'tim',
      'biaya_timbul',
      'keterangan',
    ]),
    group_order: cleanUpper(row.group_order),
    order_id: cleanUpper(row.order_id),
    nama: cleanUpper(row.nama),
    tim: cleanUpper(row.tim),
    created_by: createdBy,
    updated_by: createdBy,
  }
}

function mapManualWaybill(row) {
  return {
    ...pick(row, ['id', 'created_at', 'resi_manual', 'nama', 'no_hp', 'alamat', 'barang', 'harga_paket', 'layanan_courier', 'keterangan']),
    nama_courier: cleanUpper(row.nama_courier),
  }
}

const migrations = [
  {
    source: 'Delivery_Barcode',
    target: 'delivery_barcode',
    order: 'barcode',
    conflict: 'barcode',
    map: mapDeliveryBarcode,
  },
  {
    source: 'Delivery_Order',
    target: 'delivery_order',
    order: 'id',
    conflict: 'id',
    map: mapDeliveryOrder,
  },
  {
    source: 'Error_Retur_Cases',
    target: 'delivery_error_retur_cases',
    order: 'id',
    conflict: 'id',
    map: mapReturnCase,
  },
  {
    source: 'Order_Issue_Cases',
    target: 'delivery_order_issue_cases',
    order: 'id',
    conflict: 'id',
    map: mapOrderIssue,
  },
  {
    source: 'Resi_Manual',
    target: 'delivery_resi_manual',
    order: 'id',
    conflict: 'id,resi_manual',
    map: mapManualWaybill,
  },
]

const sourceKey = requireEnv('LEGACY_DELIVERY_SUPABASE_KEY')
const targetUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const targetKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SECRET_KEY)

const source = createClient(LEGACY_URL, sourceKey, {
  auth: { persistSession: false },
})
const target = createClient(targetUrl, targetKey, {
  auth: { persistSession: false },
})

async function countRows(client, table) {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table}: ${error.message}`)
  return count || 0
}

async function fetchBatch(table, order, from, to) {
  const { data, error } = await source
    .from(table)
    .select('*')
    .order(order, { ascending: true })
    .range(from, to)

  if (error) throw new Error(`${table}: ${error.message}`)
  return data || []
}

async function upsertBatch(table, rows, conflict) {
  if (!rows.length) return
  const { error } = await target.from(table).upsert(rows, {
    onConflict: conflict,
    ignoreDuplicates: false,
  })
  if (error) throw new Error(`${table}: ${error.message}`)
}

async function migrateTable(config) {
  const sourceCount = await countRows(source, config.source)
  const beforeCount = await countRows(target, config.target)
  let migrated = 0

  console.log(`${config.source} -> ${config.target}: source=${sourceCount}, target_before=${beforeCount}`)

  for (let offset = 0; offset < sourceCount; offset += BATCH_SIZE) {
    const rows = await fetchBatch(config.source, config.order, offset, offset + BATCH_SIZE - 1)
    const mappedRows = rows.map(config.map).filter((row) => Object.values(row).some((value) => value !== null && value !== undefined))
    await upsertBatch(config.target, mappedRows, config.conflict)
    migrated += mappedRows.length
    console.log(`  ${config.target}: ${Math.min(offset + BATCH_SIZE, sourceCount)}/${sourceCount}`)
  }

  const afterCount = await countRows(target, config.target)
  console.log(`${config.target}: migrated=${migrated}, target_after=${afterCount}`)
  return { source: config.source, target: config.target, sourceCount, beforeCount, migrated, afterCount }
}

async function run() {
  const startedAt = new Date()
  console.log(`Delivery Report migration started at ${startedAt.toISOString()}`)
  console.log(`Batch size: ${BATCH_SIZE}`)

  const results = []
  for (const config of migrations) {
    results.push(await migrateTable(config))
  }

  console.log('Migration summary:')
  for (const result of results) {
    console.log(`- ${result.target}: source=${result.sourceCount}, migrated=${result.migrated}, target_before=${result.beforeCount}, target_after=${result.afterCount}`)
  }
  console.log(`Delivery Report migration finished at ${new Date().toISOString()}`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
