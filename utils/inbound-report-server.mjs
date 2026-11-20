import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { jsPDF } from 'jspdf'
import { buildSampleQcRows, groupSampleQcByCategory } from './inbound-sample-qc-report.mjs'
import { drawInboundReportPdf, inboundReportPdfFilename } from './inbound-report-pdf.mjs'

async function allRows(query, pageSize = 1000) {
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

async function lookupRows(client, table, columns, ids) {
  const uniqueIds = [...new Set(ids.map(Number).filter(Boolean))]
  const rows = []
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    rows.push(...await allRows(client.from(table).select(columns).in('id', uniqueIds.slice(offset, offset + 100))))
  }
  return rows
}

function hasSampleProductIdentity(row) {
  if (row.product_model_variant_id) return true
  const modelName = String(row.model_name || '').trim().toUpperCase()
  const variantName = String(row.variant_name || '').trim().toUpperCase()
  return !['', 'SAMPLE', 'TEMPORARY', 'TEMPORARY SAMPLE'].includes(modelName) &&
    !['', 'SAMPLE', 'TEMPORARY'].includes(variantName)
}

export async function loadInboundReportData(client, inboundId) {
  const { data: inbound, error } = await client.from('inbound')
    .select('id, grn_number, item_name, total_claimed_qty, total_received_qty, suppliers:dir_suppliers!supplier_id(supplier_name)')
    .eq('id', inboundId)
    .single()
  if (error || !inbound) throw new Error(error?.message || 'GRN not found.')

  const [unloadRows, breakdownRows, qcItems] = await Promise.all([
    allRows(client.from('inbound_unload')
      .select('id, inbound_id, brand_id, category_id, product_model_id, product_model_variant_id, model_name, variant_name, photo_url, qty, is_sample, is_product_temporary, koli_sequence')
      .eq('inbound_id', inboundId).order('id')),
    allRows(client.from('inbound_sample_model_breakdowns')
      .select('id, inbound_unload_id, brand_id, category_id, product_model_id, product_model_variant_id, model_name, variant_name, photo_url, qty')
      .eq('inbound_id', inboundId).order('id')),
    allRows(client.from('qc_items')
      .select('id, inbound_unload_id, qc_type, qty_a, qty_b, qty_c')
      .eq('inbound_id', inboundId).order('id')),
  ])

  const brandIds = [...unloadRows, ...breakdownRows].map((row) => row.brand_id)
  const categoryIds = [...unloadRows, ...breakdownRows].map((row) => row.category_id)
  const variantIds = [...unloadRows, ...breakdownRows].map((row) => row.product_model_variant_id)
  const [brands, categories, variants] = await Promise.all([
    lookupRows(client, 'dir_brands', 'id, brand_name', brandIds),
    lookupRows(client, 'dir_categories', 'id, full_name, category_name', categoryIds),
    lookupRows(client, 'dir_product_model_variants', 'id, product_model_id, variant_name, variant_photo_url', variantIds),
  ])
  const modelIds = [...unloadRows, ...breakdownRows].map((row) => row.product_model_id)
    .concat(variants.map((variant) => variant.product_model_id))
  const models = await lookupRows(client, 'dir_product_models', 'id, model_name', modelIds)
  const brandById = new Map(brands.map((row) => [Number(row.id), row.brand_name]))
  const categoryById = new Map(categories.map((row) => [Number(row.id), row.full_name || row.category_name]))
  const variantById = new Map(variants.map((row) => [Number(row.id), row]))
  const modelById = new Map(models.map((row) => [Number(row.id), row.model_name]))

  const modelGroups = new Map()
  const modelSources = [
    ...unloadRows.filter((row) => !row.is_sample || (!row.is_product_temporary && hasSampleProductIdentity(row))),
    ...breakdownRows,
  ]
  for (const row of modelSources) {
    const variant = variantById.get(Number(row.product_model_variant_id))
    const modelName = modelById.get(Number(variant?.product_model_id || row.product_model_id)) || row.model_name || '-'
    const variantName = variant?.variant_name || row.variant_name || ''
    const key = [row.brand_id, row.category_id, variant?.id || row.product_model_variant_id || `${modelName}:${variantName}:${row.photo_url}`].join(':')
    const current = modelGroups.get(key) || {
      brandName: brandById.get(Number(row.brand_id)) || '-',
      categoryLabel: categoryById.get(Number(row.category_id)) || '-',
      modelLabel: [modelName, variantName].filter(Boolean).join(' - '),
      photoUrl: variant?.variant_photo_url || row.photo_url || '',
      modelQty: 0,
    }
    current.modelQty += Number(row.qty || 0)
    modelGroups.set(key, current)
  }
  const modelRows = [...modelGroups.values()].sort((a, b) => b.modelQty - a.modelQty || a.modelLabel.localeCompare(b.modelLabel))

  const sampleRows = unloadRows.filter((row) => row.is_sample)
  const sampleIds = new Set(sampleRows.map((row) => Number(row.id)))
  const sampleQcItems = qcItems.filter((row) => sampleIds.has(Number(row.inbound_unload_id)))
  const qcSplits = []
  for (let offset = 0; offset < sampleQcItems.length; offset += 100) {
    const ids = sampleQcItems.slice(offset, offset + 100).map((row) => row.id)
    qcSplits.push(...await allRows(client.from('qc_sample_breakdowns')
      .select('id, qc_item_id, sample_breakdown_id, qty_a, qty_b, qty_c')
      .in('qc_item_id', ids).order('id')))
  }
  const sampleQcRows = groupSampleQcByCategory(buildSampleQcRows({
    sampleRows, qcItems: sampleQcItems, sampleBreakdowns: breakdownRows, qcSplits,
  }).filter((row) => row.checkedQty > 0))
    .map((row) => ({
      ...row,
      brandName: brandById.get(Number(row.brand_id)) || '-',
      categoryName: categoryById.get(Number(row.category_id)) || '-',
    }))
    .sort((a, b) => `${a.brandName} ${a.categoryName}`.localeCompare(`${b.brandName} ${b.categoryName}`))

  return {
    grnNumber: inbound.grn_number,
    supplierName: inbound.suppliers?.supplier_name || '-',
    itemName: inbound.item_name || '-',
    sjQty: inbound.total_claimed_qty,
    receivingQty: inbound.total_received_qty,
    intakeQty: unloadRows.reduce((sum, row) => sum + Number(row.qty || 0), 0),
    sampleQcRows,
    modelRows,
    shownQty: modelRows.reduce((sum, row) => sum + row.modelQty, 0),
    inbound,
  }
}

async function loadPhoto(url, storageOrigin) {
  if (!url) return ''
  try {
    const target = new URL(url)
    if (target.origin !== storageOrigin || !target.pathname.startsWith('/storage/v1/object/public/product-photos/')) return ''
    const response = await fetch(target, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) return ''
    const type = response.headers.get('content-type')?.split(';')[0]
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return ''
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > 4_000_000) return ''
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return ''
  }
}

export async function createServerInboundReportPdf(report) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const fontDir = path.join(process.cwd(), 'public', 'fonts', 'open-sans')
  const [regular, semibold] = await Promise.all([
    readFile(path.join(fontDir, 'OpenSans-Regular.ttf')),
    readFile(path.join(fontDir, 'OpenSans-SemiBold.ttf')),
  ])
  doc.addFileToVFS('OpenSans-Regular.ttf', regular.toString('base64'))
  doc.addFileToVFS('OpenSans-SemiBold.ttf', semibold.toString('base64'))
  doc.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal')
  doc.addFont('OpenSans-SemiBold.ttf', 'OpenSans', 'bold')
  const storageOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  const photoUrls = [...new Set(report.modelRows.map((row) => row.photoUrl).filter(Boolean))]
  const photos = new Map()
  for (let offset = 0; offset < photoUrls.length; offset += 4) {
    const entries = await Promise.all(photoUrls.slice(offset, offset + 4)
      .map(async (url) => [url, await loadPhoto(url, storageOrigin)]))
    entries.forEach(([url, data]) => photos.set(url, data))
  }
  drawInboundReportPdf(doc, report, photos, 'OpenSans')
  return { bytes: Buffer.from(doc.output('arraybuffer')), filename: inboundReportPdfFilename(report.grnNumber) }
}
