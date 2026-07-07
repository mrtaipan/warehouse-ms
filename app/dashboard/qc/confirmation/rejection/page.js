'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()

function formatDateDisplay(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function TakeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  )
}

function ReturnIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-2" />
    </svg>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '20px',
    border: '1px solid #dbe4f0',
    borderRadius: '12px',
    background: '#ffffff',
    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.06)',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    paddingBottom: '6px',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    flexWrap: 'wrap',
  },
  closeIconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    minWidth: '38px',
    height: '38px',
    padding: 0,
    border: '1px solid #fecaca',
    borderRadius: '10px',
    background: '#fff',
    color: '#dc2626',
    textDecoration: 'none',
  },
  closeIconGlyph: {
    color: '#dc2626',
    fontWeight: '950',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    gap: '12px',
    alignItems: 'stretch',
  },
  grnCard: {
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  grnItemBlock: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e2e8f0',
  },
  grnLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: '6px',
  },
  grnValue: {
    display: 'block',
    color: '#0f172a',
    fontSize: '28px',
    fontWeight: '900',
    lineHeight: 1.05,
    fontVariantNumeric: 'tabular-nums',
    wordBreak: 'break-word',
  },
  infoValue: {
    display: 'block',
    marginTop: '4px',
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: '800',
    lineHeight: 1.25,
    wordBreak: 'break-word',
  },
  headerInfoColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
    gap: '10px',
  },
  infoBox: {
    minHeight: '52px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '10px 12px',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px',
  },
  metricBox: {
    minWidth: 0,
    minHeight: '52px',
    background: '#eef6ff',
    border: '1px solid #dbeafe',
    borderRadius: '10px',
    padding: '10px 12px',
  },
  metricValue: {
    display: 'block',
    marginTop: '4px',
    color: '#111827',
    fontSize: '16px',
    fontWeight: '900',
    lineHeight: 1.15,
    fontVariantNumeric: 'tabular-nums',
    wordBreak: 'break-word',
  },
  eyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: '28px',
    fontWeight: '900',
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  sectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '22px',
    fontWeight: '900',
    letterSpacing: 0,
  },
  sectionSubtitle: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '750',
    color: '#334155',
  },
  input: {
    height: '40px',
    padding: '0 11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    background: '#fff',
    color: '#111827',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
  },
  summaryCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  summaryLabel: {
    fontSize: '10px',
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#64748b',
    letterSpacing: 0,
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#111827',
    fontVariantNumeric: 'tabular-nums',
  },
  note: {
    margin: 0,
    padding: '12px 14px',
    border: '1px solid #fed7aa',
    borderRadius: '10px',
    background: '#fff7ed',
    color: '#9a3412',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  sourceCard: {
    border: '1px solid #dbe4f0',
    borderRadius: '12px',
    padding: '14px',
    display: 'grid',
    gridTemplateColumns: '1.8fr 0.7fr 0.7fr 0.7fr 0.8fr auto auto',
    gap: '12px',
    alignItems: 'center',
  },
  modelMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  modelName: {
    fontWeight: '700',
    color: '#111827',
  },
  modelInfo: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
  },
  qtyBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    alignItems: 'center',
  },
  qtyLabel: {
    fontSize: '10px',
    textTransform: 'uppercase',
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 0,
  },
  qtyValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#111827',
    fontVariantNumeric: 'tabular-nums',
  },
  tableModelCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  tableModelName: {
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '700',
    lineHeight: 1.3,
  },
  tableMutedText: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '650',
    lineHeight: 1.3,
  },
  photoButton: {
    width: '44px',
    height: '44px',
    padding: 0,
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  photoThumb: {
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    objectFit: 'cover',
    display: 'block',
  },
  photoEmpty: {
    width: '44px',
    height: '44px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    fontSize: '10px',
    fontWeight: '800',
    background: '#f8fafc',
  },
  photoPreviewOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'rgba(15, 23, 42, 0.72)',
  },
  photoPreviewWrap: {
    position: 'relative',
    maxWidth: 'min(92vw, 920px)',
    maxHeight: '88vh',
  },
  photoPreviewImage: {
    maxWidth: '100%',
    maxHeight: '88vh',
    borderRadius: '10px',
    objectFit: 'contain',
    display: 'block',
  },
  photoPreviewClose: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '34px',
    height: '34px',
    border: '1px solid rgba(255, 255, 255, 0.72)',
    borderRadius: '999px',
    background: 'rgba(15, 23, 42, 0.72)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  centerCell: {
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  actionCell: {
    minWidth: '170px',
  },
  sourceActionGroup: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  compactInput: {
    height: '36px',
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '86px',
    background: '#fff',
    color: '#111827',
    textAlign: 'center',
  },
  compactButton: {
    height: '34px',
    padding: '0 10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '750',
    cursor: 'pointer',
  },
  iconActionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    minWidth: '34px',
    height: '34px',
    padding: 0,
    borderRadius: '8px',
    cursor: 'pointer',
  },
  takeIconButton: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
  },
  returnIconButton: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  primaryButton: {
    height: '40px',
    padding: '0 15px',
    border: '1px solid #111827',
    borderRadius: '9px',
    background: '#111827',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '750',
    cursor: 'pointer',
  },
  secondaryButton: {
    height: '40px',
    padding: '0 13px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    background: '#fff',
    color: '#334155',
    fontSize: '13px',
    fontWeight: '750',
    cursor: 'pointer',
  },
  redButton: {
    height: '40px',
    padding: '0 15px',
    border: '1px solid #b91c1c',
    borderRadius: '9px',
    background: '#b91c1c',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '750',
    cursor: 'pointer',
  },
  tableWrap: {
    maxHeight: '360px',
    overflow: 'auto',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    minWidth: '760px',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: '800',
    color: '#64748b',
    padding: '11px 12px',
    background: '#f8fafc',
    textTransform: 'uppercase',
    letterSpacing: 0,
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
  },
  td: {
    padding: '12px',
    fontSize: '13px',
    color: '#1e293b',
    borderTop: '1px solid #eef2f7',
  },
  errorText: {
    margin: 0,
    padding: '12px 14px',
    borderRadius: '10px',
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: '13px',
  },
  successText: {
    margin: 0,
    padding: '12px 14px',
    borderRadius: '10px',
    background: '#f0fdf4',
    color: '#166534',
    fontSize: '13px',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
  },
}

function getSourceKey(item) {
  const variantName = item.variant_name || item.model_color || ''

  return `${Number(item.brand_id || 0)}::${Number(item.category_id || 0)}::${String(item.model_name || '').trim().toUpperCase()}::${String(
    variantName
  )
    .trim()
    .toUpperCase()}::${String(item.grade || '').trim().toUpperCase()}`
}

function getModelLabel(item) {
  const variantName = item.variant_name || item.model_color || ''
  return variantName ? `${item.model_name} - ${variantName}` : item.model_name
}

function normalizeReturnRow(item) {
  return {
    ...item,
    model_color: item.variant_name || '',
  }
}

function normalizeQcItemRow(item) {
  return {
    ...item,
    model_color: item.variant_name || item.model_color || '',
  }
}

export default function QcConfirmationRejectionPage() {
  const searchParams = useSearchParams()
  const draftIdRef = useRef(1)
  const [loading, setLoading] = useState(true)
  const [savingTake, setSavingTake] = useState(false)
  const [savingReturn, setSavingReturn] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const grnFilter = searchParams.get('grn') || ''
  const [qcItems, setQcItems] = useState([])
  const [confirmRows, setConfirmRows] = useState([])
  const [returnRows, setReturnRows] = useState([])
  const [productModels, setProductModels] = useState([])
  const [qtyInputs, setQtyInputs] = useState({})
  const [currentTakeKoliItems, setCurrentTakeKoliItems] = useState([])
  const [currentReturnKoliItems, setCurrentReturnKoliItems] = useState([])
  const [adjustmentModelLabel, setAdjustmentModelLabel] = useState('')
  const [adjustmentGrade, setAdjustmentGrade] = useState('B')
  const [adjustmentQty, setAdjustmentQty] = useState('')
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState('')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      const [
        { data: qcData, error: qcError },
        { data: confirmData, error: confirmError },
        { data: returnsData, error: returnsError },
        { data: productModelData, error: productModelError },
      ] = await Promise.all([
        supabase
          .from('qc_items')
          .select(`
            *,
            inbound:inbound_id (
              id,
              grn_number,
              item_name,
              inbound_date,
              suppliers:dir_suppliers!supplier_id (
                supplier_name
              )
            ),
            inbound_unload:inbound_unload_id (
              id,
              brand_id,
              category_id,
              brands:dir_brands!brand_id (
                id,
                brand_name
              ),
              categories:dir_categories!category_id (
                id,
                category_name,
                full_name
              )
            )
          `)
          .eq('status', 'done')
          .order('created_at', { ascending: false }),
        supabase
          .from('qc_confirm')
          .select('id, inbound_id, brand_id, category_id, model_name, model_color, photo_url, qty, koli_sequence, grade, is_adjustment')
          .in('grade', ['B', 'C'])
          .order('koli_sequence', { ascending: true }),
        supabase
          .from('warehouse_returns')
          .select('id, inbound_id, source_phase, brand_id, category_id, model_name, variant_name, qty, koli_sequence, grade, is_adjustment')
          .eq('source_phase', 'qc')
          .order('koli_sequence', { ascending: true }),
        supabase
          .from('dir_product_models')
          .select('id, brand_id, category_id, model_name')
          .eq('is_active', true)
          .order('model_name', { ascending: true }),
      ])

      if (qcError || confirmError || returnsError || productModelError) {
        setError(qcError?.message || confirmError?.message || returnsError?.message || productModelError?.message || 'Failed to load confirmation rejection.')
        setLoading(false)
        return
      }

      setQcItems((qcData || []).map(normalizeQcItemRow))
      setConfirmRows(confirmData || [])
      setReturnRows((returnsData || []).map(normalizeReturnRow))
      setProductModels(productModelData || [])
      setLoading(false)
    }

    loadData()
  }, [])

  const selectedInbound = useMemo(
    () => qcItems.find((item) => item.inbound?.grn_number === grnFilter)?.inbound || null,
    [grnFilter, qcItems]
  )

  const sourceRows = useMemo(() => {
    const grouped = new Map()

    qcItems
      .filter((item) => item.inbound?.grn_number === grnFilter)
      .forEach((item) => {
        ;[
          { grade: 'B', qty: Number(item.qty_b || 0) },
          { grade: 'C', qty: Number(item.qty_c || 0) },
        ]
          .filter((gradeRow) => gradeRow.qty > 0)
          .forEach((gradeRow) => {
            const key = getSourceKey({
              brand_id: item.inbound_unload?.brand_id,
              category_id: item.inbound_unload?.category_id,
              model_name: item.model_name,
              model_color: item.model_color,
              grade: gradeRow.grade,
            })

            const current = grouped.get(key) || {
              key,
              inbound_id: item.inbound_id,
              brand_id: item.inbound_unload?.brand_id || null,
              category_id: item.inbound_unload?.category_id || null,
              brand_name: item.inbound_unload?.brands?.brand_name || 'UNBRANDED',
              category_name:
                item.inbound_unload?.categories?.full_name ||
                item.inbound_unload?.categories?.category_name ||
                'UNCATEGORIZED',
              model_name: item.model_name || 'UNKNOWN MODEL',
              model_color: item.model_color || '',
              photo_url: item.photo_url || '',
              grade: gradeRow.grade,
              source_qty: 0,
              taken_qty: 0,
              returned_qty: 0,
            }

            if (!current.photo_url && item.photo_url) {
              current.photo_url = item.photo_url
            }
            current.source_qty += gradeRow.qty
            grouped.set(key, current)
          })
      })

    confirmRows
      .filter((item) => Number(item.inbound_id) === Number(selectedInbound?.id))
      .forEach((item) => {
        const key = getSourceKey(item)
        const current = grouped.get(key)
        if (current) {
          current.taken_qty += Number(item.qty || 0)
          grouped.set(key, current)
        }
      })

    returnRows
      .filter((item) => Number(item.inbound_id) === Number(selectedInbound?.id))
      .forEach((item) => {
        const key = getSourceKey(item)
        const current = grouped.get(key)
        if (current) {
          current.returned_qty += Number(item.qty || 0)
          grouped.set(key, current)
        }
      })

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.brand_name !== b.brand_name) return a.brand_name.localeCompare(b.brand_name)
      if (a.category_name !== b.category_name) return a.category_name.localeCompare(b.category_name)
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade)
      return getModelLabel(a).localeCompare(getModelLabel(b))
    })
  }, [confirmRows, grnFilter, qcItems, returnRows, selectedInbound?.id])

  const totals = useMemo(
    () =>
      sourceRows.reduce(
        (result, item) => {
          result.source += Number(item.source_qty || 0)
          result.taken += Number(item.taken_qty || 0)
          result.returned += Number(item.returned_qty || 0)
          return result
        },
        { source: 0, taken: 0, returned: 0 }
      ),
    [sourceRows]
  )
  const totalRejectKoli = useMemo(() => {
    const sequences = new Set()
    confirmRows
      .filter((item) => Number(item.inbound_id) === Number(selectedInbound?.id))
      .forEach((item) => sequences.add(`take-${Number(item.koli_sequence || 0)}`))
    returnRows
      .filter((item) => Number(item.inbound_id) === Number(selectedInbound?.id))
      .forEach((item) => sequences.add(`return-${Number(item.koli_sequence || 0)}`))
    return sequences.size
  }, [confirmRows, returnRows, selectedInbound?.id])
  const adjustmentModelOptions = useMemo(
    () => productModels.map((item) => ({
      ...item,
      label: item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name,
    })),
    [productModels]
  )
  const selectedAdjustmentModel = adjustmentModelOptions.find((item) => item.label === adjustmentModelLabel) || null

  function getDraftQty(sourceKey, type) {
    const target = type === 'take' ? currentTakeKoliItems : currentReturnKoliItems
    return target.filter((item) => item.source_key === sourceKey).reduce((sum, item) => sum + Number(item.qty || 0), 0)
  }

  function handleAddDecision(row, type) {
    setError('')
    setSuccess('')

    const nextQty = Number(qtyInputs[row.key] || 0)
    const maxAllowed =
      Math.max(0, Number(row.source_qty || 0) - Number(row.taken_qty || 0) - Number(row.returned_qty || 0) - getDraftQty(row.key, 'take') - getDraftQty(row.key, 'return'))

    if (nextQty <= 0) {
      setError('Qty must be greater than 0.')
      return
    }

    if (nextQty > maxAllowed) {
      setError(`Qty for ${row.model_name} grade ${row.grade} cannot be greater than the remaining qty (${maxAllowed}).`)
      return
    }

    const item = {
      id: `${type}-${draftIdRef.current++}`,
      source_key: row.key,
      inbound_id: row.inbound_id,
      brand_id: row.brand_id,
      category_id: row.category_id,
      model_name: row.model_name,
      model_color: row.model_color,
      qty: nextQty,
      grade: row.grade,
    }

    if (type === 'take') {
      setCurrentTakeKoliItems((prev) => [...prev, item])
    } else {
      setCurrentReturnKoliItems((prev) => [...prev, item])
    }

    setQtyInputs((prev) => ({
      ...prev,
      [row.key]: '',
    }))
  }

  function handleAddAdjustmentItem(type) {
    setError('')
    setSuccess('')

    if (!selectedInbound) {
      setError('Choose a GRN first.')
      return
    }

    if (!selectedAdjustmentModel) {
      setError('Choose an adjustment model first.')
      return
    }

    const nextQty = Number(adjustmentQty || 0)
    if (nextQty <= 0) {
      setError('Adjustment qty must be greater than 0.')
      return
    }

    const nextItem = {
      id: `adjust-${type}-${draftIdRef.current++}`,
      source_key: `adjustment::${type}::${selectedAdjustmentModel.id}::${adjustmentGrade}`,
      inbound_id: selectedInbound.id,
      brand_id: selectedAdjustmentModel.brand_id || null,
      category_id: selectedAdjustmentModel.category_id || null,
      model_name: selectedAdjustmentModel.model_name,
      model_color: selectedAdjustmentModel.model_color || '',
      qty: nextQty,
      grade: adjustmentGrade,
      is_adjustment: true,
    }

    if (type === 'take') {
      setCurrentTakeKoliItems((prev) => [...prev, nextItem])
    } else {
      setCurrentReturnKoliItems((prev) => [...prev, nextItem])
    }

    setAdjustmentModelLabel('')
    setAdjustmentGrade('B')
    setAdjustmentQty('')
  }

  function removeDraftItem(type, draftId) {
    if (type === 'take') {
      setCurrentTakeKoliItems((prev) => prev.filter((item) => item.id !== draftId))
      return
    }

    setCurrentReturnKoliItems((prev) => prev.filter((item) => item.id !== draftId))
  }

  async function handlePostTakeKoli() {
    setError('')
    setSuccess('')

    if (!selectedInbound) {
      setError('Choose a GRN first.')
      return
    }

    if (!currentTakeKoliItems.length) {
      setError('Take koli is still empty.')
      return
    }

    setSavingTake(true)
    const nextKoliSequence =
      confirmRows
        .filter((item) => Number(item.inbound_id) === Number(selectedInbound.id))
        .reduce((maxValue, item) => Math.max(maxValue, Number(item.koli_sequence || 0)), 0) + 1

    const payload = currentTakeKoliItems.map((item) => ({
      inbound_id: item.inbound_id,
      brand_id: item.brand_id,
      category_id: item.category_id,
      model_name: item.model_name,
      model_color: item.model_color || null,
      qty: Number(item.qty || 0),
      koli_sequence: nextKoliSequence,
      grade: item.grade,
      is_adjustment: Boolean(item.is_adjustment),
    }))

    const { data, error: insertError } = await supabase
      .from('qc_confirm')
      .insert(payload)
      .select('id, inbound_id, brand_id, category_id, model_name, model_color, photo_url, qty, koli_sequence, grade, is_adjustment')

    if (insertError) {
      setError(insertError.message)
      setSavingTake(false)
      return
    }

    setConfirmRows((prev) => [...prev, ...(data || [])])
    setCurrentTakeKoliItems([])
    setSuccess(`Take koli ${nextKoliSequence} posted to next process.`)
    setSavingTake(false)
  }

  async function handlePostReturnKoli() {
    setError('')
    setSuccess('')

    if (!selectedInbound) {
      setError('Choose a GRN first.')
      return
    }

    if (!currentReturnKoliItems.length) {
      setError('Return koli is still empty.')
      return
    }

    setSavingReturn(true)
    const nextKoliSequence =
      returnRows
        .filter((item) => Number(item.inbound_id) === Number(selectedInbound.id))
        .reduce((maxValue, item) => Math.max(maxValue, Number(item.koli_sequence || 0)), 0) + 1

    const payload = currentReturnKoliItems.map((item) => ({
      inbound_id: item.inbound_id,
      brand_id: item.brand_id,
      category_id: item.category_id,
      model_name: item.model_name,
      variant_name: item.model_color || null,
      qty: Number(item.qty || 0),
      koli_sequence: nextKoliSequence,
      grade: item.grade,
      source_phase: 'qc',
      is_adjustment: Boolean(item.is_adjustment),
    }))

    const { data, error: insertError } = await supabase
      .from('warehouse_returns')
      .insert(payload)
      .select('id, inbound_id, source_phase, brand_id, category_id, model_name, variant_name, qty, koli_sequence, grade, is_adjustment')

    if (insertError) {
      setError(insertError.message)
      setSavingReturn(false)
      return
    }

    setReturnRows((prev) => [...prev, ...(data || []).map(normalizeReturnRow)])
    setCurrentReturnKoliItems([])
    setSuccess(`Return koli ${nextKoliSequence} posted to returns.`)
    setSavingReturn(false)
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading confirmation rejection...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.topBar}>
          <div>
            <p style={styles.eyebrow}>Grading Verification</p>
            <h1 style={styles.title}>Rejection Grade</h1>
          </div>
          <Link href="/dashboard/qc/confirmation" style={styles.closeIconButton} aria-label="Back to Grading Verification" title="Back to Grading Verification">
            <span style={styles.closeIconGlyph}>
              <XIcon />
            </span>
          </Link>
        </div>

        {error ? <p style={styles.errorText}>{error}</p> : null}
        {success ? <p style={styles.successText}>{success}</p> : null}

        <div style={styles.contentGrid}>
          <div style={styles.grnCard}>
            <span style={styles.grnLabel}>GRN Number</span>
            <strong style={styles.grnValue}>{selectedInbound?.grn_number || grnFilter || '-'}</strong>
            <div style={styles.grnItemBlock}>
              <span style={styles.grnLabel}>Item Name</span>
              <strong style={styles.infoValue}>{selectedInbound?.item_name || '-'}</strong>
            </div>
          </div>

          <div style={styles.headerInfoColumn}>
            <div style={styles.infoGrid}>
              <div style={styles.infoBox}>
                <span style={styles.grnLabel}>Inbound Date</span>
                <strong style={styles.infoValue}>{formatDateDisplay(selectedInbound?.inbound_date)}</strong>
              </div>
              <div style={styles.infoBox}>
                <span style={styles.grnLabel}>Supplier</span>
                <strong style={styles.infoValue}>{selectedInbound?.suppliers?.supplier_name || '-'}</strong>
              </div>
            </div>

            <div style={styles.metricGrid}>
              <div style={styles.metricBox}>
                <span style={styles.grnLabel}>Initial</span>
                <strong style={styles.metricValue}>{formatNumber(totals.source)}</strong>
              </div>
              <div style={styles.metricBox}>
                <span style={styles.grnLabel}>Taken</span>
                <strong style={styles.metricValue}>{formatNumber(totals.taken)}</strong>
              </div>
              <div style={styles.metricBox}>
                <span style={styles.grnLabel}>Returned</span>
                <strong style={styles.metricValue}>{formatNumber(totals.returned)}</strong>
              </div>
              <div style={styles.metricBox}>
                <span style={styles.grnLabel}>Total Koli</span>
                <strong style={styles.metricValue}>{formatNumber(totalRejectKoli)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        {!grnFilter ? <p style={styles.emptyText}>Open this page from Grading Verification first.</p> : null}
        {grnFilter && !sourceRows.length ? <p style={styles.emptyText}>No Grade B / C source found for this GRN.</p> : null}

        {grnFilter && sourceRows.length ? (
          <div style={styles.tableWrap}>
            <table style={{ ...styles.table, minWidth: '1120px' }}>
              <thead>
                <tr>
                  <th style={styles.th}>Brand</th>
                  <th style={styles.th}>Picture</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Model-Variant</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Grade</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Initial</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Taken</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Returned</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Remaining</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Qty</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Take</th>
                  <th style={{ ...styles.th, ...styles.centerCell }}>Return</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((row) => {
                  const remainingQty = Math.max(
                    0,
                    Number(row.source_qty || 0) -
                      Number(row.taken_qty || 0) -
                      Number(row.returned_qty || 0) -
                      getDraftQty(row.key, 'take') -
                      getDraftQty(row.key, 'return')
                  )
                  const isActionDisabled = remainingQty <= 0

                  return (
                    <tr key={row.key}>
                      <td style={styles.td}>{row.brand_name}</td>
                      <td style={styles.td}>
                        {row.photo_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoUrl(row.photo_url)}
                            style={styles.photoButton}
                            aria-label={`Preview ${getModelLabel(row)} photo`}
                            title="Preview photo"
                          >
                            <img src={row.photo_url} alt={getModelLabel(row)} style={styles.photoThumb} />
                          </button>
                        ) : (
                          <span style={styles.photoEmpty}>NO</span>
                        )}
                      </td>
                      <td style={styles.td}>{row.category_name}</td>
                      <td style={styles.td}>
                        <span style={styles.tableModelName}>{getModelLabel(row)}</span>
                      </td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>{row.grade}</td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>{formatNumber(row.source_qty)}</td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>{formatNumber(row.taken_qty)}</td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>{formatNumber(row.returned_qty)}</td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>{formatNumber(remainingQty)}</td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>
                        <input
                          type="number"
                          min="0"
                          value={qtyInputs[row.key] || ''}
                          onChange={(event) =>
                            setQtyInputs((prev) => ({
                              ...prev,
                              [row.key]: event.target.value,
                            }))
                          }
                          style={styles.compactInput}
                          placeholder="Qty"
                          disabled={isActionDisabled}
                        />
                      </td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>
                        <button
                          type="button"
                          onClick={() => handleAddDecision(row, 'take')}
                          style={{
                            ...styles.iconActionButton,
                            ...styles.takeIconButton,
                            ...(isActionDisabled ? { opacity: 0.55, cursor: 'not-allowed' } : {}),
                          }}
                          disabled={isActionDisabled}
                          aria-label={`Take ${getModelLabel(row)} grade ${row.grade}`}
                          title="Take"
                        >
                          <TakeIcon />
                        </button>
                      </td>
                      <td style={{ ...styles.td, ...styles.centerCell }}>
                        <button
                          type="button"
                          onClick={() => handleAddDecision(row, 'return')}
                          style={{
                            ...styles.iconActionButton,
                            ...styles.returnIconButton,
                            ...(isActionDisabled ? { opacity: 0.55, cursor: 'not-allowed' } : {}),
                          }}
                          disabled={isActionDisabled}
                          aria-label={`Return ${getModelLabel(row)} grade ${row.grade}`}
                          title="Return"
                        >
                          <ReturnIcon />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Adjustment</h2>
        </div>

        {!grnFilter ? <p style={styles.emptyText}>Choose a GRN Number first.</p> : null}

        {grnFilter ? (
          <>
            <div style={styles.summaryGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Adjustment Model</label>
                <input
                  list="qc-rejection-adjustment-models"
                  value={adjustmentModelLabel}
                  onChange={(event) => setAdjustmentModelLabel(event.target.value)}
                  style={styles.input}
                  placeholder="Choose model"
                />
                <datalist id="qc-rejection-adjustment-models">
                  {adjustmentModelOptions.map((item) => (
                    <option key={item.id} value={item.label} />
                  ))}
                </datalist>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Adjustment Grade</label>
                <select value={adjustmentGrade} onChange={(event) => setAdjustmentGrade(event.target.value)} style={styles.input}>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Adjustment Qty</label>
                <input
                  type="number"
                  min="0"
                  value={adjustmentQty}
                  onChange={(event) => setAdjustmentQty(event.target.value)}
                  style={styles.input}
                  placeholder="Qty"
                />
              </div>
            </div>

            <div style={styles.buttonRow}>
              <button type="button" onClick={() => handleAddAdjustmentItem('take')} style={styles.secondaryButton}>
                Add Adjustment to Take
              </button>
              <button type="button" onClick={() => handleAddAdjustmentItem('return')} style={styles.redButton}>
                Add Adjustment to Return
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Take Koli</h2>
        </div>

        {!currentTakeKoliItems.length ? <p style={styles.emptyText}>Take koli is still empty.</p> : null}

        {currentTakeKoliItems.length ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Model</th>
                  <th style={styles.th}>Grade</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentTakeKoliItems.map((item, index) => (
                  <tr key={`${item.id}-${item.grade || 'take'}-${index}`}>
                    <td style={styles.td}>{getModelLabel(item)}</td>
                    <td style={styles.td}>
                      {item.grade}
                      {item.is_adjustment ? ' - Adjustment' : ''}
                    </td>
                    <td style={styles.td}>{formatNumber(item.qty)}</td>
                    <td style={styles.td}>
                      <button type="button" onClick={() => removeDraftItem('take', item.id)} style={styles.secondaryButton}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div style={styles.buttonRow}>
          <button
            type="button"
            onClick={handlePostTakeKoli}
            disabled={savingTake || !currentTakeKoliItems.length}
            style={{
              ...styles.primaryButton,
              ...(savingTake || !currentTakeKoliItems.length ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
          >
            {savingTake ? 'Posting...' : 'Post Take Koli'}
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Return Koli</h2>
        </div>

        {!currentReturnKoliItems.length ? <p style={styles.emptyText}>Return koli is still empty.</p> : null}

        {currentReturnKoliItems.length ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Model</th>
                  <th style={styles.th}>Grade</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentReturnKoliItems.map((item, index) => (
                  <tr key={`${item.id}-${item.grade || 'return'}-${index}`}>
                    <td style={styles.td}>{getModelLabel(item)}</td>
                    <td style={styles.td}>
                      {item.grade}
                      {item.is_adjustment ? ' - Adjustment' : ''}
                    </td>
                    <td style={styles.td}>{formatNumber(item.qty)}</td>
                    <td style={styles.td}>
                      <button type="button" onClick={() => removeDraftItem('return', item.id)} style={styles.secondaryButton}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div style={styles.buttonRow}>
          <button
            type="button"
            onClick={handlePostReturnKoli}
            disabled={savingReturn || !currentReturnKoliItems.length}
            style={{
              ...styles.redButton,
              ...(savingReturn || !currentReturnKoliItems.length ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
          >
            {savingReturn ? 'Posting...' : 'Post Return Koli'}
          </button>
        </div>
      </div>
      {previewPhotoUrl ? (
        <div style={styles.photoPreviewOverlay} role="dialog" aria-modal="true" onClick={() => setPreviewPhotoUrl('')}>
          <div style={styles.photoPreviewWrap} onClick={(event) => event.stopPropagation()}>
            <img src={previewPhotoUrl} alt="Product preview" style={styles.photoPreviewImage} />
            <button type="button" onClick={() => setPreviewPhotoUrl('')} style={styles.photoPreviewClose} aria-label="Close preview">
              X
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
