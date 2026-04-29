'use client'

import Image from 'next/image'
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
  select: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
    width: '100%',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
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
  sourceCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
    display: 'grid',
    gridTemplateColumns: '88px 1.6fr 0.9fr 0.9fr 0.9fr auto',
    gap: '12px',
    alignItems: 'center',
  },
  thumb: {
    width: '88px',
    height: '88px',
    objectFit: 'cover',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  thumbEmpty: {
    width: '88px',
    height: '88px',
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
  printButton: {
    height: '36px',
    padding: '0 14px',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
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
  tableWrap: {
    maxHeight: '420px',
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
    verticalAlign: 'middle',
  },
}

function getSourceKey(item) {
  return `${Number(item.brand_id || 0)}::${Number(item.category_id || 0)}::${String(item.model_name || '').trim().toUpperCase()}::${String(
    item.model_color || ''
  )
    .trim()
    .toUpperCase()}`
}

function getModelLabel(item) {
  return item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name
}

export default function QcConfirmationNextProcessPage() {
  const draftIdRef = useRef(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [grnFilter, setGrnFilter] = useState('')
  const [qcItems, setQcItems] = useState([])
  const [confirmRows, setConfirmRows] = useState([])
  const [productModels, setProductModels] = useState([])
  const [qtyInputs, setQtyInputs] = useState({})
  const [currentKoliItems, setCurrentKoliItems] = useState([])
  const [adjustmentModelLabel, setAdjustmentModelLabel] = useState('')
  const [adjustmentQty, setAdjustmentQty] = useState('')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      const [
        { data: qcData, error: qcError },
        { data: confirmData, error: confirmError },
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
          .order('koli_sequence', { ascending: true }),
        supabase
          .from('dir_product_models')
          .select('id, brand_id, category_id, model_name, model_color, photo_url')
          .eq('is_active', true)
          .order('model_name', { ascending: true }),
      ])

      if (qcError || confirmError || productModelError) {
        setError(qcError?.message || confirmError?.message || productModelError?.message || 'Failed to load confirmation next process.')
        setLoading(false)
        return
      }

      setQcItems(qcData || [])
      setConfirmRows(confirmData || [])
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
        const key = getSourceKey({
          brand_id: item.inbound_unload?.brand_id,
          category_id: item.inbound_unload?.category_id,
          model_name: item.model_name,
          model_color: item.model_color,
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
          source_qty: 0,
          confirmed_qty: 0,
        }

        current.source_qty += Number(item.qty_a || 0)
        grouped.set(key, current)
      })

    confirmRows
      .filter((item) => Number(item.inbound_id) === Number(selectedInbound?.id) && String(item.grade || 'A').toUpperCase() === 'A')
      .forEach((item) => {
        const key = getSourceKey(item)
        const current = grouped.get(key) || {
          key,
          inbound_id: item.inbound_id,
          brand_id: item.brand_id || null,
          category_id: item.category_id || null,
          brand_name: 'UNBRANDED',
          category_name: 'UNCATEGORIZED',
          model_name: item.model_name || 'UNKNOWN MODEL',
          model_color: item.model_color || '',
          photo_url: item.photo_url || '',
          source_qty: 0,
          confirmed_qty: 0,
        }

        current.confirmed_qty += Number(item.qty || 0)
        current.photo_url = current.photo_url || item.photo_url || ''
        grouped.set(key, current)
      })

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.brand_name !== b.brand_name) return a.brand_name.localeCompare(b.brand_name)
      if (a.category_name !== b.category_name) return a.category_name.localeCompare(b.category_name)
      return getModelLabel(a).localeCompare(getModelLabel(b))
    })
  }, [confirmRows, grnFilter, qcItems, selectedInbound?.id])

  const adjustmentModelOptions = useMemo(
    () => productModels.map((item) => ({
      ...item,
      label: item.model_color ? `${item.model_name} / ${item.model_color}` : item.model_name,
    })),
    [productModels]
  )

  const selectedAdjustmentModel = adjustmentModelOptions.find((item) => item.label === adjustmentModelLabel) || null

  const sourceTotals = useMemo(
    () => sourceRows.reduce(
      (result, item) => {
        result.source += Number(item.source_qty || 0)
        result.confirmed += Number(item.confirmed_qty || 0)
        return result
      },
      { source: 0, confirmed: 0 }
    ),
    [sourceRows]
  )

  const currentKoliQty = currentKoliItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const postedKoliRows = useMemo(() => {
    const grouped = new Map()

    confirmRows
      .filter((item) => Number(item.inbound_id) === Number(selectedInbound?.id))
      .forEach((item) => {
        const key = Number(item.koli_sequence || 0)
        const current = grouped.get(key) || {
          koli_sequence: key,
          total_qty: 0,
          items: [],
        }

        current.total_qty += Number(item.qty || 0)
        current.items.push(item)
        grouped.set(key, current)
      })

    return Array.from(grouped.values()).sort((a, b) => a.koli_sequence - b.koli_sequence)
  }, [confirmRows, selectedInbound?.id])

  function getDraftQtyForSource(sourceKey) {
    return currentKoliItems
      .filter((item) => item.source_key === sourceKey)
      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  }

  function handleAddSourceItem(row) {
    setError('')
    setSuccess('')

    const nextQty = Number(qtyInputs[row.key] || 0)
    const maxAllowed = Math.max(0, Number(row.source_qty || 0) - Number(row.confirmed_qty || 0) - getDraftQtyForSource(row.key))

    if (nextQty <= 0) {
      setError('Qty must be greater than 0.')
      return
    }

    if (nextQty > maxAllowed) {
      setError(`Qty for ${row.model_name} cannot be greater than the remaining source qty (${maxAllowed}).`)
      return
    }

    setCurrentKoliItems((prev) => [
      ...prev,
      {
        id: `draft-${draftIdRef.current++}`,
        source_key: row.key,
        inbound_id: row.inbound_id,
        brand_id: row.brand_id,
        category_id: row.category_id,
        model_name: row.model_name,
        model_color: row.model_color,
        photo_url: row.photo_url,
        qty: nextQty,
        grade: 'A',
        is_adjustment: false,
      },
    ])
    setQtyInputs((prev) => ({
      ...prev,
      [row.key]: '',
    }))
  }

  function handleAddAdjustmentItem() {
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

    setCurrentKoliItems((prev) => [
      ...prev,
      {
        id: `adjust-${draftIdRef.current++}`,
        source_key: `adjustment::${selectedAdjustmentModel.id}`,
        inbound_id: selectedInbound.id,
        brand_id: selectedAdjustmentModel.brand_id || null,
        category_id: selectedAdjustmentModel.category_id || null,
        model_name: selectedAdjustmentModel.model_name,
        model_color: selectedAdjustmentModel.model_color || '',
        photo_url: selectedAdjustmentModel.photo_url || '',
        qty: nextQty,
        grade: 'A',
        is_adjustment: true,
      },
    ])
    setAdjustmentModelLabel('')
    setAdjustmentQty('')
  }

  function removeDraftItem(draftId) {
    setCurrentKoliItems((prev) => prev.filter((item) => item.id !== draftId))
  }

  function handlePrintPostedKoli(koli) {
    if (!selectedInbound) {
      return
    }

    const rowsHtml = koli.items
      .map(
        (item) => `
          <tr>
            <td>${getModelLabel(item)}</td>
            <td>${item.is_adjustment ? 'Adjustment' : `Grade ${item.grade || 'A'}`}</td>
            <td class="qty">${Number(item.qty || 0)}</td>
          </tr>
        `
      )
      .join('')

    const printWindow = window.open('', '_blank', 'width=800,height=900')

    if (!printWindow) {
      setError('Print window was blocked by the browser.')
      return
    }

    const printHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>QC Confirm Card</title>
    <style>
      @page { size: A6 portrait; margin: 8mm; }
      body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
      .card { border: 2px solid #111827; border-radius: 16px; padding: 18px; width: 100%; box-sizing: border-box; }
      h1 { margin: 0 0 16px; font-size: 26px; text-align: center; }
      .row { display: grid; grid-template-columns: 88px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; align-items: start; }
      .row:last-child { border-bottom: none; }
      .label { font-weight: 700; font-size: 12px; }
      .value { font-weight: 500; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; vertical-align: middle; }
      th { background: #f9fafb; text-align: left; }
      .qty { text-align: center; font-weight: 800; }
      .total { margin-top: 16px; padding: 14px; border: 2px solid #111827; border-radius: 14px; text-align: center; }
      .totalLabel { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
      .totalValue { margin-top: 6px; font-size: 42px; line-height: 1; font-weight: 800; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>QC Confirm Card</h1>
      <div class="row"><div class="label">No GRN</div><div class="value">${selectedInbound.grn_number || '-'}</div></div>
      <div class="row"><div class="label">No Koli</div><div class="value">Koli ${koli.koli_sequence || '-'}</div></div>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Type</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="total">
        <div class="totalLabel">Total Qty</div>
        <div class="totalValue">${koli.total_qty}</div>
      </div>
    </div>
    <script>window.onload = function () { window.print(); };</script>
  </body>
</html>`

    printWindow.document.open()
    printWindow.document.write(printHtml)
    printWindow.document.close()
  }

  async function handlePostCurrentKoli() {
    setError('')
    setSuccess('')

    if (!selectedInbound) {
      setError('Choose a GRN first.')
      return
    }

    if (!currentKoliItems.length) {
      setError('Current koli is still empty.')
      return
    }

    setSaving(true)
    const nextKoliSequence =
      confirmRows
        .filter((item) => Number(item.inbound_id) === Number(selectedInbound.id))
        .reduce((maxValue, item) => Math.max(maxValue, Number(item.koli_sequence || 0)), 0) + 1

    const payload = currentKoliItems.map((item) => ({
      inbound_id: item.inbound_id,
      brand_id: item.brand_id,
      category_id: item.category_id,
      model_name: item.model_name,
      model_color: item.model_color || null,
      photo_url: item.photo_url || null,
      qty: Number(item.qty || 0),
      koli_sequence: nextKoliSequence,
      grade: 'A',
      is_adjustment: Boolean(item.is_adjustment),
    }))

    const { data, error: insertError } = await supabase
      .from('qc_confirm')
      .insert(payload)
      .select('id, inbound_id, brand_id, category_id, model_name, model_color, photo_url, qty, koli_sequence, grade, is_adjustment')

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setConfirmRows((prev) => [...prev, ...(data || [])])
    setCurrentKoliItems([])
    setSuccess(`Koli ${nextKoliSequence} posted to next process.`)
    setSaving(false)
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading confirmation next process...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div>
          <h1 style={styles.title}>Confirmation - Next Process</h1>
          <p style={styles.subtitle}>Grade A dari QC dikoli-kan di sini sebelum lanjut ke proses berikutnya.</p>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>GRN Number</label>
          <input
            list="qc-confirmation-next-process-grn-options"
            value={grnFilter}
            onChange={(event) => {
              setGrnFilter(event.target.value)
              setCurrentKoliItems([])
              setQtyInputs({})
              setError('')
              setSuccess('')
            }}
            style={styles.input}
            placeholder="Type or choose GRN Number"
          />
          <datalist id="qc-confirmation-next-process-grn-options">
            {grnOptions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        {error ? <p style={styles.errorText}>{error}</p> : null}
        {success ? <p style={styles.successText}>{success}</p> : null}
        {grnFilter ? (
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Source Grade A</span>
              <strong style={styles.summaryValue}>{sourceTotals.source}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Confirmed Qty</span>
              <strong style={styles.summaryValue}>{sourceTotals.confirmed}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Difference</span>
              <strong style={styles.summaryValue}>
                {(sourceTotals.confirmed - sourceTotals.source) > 0 ? '+' : ''}
                {sourceTotals.confirmed - sourceTotals.source}
              </strong>
            </div>
          </div>
        ) : null}
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Grade A Source</h2>
          <p style={styles.sectionSubtitle}>Add source rows into the current confirmation koli.</p>
        </div>

        {!grnFilter ? <p style={styles.emptyText}>Choose a GRN Number first.</p> : null}

        {grnFilter && !sourceRows.length ? <p style={styles.emptyText}>No Grade A source found for this GRN.</p> : null}

        {grnFilter && sourceRows.length
          ? sourceRows.map((row) => {
              const remainingQty = Math.max(0, Number(row.source_qty || 0) - Number(row.confirmed_qty || 0) - getDraftQtyForSource(row.key))

              return (
                <div key={row.key} style={styles.sourceCard}>
                  {row.photo_url ? (
                    <Image src={row.photo_url} alt={row.model_name} width={88} height={88} unoptimized style={styles.thumb} />
                  ) : (
                    <div style={styles.thumbEmpty}>NO PHOTO</div>
                  )}

                  <div style={styles.modelMeta}>
                    <div style={styles.modelName}>{getModelLabel(row)}</div>
                    <p style={styles.modelInfo}>{row.brand_name}</p>
                    <p style={styles.modelInfo}>{row.category_name}</p>
                  </div>

                  <div style={styles.qtyBox}>
                    <span style={styles.qtyLabel}>Source</span>
                    <strong style={styles.qtyValue}>{row.source_qty}</strong>
                  </div>

                  <div style={styles.qtyBox}>
                    <span style={styles.qtyLabel}>Confirmed</span>
                    <strong style={styles.qtyValue}>{row.confirmed_qty}</strong>
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
                    <button type="button" onClick={() => handleAddSourceItem(row)} style={styles.secondaryButton} disabled={remainingQty <= 0}>
                      Add To Current Koli
                    </button>
                  </div>
                </div>
              )
            })
          : null}
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Adjustment</h2>
          <p style={styles.sectionSubtitle}>Tambahkan model tambahan ke koli confirmation kalau ada item yang perlu dikoreksi di tahap ini.</p>
        </div>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Model</label>
            <input
              list="qc-next-process-adjustment-models"
              value={adjustmentModelLabel}
              onChange={(event) => setAdjustmentModelLabel(event.target.value)}
              style={styles.input}
              placeholder="Type or choose model"
            />
            <datalist id="qc-next-process-adjustment-models">
              {adjustmentModelOptions.map((item) => (
                <option key={item.id} value={item.label} />
              ))}
            </datalist>
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
          <div style={{ ...styles.field, justifyContent: 'flex-end' }}>
            <label style={styles.label}>&nbsp;</label>
            <button type="button" onClick={handleAddAdjustmentItem} style={styles.secondaryButton}>
              Add Adjustment Model
            </button>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Current Koli</h2>
          <p style={styles.sectionSubtitle}>Post satu koli penuh setelah semua model yang mau dikirim ke next process sudah lengkap.</p>
        </div>

        {!currentKoliItems.length ? <p style={styles.emptyText}>Current koli is still empty.</p> : null}

        {currentKoliItems.length ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Model</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentKoliItems.map((item) => (
                  <tr key={item.id}>
                    <td style={styles.td}>{getModelLabel(item)}</td>
                    <td style={styles.td}>{item.is_adjustment ? 'Adjustment' : 'Source Grade A'}</td>
                    <td style={styles.td}>{item.qty}</td>
                    <td style={styles.td}>
                      <button type="button" onClick={() => removeDraftItem(item.id)} style={styles.secondaryButton}>
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
            onClick={handlePostCurrentKoli}
            disabled={saving || !currentKoliItems.length}
            style={{
              ...styles.primaryButton,
              ...(saving || !currentKoliItems.length ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
          >
            {saving ? 'Posting...' : 'Post Current Koli'}
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Posted Koli</h2>
          <p style={styles.sectionSubtitle}>Koli Grade A yang sudah ter-post dari confirmation akan muncul di sini.</p>
        </div>

        {!grnFilter ? <p style={styles.emptyText}>Choose a GRN Number first.</p> : null}
        {grnFilter && !postedKoliRows.length ? <p style={styles.emptyText}>No posted koli yet for this GRN.</p> : null}

        {grnFilter && postedKoliRows.length ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Koli</th>
                  <th style={styles.th}>Models</th>
                  <th style={styles.th}>Total Qty</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {postedKoliRows.map((koli) => (
                  <tr key={koli.koli_sequence}>
                    <td style={styles.td}>{`Koli ${koli.koli_sequence}`}</td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {koli.items.map((item) => (
                          <span key={item.id}>
                            {getModelLabel(item)} ({item.qty})
                            {item.is_adjustment ? ' - Adjustment' : ''}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={styles.td}>{koli.total_qty}</td>
                    <td style={styles.td}>
                      <button type="button" onClick={() => handlePrintPostedKoli(koli)} style={styles.printButton}>
                        Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
