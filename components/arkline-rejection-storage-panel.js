'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import ArklineReturReportClient from '@/app/dashboard/qc/retur-report/arkline-retur-report-client'
import RejectStorageRelease, { getReleasedQtyBySource, loadRejectStorageOutbounds } from '@/components/reject-storage-release'
import releaseStyles from '@/components/reject-storage-release.module.css'

const supabase = createClient()
const PAGE_SIZE = 1000

async function loadAllRows(table, columns = '*') {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if ((data || []).length < PAGE_SIZE) return rows
  }
}

export default function ArklineRejectionStoragePanel({ userEmail, canAdd = false, canRelease = false, storageViewMode }) {
  const [data, setData] = useState({ storages: [], registrationProducts: [], rejectReasons: [], releaseItems: [], outbounds: [], releaseReady: false, releaseError: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [releaseOpen, setReleaseOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [batches, lines, reasons, products, releaseState] = await Promise.all([
        loadAllRows('arkline_qc_rejection_storage_batches'),
        loadAllRows('arkline_qc_rejection_storage_lines'),
        loadAllRows('arkline_qc_reject_reasons', 'id, reason_name, is_repairable'),
        loadAllRows('arkline_dir_products', 'sku_induk, kategori_produk, nama_produk, is_active'),
        loadRejectStorageOutbounds('ARKLINE')
          .then((rows) => ({ rows, ready: true, error: '' }))
          .catch((loadError) => ({ rows: [], ready: false, error: loadError.message || 'Release history is unavailable.' })),
      ])
      const outbounds = releaseState.rows
      const reasonById = new Map(reasons.map((reason) => [String(reason.id), reason]))
      const releasedByLine = getReleasedQtyBySource(outbounds, 'ARKLINE')
      const batchById = new Map(batches.map((batch) => [String(batch.id), batch]))
      const linesByBatch = new Map()
      lines.forEach((line) => {
        const key = String(line.storage_batch_id)
        const reason = reasonById.get(String(line.reject_reason_id))
        const current = linesByBatch.get(key) || []
        const available = Math.max(0, Number(line.qty || 0) - Number(releasedByLine.get(String(line.id)) || 0))
        if (available <= 0) return
        current.push({
          id: line.id,
          reasonId: line.reject_reason_id,
          reasonName: reason?.reason_name || line.reason_snapshot || 'Not recorded',
          grade: line.grade,
          size: String(line.size || 'No size').trim().toUpperCase(),
          qty: available,
          sourceType: batchById.get(key)?.source_type || (line.delivery_return_item_id ? 'DELIVERY_REJECT' : line.reject_detail_id ? 'QC_REJECT' : 'PACKING_REJECT'),
        })
        linesByBatch.set(key, current)
      })
      setData({
        storages: batches.map((batch) => ({
          id: batch.id,
          storageNumber: batch.storage_number,
          poId: batch.po_id,
          poItemId: batch.arkline_po_item_id,
          skuInduk: batch.sku_induk,
          modelName: batch.model_name_snapshot,
          supplierName: batch.supplier_name_snapshot,
          roundNumber: Number(batch.round_number || 1),
          storageDate: batch.storage_date,
          updatedAt: batch.updated_at,
          storedQty: (linesByBatch.get(String(batch.id)) || []).reduce((sum, line) => sum + line.qty, 0),
          status: batch.status,
          sourceType: batch.source_type || 'QC_REJECT',
          inventorySource: batch.inventory_source || null,
          sourceLocationLabel: batch.source_location_label || null,
          notes: batch.notes || '',
          createdBy: batch.created_by || '',
          lines: linesByBatch.get(String(batch.id)) || [],
        })),
        registrationProducts: products
          .map((product) => ({
            id: String(product.sku_induk || '').trim(),
            skuInduk: String(product.sku_induk || '').trim(),
            productName: String(product.nama_produk || 'Arkline Product').trim(),
            categoryName: product.kategori_produk || '',
            isActive: product.is_active !== false,
            poId: '',
            supplierName: '',
          }))
          .filter((product) => product.skuInduk)
          .sort((a, b) => a.productName.localeCompare(b.productName, undefined, { numeric: true })),
        rejectReasons: reasons.map((reason) => ({
          id: reason.id,
          name: reason.reason_name || 'Reject reason',
          isRepairable: reason.is_repairable === true,
        })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
        releaseItems: lines.map((line) => {
          const batch = batchById.get(String(line.storage_batch_id))
          return {
            id: line.id,
            koli: batch?.storage_number || '-',
            name: batch?.model_name_snapshot || batch?.sku_induk || 'Arkline item',
            sku: batch?.sku_induk || '',
            size: line.size,
            grade: line.grade,
            available: batch?.status === 'STORED' ? Math.max(0, Number(line.qty || 0) - Number(releasedByLine.get(String(line.id)) || 0)) : 0,
          }
        }),
        outbounds,
        releaseReady: releaseState.ready,
        releaseError: releaseState.error,
      })
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'Could not load Arkline reject storage.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  if (loading) return <p>Loading Arkline reject storage...</p>
  if (error) return <p role="alert">{error}</p>

  return (
    <>
    {data.releaseError ? <p role="alert">Release feature unavailable: {data.releaseError}. Run supabase/reject_storage_outbound.sql.</p> : null}
    <ArklineReturReportClient
      storageOnly
      eligibleRows={[]}
      batches={[]}
      storages={data.storages}
      registrationProducts={data.registrationProducts}
      rejectReasons={data.rejectReasons}
      userEmail={userEmail}
      canAdd={canAdd}
      onStorageChanged={refresh}
      storageViewMode={storageViewMode}
      releaseAction={canRelease ? (
        <button type="button" className={releaseStyles.releaseButton} onClick={() => setReleaseOpen(true)} disabled={!data.releaseReady || !data.releaseItems.some((item) => item.available > 0)} title="Release from Koli" aria-label="Release from Koli">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14" /><path d="m12 6 6 6-6 6" /><path d="M20 4v16" /></svg>
        </button>
      ) : null}
    />
    {data.outbounds.length > 0 ? <section className={releaseStyles.log} aria-label="Arkline reject release history"><h3>Release History</h3><div className={releaseStyles.logScroll}><table><thead><tr><th>Date</th><th>Koli</th><th>Item</th><th>Qty</th><th>Reason</th><th>Destination</th><th>By</th></tr></thead><tbody>{data.outbounds.slice(0, 100).map((row) => { const item = data.releaseItems.find((entry) => String(entry.id) === String(row.arkline_line_id)); return <tr key={row.id}><td>{new Date(row.released_at).toLocaleString('id-ID')}</td><td>{item?.koli || '-'}</td><td>{item?.name || '-'} / {item?.size || '-'}</td><td>{row.qty}</td><td>{row.reason}</td><td>{row.destination || '-'}</td><td>{row.released_by || '-'}</td></tr> })}</tbody></table></div></section> : null}
    {releaseOpen ? <RejectStorageRelease sourceType="ARKLINE" items={data.releaseItems} outbounds={data.outbounds} onSaved={refresh} onClose={() => setReleaseOpen(false)} /> : null}
    </>
  )
}
