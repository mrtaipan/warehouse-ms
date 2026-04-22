'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { readFileAsDataUrl } from '../shared'

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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
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
  compactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
  },
  modeRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  modeButton: {
    minHeight: '42px',
    padding: '0 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  modeButtonActive: {
    background: '#111827',
    color: '#fff',
    borderColor: '#111827',
  },
  modeButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
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
  helperText: {
    fontSize: '12px',
    color: '#6b7280',
  },
  input: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
  },
  select: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
    width: '100%',
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
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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
  modelRow: {
    display: 'grid',
    gridTemplateColumns: '96px 1.4fr 0.9fr 0.9fr auto',
    gap: '14px',
    alignItems: 'center',
    padding: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#fff',
  },
  thumb: {
    width: '96px',
    height: '96px',
    objectFit: 'cover',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  thumbEmpty: {
    width: '96px',
    height: '96px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: '12px',
    fontWeight: '700',
  },
  modelMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  modelName: {
    fontWeight: '700',
    color: '#111827',
  },
  infoText: {
    margin: 0,
    color: '#6b7280',
  },
  allocationCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
    background: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
  },
  successText: {
    margin: 0,
    color: '#16a34a',
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
  },
  checkboxWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
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
    maxWidth: '760px',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gap: '12px',
  },
  modelCardButton: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '12px',
    background: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
  },
}

function createDefaultObservedRow(expectedRow) {
  return {
    id: `expected-${expectedRow.id}`,
    model_id: '',
    model_name: expectedRow.model_name || '',
    model_color: expectedRow.model_color || '',
    qty_in: Number(expectedRow.qty || 0),
    qty_qc: String(expectedRow.qty || 0),
    photo_url: expectedRow.photo_url || '',
  }
}

export default function QcReceivingPage() {
  const [inbounds, setInbounds] = useState([])
  const [unloadRows, setUnloadRows] = useState([])
  const [productModels, setProductModels] = useState([])
  const [qcItems, setQcItems] = useState([])
  const [qcMembers, setQcMembers] = useState([])
  const [qcMode, setQcMode] = useState('regular')
  const [grnSearch, setGrnSearch] = useState('')
  const [selectedInboundId, setSelectedInboundId] = useState('')
  const [selectedKoliId, setSelectedKoliId] = useState('')
  const [isConfirmed, setIsConfirmed] = useState(true)
  const [modelRows, setModelRows] = useState([])
  const [allocations, setAllocations] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showChooseModelModal, setShowChooseModelModal] = useState(false)
  const [showModelModal, setShowModelModal] = useState(false)
  const [activeModelRowId, setActiveModelRowId] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [modelModalError, setModelModalError] = useState('')
  const [modelDraft, setModelDraft] = useState({
    model_name: '',
    model_color: '',
    photo_url: '',
  })
  const [modelPhotoFile, setModelPhotoFile] = useState(null)

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      setError('')

      const [
        { data: inboundRows, error: inboundError },
        { data: modelRows, error: modelError },
        { data: qcRows, error: qcError },
        { data: memberRows, error: memberError },
      ] = await Promise.all([
        supabase
          .from('inbound')
          .select('id, grn_number, inbound_date, item_name, suppliers(supplier_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('product_models')
          .select('id, model_name, model_color, photo_url')
          .eq('is_active', true)
          .order('model_name', { ascending: true }),
        supabase
          .from('qc_items')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('qc_members')
          .select('id, email, display_name')
          .eq('is_active', true)
          .order('display_name', { ascending: true }),
      ])

      if (inboundError || modelError || qcError || memberError) {
        setError(
          inboundError?.message ||
            modelError?.message ||
            qcError?.message ||
            memberError?.message ||
            'Failed to load QC receiving setup.'
        )
        setLoading(false)
        return
      }

      setInbounds(inboundRows || [])
      setProductModels(modelRows || [])
      setQcItems(qcRows || [])
      setQcMembers(memberRows || [])
      setLoading(false)
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    async function loadUnloadRows() {
      if (!selectedInboundId) {
        setUnloadRows([])
        setSelectedKoliId('')
        return
      }

      const { data, error: unloadError } = await supabase
        .from('inbound_unload')
        .select('id, inbound_id, model_name, model_color, qty, pic_name, is_sample, koli_sequence, photo_url')
        .eq('inbound_id', selectedInboundId)
        .eq('is_sample', false)
        .order('koli_sequence', { ascending: true })

      if (unloadError) {
        setError(unloadError.message)
        return
      }

      setUnloadRows(data || [])
    }

    loadUnloadRows()
  }, [selectedInboundId])

  const selectedInbound = inbounds.find((item) => item.id === Number(selectedInboundId)) || null
  const selectedKoli = unloadRows.find((item) => item.id === Number(selectedKoliId)) || null

  const qcInQty = modelRows.reduce((sum, row) => sum + Number(row.qty_qc || 0), 0)
  const allocationTotal = Object.values(allocations).reduce((sum, value) => sum + Number(value || 0), 0)
  const modelOptions = productModels.filter((item) => {
    if (!modelSearch.trim()) return true
    const label = item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name
    return label.toUpperCase().includes(modelSearch.trim().toUpperCase())
  })
  const currentPlanRows = selectedKoli ? qcItems.filter((item) => item.inbound_unload_id === Number(selectedKoliId)) : []
  const isPlanLocked = currentPlanRows.some((item) => item.status === 'in_progress' || item.status === 'done')

  function handleGrnChange(value) {
    setGrnSearch(value)
    const match = inbounds.find((item) => item.grn_number === value)
    setSelectedInboundId(match ? String(match.id) : '')
    setSelectedKoliId('')
    setModelRows([])
    setAllocations({})
    setError('')
    setSuccess('')
  }

  function handleKoliChange(nextKoliId) {
    setSelectedKoliId(nextKoliId)
    setError('')
    setSuccess('')

    if (!nextKoliId) {
      setModelRows([])
      return
    }

    const expectedRow = unloadRows.find((item) => item.id === Number(nextKoliId))

    if (!expectedRow) {
      setModelRows([])
      return
    }

    const existingPlanRows = qcItems.filter((item) => item.inbound_unload_id === expectedRow.id)
    const firstPlan = existingPlanRows[0]

    if (firstPlan) {
      setIsConfirmed(Boolean(firstPlan.is_confirmed))
      setModelRows(
        (firstPlan.observed_items || []).map((row, index) => ({
          id: `saved-${index}-${Date.now()}`,
          model_id: '',
          model_name: row.model_name || '',
          model_color: row.model_color || '',
          qty_in: index === 0 ? Number(expectedRow.qty || 0) : 0,
          qty_qc: String(row.qty || 0),
          photo_url: row.photo_url || '',
        }))
      )
      setAllocations(
        qcMembers.reduce((result, member) => {
          result[member.email] = String(existingPlanRows.find((item) => item.assigned_to === member.email)?.allocated_qty || '')
          return result
        }, {})
      )
      return
    }

    setIsConfirmed(true)
    setModelRows([createDefaultObservedRow(expectedRow)])
    setAllocations({})
  }

  function syncRowsWithConfirmation(nextConfirmed) {
    setIsConfirmed(nextConfirmed)

    if (!selectedKoli) {
      return
    }

    if (nextConfirmed) {
      setModelRows([createDefaultObservedRow(selectedKoli)])
    }
  }

  function addModelRow() {
    setModelRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${prev.length}`,
        model_id: '',
        model_name: '',
        model_color: '',
        qty_in: 0,
        qty_qc: '',
        photo_url: '',
      },
    ])
  }

  function updateModelRow(rowId, updates) {
    setModelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row)))
  }

  function removeModelRow(rowId) {
    setModelRows((prev) => prev.filter((row) => row.id !== rowId))
  }

  async function handleModelPhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setModelPhotoFile(file)
      const dataUrl = await readFileAsDataUrl(file)
      setModelDraft((prev) => ({
        ...prev,
        photo_url: dataUrl,
      }))
    } catch (photoError) {
      setModelModalError(photoError.message)
    }
  }

  async function handleSaveModel() {
    setModelModalError('')

    if (!modelDraft.model_name.trim()) {
      setModelModalError('Model name is required.')
      return
    }

    let photoUrl = modelDraft.photo_url || ''

    if (modelPhotoFile) {
      const fileExt = modelPhotoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`
      const filePath = `qc-models/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('product-photos')
        .upload(filePath, modelPhotoFile, { upsert: false })

      if (uploadError) {
        setModelModalError(uploadError.message)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-photos')
        .getPublicUrl(filePath)

      photoUrl = publicUrlData.publicUrl || ''
    }

    const { data: insertedModel, error: insertError } = await supabase
      .from('product_models')
      .insert([
        {
          model_name: modelDraft.model_name.trim().toUpperCase(),
          model_color: modelDraft.model_color.trim().toUpperCase() || null,
          photo_url: photoUrl || null,
          is_active: true,
        },
      ])
      .select('id, model_name, model_color, photo_url')
      .single()

    if (insertError) {
      setModelModalError(insertError.message)
      return
    }

    setProductModels((prev) => [...prev, insertedModel])

    if (activeModelRowId) {
      updateModelRow(activeModelRowId, {
        model_id: String(insertedModel.id),
        model_name: insertedModel.model_name,
        model_color: insertedModel.model_color || '',
        photo_url: insertedModel.photo_url || '',
      })
    }

    setShowModelModal(false)
    setShowChooseModelModal(false)
    setModelDraft({
      model_name: '',
      model_color: '',
      photo_url: '',
    })
    setModelPhotoFile(null)
    setSuccess('Model added successfully.')
  }

  async function handleSavePlan() {
    setError('')
    setSuccess('')

    if (!selectedInbound || !selectedKoli) {
      setError('Choose GRN and No Koli first.')
      return
    }

    if (isPlanLocked) {
      setError('This QC plan is locked because inspection has already started for this koli.')
      return
    }

    const invalidRow = modelRows.find((row) => !row.model_name.trim() || Number(row.qty_qc || 0) <= 0)
    if (invalidRow) {
      setError('Every model row must have model and QC qty.')
      return
    }

    if (qcInQty <= 0) {
      setError('QC In must be greater than 0.')
      return
    }

    if (!qcMembers.length) {
      setError('No QC user has registered yet. Open Inspection Task and register at least one QC user first.')
      return
    }

    if (allocationTotal !== qcInQty) {
      setError('Total allocated qty must match QC In exactly.')
      return
    }

    setSaving(true)

    const observedItems = modelRows.map((row) => ({
      model_name: row.model_name.trim(),
      model_color: row.model_color.trim(),
      qty: Number(row.qty_qc || 0),
      photo_url: row.photo_url || '',
    }))

    const queuePayload = qcMembers
      .filter((member) => Number(allocations[member.email] || 0) > 0)
      .map((member) => ({
        inbound_id: selectedInbound.id,
        inbound_unload_id: selectedKoli.id,
        assigned_to: member.email,
        allocated_qty: Number(allocations[member.email] || 0),
        expected_qty: Number(selectedKoli.qty || 0),
        is_confirmed: isConfirmed,
        observed_items: observedItems,
        status: 'queued',
      }))

    const { error: deleteError } = await supabase
      .from('qc_items')
      .delete()
      .eq('inbound_unload_id', selectedKoli.id)
      .in('status', ['queued', 'in_progress'])

    if (deleteError) {
      setError(deleteError.message)
      setSaving(false)
      return
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from('qc_items')
      .insert(queuePayload)
      .select('*')

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setQcItems((prev) => [
      ...(insertedRows || []),
      ...prev.filter((item) => item.inbound_unload_id !== selectedKoli.id),
    ])
    setSuccess('QC plan saved. You can choose the same koli again and continue editing this plan.')
    setSaving(false)
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading QC receiving setup...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>QC Receiving</h1>
          <p style={styles.subtitle}>
            Check whether model and qty from receiving are correct, then send QC work into operator tasks.
          </p>
        </div>
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Planner</h2>
          <p style={styles.sectionSubtitle}>
            Choose the GRN and Koli first. If the model or qty is different, correct it here before allocating QC work.
          </p>
        </div>

        <div style={styles.modeRow}>
          <button
            type="button"
            onClick={() => setQcMode('regular')}
            style={{
              ...styles.modeButton,
              ...(qcMode === 'regular' ? styles.modeButtonActive : {}),
            }}
          >
            Reguler
          </button>
          <button
            type="button"
            disabled
            style={{
              ...styles.modeButton,
              ...styles.modeButtonDisabled,
            }}
          >
            QC Ulang
          </button>
          <button
            type="button"
            disabled
            style={{
              ...styles.modeButton,
              ...styles.modeButtonDisabled,
            }}
          >
            QC Arkline
          </button>
        </div>

        {qcMode !== 'regular' ? <p style={styles.emptyText}>Only Reguler flow is enabled for now.</p> : null}
        {isPlanLocked ? (
          <p style={styles.errorText}>
            Allocation for this koli is locked because at least one inspector has already started or completed QC.
          </p>
        ) : null}

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>GRN Number</label>
            <input
              list="qc-receiving-grn-options"
              value={grnSearch}
              onChange={(event) => handleGrnChange(event.target.value)}
              style={styles.input}
              placeholder="Type or choose GRN Number"
            />
            <datalist id="qc-receiving-grn-options">
              {inbounds.map((item) => (
                <option key={item.id} value={item.grn_number} />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>No Koli</label>
            <select
              value={selectedKoliId}
              onChange={(event) => handleKoliChange(event.target.value)}
              style={styles.select}
              disabled={!selectedInboundId}
            >
              <option value="">{selectedInboundId ? 'Choose No Koli' : 'Choose GRN first'}</option>
              {unloadRows.map((row) => (
                <option key={row.id} value={row.id}>
                  Koli {row.koli_sequence}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Barang</label>
            <div style={styles.readonlyBox}>{selectedInbound?.item_name || '-'}</div>
          </div>
        </div>

        {selectedKoli ? (
          <>
            <label style={styles.checkboxWrap}>
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(event) => syncRowsWithConfirmation(event.target.checked)}
              />
              Confirm qty and model are already correct
            </label>

            {modelRows.map((row, index) => (
              <div key={row.id} style={styles.modelRow}>
                {row.photo_url ? (
                  <Image
                    src={row.photo_url}
                    alt={row.model_name || 'QC model'}
                    width={96}
                    height={96}
                    unoptimized
                    style={styles.thumb}
                  />
                ) : (
                  <div style={styles.thumbEmpty}>NO PHOTO</div>
                )}

                <div style={styles.modelMeta}>
                  <div style={styles.modelName}>{row.model_name || 'Choose model'}</div>
                  <p style={styles.infoText}>{row.model_color || 'NO COLOR'}</p>
                  {index > 0 || !isConfirmed ? (
                    <div style={styles.buttonRow}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveModelRowId(row.id)
                          setShowChooseModelModal(true)
                        }}
                        style={styles.secondaryButton}
                        disabled={isPlanLocked}
                      >
                        Choose Model
                      </button>
                      {index > 0 ? (
                        <button
                          type="button"
                          onClick={() => removeModelRow(row.id)}
                          style={styles.secondaryButton}
                          disabled={isPlanLocked}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Inbound Qty</label>
                  <div style={styles.readonlyBox}>{row.qty_in || 0}</div>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>QC In</label>
                  <input
                    type="number"
                    min="0"
                    value={row.qty_qc}
                    onChange={(event) =>
                      updateModelRow(row.id, {
                        qty_qc: event.target.value,
                      })
                    }
                    style={styles.input}
                    disabled={isPlanLocked || (isConfirmed && index === 0)}
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Action</label>
                  {isConfirmed && index === 0 ? (
                    <div style={styles.readonlyBox}>Expected row</div>
                  ) : (
                    <div style={styles.readonlyBox}>Editable row</div>
                  )}
                </div>
              </div>
            ))}

            {!isConfirmed ? (
              <div style={styles.buttonRow}>
                <button type="button" onClick={addModelRow} style={styles.secondaryButton} disabled={isPlanLocked}>
                  + Add Model Row
                </button>
              </div>
            ) : null}

            <div>
              <h3 style={styles.sectionTitle}>Allocate to QC Team</h3>
              <p style={styles.sectionSubtitle}>
                `Inbound Qty` is the qty from receiving. `QC In` is the qty that will actually enter QC. The total allocated qty across registered QC users must match `QC In`.
              </p>
            </div>

            <div style={styles.compactGrid}>
              {qcMembers.map((member) => (
                <div key={member.id} style={styles.allocationCard}>
                  <span style={styles.label}>{member.display_name || member.email}</span>
                  <input
                    type="number"
                    min="0"
                    max={qcInQty || 0}
                    value={allocations[member.email] || ''}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value || 0)
                      setAllocations((prev) => ({
                        ...prev,
                        [member.email]: nextValue > qcInQty ? String(qcInQty) : event.target.value,
                      }))
                    }}
                    style={styles.input}
                    placeholder="0"
                    disabled={isPlanLocked}
                  />
                </div>
              ))}
            </div>

            {!qcMembers.length ? (
              <p style={styles.emptyText}>
                No QC user has registered yet. Open `Inspection Task` and press `Register for QC` first.
              </p>
            ) : null}

            <div style={styles.summaryGrid}>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Inbound Qty</span>
                <strong style={styles.summaryValue}>{Number(selectedKoli.qty || 0)}</strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>QC In</span>
                <strong style={styles.summaryValue}>{qcInQty}</strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>QC Allocated Qty</span>
                <strong style={styles.summaryValue}>{allocationTotal}</strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Koli</span>
                <strong style={styles.summaryValue}>Koli {selectedKoli.koli_sequence}</strong>
              </div>
            </div>
          </>
        ) : (
          <p style={styles.emptyText}>Choose GRN and Koli first to start QC planning.</p>
        )}

        <div style={styles.buttonRow}>
          {error ? <p style={styles.errorText}>{error}</p> : null}
          {success ? <p style={styles.successText}>{success}</p> : null}
          <button
            type="button"
            onClick={handleSavePlan}
            disabled={saving || !selectedKoli || isPlanLocked}
            style={{
              ...styles.primaryButton,
              ...(saving || !selectedKoli || isPlanLocked ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
          >
            {saving ? 'Saving...' : isPlanLocked ? 'QC Started' : 'Save QC Plan'}
          </button>
        </div>
      </div>

      {showChooseModelModal ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>Choose Model</h2>
              <p style={styles.sectionSubtitle}>Select the model from the photo list. If it does not exist yet, add a new one.</p>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Search Model</label>
              <input
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                style={styles.input}
                placeholder="Type model name"
              />
            </div>

            <div style={styles.modalGrid}>
              {modelOptions.map((item) => {
                const label = item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (activeModelRowId) {
                        updateModelRow(activeModelRowId, {
                          model_id: String(item.id),
                          model_name: item.model_name,
                          model_color: item.model_color || '',
                          photo_url: item.photo_url || '',
                        })
                      }
                      setShowChooseModelModal(false)
                    }}
                    style={styles.modelCardButton}
                  >
                    {item.photo_url ? (
                      <Image
                        src={item.photo_url}
                        alt={label}
                        width={170}
                        height={120}
                        unoptimized
                        style={{ ...styles.thumb, width: '100%', height: '120px' }}
                      />
                    ) : (
                      <div style={{ ...styles.thumbEmpty, width: '100%', height: '120px' }}>NO PHOTO</div>
                    )}
                    <strong>{item.model_name}</strong>
                    <span>{item.model_color || 'NO COLOR'}</span>
                  </button>
                )
              })}
            </div>

            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setShowModelModal(true)} style={styles.secondaryButton}>
                + Add New Model
              </button>
              <button type="button" onClick={() => setShowChooseModelModal(false)} style={styles.secondaryButton}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showModelModal ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>Add New Model</h2>
              <p style={styles.sectionSubtitle}>Save a missing model from QC.</p>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Nama Model</label>
              <input
                value={modelDraft.model_name}
                onChange={(event) =>
                  setModelDraft((prev) => ({
                    ...prev,
                    model_name: event.target.value.toUpperCase(),
                  }))
                }
                style={styles.input}
                placeholder="MODEL NAME"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Warna Model</label>
              <input
                value={modelDraft.model_color}
                onChange={(event) =>
                  setModelDraft((prev) => ({
                    ...prev,
                    model_color: event.target.value.toUpperCase(),
                  }))
                }
                style={styles.input}
                placeholder="MODEL COLOR"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Foto Produk</label>
              <input type="file" accept="image/*" capture="environment" onChange={handleModelPhotoChange} style={styles.input} />
            </div>

            {modelModalError ? <p style={styles.errorText}>{modelModalError}</p> : null}

            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setShowModelModal(false)} style={styles.secondaryButton}>
                Cancel
              </button>
              <button type="button" onClick={handleSaveModel} style={styles.primaryButton}>
                Save Model
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
