'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
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
  note: {
    margin: 0,
    padding: '14px 16px',
    borderRadius: '12px',
    background: '#fee2e2',
    color: '#991b1b',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  sourceCard: {
    border: '1px solid #e5e7eb',
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
    color: '#6b7280',
    fontSize: '13px',
  },
  qtyBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    alignItems: 'center',
  },
  qtyLabel: {
    fontSize: '12px',
    textTransform: 'uppercase',
    color: '#6b7280',
    fontWeight: '700',
  },
  qtyValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#111827',
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
  redButton: {
    height: '42px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '8px',
    background: '#dc2626',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tableWrap: {
    maxHeight: '360px',
    overflow: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '700',
    color: '#374151',
    padding: '12px 14px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
  },
  td: {
    padding: '12px 14px',
    fontSize: '14px',
    color: '#111827',
    borderBottom: '1px solid #f1f5f9',
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
}

function getSourceKey(item) {
  return `${Number(item.brand_id || 0)}::${Number(item.category_id || 0)}::${String(item.model_name || '').trim().toUpperCase()}::${String(
    item.model_color || ''
  )
    .trim()
    .toUpperCase()}::${String(item.grade || '').trim().toUpperCase()}`
}

function getModelLabel(item) {
  return item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name
}

export default function QcConfirmationRejectionPage() {
  const draftIdRef = useRef(1)
  const [loading, setLoading] = useState(true)
  const [savingTake, setSavingTake] = useState(false)
  const [savingReturn, setSavingReturn] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [grnFilter, setGrnFilter] = useState('')
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
              grn_number
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
          .select('id, inbound_id, source_phase, brand_id, category_id, model_name, model_color, qty, koli_sequence, grade, is_adjustment')
          .eq('source_phase', 'qc')
          .order('koli_sequence', { ascending: true }),
        supabase
          .from('dir_product_models')
          .select('id, brand_id, category_id, model_name, model_color, photo_url')
          .eq('is_active', true)
          .order('model_name', { ascending: true }),
      ])

      if (qcError || confirmError || returnsError || productModelError) {
        setError(qcError?.message || confirmError?.message || returnsError?.message || productModelError?.message || 'Failed to load confirmation rejection.')
        setLoading(false)
        return
      }

      setQcItems(qcData || [])
      setConfirmRows(confirmData || [])
      setReturnRows(returnsData || [])
      setProductModels(productModelData || [])
      setLoading(false)
    }

    loadData()
  }, [])

  const grnOptions = useMemo(
    () => Array.from(new Set(qcItems.map((item) => item.inbound?.grn_number).filter(Boolean))),
    [qcItems]
  )

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
              grade: gradeRow.grade,
              source_qty: 0,
              taken_qty: 0,
              returned_qty: 0,
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
      model_color: item.model_color || null,
      qty: Number(item.qty || 0),
      koli_sequence: nextKoliSequence,
      grade: item.grade,
      source_phase: 'qc',
      is_adjustment: Boolean(item.is_adjustment),
    }))

    const { data, error: insertError } = await supabase
      .from('warehouse_returns')
      .insert(payload)
      .select('id, inbound_id, source_phase, brand_id, category_id, model_name, model_color, qty, koli_sequence, grade, is_adjustment')

    if (insertError) {
      setError(insertError.message)
      setSavingReturn(false)
      return
    }

    setReturnRows((prev) => [...prev, ...(data || [])])
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
        <div>
          <h1 style={styles.title}>Confirmation - Rejection</h1>
          <p style={styles.subtitle}>Grade B dan Grade C diputuskan di sini: diambil ke next process atau masuk retur.</p>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>GRN Number</label>
          <input
            list="qc-confirmation-rejection-grn-options"
            value={grnFilter}
            onChange={(event) => {
              setGrnFilter(event.target.value)
              setCurrentTakeKoliItems([])
              setCurrentReturnKoliItems([])
              setQtyInputs({})
              setError('')
              setSuccess('')
            }}
            style={styles.input}
            placeholder="Type or choose GRN Number"
          />
          <datalist id="qc-confirmation-rejection-grn-options">
            {grnOptions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        {error ? <p style={styles.errorText}>{error}</p> : null}
        {success ? <p style={styles.successText}>{success}</p> : null}
        <p style={styles.note}>Grade B/C yang diambil akan ikut ke next process dengan grade aslinya. Yang tidak diambil masuk retur dan bisa nanti diprint per koli.</p>

        {grnFilter ? (
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Source B/C</span>
              <strong style={styles.summaryValue}>{totals.source}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Taken Qty</span>
              <strong style={styles.summaryValue}>{totals.taken}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Returned Qty</span>
              <strong style={styles.summaryValue}>{totals.returned}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Take Draft</span>
              <strong style={styles.summaryValue}>{currentTakeKoliItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Return Draft</span>
              <strong style={styles.summaryValue}>{currentReturnKoliItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)}</strong>
            </div>
          </div>
        ) : null}
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Grade B / C Source</h2>
          <p style={styles.sectionSubtitle}>Decide each source qty into `Take` or `Return`.</p>
        </div>

        {!grnFilter ? <p style={styles.emptyText}>Choose a GRN Number first.</p> : null}
        {grnFilter && !sourceRows.length ? <p style={styles.emptyText}>No Grade B / C source found for this GRN.</p> : null}

        {grnFilter && sourceRows.length
          ? sourceRows.map((row) => {
              const remainingQty =
                Math.max(
                  0,
                  Number(row.source_qty || 0) -
                    Number(row.taken_qty || 0) -
                    Number(row.returned_qty || 0) -
                    getDraftQty(row.key, 'take') -
                    getDraftQty(row.key, 'return')
                )

              return (
                <div key={row.key} style={styles.sourceCard}>
                  <div style={styles.modelMeta}>
                    <div style={styles.modelName}>{getModelLabel(row)}</div>
                    <p style={styles.modelInfo}>{row.brand_name}</p>
                    <p style={styles.modelInfo}>{row.category_name}</p>
                  </div>

                  <div style={styles.qtyBox}>
                    <span style={styles.qtyLabel}>Grade</span>
                    <strong style={styles.qtyValue}>{row.grade}</strong>
                  </div>

                  <div style={styles.qtyBox}>
                    <span style={styles.qtyLabel}>Source</span>
                    <strong style={styles.qtyValue}>{row.source_qty}</strong>
                  </div>

                  <div style={styles.qtyBox}>
                    <span style={styles.qtyLabel}>Taken</span>
                    <strong style={styles.qtyValue}>{row.taken_qty}</strong>
                  </div>

                  <div style={styles.qtyBox}>
                    <span style={styles.qtyLabel}>Returned</span>
                    <strong style={styles.qtyValue}>{row.returned_qty}</strong>
                  </div>

                  <div style={styles.qtyBox}>
                    <span style={styles.qtyLabel}>Remaining</span>
                    <strong style={styles.qtyValue}>{remainingQty}</strong>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                      style={styles.input}
                      placeholder="Qty"
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => handleAddDecision(row, 'take')} style={styles.secondaryButton} disabled={remainingQty <= 0}>
                        Take
                      </button>
                      <button type="button" onClick={() => handleAddDecision(row, 'return')} style={styles.redButton} disabled={remainingQty <= 0}>
                        Return
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          : null}
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Adjustment</h2>
          <p style={styles.sectionSubtitle}>Add adjustment item for Grade B/C, then send it directly to `Take` or `Return`.</p>
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
          <h2 style={styles.sectionTitle}>Current Take Koli</h2>
          <p style={styles.sectionSubtitle}>Ini yang akan ikut next process, tetap dengan grade B/C aslinya.</p>
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
                {currentTakeKoliItems.map((item) => (
                  <tr key={item.id}>
                    <td style={styles.td}>{getModelLabel(item)}</td>
                    <td style={styles.td}>
                      {item.grade}
                      {item.is_adjustment ? ' - Adjustment' : ''}
                    </td>
                    <td style={styles.td}>{item.qty}</td>
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
          <h2 style={styles.sectionTitle}>Current Return Koli</h2>
          <p style={styles.sectionSubtitle}>Ini yang akan masuk ke returns dari phase QC.</p>
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
                {currentReturnKoliItems.map((item) => (
                  <tr key={item.id}>
                    <td style={styles.td}>{getModelLabel(item)}</td>
                    <td style={styles.td}>
                      {item.grade}
                      {item.is_adjustment ? ' - Adjustment' : ''}
                    </td>
                    <td style={styles.td}>{item.qty}</td>
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
    </div>
  )
}
