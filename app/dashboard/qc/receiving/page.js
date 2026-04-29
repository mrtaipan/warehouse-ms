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
  iconButton: {
    width: '36px',
    height: '36px',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
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
  sourceList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  sourceChip: {
    minHeight: '38px',
    padding: '0 14px',
    borderRadius: '999px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  sourceChipActive: {
    background: '#111827',
    borderColor: '#111827',
    color: '#fff',
  },
  sourceChipDone: {
    background: '#dcfce7',
    borderColor: '#86efac',
    color: '#166534',
  },
  sourceChipDoneActive: {
    background: '#16a34a',
    borderColor: '#16a34a',
    color: '#fff',
  },
  sourceStatusBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #86efac',
    background: '#f0fdf4',
    color: '#166534',
    fontSize: '14px',
    fontWeight: '700',
    flexWrap: 'wrap',
  },
  modelRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#fff',
  },
  modelRowTop: {
    display: 'grid',
    gridTemplateColumns: '96px 1.4fr 0.9fr 0.9fr auto',
    gap: '14px',
    alignItems: 'center',
  },
  allocationWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '14px',
    borderTop: '1px solid #e5e7eb',
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

function createDefaultModelRow(expectedRow) {
  return {
    id: `expected-${expectedRow.id}`,
    source_id: expectedRow.id,
    model_id: '',
    model_name: expectedRow.model_name || '',
    model_color: expectedRow.model_color || '',
    qty_in: Number(expectedRow.qty || 0),
    qty_qc: String(expectedRow.qty || 0),
    photo_url: expectedRow.photo_url || '',
    allocations: [],
  }
}

function getModelKey(modelName, modelColor) {
  return `${String(modelName || '').trim().toUpperCase()}::${String(modelColor || '').trim().toUpperCase()}`
}

function getTaskKey(values) {
  return `${String(values.assigned_to || values.member_email || '').trim().toLowerCase()}::${getModelKey(
    values.model_name,
    values.model_color
  )}`
}

function getSourceStatus(source, qcItems) {
  if (!source?.sourceId) {
    return 'idle'
  }

  const sourceTasks = (qcItems || []).filter((item) => Number(item.inbound_unload_id) === Number(source.sourceId))

  if (!sourceTasks.length) {
    return 'idle'
  }

  if (sourceTasks.every((item) => item.status === 'done')) {
    return 'completed'
  }

  if (sourceTasks.some((item) => item.status !== 'queued')) {
    return 'started'
  }

  return 'planned'
}

function buildModelRowsForSource(source, unloadRows, qcItems) {
  if (!source) {
    return []
  }

  const rowMap = new Map()
  const expectedRows = source.rows || []
  const existingPlanRows = (qcItems || []).filter((item) => item.inbound_unload_id === source.sourceId)

  expectedRows.forEach((row) => {
    const key = getModelKey(row.model_name, row.model_color)
    const existingRow = rowMap.get(key) || {
      ...createDefaultModelRow(row),
      id: `expected-${source.sourceId}-${key}`,
      qty_in: 0,
      qty_qc: String(row.qty || 0),
      allocations: [],
    }

    existingRow.qty_in += Number(row.qty || 0)
    existingRow.qty_qc = String(Math.max(Number(existingRow.qty_qc || 0), Number(row.qty || 0)))
    existingRow.photo_url = existingRow.photo_url || row.photo_url || ''
    rowMap.set(key, existingRow)
  })

  existingPlanRows.forEach((planRow) => {
    const key = getModelKey(planRow.model_name, planRow.model_color)
    const existingRow =
      rowMap.get(key) ||
      {
        id: `saved-${planRow.id}`,
        source_id: source.sourceId,
        model_id: '',
        model_name: planRow.model_name || '',
        model_color: planRow.model_color || '',
        qty_in: 0,
        qty_qc: String(planRow.qty_in || 0),
        photo_url: planRow.photo_url || '',
        allocations: [],
      }

    existingRow.model_name = existingRow.model_name || planRow.model_name || ''
    existingRow.model_color = existingRow.model_color || planRow.model_color || ''
    existingRow.photo_url = existingRow.photo_url || planRow.photo_url || ''
    existingRow.qty_qc = String(Math.max(Number(existingRow.qty_qc || 0), Number(planRow.qty_in || 0)))
    existingRow.allocations = [
      ...(existingRow.allocations || []),
      {
        id: `alloc-saved-${planRow.id}`,
        task_id: planRow.id,
        member_email: planRow.assigned_to || '',
        qty: String(planRow.allocated_qty || 0),
        existing_status: planRow.status || 'queued',
        locked_qty: Number(planRow.locked_qty || 0),
      },
    ]

    rowMap.set(key, existingRow)
  })

  return Array.from(rowMap.values()).sort((a, b) => getModelKey(a.model_name, a.model_color).localeCompare(getModelKey(b.model_name, b.model_color)))
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
  const [selectedSourceKey, setSelectedSourceKey] = useState('')
  const [modelRows, setModelRows] = useState([])
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
  const [sourceDetailsExpanded, setSourceDetailsExpanded] = useState(true)

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
          .select('id, grn_number, inbound_date, item_name, suppliers:dir_suppliers!supplier_id (supplier_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('dir_product_models')
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
        setSelectedSourceKey('')
        return
      }

      const { data, error: unloadError } = await supabase
        .from('inbound_unload')
        .select('id, inbound_id, model_name, model_color, qty, pic_name, is_sample, koli_sequence, photo_url')
        .eq('inbound_id', selectedInboundId)
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
  const sourceOptions = useMemo(() => {
    const groupedKoli = new Map()
    const sampleRows = []

    unloadRows.forEach((row) => {
      if (row.is_sample) {
        sampleRows.push(row)
        return
      }

      const key = `koli:${row.koli_sequence}`
      if (!groupedKoli.has(key)) {
        groupedKoli.set(key, {
          key,
          label: `Koli ${row.koli_sequence}`,
          type: 'koli',
          sourceId: row.id,
          rows: [],
        })
      }

      groupedKoli.get(key).rows.push(row)
    })

    const result = Array.from(groupedKoli.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))

    if (sampleRows.length) {
      result.push({
        key: 'sample',
        label: 'Sample',
        type: 'sample',
        sourceId: sampleRows[0].id,
        rows: sampleRows,
      })
    }

    return result
  }, [unloadRows])
  const selectedSource = sourceOptions.find((item) => item.key === selectedSourceKey) || null
  const selectedSourceRows = selectedSource?.rows || []
  const selectedSourceId = selectedSource?.sourceId || null

  const qcInQty = modelRows.reduce((sum, row) => sum + Number(row.qty_qc || 0), 0)
  const allocationTotal = modelRows.reduce(
    (sum, row) =>
      sum +
      (row.allocations || []).reduce((allocationSum, split) => allocationSum + Number(split.qty || 0), 0),
    0
  )
  const modelOptions = productModels.filter((item) => {
    if (!modelSearch.trim()) return true
    const label = item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name
    return label.toUpperCase().includes(modelSearch.trim().toUpperCase())
  })
  const currentPlanRows = selectedSourceId ? qcItems.filter((item) => item.inbound_unload_id === Number(selectedSourceId)) : []
  const hasSavedPlan = currentPlanRows.length > 0
  const selectedSourceStatus = selectedSource ? getSourceStatus(selectedSource, qcItems) : 'idle'
  const isSelectedSourceStarted = selectedSourceStatus === 'started' || selectedSourceStatus === 'completed'
  const isSelectedSourceCompleted = selectedSourceStatus === 'completed'
  const persistedTaskRows = new Map(
    currentPlanRows.map((item) => [getTaskKey(item), item])
  )

  function handleGrnChange(value) {
    setGrnSearch(value)
    const match = inbounds.find((item) => item.grn_number === value)
    setSelectedInboundId(match ? String(match.id) : '')
    setSelectedSourceKey('')
    setModelRows([])
    setError('')
    setSuccess('')
  }

  function handleSourceChange(nextSourceKey) {
    setSelectedSourceKey(nextSourceKey)
    setError('')
    setSuccess('')

    if (!nextSourceKey) {
      setModelRows([])
      return
    }

    const nextSource = sourceOptions.find((item) => item.key === nextSourceKey)

    if (!nextSource) {
      setModelRows([])
      setSourceDetailsExpanded(true)
      return
    }

    setSourceDetailsExpanded(getSourceStatus(nextSource, qcItems) !== 'completed')
    setModelRows(buildModelRowsForSource(nextSource, unloadRows, qcItems))
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
        allocations: [],
      },
    ])
  }

  function updateModelRow(rowId, updates) {
    setModelRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row)))
  }

  function addAllocationSplit(rowId) {
    setModelRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? (row.allocations || []).length >= qcMembers.length
            ? row
            : {
                ...row,
                allocations: [
                  ...(row.allocations || []),
                  {
                    id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    task_id: null,
                    member_email: '',
                    qty: '',
                    existing_status: 'queued',
                    locked_qty: 0,
                  },
                ],
              }
          : row
      )
    )
  }

  function updateAllocationSplit(rowId, splitId, updates) {
    setModelRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              allocations: (row.allocations || []).map((split) => (split.id === splitId ? { ...split, ...updates } : split)),
            }
          : row
      )
    )
  }

  function removeAllocationSplit(rowId, splitId) {
    setModelRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              allocations: (row.allocations || []).filter((split) => split.id !== splitId),
            }
          : row
      )
    )
  }

  function removeModelRow(rowId) {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Remove this model row?')
      if (!confirmed) return
    }
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
      .from('dir_product_models')
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

    if (!selectedInbound || !selectedSourceId) {
      setError('Choose GRN and Koli/Sample first.')
      return
    }

    const invalidRow = modelRows.find((row) => {
      const splitTotal = (row.allocations || []).reduce((sum, split) => sum + Number(split.qty || 0), 0)
      const hasInvalidSplit = (row.allocations || []).some(
        (split) => !String(split.member_email || '').trim() || Number(split.qty || 0) <= 0
      )

      return !row.model_name.trim() || Number(row.qty_qc || 0) <= 0 || hasInvalidSplit || splitTotal > Number(row.qty_qc || 0)
    })
    if (invalidRow) {
      setError('Every model row must have a model and QC qty. Allocated qty cannot be greater than QC In.')
      return
    }

    if (qcInQty <= 0) {
      setError('QC In must be greater than 0.')
      return
    }

    if (!qcMembers.length) {
      setError('No QC user has registered yet. Open Grading Task and register at least one QC user first.')
      return
    }

    setSaving(true)

    const activeTaskKeys = new Set()
    const insertPayload = []
    const updatesForPersistedRows = []
    let blockingError = ''
    modelRows.forEach((row) => {
      ;(row.allocations || []).forEach((split) => {
        if (blockingError) {
          return
        }
        if (!split.member_email || Number(split.qty || 0) <= 0) {
          return
        }
        const taskKey = getTaskKey({
          member_email: split.member_email,
          model_name: row.model_name,
          model_color: row.model_color,
        })
        activeTaskKeys.add(taskKey)

        const persistedRow = persistedTaskRows.get(taskKey) || null
        const lockedQty = Number(persistedRow?.locked_qty ?? split.locked_qty ?? 0)
        const allocatedQty = Number(split.qty || 0)

        if (allocatedQty < lockedQty) {
          blockingError = `Allocated qty for ${split.member_email} on ${row.model_name} cannot be less than the committed qty (${lockedQty}).`
          return
        }

        const basePayload = {
          inbound_id: selectedInbound.id,
          inbound_unload_id: selectedSourceId,
          assigned_to: split.member_email,
          allocated_qty: allocatedQty,
          expected_qty: Number(row.qty_in || 0),
          qty_in: Number(row.qty_qc || 0),
          model_name: row.model_name.trim(),
          model_color: row.model_color.trim() || null,
          photo_url: row.photo_url || null,
          locked_qty: lockedQty,
        }

        if (persistedRow) {
          updatesForPersistedRows.push({
            id: persistedRow.id,
            ...basePayload,
            status: persistedRow.status,
            finished_at: persistedRow.finished_at,
            started_at: persistedRow.started_at,
            paused_at: persistedRow.paused_at,
            pause_reason: persistedRow.pause_reason,
          })
          return
        }

        insertPayload.push({
          ...basePayload,
          is_confirmed: true,
          status: 'queued',
        })
      })
    })

    if (blockingError) {
      setError(blockingError)
      setSaving(false)
      return
    }

    const queuedRowsToDelete = currentPlanRows.filter(
      (item) => item.status === 'queued' && !activeTaskKeys.has(getTaskKey(item))
    )

    if (queuedRowsToDelete.length) {
      const { error: deleteError } = await supabase
        .from('qc_items')
        .delete()
        .in(
          'id',
          queuedRowsToDelete.map((item) => item.id)
        )

      if (deleteError) {
        setError(deleteError.message)
        setSaving(false)
        return
      }
    }

    let insertedRows = []
    if (insertPayload.length) {
      const insertResponse = await supabase
        .from('qc_items')
        .insert(insertPayload)
        .select('*')

      if (insertResponse.error) {
        setError(insertResponse.error.message)
        setSaving(false)
        return
      }

      insertedRows = insertResponse.data || []
    }

    const updatedRows = []
    for (const row of updatesForPersistedRows) {
      const { data: updatedRow, error: updateError } = await supabase
        .from('qc_items')
        .update({
          inbound_id: row.inbound_id,
          inbound_unload_id: row.inbound_unload_id,
          assigned_to: row.assigned_to,
          allocated_qty: row.allocated_qty,
          expected_qty: row.expected_qty,
          qty_in: row.qty_in,
          model_name: row.model_name,
          model_color: row.model_color,
          photo_url: row.photo_url,
          locked_qty: row.locked_qty,
          status: row.status,
          finished_at: row.finished_at,
          started_at: row.started_at,
          paused_at: row.paused_at,
          pause_reason: row.pause_reason,
        })
        .eq('id', row.id)
        .select('*')
        .single()

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      updatedRows.push(updatedRow)
    }

    const deletedIds = new Set(queuedRowsToDelete.map((item) => item.id))
    const nextQcItems = [
      ...qcItems.filter((item) => !deletedIds.has(item.id) && !updatedRows.some((updated) => updated.id === item.id)),
      ...updatedRows,
      ...insertedRows,
    ]

    setQcItems(nextQcItems)
    setModelRows(buildModelRowsForSource(selectedSource, unloadRows, nextQcItems))
    setSuccess('QC plan saved. You can choose the same Koli/Sample again and continue editing this plan.')
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
            Choose the GRN and Koli/Sample first. If the model or qty is different, correct it here before allocating QC work.
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
            <label style={styles.label}>Koli / Sample</label>
              <select
                value={selectedSourceKey}
                onChange={(event) => handleSourceChange(event.target.value)}
                style={styles.select}
                disabled={!selectedInboundId}
              >
                <option value="">{selectedInboundId ? 'Choose Koli / Sample' : 'Choose GRN first'}</option>
                {sourceOptions.map((row) => (
                  <option
                    key={row.key}
                    value={row.key}
                    style={
                      getSourceStatus(row, qcItems) === 'completed'
                        ? { color: '#166534', backgroundColor: '#f0fdf4', fontWeight: '700' }
                        : undefined
                    }
                  >
                    {getSourceStatus(row, qcItems) === 'completed' ? `DONE - ${row.label}` : row.label}
                  </option>
                ))}
              </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Barang</label>
            <div style={styles.readonlyBox}>{selectedInbound?.item_name || '-'}</div>
          </div>
        </div>

        {selectedSource ? (
          <>
            <div style={styles.sourceList}>
              {sourceOptions.map((row) => {
                const rowStatus = getSourceStatus(row, qcItems)
                const isActive = row.key === selectedSourceKey

                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => handleSourceChange(row.key)}
                    style={{
                      ...styles.sourceChip,
                      ...(rowStatus === 'completed' ? styles.sourceChipDone : {}),
                      ...(isActive ? (rowStatus === 'completed' ? styles.sourceChipDoneActive : styles.sourceChipActive) : {}),
                    }}
                  >
                    {row.label}
                  </button>
                )
              })}
            </div>

            {isSelectedSourceCompleted ? (
              <div style={styles.sourceStatusBanner}>
                <span>KOLI SUDAH SELESAI DIQC</span>
                <button
                  type="button"
                  onClick={() => setSourceDetailsExpanded((prev) => !prev)}
                  style={styles.secondaryButton}
                >
                  {sourceDetailsExpanded ? 'Collapse Detail' : 'Expand Detail'}
                </button>
              </div>
            ) : null}

            {sourceDetailsExpanded ? modelRows.map((row) => (
              <div key={row.id} style={styles.modelRow}>
                <div style={styles.modelRowTop}>
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
                  <div style={styles.buttonRow}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModelRowId(row.id)
                        setShowChooseModelModal(true)
                      }}
                      style={styles.iconButton}
                      disabled={hasSavedPlan}
                      title="Choose model"
                      aria-label="Choose model"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeModelRow(row.id)}
                      style={styles.iconButton}
                      disabled={
                        hasSavedPlan ||
                        modelRows.length === 1 ||
                        (row.allocations || []).some((split) => Number(split.locked_qty || 0) > 0)
                      }
                      title="Remove row"
                      aria-label="Remove row"
                    >
                      x
                    </button>
                  </div>
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
                    disabled={hasSavedPlan}
                  />
                </div>
                </div>

                <div style={{ ...styles.field, ...styles.allocationWrap }}>
                  <label style={styles.label}>Allocation</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(row.allocations || []).map((split) => (
                      <div key={split.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.8fr auto', gap: '8px', alignItems: 'center' }}>
                        <select
                          value={split.member_email || ''}
                          onChange={(event) => updateAllocationSplit(row.id, split.id, { member_email: event.target.value })}
                          style={styles.select}
                          disabled={isSelectedSourceStarted || (split.existing_status && split.existing_status !== 'queued')}
                        >
                          <option value="">Choose inspector</option>
                          {qcMembers
                            .filter(
                              (member) =>
                                member.email === split.member_email ||
                                !(row.allocations || []).some(
                                  (allocation) =>
                                    allocation.id !== split.id && allocation.member_email === member.email
                                )
                            )
                            .map((member) => (
                              <option key={member.id} value={member.email}>
                                {member.display_name || member.email}
                              </option>
                            ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          value={split.qty || ''}
                          onFocus={(event) => {
                            event.target.select()
                          }}
                          onChange={(event) =>
                            updateAllocationSplit(row.id, split.id, {
                              qty: event.target.value,
                            })
                          }
                          onBlur={(event) => {
                            const otherTotal = (row.allocations || [])
                              .filter((item) => item.id !== split.id)
                              .reduce((sum, item) => sum + Number(item.qty || 0), 0)
                            const minAllowed = Number(split.locked_qty || 0)
                            const maxAllowed = Math.max(minAllowed, Number(row.qty_qc || 0) - otherTotal)
                            const rawValue = event.target.value

                            if (rawValue === '') {
                              updateAllocationSplit(row.id, split.id, {
                                qty: minAllowed > 0 ? String(minAllowed) : '',
                              })
                              return
                            }

                            const nextValue = Number(rawValue || 0)
                            updateAllocationSplit(row.id, split.id, {
                              qty: String(Math.max(minAllowed, Math.min(nextValue, maxAllowed))),
                            })
                          }}
                          style={styles.input}
                          disabled={isSelectedSourceStarted || Boolean(split.existing_status && split.existing_status !== 'queued')}
                          placeholder="Qty"
                        />
                        <button
                          type="button"
                          onClick={() => removeAllocationSplit(row.id, split.id)}
                          style={styles.secondaryButton}
                          disabled={
                            isSelectedSourceStarted ||
                            Number(split.locked_qty || 0) > 0 ||
                            (split.existing_status && split.existing_status !== 'queued')
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={styles.helperText}>
                        Allocated: {(row.allocations || []).reduce((sum, split) => sum + Number(split.qty || 0), 0)} / {Number(row.qty_qc || 0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => addAllocationSplit(row.id)}
                        style={styles.secondaryButton}
                        disabled={isSelectedSourceStarted || !qcMembers.length || (row.allocations || []).length >= qcMembers.length}
                      >
                        Allocate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )) : null}

            {sourceDetailsExpanded ? (
            <div style={styles.buttonRow}>
              <button type="button" onClick={addModelRow} style={styles.secondaryButton} disabled={hasSavedPlan}>
                + Add Model Row
              </button>
            </div>
            ) : null}

            {sourceDetailsExpanded ? (
            <div>
              <h3 style={styles.sectionTitle}>Model Allocation</h3>
              <p style={styles.sectionSubtitle}>
                Each model row can be allocated to one or more inspectors. Allocated qty may be less than QC In, but it cannot be more.
              </p>
              <p style={styles.sectionSubtitle}>
                After QC has started, allocation stays as the original plan so any allocation gap remains visible for planner KPI.
              </p>
            </div>
            ) : null}

            {!qcMembers.length ? (
              <p style={styles.emptyText}>
                No QC user has registered yet. Open `Grading Task` and press `Register for QC` first.
              </p>
            ) : null}

            <div style={styles.summaryGrid}>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Inbound Qty</span>
                <strong style={styles.summaryValue}>
                  {selectedSourceRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)}
                </strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>QC In</span>
                <strong style={styles.summaryValue}>{qcInQty}</strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>QC Assigned Qty</span>
                <strong style={styles.summaryValue}>{allocationTotal}</strong>
              </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Selected</span>
                  <strong style={styles.summaryValue}>{selectedSource?.label || '-'}</strong>
                </div>
              </div>
            </>
          ) : (
            <p style={styles.emptyText}>Choose GRN and Koli/Sample first to start QC planning.</p>
          )}

        <div style={styles.buttonRow}>
          {error ? <p style={styles.errorText}>{error}</p> : null}
          {success ? <p style={styles.successText}>{success}</p> : null}
          <button
            type="button"
            onClick={handleSavePlan}
            disabled={saving || !selectedSource || isSelectedSourceStarted}
            style={{
              ...styles.primaryButton,
              ...(saving || !selectedSource || isSelectedSourceStarted ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
          >
            {saving ? 'Saving...' : 'Save QC Plan'}
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

