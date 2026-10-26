'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import ArklineReturReportClient from '@/app/dashboard/qc/retur-report/arkline-retur-report-client'

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

export default function ArklineRejectionStoragePanel({ userEmail, canAdd = false }) {
  const [data, setData] = useState({ storages: [], registrationProducts: [], rejectReasons: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [batches, lines, reasons, products] = await Promise.all([
        loadAllRows('arkline_qc_rejection_storage_batches'),
        loadAllRows('arkline_qc_rejection_storage_lines'),
        loadAllRows('arkline_qc_reject_reasons', 'id, reason_name, is_repairable'),
        loadAllRows('arkline_dir_products', 'sku_induk, kategori_produk, nama_produk, is_active'),
      ])
      const reasonById = new Map(reasons.map((reason) => [String(reason.id), reason]))
      const linesByBatch = new Map()
      lines.forEach((line) => {
        const key = String(line.storage_batch_id)
        const reason = reasonById.get(String(line.reject_reason_id))
        const current = linesByBatch.get(key) || []
        current.push({
          id: line.id,
          reasonId: line.reject_reason_id,
          reasonName: reason?.reason_name || line.reason_snapshot || 'Not recorded',
          grade: line.grade,
          size: String(line.size || 'No size').trim().toUpperCase(),
          qty: Number(line.qty || 0),
          sourceType: line.delivery_return_item_id ? 'DELIVERY_REJECT' : line.reject_detail_id ? 'QC_REJECT' : 'PACKING_REJECT',
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
          storedQty: Number(batch.stored_qty || 0),
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
    />
  )
}
