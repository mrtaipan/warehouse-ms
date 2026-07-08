'use client'

import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()

const styles = {
  overviewPanel: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '22px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  overviewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  eyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  overviewTitle: {
    margin: '4px 0 0',
    fontSize: '28px',
    lineHeight: 1.05,
    fontWeight: 900,
    color: '#0f172a',
  },
  overviewSubtitle: {
    margin: '6px 0 0',
    color: '#475569',
    fontSize: '13px',
    lineHeight: 1.45,
    maxWidth: '640px',
  },
  overviewPrimaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40px',
    padding: '0 16px',
    border: 'none',
    background: '#111827',
    color: '#fff',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  topIconGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  topIconButton: {
    width: '58px',
    height: '58px',
    borderRadius: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '20px',
    fontWeight: 900,
  },
  inputIconButton: {
    background: '#0f766e',
    color: '#fff',
    boxShadow: '0 16px 32px rgba(15, 118, 110, 0.16)',
  },
  closeIconButton: {
    background: '#fff',
    color: '#dc2626',
    borderColor: '#fecaca',
  },
  overviewTableWrap: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    overflowX: 'auto',
  },
  overviewTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  overviewHeadRow: {
    background: '#f8fafc',
  },
  overviewBodyRow: {
    borderTop: '1px solid #f1f5f9',
  },
  overviewTh: {
    padding: '12px 14px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 800,
    color: '#475569',
    whiteSpace: 'nowrap',
  },
  overviewTd: {
    padding: '12px 14px',
    fontSize: '13px',
    color: '#0f172a',
    whiteSpace: 'nowrap',
  },
  detailInfoRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    alignItems: 'stretch',
  },
  grnHeroCard: {
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '18px',
    padding: '22px',
  },
  grnHeroLabel: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
    fontWeight: 800,
    textTransform: 'uppercase',
  },
  grnHeroValue: {
    margin: '10px 0 0',
    color: '#020617',
    fontSize: '36px',
    lineHeight: 1,
    fontWeight: 900,
  },
  detailInfoBox: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  detailInfoLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 800,
    textTransform: 'uppercase',
  },
  detailInfoValue: {
    display: 'block',
    marginTop: '8px',
    color: '#0f172a',
    fontSize: '18px',
    fontWeight: 800,
  },
  variancePill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '72px',
    minHeight: '32px',
    padding: '0 12px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 900,
  },
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    width: '100%',
    maxWidth: '560px',
    margin: '0 auto',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6b7280',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '20px',
  },
  sectionSubtitle: {
    margin: '4px 0 0',
    color: '#6b7280',
    fontSize: '14px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '8px',
  },
  summaryCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#111827',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    minHeight: '44px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
    background: '#fff',
  },
  select: {
    minHeight: '44px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
    background: '#fff',
  },
  dropdownWrap: {
    position: 'relative',
  },
  dropdownButton: {
    minHeight: '44px',
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    fontSize: '14px',
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  dropdownButtonText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    boxShadow: '0 16px 32px rgba(15, 23, 42, 0.12)',
    maxHeight: '260px',
    overflowY: 'auto',
    zIndex: 10,
    padding: '6px',
  },
  dropdownItem: {
    width: '100%',
    border: 'none',
    background: '#fff',
    borderRadius: '8px',
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: '14px',
    color: '#111827',
    cursor: 'pointer',
  },
  dropdownItemValidated: {
    color: '#15803d',
    fontWeight: '700',
  },
  dropdownItemActive: {
    background: '#f3f4f6',
  },
  previewButton: {
    width: '36px',
    height: '36px',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readonlyBox: {
    minHeight: '44px',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#f9fafb',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
  },
  modelRow: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
    alignItems: 'end',
  },
  qtyStatus: {
    fontSize: '13px',
    fontWeight: '700',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  primaryButton: {
    minHeight: '44px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '8px',
    background: '#111827',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    minHeight: '44px',
    padding: '0 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  successText: {
    margin: 0,
    color: '#16a34a',
    fontWeight: '600',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
    fontWeight: '600',
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 40,
  },
  modal: {
    width: '100%',
    maxWidth: '520px',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  previewImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '70vh',
    objectFit: 'contain',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  overviewList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  overviewRow: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '12px',
    alignItems: 'center',
  },
  overviewMeta: {
    margin: '6px 0 0',
    color: '#6b7280',
    fontSize: '13px',
  },
}

function getModelKey(modelName, modelColor) {
  return `${String(modelName || '').trim().toUpperCase()}::${String(modelColor || '').trim().toUpperCase()}`
}

function getModelLabel(item) {
  return item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name
}

function buildPackingRows(confirmRows) {
  const grouped = new Map()

  ;(confirmRows || []).forEach((item) => {
    const key = getModelKey(item.model_name, item.model_color)
    const current = grouped.get(key) || {
      id: `source-${key}`,
      source_key: key,
      model_name: item.model_name || '',
      model_color: item.model_color || '',
      photo_url: item.photo_url || '',
      qty: 0,
    }

    current.qty += Number(item.qty || 0)
    current.photo_url = current.photo_url || item.photo_url || ''
    grouped.set(key, current)
  })

  return Array.from(grouped.values()).sort((a, b) => getModelLabel(a).localeCompare(getModelLabel(b)))
}

function createDraftRows(sourceRows) {
  return sourceRows.map((row) => ({
    id: `draft-${row.source_key}`,
    source_key: row.source_key,
    model_name: row.model_name,
    model_color: row.model_color,
    photo_url: row.photo_url || '',
    qty: String(row.qty || 0),
  }))
}

export default function PackingListReceivingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialGrn = searchParams.get('grn') || ''
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [koliMenuOpen, setKoliMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmRows, setConfirmRows] = useState([])
  const [validationSummaryRows, setValidationSummaryRows] = useState([])
  const [productModels, setProductModels] = useState([])
  const [grnFilter, setGrnFilter] = useState('')
  const [selectedSourceKey, setSelectedSourceKey] = useState('')
  const [draftRows, setDraftRows] = useState([])
  const [validationRows, setValidationRows] = useState([])
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [showInputForm, setShowInputForm] = useState(false)
  const [detailGrn, setDetailGrn] = useState(initialGrn)

  useEffect(() => {
    if (!initialGrn) {
      router.replace('/dashboard/packing-list')
    }
  }, [initialGrn, router])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      const [
        { data: confirmData, error: confirmError },
        { data: validationSummaryData, error: validationSummaryError },
        { data: productModelData, error: productModelError },
      ] = await Promise.all([
        supabase
          .from('qc_confirm')
          .select(`
            id,
            inbound_id,
            model_name,
            model_color:variant_name,
            photo_url,
            qty,
            koli_sequence,
            inbound:inbound_id (
              id,
              grn_number,
              inbound_date,
              suppliers:dir_suppliers!supplier_id (
                supplier_name
              )
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('pl_receiving')
          .select('id, inbound_id, source_koli_sequence, source_qty, received_qty, qty_diff, validated_at')
          .order('validated_at', { ascending: false }),
        supabase
          .from('dir_product_models')
          .select('id, model_name')
          .eq('is_active', true)
          .order('model_name', { ascending: true }),
      ])

      if (confirmError || validationSummaryError || productModelError) {
        setError(confirmError?.message || validationSummaryError?.message || productModelError?.message || 'Failed to load packing list receiving.')
        setLoading(false)
        return
      }

      setConfirmRows(confirmData || [])
      setValidationSummaryRows(validationSummaryData || [])
      setProductModels(productModelData || [])
      setLoading(false)
    }

    loadData()
  }, [])

  const grnOptions = useMemo(
    () => Array.from(new Set(confirmRows.map((item) => item.inbound?.grn_number).filter(Boolean))),
    [confirmRows]
  )

  const overviewRows = useMemo(() => {
    const validatedMap = new Map()

    validationSummaryRows.forEach((row) => {
      validatedMap.set(`${row.inbound_id}::${Number(row.source_koli_sequence || 0)}`, true)
    })

    const grouped = new Map()

    confirmRows.forEach((item) => {
      const inboundId = item.inbound?.id || item.inbound_id || 0
      const current = grouped.get(inboundId) || {
        inbound_id: inboundId,
        grn_number: item.inbound?.grn_number || '-',
        inbound_date: item.inbound?.inbound_date || null,
        supplier_name: item.inbound?.suppliers?.supplier_name || '-',
        total_qty: 0,
        koliSet: new Set(),
        validatedSet: new Set(),
      }
      const koliSequence = Number(item.koli_sequence || 0)

      current.total_qty += Number(item.qty || 0)
      current.koliSet.add(koliSequence)
      if (validatedMap.has(`${inboundId}::${koliSequence}`)) {
        current.validatedSet.add(koliSequence)
      }
      grouped.set(inboundId, current)
    })

    return Array.from(grouped.values())
      .map((row) => ({
        inbound_id: row.inbound_id,
        grn_number: row.grn_number,
        inbound_date: row.inbound_date,
        supplier_name: row.supplier_name,
        total_qty: row.total_qty,
        total_koli: row.koliSet.size,
        validated_koli: row.validatedSet.size,
        pending_koli: Math.max(0, row.koliSet.size - row.validatedSet.size),
      }))
      .sort((a, b) => new Date(b.inbound_date || 0).getTime() - new Date(a.inbound_date || 0).getTime())
  }, [confirmRows, validationSummaryRows])

  const selectedDetail = overviewRows.find((row) => row.grn_number === detailGrn) || null
  const detailKoliRows = useMemo(() => {
    if (!detailGrn) return []

    const validationMap = new Map()
    validationSummaryRows.forEach((row) => {
      const key = `${row.inbound_id}::${Number(row.source_koli_sequence || 0)}`
      const current = validationMap.get(key) || {
        source_qty: 0,
        received_qty: 0,
        qty_diff: 0,
        validated_at: row.validated_at || null,
      }

      current.source_qty += Number(row.source_qty || 0)
      current.received_qty += Number(row.received_qty || 0)
      current.qty_diff += Number(row.qty_diff || 0)
      current.validated_at =
        !current.validated_at || new Date(row.validated_at || 0) > new Date(current.validated_at || 0)
          ? row.validated_at
          : current.validated_at
      validationMap.set(key, current)
    })

    const grouped = new Map()
    confirmRows
      .filter((item) => item.inbound?.grn_number === detailGrn)
      .forEach((item) => {
        const inboundId = item.inbound?.id || item.inbound_id || 0
        const koliSequence = Number(item.koli_sequence || 0)
        const key = `${inboundId}::${koliSequence}`
        const validationInfo = validationMap.get(key) || null
        const current = grouped.get(key) || {
          key,
          inbound_id: inboundId,
          koli_sequence: koliSequence,
          qc_confirm_qty: 0,
          received_qty: 0,
          qty_diff: 0,
          validated_at: null,
          is_validated: false,
        }

        current.qc_confirm_qty += Number(item.qty || 0)
        current.received_qty = validationInfo ? Number(validationInfo.received_qty || 0) : current.received_qty
        current.qty_diff = validationInfo ? Number(validationInfo.qty_diff || 0) : current.qty_diff
        current.validated_at = validationInfo?.validated_at || null
        current.is_validated = Boolean(validationInfo)
        grouped.set(key, current)
      })

    return Array.from(grouped.values()).sort((a, b) => a.koli_sequence - b.koli_sequence)
  }, [confirmRows, detailGrn, validationSummaryRows])
  const detailTotals = useMemo(
    () =>
      detailKoliRows.reduce(
        (summary, row) => ({
          qcConfirmQty: summary.qcConfirmQty + Number(row.qc_confirm_qty || 0),
          receivedQty: summary.receivedQty + Number(row.received_qty || 0),
          validatedKoli: summary.validatedKoli + (row.is_validated ? 1 : 0),
          pendingKoli: summary.pendingKoli + (row.is_validated ? 0 : 1),
        }),
        { qcConfirmQty: 0, receivedQty: 0, validatedKoli: 0, pendingKoli: 0 }
      ),
    [detailKoliRows]
  )
  const detailVariance = detailTotals.receivedQty - detailTotals.qcConfirmQty

  const selectedInbound = useMemo(
    () => confirmRows.find((item) => item.inbound?.grn_number === grnFilter)?.inbound || null,
    [confirmRows, grnFilter]
  )

  const sourceOptions = useMemo(() => {
    const validatedMap = new Map()

    validationSummaryRows.forEach((row) => {
      const key = `${row.inbound_id}::${Number(row.source_koli_sequence || 0)}`
      const current = validatedMap.get(key)

      if (!current || new Date(row.validated_at || 0) > new Date(current.validated_at || 0)) {
        validatedMap.set(key, row)
      }
    })

    const grouped = new Map()

    confirmRows
      .filter((item) => item.inbound?.grn_number === grnFilter)
      .forEach((item) => {
        const inboundId = item.inbound?.id || item.inbound_id || 0
        const koliSequence = Number(item.koli_sequence || 0)
        const key = `koli:${Number(item.koli_sequence || 0)}`
        const validationKey = `${inboundId}::${koliSequence}`
        const validationInfo = validatedMap.get(validationKey) || null
        const current = grouped.get(key) || {
          key,
          label: `Koli ${item.koli_sequence || '-'}`,
          koli_sequence: koliSequence,
          isValidated: Boolean(validationInfo),
          validatedAt: validationInfo?.validated_at || null,
          rows: [],
        }

        current.isValidated = Boolean(validationInfo)
        current.validatedAt = validationInfo?.validated_at || null
        current.rows.push(item)
        grouped.set(key, current)
      })

    return Array.from(grouped.values()).sort((a, b) => a.koli_sequence - b.koli_sequence)
  }, [confirmRows, grnFilter, validationSummaryRows])

  const selectedSource = sourceOptions.find((item) => item.key === selectedSourceKey) || null
  const sourceRows = useMemo(() => buildPackingRows(selectedSource?.rows || []), [selectedSource])
  const sourceRowMap = useMemo(() => {
    const grouped = new Map()

    ;(selectedSource?.rows || []).forEach((item) => {
      const key = getModelKey(item.model_name, item.model_color)
      const current = grouped.get(key) || {
        source_key: key,
        model_name: item.model_name || '',
        model_color: item.model_color || '',
        photo_url: item.photo_url || '',
        qty: 0,
        qcConfirmIds: [],
      }

      current.qty += Number(item.qty || 0)
      current.photo_url = current.photo_url || item.photo_url || ''
      current.qcConfirmIds.push(item.id)
      grouped.set(key, current)
    })

    return grouped
  }, [selectedSource])
  const modelOptions = useMemo(
    () =>
      productModels.map((item) => ({
        ...item,
        label: item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name,
      })),
    [productModels]
  )
  const productModelMap = useMemo(() => {
    const mapped = new Map()
    productModels.forEach((item) => {
      mapped.set(getModelKey(item.model_name, item.model_color), item)
    })
    return mapped
  }, [productModels])

  useEffect(() => {
    async function loadValidationRows() {
      if (!selectedInbound?.id || !selectedSource?.koli_sequence) {
        setValidationRows([])
        setDraftRows([])
        return
      }

      const { data, error: loadError } = await supabase
        .from('pl_receiving')
        .select(`
          id,
          source_qc_confirm_id,
          model_name,
          model_color,
          source_qty,
          received_qty,
          qty_diff,
          validation_batch,
          validated_at
        `)
        .eq('inbound_id', selectedInbound.id)
        .eq('source_koli_sequence', selectedSource.koli_sequence)
        .order('validated_at', { ascending: false })
        .order('id', { ascending: false })

      if (loadError) {
        setValidationRows([])
        setDraftRows(createDraftRows(sourceRows))
        setError(loadError.message || 'Failed to load saved packing list validation.')
        return
      }

      const nextRows = data || []
      setValidationRows(nextRows)

      if (!nextRows.length) {
        setDraftRows(createDraftRows(sourceRows))
        return
      }

      setDraftRows(
        nextRows.map((row, index) => {
          const sourceKey = getModelKey(row.model_name, row.model_color)
          const matchedSource = sourceRowMap.get(sourceKey)
          const matchedModel = productModelMap.get(sourceKey)

          return {
            id: `saved-${row.id || index}`,
            source_key: matchedSource?.source_key || '',
            model_name: row.model_name || '',
            model_color: row.model_color || '',
            photo_url: matchedSource?.photo_url || matchedModel?.photo_url || '',
            qty: String(row.received_qty || 0),
          }
        })
      )
    }

    loadValidationRows()
  }, [productModelMap, selectedInbound?.id, selectedSource?.koli_sequence, sourceRowMap, sourceRows])

  function handleGrnChange(value) {
    setGrnFilter(value)
    setSelectedSourceKey('')
    setKoliMenuOpen(false)
    setDraftRows([])
    setError('')
    setSuccess('')
  }

  function openInputForm(nextGrn = detailGrn) {
    setGrnFilter(nextGrn)
    setDetailGrn(nextGrn || detailGrn)
    setSelectedSourceKey('')
    setKoliMenuOpen(false)
    setDraftRows([])
    setValidationRows([])
    setError('')
    setSuccess('')
    setShowInputForm(true)
  }

  function backToOverview() {
    router.push('/dashboard/packing-list')
  }

  function backToDetail() {
    setShowInputForm(false)
    setGrnFilter('')
    setSelectedSourceKey('')
    setKoliMenuOpen(false)
    setDraftRows([])
    setValidationRows([])
    setError('')
    setSuccess('')
  }

  function handleSourceChange(nextSourceKey) {
    setSelectedSourceKey(nextSourceKey)
    setKoliMenuOpen(false)
    setError('')
    setSuccess('')

    const nextSource = sourceOptions.find((item) => item.key === nextSourceKey) || null
    setDraftRows(nextSource ? createDraftRows(buildPackingRows(nextSource.rows || [])) : [])
  }

  function updateDraftRow(rowId, updates) {
    setDraftRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row)))
  }

  function addDraftRow() {
    setDraftRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${prev.length}`,
        source_key: '',
        model_name: '',
        model_color: '',
        qty: '',
      },
    ])
  }

  function removeDraftRow(rowId) {
    setDraftRows((prev) => prev.filter((row) => row.id !== rowId))
  }

  function applyModelSelection(rowId, nextLabel) {
    const selectedModel = modelOptions.find((item) => item.label === nextLabel) || null

    updateDraftRow(rowId, {
      model_name: selectedModel?.model_name || nextLabel,
      model_color: selectedModel?.model_color || '',
      photo_url: selectedModel?.photo_url || '',
    })
  }

  const comparisonRows = useMemo(() => {
    const sourceMap = new Map(sourceRows.map((row) => [getModelKey(row.model_name, row.model_color), row]))
    const draftMap = new Map()

    draftRows.forEach((row) => {
      const key = getModelKey(row.model_name, row.model_color)
      if (!key || key === '::') {
        return
      }

      const current = draftMap.get(key) || {
        model_name: row.model_name,
        model_color: row.model_color,
        qty: 0,
      }

      current.qty += Number(row.qty || 0)
      draftMap.set(key, current)
    })

    const allKeys = Array.from(new Set([...sourceMap.keys(), ...draftMap.keys()]))

    return allKeys
      .map((key) => {
        const sourceRow = sourceMap.get(key)
        const draftRow = draftMap.get(key)
        const sourceQty = Number(sourceRow?.qty || 0)
        const receivedQty = Number(draftRow?.qty || 0)
        const qtyDiff = receivedQty - sourceQty

        return {
          key,
          model_name: draftRow?.model_name || sourceRow?.model_name || '',
          model_color: draftRow?.model_color || sourceRow?.model_color || '',
          sourceQty,
          receivedQty,
          qtyDiff,
          isMatch: sourceQty === receivedQty,
        }
      })
      .sort((a, b) => getModelLabel(a).localeCompare(getModelLabel(b)))
  }, [draftRows, sourceRows])

  const sourceTotalQty = sourceRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const receivedTotalQty = draftRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const isValidated = Boolean(selectedSource?.isValidated)

  async function handleValidate() {
    setError('')

    const invalidRow = draftRows.find((row) => !String(row.model_name || '').trim() || Number(row.qty || 0) <= 0)
    if (invalidRow) {
      setSuccess('')
      setError('Every received row must have a model and qty greater than 0.')
      return
    }

    if (!selectedInbound || !selectedSource) {
      setSuccess('')
      setError('Choose GRN and Koli first.')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const validationBatch = `${selectedInbound.id}-${selectedSource.koli_sequence}-${Date.now()}`
    const payload = comparisonRows
      .filter((row) => row.sourceQty > 0 || row.receivedQty > 0)
      .map((row) => {
      let mismatchType = 'MATCH'

      if (row.sourceQty === 0 && row.receivedQty > 0) {
        mismatchType = 'NEW_MODEL'
      } else if (row.sourceQty > 0 && row.receivedQty === 0) {
        mismatchType = 'MISSING_FROM_RECEIVING'
      } else if (row.qtyDiff !== 0) {
        mismatchType = 'QTY_DIFF'
      }

      const sourceRow = sourceRowMap.get(row.key)

      return {
        inbound_id: selectedInbound.id,
        source_koli_sequence: selectedSource.koli_sequence,
        source_qc_confirm_id: sourceRow?.qcConfirmIds?.[0] || null,
        model_name: row.model_name,
        model_color: row.model_color || null,
        source_qty: row.sourceQty,
        received_qty: row.receivedQty,
        qty_diff: row.qtyDiff,
        validation_batch: validationBatch,
        validated_by: user?.email || null,
        is_match: row.isMatch,
        mismatch_type: mismatchType,
      }
    })

    setSaving(true)
    setSuccess('')

    const { error: deleteError } = await supabase
      .from('pl_receiving')
      .delete()
      .eq('inbound_id', selectedInbound.id)
      .eq('source_koli_sequence', selectedSource.koli_sequence)

    if (deleteError) {
      setSaving(false)
      setError(deleteError.message || 'Failed to clear previous packing list validation.')
      return
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from('pl_receiving')
      .insert(payload)
      .select(`
        id,
        inbound_id,
        source_koli_sequence,
        source_qc_confirm_id,
        model_name,
        model_color,
        source_qty,
        received_qty,
        qty_diff,
        validation_batch,
        validated_at
      `)
      .order('validated_at', { ascending: false })
      .order('id', { ascending: false })

    setSaving(false)

    if (insertError) {
      setError(insertError.message || 'Failed to save packing list validation.')
      return
    }

    setValidationRows(insertedRows || [])
    setValidationSummaryRows((prev) => {
      const nextKey = `${selectedInbound.id}::${selectedSource.koli_sequence}`
      const remaining = prev.filter(
        (row) => `${row.inbound_id}::${Number(row.source_koli_sequence || 0)}` !== nextKey
      )

      return [
        ...((insertedRows || []).map((row) => ({
          id: row.id,
          inbound_id: row.inbound_id,
          source_koli_sequence: row.source_koli_sequence,
          source_qty: row.source_qty,
          received_qty: row.received_qty,
          qty_diff: row.qty_diff,
          validated_at: row.validated_at,
        }))),
        ...remaining,
      ]
    })

    const mismatchCount = payload.filter((row) => !row.is_match).length
    if (!mismatchCount) {
      setSuccess(`Receiving validated for ${selectedInbound.grn_number} ${selectedSource.label}.`)
      return
    }

    setSuccess(`Receiving validated. ${mismatchCount} row still differs from QC Confirm.`)
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading packing list receiving...</p>
  }

  if (!initialGrn) {
    return <p style={styles.emptyText}>Redirecting to Packing List overview...</p>
  }

  if (!showInputForm && selectedDetail) {
    return (
      <section style={styles.overviewPanel}>
        <div style={styles.overviewHeader}>
          <div>
            <p style={styles.eyebrow}>Packing List</p>
            <h1 style={styles.overviewTitle}>Receiving</h1>
            <p style={styles.overviewSubtitle}>Validate QC Confirm data for this GRN before size breakdown.</p>
          </div>

          <div style={styles.topIconGroup}>
            <button
              type="button"
              onClick={() => openInputForm(selectedDetail.grn_number)}
              style={{ ...styles.topIconButton, ...styles.inputIconButton }}
              title="Open receiving input"
              aria-label="Open receiving input"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 5H7.6C6.16 5 5 6.16 5 7.6V18.4C5 19.84 6.16 21 7.6 21H16.4C17.84 21 19 19.84 19 18.4V7.6C19 6.16 17.84 5 16.4 5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M9 5C9 3.9 9.9 3 11 3H13C14.1 3 15 3.9 15 5V6.5H9V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M9 16H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={backToOverview}
              style={{ ...styles.topIconButton, ...styles.closeIconButton }}
              title="Back to Packing List overview"
              aria-label="Back to Packing List overview"
            >
              X
            </button>
          </div>
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>QC Confirm Qty</span>
            <strong style={styles.summaryValue}>{detailTotals.qcConfirmQty}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Received Qty</span>
            <strong style={styles.summaryValue}>{detailTotals.receivedQty}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Variance</span>
            <strong style={{ ...styles.summaryValue, color: detailVariance === 0 ? '#111827' : detailVariance > 0 ? '#15803d' : '#dc2626' }}>
              {detailVariance > 0 ? '+' : ''}
              {detailVariance}
            </strong>
          </div>
        </div>

        <div style={styles.detailInfoRow}>
          <div style={styles.grnHeroCard}>
            <p style={styles.grnHeroLabel}>GRN Number</p>
            <h2 style={styles.grnHeroValue}>{selectedDetail.grn_number}</h2>
          </div>

          <div style={styles.detailInfoBox}>
            <span style={styles.detailInfoLabel}>Supplier</span>
            <span style={styles.detailInfoValue}>{selectedDetail.supplier_name || '-'}</span>
          </div>
        </div>

        <div style={styles.overviewTableWrap}>
          <table style={styles.overviewTable}>
            <thead>
              <tr style={styles.overviewHeadRow}>
                <th style={styles.overviewTh}>No</th>
                <th style={styles.overviewTh}>Koli</th>
                <th style={styles.overviewTh}>QC Confirm Qty</th>
                <th style={styles.overviewTh}>Received Qty</th>
                <th style={styles.overviewTh}>Variance</th>
                <th style={styles.overviewTh}>Status</th>
              </tr>
            </thead>
            <tbody>
              {detailKoliRows.map((row, index) => {
                const variance = Number(row.received_qty || 0) - Number(row.qc_confirm_qty || 0)
                const varianceStyle =
                  variance === 0
                    ? { background: '#ecfdf5', color: '#047857', border: '1px solid #bbf7d0' }
                    : variance > 0
                      ? { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }
                      : { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }

                return (
                  <tr key={row.key} style={styles.overviewBodyRow}>
                    <td style={styles.overviewTd}>{index + 1}</td>
                    <td style={styles.overviewTd}>Koli {row.koli_sequence || '-'}</td>
                    <td style={styles.overviewTd}>{row.qc_confirm_qty}</td>
                    <td style={styles.overviewTd}>{row.is_validated ? row.received_qty : '-'}</td>
                    <td style={styles.overviewTd}>
                      <span style={{ ...styles.variancePill, ...varianceStyle }}>
                        {variance > 0 ? '+' : ''}
                        {variance}
                      </span>
                    </td>
                    <td style={{ ...styles.overviewTd, color: row.is_validated ? '#15803d' : '#dc2626', fontWeight: 800 }}>
                      {row.is_validated ? 'Validated' : 'Pending'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.buttonRow}>
          <div style={{ flex: 1 }}>
            <h1 style={styles.title}>Receiving Input</h1>
            <p style={styles.subtitle}>
              Validate the received packing list against QC Confirm by GRN and Koli.
            </p>
          </div>
          <button type="button" onClick={backToDetail} style={styles.secondaryButton}>
            Back
          </button>
        </div>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>GRN Number</label>
            <input
              list="packing-list-receiving-grn-options"
              value={grnFilter}
              onChange={(event) => handleGrnChange(event.target.value)}
              style={styles.input}
              placeholder="Type or choose GRN Number"
            />
            <datalist id="packing-list-receiving-grn-options">
              {grnOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Koli</label>
            {sourceOptions.length ? (
              <div style={styles.dropdownWrap}>
                <button type="button" style={styles.dropdownButton} onClick={() => setKoliMenuOpen((prev) => !prev)}>
                  <span style={styles.dropdownButtonText}>
                    {selectedSource ? (selectedSource.isValidated ? `${selectedSource.label} - Validated` : selectedSource.label) : 'Choose Koli'}
                  </span>
                  <span aria-hidden="true">{koliMenuOpen ? '▲' : '▼'}</span>
                </button>
                {koliMenuOpen ? (
                  <div style={styles.dropdownMenu}>
                    {sourceOptions.map((row) => (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => handleSourceChange(row.key)}
                        style={{
                          ...styles.dropdownItem,
                          ...(row.isValidated ? styles.dropdownItemValidated : {}),
                          ...(selectedSourceKey === row.key ? styles.dropdownItemActive : {}),
                        }}
                      >
                        {row.isValidated ? `${row.label} - Validated` : row.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={styles.readonlyBox}>{grnFilter ? 'No Koli from QC Confirm yet.' : 'Choose GRN first'}</div>
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Receiving Status</label>
            <div style={styles.readonlyBox}>
              {selectedInbound && selectedSource ? (isValidated ? 'Validated' : 'Pending Validation') : '-'}
            </div>
          </div>
        </div>

        {error ? <p style={styles.errorText}>{error}</p> : null}
        {success ? <p style={styles.successText}>{success}</p> : null}

        {selectedSource ? (
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>QC Confirm Qty</span>
              <strong style={styles.summaryValue}>{sourceTotalQty}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Received Qty</span>
              <strong style={styles.summaryValue}>{receivedTotalQty}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Difference</span>
              <strong style={{ ...styles.summaryValue, color: receivedTotalQty - sourceTotalQty === 0 ? '#111827' : receivedTotalQty - sourceTotalQty > 0 ? '#16a34a' : '#dc2626' }}>
                {receivedTotalQty - sourceTotalQty > 0 ? '+' : ''}
                {receivedTotalQty - sourceTotalQty}
              </strong>
            </div>
          </div>
        ) : null}
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Received Validation</h2>
          <p style={styles.sectionSubtitle}>
            Adjust the received rows below. If the model is not the same, choose the correct model. If needed, add a new row.
          </p>
        </div>

        {isValidated ? <p style={styles.successText}>Koli ini sudah validated di Receiving.</p> : null}

        {!selectedSource ? <p style={styles.emptyText}>Choose GRN and Koli first to validate packing list receiving.</p> : null}

        {selectedSource
          ? draftRows.map((row) => {
              return (
                <div key={row.id} style={styles.modelRow}>
                  <div style={styles.field}>
                    <label style={styles.label}>Photo</label>
                    <div style={styles.readonlyBox}>
                      {row.photo_url ? (
                        <button
                          type="button"
                          style={styles.previewButton}
                          title="Preview photo"
                          onClick={() => setPreviewPhoto({ url: row.photo_url, label: getModelLabel(row) })}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M2 12C3.9 8.5 7.4 6 12 6C16.6 6 20.1 8.5 22 12C20.1 15.5 16.6 18 12 18C7.4 18 3.9 15.5 2 12Z"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                        </button>
                      ) : (
                        '-'
                      )}
                    </div>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Received Model</label>
                    <input
                      list="packing-list-model-options"
                      value={getModelLabel(row)}
                      onChange={(event) => applyModelSelection(row.id, event.target.value)}
                      style={styles.input}
                      placeholder="Choose model"
                      disabled={isValidated}
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Received Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={row.qty}
                      onChange={(event) => updateDraftRow(row.id, { qty: event.target.value })}
                      style={styles.input}
                      disabled={isValidated}
                    />
                  </div>

                  <div style={styles.buttonRow}>
                    <button
                      type="button"
                      onClick={() => removeDraftRow(row.id)}
                      style={isValidated || draftRows.length === 1 ? { ...styles.secondaryButton, ...styles.disabledButton } : styles.secondaryButton}
                      disabled={isValidated || draftRows.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })
          : null}

        {selectedSource ? (
          <>
            <datalist id="packing-list-model-options">
              {modelOptions.map((item) => (
                <option key={item.id} value={item.label} />
              ))}
            </datalist>

            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={addDraftRow}
                style={isValidated ? { ...styles.secondaryButton, ...styles.disabledButton } : styles.secondaryButton}
                disabled={isValidated}
              >
                + Add Model Row
              </button>
              <button
                type="button"
                onClick={handleValidate}
                style={isValidated || saving ? { ...styles.primaryButton, ...styles.disabledButton } : styles.primaryButton}
                disabled={isValidated || saving}
              >
                {saving ? 'Saving...' : 'Validate Receiving'}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {previewPhoto ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>{previewPhoto.label}</h2>
            </div>
            <Image src={previewPhoto.url} alt={previewPhoto.label} width={720} height={720} unoptimized style={styles.previewImage} />
            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setPreviewPhoto(null)} style={styles.secondaryButton}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
