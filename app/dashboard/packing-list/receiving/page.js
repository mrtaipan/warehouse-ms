'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
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
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
  },
  summaryCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
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
    fontSize: '24px',
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
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
    background: '#fff',
  },
  select: {
    height: '42px',
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
    minHeight: '42px',
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
    minHeight: '42px',
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
    gridTemplateColumns: 'auto 1.6fr 1fr auto',
    gap: '12px',
    alignItems: 'end',
  },
  qtyStatus: {
    fontSize: '13px',
    fontWeight: '700',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  primaryButton: {
    height: '42px',
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
    height: '42px',
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
            model_color,
            photo_url,
            qty,
            koli_sequence,
            inbound:inbound_id (
              id,
              grn_number
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('pl_receiving')
          .select('id, inbound_id, source_koli_sequence, validated_at')
          .order('validated_at', { ascending: false }),
        supabase
        .from('dir_product_models')
          .select('id, model_name, model_color, photo_url')
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

          return {
            id: `saved-${row.id || index}`,
            source_key: matchedSource?.source_key || '',
            model_name: row.model_name || '',
            model_color: row.model_color || '',
            photo_url: matchedSource?.photo_url || '',
            qty: String(row.received_qty || 0),
          }
        })
      )
    }

    loadValidationRows()
  }, [selectedInbound?.id, selectedSource?.koli_sequence, sourceRowMap, sourceRows])

  function handleGrnChange(value) {
    setGrnFilter(value)
    setSelectedSourceKey('')
    setKoliMenuOpen(false)
    setDraftRows([])
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
      .filter((row) => row.receivedQty > 0)
      .map((row) => {
      let mismatchType = 'MATCH'

      if (row.sourceQty === 0 && row.receivedQty > 0) {
        mismatchType = 'NEW_MODEL'
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
        {
          id: insertedRows?.[0]?.id || `${nextKey}-${Date.now()}`,
          inbound_id: selectedInbound.id,
          source_koli_sequence: selectedSource.koli_sequence,
          validated_at: insertedRows?.[0]?.validated_at || new Date().toISOString(),
        },
        ...remaining,
      ]
    })

    const mismatchCount = payload.filter((row) => !row.is_match).length
    if (!mismatchCount) {
      setSuccess(`Packing List Receiving validated for ${selectedInbound.grn_number} ${selectedSource.label}.`)
      return
    }

    setSuccess(`Packing List Receiving validated. ${mismatchCount} row still differs from QC Confirm.`)
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading packing list receiving...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div>
          <h1 style={styles.title}>Packing List Receiving</h1>
          <p style={styles.subtitle}>
            Validate the received packing list against QC Confirm by GRN and Koli. No allocation is needed here, only model and qty confirmation.
          </p>
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

        {isValidated ? <p style={styles.successText}>Koli ini sudah validated di Packing List Receiving.</p> : null}

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
                {saving ? 'Saving...' : 'Validate Packing List Receiving'}
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
