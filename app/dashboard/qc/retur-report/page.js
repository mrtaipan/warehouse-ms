import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import ReturReportClient from './retur-report-client'
import ArklineReturReportClient from './arkline-retur-report-client'
import reportStyles from './retur-report.module.css'
import { loadAccessContext } from '@/utils/access-control'
import { hasPermission } from '@/utils/permissions'

function ReturModeTabs({ activeMode }) {
  return (
    <nav className={reportStyles.modeTabs} aria-label="Return report type">
      <Link
        href="/dashboard/qc/retur-report?mode=regular"
        className={`${reportStyles.modeTab} ${activeMode === 'regular' ? reportStyles.modeTabActive : ''}`}
      >
        Reguler
      </Link>
      <Link
        href="/dashboard/qc/retur-report?mode=arkline"
        className={`${reportStyles.modeTab} ${activeMode === 'arkline' ? reportStyles.modeTabActive : ''}`}
      >
        Arkline
      </Link>
    </nav>
  )
}

function ReturnReportShell({ activeMode, children }) {
  return (
    <section className={reportStyles.returnReportShell}>
      <div className={reportStyles.returnReportHeader}>
        <div className={reportStyles.returnReportTitleWrap}>
          <div>
            <p className={reportStyles.returnReportEyebrow}>Quality Control</p>
            <h1 className={reportStyles.returnReportTitle}>Return Report</h1>
          </div>
          <ReturModeTabs activeMode={activeMode} />
        </div>
      </div>
      <div className={reportStyles.returnReportBody}>{children}</div>
    </section>
  )
}

async function loadArklineReturnData(supabase) {
  const [detailResult, qcResult, reasonResult, batchResult, lineResult, receiptResult, poResult] = await Promise.all([
    supabase.from('arkline_qc_reject_details').select('*').order('created_at', { ascending: false }),
    supabase
      .from('arkline_qc')
      .select('id, qc_cycle_id, qc_round_number, qc_type, source_return_batch_id, source_receipt_group_id, po_id, arkline_po_item_id, sku_induk, model_name'),
    supabase.from('arkline_qc_reject_reasons').select('id, reason_name, is_repairable'),
    supabase.from('arkline_qc_return_batches').select('*').order('created_at', { ascending: false }),
    supabase.from('arkline_qc_return_batch_lines').select('*'),
    supabase
      .from('arkline_po_item_receipts')
      .select('source_return_batch_id, source_return_batch_line_id, received_qty')
      .eq('receipt_type', 'REWORK_RETURN'),
    supabase.from('arkline_pos').select('po_id, supplier_name'),
  ])

  const firstError = [detailResult, qcResult, reasonResult, batchResult, lineResult, receiptResult, poResult].find(
    (result) => result.error
  )?.error
  if (firstError) {
    throw new Error(firstError.message)
  }

  const qcById = new Map((qcResult.data || []).map((row) => [String(row.id), row]))
  const reasonById = new Map((reasonResult.data || []).map((row) => [String(row.id), row]))
  const supplierByPo = new Map((poResult.data || []).map((row) => [String(row.po_id), row.supplier_name || '']))
  const returnedByDetail = new Map()
  ;(lineResult.data || []).forEach((line) => {
    const key = String(line.reject_detail_id)
    returnedByDetail.set(key, Number(returnedByDetail.get(key) || 0) + Number(line.qty || 0))
  })

  const eligibleRows = (detailResult.data || [])
    .map((detail) => {
      const availableQty = Math.max(0, Number(detail.qty || 0) - Number(returnedByDetail.get(String(detail.id)) || 0))
      const qc = qcById.get(String(detail.arkline_qc_id)) || {}
      const reason = reasonById.get(String(detail.reject_reason_id)) || {}
      const poId = detail.po_id || qc.po_id || ''
      return {
        id: detail.id,
        qcId: detail.arkline_qc_id,
        qcCycleId: qc.qc_cycle_id || detail.arkline_qc_id,
        qcRoundNumber: Number(qc.qc_round_number || 1),
        qcType: qc.qc_type || 'INITIAL',
        sourceReturnBatchId: qc.source_return_batch_id || null,
        sourceReceiptGroupId: qc.source_receipt_group_id || null,
        poId,
        poItemId: detail.arkline_po_item_id || qc.arkline_po_item_id || '',
        skuInduk: detail.sku_induk || qc.sku_induk || '',
        modelName: detail.model_name || qc.model_name || 'Arkline Product',
        grade: detail.grade,
        size: detail.size,
        reasonId: detail.reject_reason_id,
        reasonName: reason.reason_name || 'Reject reason',
        isRepairable: reason.is_repairable === true,
        availableQty,
        supplierName: supplierByPo.get(String(poId)) || '',
      }
    })
    .filter((row) => row.poId && row.poItemId && row.availableQty > 0)

  const receiptsByLine = new Map()
  ;(receiptResult.data || []).forEach((receipt) => {
    const key = String(receipt.source_return_batch_line_id || '')
    receiptsByLine.set(key, Number(receiptsByLine.get(key) || 0) + Number(receipt.received_qty || 0))
  })
  const linesByBatch = new Map()
  ;(lineResult.data || []).forEach((line) => {
    const reason = reasonById.get(String(line.reject_reason_id)) || {}
    const normalized = {
      id: line.id,
      reasonId: line.reject_reason_id,
      reasonName: reason.reason_name || 'Reject reason',
      grade: line.grade,
      size: line.size,
      qty: Number(line.qty || 0),
      receivedQty: Number(receiptsByLine.get(String(line.id)) || 0),
    }
    const key = String(line.return_batch_id)
    linesByBatch.set(key, [...(linesByBatch.get(key) || []), normalized])
  })

  const batches = (batchResult.data || []).map((batch) => ({
    id: batch.id,
    returnNumber: batch.return_number,
    poId: batch.po_id,
    poItemId: batch.arkline_po_item_id,
    skuInduk: batch.sku_induk,
    modelName: batch.model_name_snapshot,
    supplierName: batch.supplier_name_snapshot,
    roundNumber: Number(batch.round_number || 1),
    returnDate: batch.return_date,
    sentQty: Number(batch.sent_qty || 0),
    returnedQty: Number(batch.returned_qty || 0),
    shortQty: Number(batch.short_qty || 0),
    status: batch.status,
    lines: linesByBatch.get(String(batch.id)) || [],
  }))

  return { eligibleRows, batches }
}

export default async function QcReturReportPage({ searchParams }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { permissions, isAdmin } = await loadAccessContext(supabase, user, 'role')
  const canAdd = hasPermission(permissions, 'qc.retur_report.add', isAdmin)
  const canEdit = hasPermission(permissions, 'qc.retur_report.edit', isAdmin)

  const params = await searchParams
  const activeMode = params?.mode === 'arkline' ? 'arkline' : 'regular'

  if (activeMode === 'arkline') {
    let arklineData = null
    let arklineError = null
    try {
      arklineData = await loadArklineReturnData(supabase)
    } catch (loadError) {
      arklineError = loadError
    }

    return (
      <div className={reportStyles.page}>
        <ReturnReportShell activeMode={activeMode}>
          {arklineError ? (
            <div className={reportStyles.card}>
              <p className={reportStyles.error}>Arkline return data could not be loaded: {arklineError.message}</p>
              <p className={reportStyles.notice}>Run `supabase/arkline_qc_return_rework.sql` in Supabase before using this flow.</p>
            </div>
          ) : (
            <ArklineReturReportClient
              eligibleRows={arklineData?.eligibleRows || []}
              batches={arklineData?.batches || []}
              userEmail={user.email || ''}
              canAdd={canAdd}
              canEdit={canEdit}
            />
          )}
        </ReturnReportShell>
      </div>
    )
  }

  const { data: rows, error } = await supabase
    .from('warehouse_returns')
    .select(`
      *,
      inbound:inbound_id (
        id,
        grn_number,
        inbound_date,
        payment_on_site,
        suppliers:dir_suppliers!supplier_id (
          supplier_name
        )
      ),
      brands:dir_brands!brand_id (
        brand_name
      ),
      categories:dir_categories!category_id (
        category_name,
        full_name
      )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className={reportStyles.page}>
      <ReturnReportShell activeMode={activeMode}>
        {error ? (
          <section className={reportStyles.regularArrangementPanel}>
            <p className={reportStyles.error}>Error: {error.message}</p>
          </section>
        ) : (
          <ReturReportClient rows={rows || []} canAdd={canAdd} />
        )}
      </ReturnReportShell>
    </div>
  )
}
