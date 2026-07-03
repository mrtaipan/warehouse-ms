'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()
const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const GRN_SEQUENCE_MAX = 1000
const QUANTITY_FIELDS = new Set(['qty_surat_jalan', 'total_koli', 'supplier_qty', 'sample_qty', 'bongkar_qty'])

function getCurrentRoSuffix() {
  const now = new Date()
  return `${ROMAN_MONTHS[now.getMonth()]}${now.getFullYear()}`
}

function createNextRoNumber(existingRows) {
  const suffix = getCurrentRoSuffix()
  let latestNumber = 0

  for (const row of existingRows || []) {
    const roNumber = row.grn_number || ''
    const match = roNumber.match(/^#?(\d+)-([A-Z]+)(\d{4})$/)

    if (!match) continue

    latestNumber = Number(match[1]) || 0
    break
  }

  const nextNumber = latestNumber >= GRN_SEQUENCE_MAX ? 1 : latestNumber + 1

  return `#${String(nextNumber).padStart(3, '0')}-${suffix}`
}

function formatToday() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeDateInput(value) {
  if (!value) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

function buildKoliRows(count, previousRows) {
  return Array.from({ length: count }, (_, index) => {
    const existing = previousRows[index]

    return {
      row_no: index + 1,
      supplier_colli_no: existing?.supplier_colli_no || '',
      supplier_qty: existing?.supplier_qty || '',
      sample_qty: existing?.sample_qty || '',
      bongkar_qty: existing?.bongkar_qty || '',
      unload_pic: existing?.unload_pic || '',
    }
  })
}

function getDifference(row) {
  const supplierQty = Number(row.supplier_qty || 0)
  const sampleQty = Number(row.sample_qty || 0)
  const bongkarQty = Number(row.bongkar_qty || 0)
  return (bongkarQty + sampleQty) - supplierQty
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

function sanitizeQuantityInput(value) {
  return String(value || '').replace(/\D/g, '')
}

function preventNumberWheel(event) {
  event.currentTarget.blur()
}

function normalizeGroup(value) {
  return String(value || '').trim().toUpperCase()
}

function getVarianceStyle(value) {
  if (value < 0) {
    return { color: '#991b1b', background: '#fef2f2', borderColor: '#fecaca' }
  }

  if (value > 0) {
    return { color: '#9a3412', background: '#fff7ed', borderColor: '#fed7aa' }
  }

  return { color: '#166534', background: '#f0fdf4', borderColor: '#bbf7d0' }
}

const styles = {
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
  panel: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 344px) minmax(0, 1fr)',
    gap: '20px',
    alignItems: 'start',
  },
  headerColumn: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  breakdownColumn: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '28px',
    fontWeight: '900',
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  headerGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
  },
  threeFieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
    alignItems: 'end',
  },
  grnCard: {
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    padding: '14px 16px',
    background: '#f8fafc',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
  },
  grnLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: 0,
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
  fieldFull: { gridColumn: '1 / -1' },
  fieldWide: { gridColumn: '1 / -1' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '12px', fontWeight: '750', color: '#334155' },
  helperText: { fontSize: '12px', color: '#6b7280' },
  input: {
    height: '40px',
    padding: '0 11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    background: '#fff',
    color: '#111827',
    WebkitTextFillColor: '#111827',
    caretColor: '#111827',
    colorScheme: 'light',
  },
  inputReadonly: {
    height: '40px',
    padding: '0 11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    backgroundColor: '#f8fafc',
    color: '#475569',
    WebkitTextFillColor: '#475569',
    colorScheme: 'light',
  },
  select: {
    height: '40px',
    padding: '0 11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    backgroundColor: '#fff',
    color: '#111827',
    WebkitTextFillColor: '#111827',
    colorScheme: 'light',
  },
  textarea: {
    minHeight: '80px',
    padding: '11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    backgroundColor: '#fff',
    color: '#111827',
    WebkitTextFillColor: '#111827',
    caretColor: '#111827',
    colorScheme: 'light',
    resize: 'vertical',
  },
  itemTextarea: {
    minHeight: '96px',
    resize: 'vertical',
  },
  helperBox: {
    padding: '14px 16px',
    borderRadius: '12px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    color: '#6b7280',
    fontSize: '14px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(112px, 1fr))',
    gap: '10px',
  },
  summaryGridCompact: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
    gap: '10px',
  },
  summaryCard: {
    minWidth: 0,
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  summaryLabel: {
    fontSize: '10px',
    color: '#64748b',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  summaryValue: {
    fontSize: '20px',
    color: '#111827',
    fontWeight: '800',
    fontVariantNumeric: 'tabular-nums',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '12px',
    fontWeight: '700',
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 12px',
    borderTop: '1px solid #f1f5f9',
    fontSize: '13px',
    verticalAlign: 'top',
  },
  displayCell: {
    minHeight: '32px',
    minWidth: '64px',
    display: 'inline-flex',
    alignItems: 'center',
    color: '#475569',
    fontWeight: '650',
  },
  tableInput: {
    width: '100%',
    minWidth: '100px',
    height: '36px',
    padding: '0 10px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
  },
  tableInputShort: {
    width: '76px',
    height: '36px',
    padding: '0 10px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
  },
  diffBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '58px',
    height: '30px',
    padding: '0 10px',
    border: '1px solid transparent',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: '700',
  },
  switchButton: {
    width: '52px',
    height: '30px',
    border: 'none',
    borderRadius: '999px',
    padding: '3px',
    cursor: 'pointer',
    transition: 'background 160ms ease',
  },
  switchButtonOn: { background: '#16a34a' },
  switchButtonOff: { background: '#cbd5e1' },
  switchKnob: {
    display: 'block',
    width: '24px',
    height: '24px',
    borderRadius: '999px',
    background: '#fff',
    boxShadow: '0 2px 7px rgba(15, 23, 42, 0.22)',
    transition: 'transform 160ms ease',
  },
  switchKnobOn: { transform: 'translateX(22px)' },
  switchValue: { fontSize: '13px', fontWeight: '700', color: '#475569' },
  switchRow: { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '40px' },
  actions: { display: 'flex', gap: '10px', alignItems: 'center' },
  formLock: {
    border: 0,
    margin: 0,
    padding: 0,
    minInlineSize: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  panelSaving: {
    cursor: 'wait',
  },
  savingText: {
    margin: 0,
    color: '#475569',
    fontSize: '13px',
    fontWeight: '700',
  },
  primaryButton: {
    height: '40px',
    padding: '0 18px',
    border: 'none',
    borderRadius: '8px',
    background: '#14532d',
    color: '#fff',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(20, 83, 45, 0.18)',
  },
  secondaryButton: {
    height: '40px',
    padding: '0 18px',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    background: '#7f1d1d',
    color: '#fff',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(127, 29, 29, 0.16)',
  },
  error: { color: '#dc2626', margin: 0 },
  success: { color: '#16a34a', margin: 0 },
}

export default function NewInboundPage() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingRoNumber, setLoadingRoNumber] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isCompactLayout, setIsCompactLayout] = useState(false)
  const [form, setForm] = useState({
    grn_number: '',
    inbound_date: normalizeDateInput(formatToday()),
    supplier_id: '',
    item_name: '',
    payment_on_site: 'yes',
    qty_surat_jalan: '',
    total_koli: '',
    notes: '',
  })
  const [koliRows, setKoliRows] = useState([])

  useEffect(() => {
    function updateLayout() {
      setIsCompactLayout(window.innerWidth < 960)
    }

    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [])

  useEffect(() => {
    async function loadInitialData() {
      setLoadingOptions(true)
      setLoadingRoNumber(true)
      setError('')

      const [
        { data: supplierRows, error: supplierError },
        { data: roRows, error: roError },
      ] = await Promise.all([
        supabase.from('dir_suppliers').select('id, supplier_name, group').eq('is_active', true).ilike('group', 'MOB').order('supplier_name', { ascending: true }),
        supabase.from('inbound').select('grn_number').order('created_at', { ascending: false }).limit(200),
      ])

      if (supplierError || roError) {
        setError(
          supplierError?.message ||
            roError?.message ||
            'Failed to load form data.'
        )
        setLoadingOptions(false)
        setLoadingRoNumber(false)
        return
      }

      setSuppliers((supplierRows || []).filter((supplier) => normalizeGroup(supplier.group) === 'MOB'))
      setForm((prev) => ({
        ...prev,
        grn_number: createNextRoNumber(roRows || []),
      }))
      setLoadingOptions(false)
      setLoadingRoNumber(false)
    }

    loadInitialData()
  }, [])

  function handleChange(event) {
    const { name, value } = event.target
    const nextValue = QUANTITY_FIELDS.has(name)
      ? sanitizeQuantityInput(value)
      : name === 'item_name'
        ? value.toUpperCase()
        : value

    setForm((prev) => ({
      ...prev,
      [name]: nextValue,
    }))

    if (name === 'total_koli') {
      const nextCount = Math.max(0, Number.parseInt(nextValue || '0', 10) || 0)
      setKoliRows((prev) => buildKoliRows(nextCount, prev))
    }
  }

  function handlePaidOnSiteChange() {
    setForm((prev) => ({
      ...prev,
      payment_on_site: prev.payment_on_site === 'yes' ? 'no' : 'yes',
    }))
  }

  const totalSampleQty = koliRows.reduce((sum, row) => sum + Number(row.sample_qty || 0), 0)
  const totalUnloadedQty = koliRows.reduce((sum, row) => sum + Number(row.bongkar_qty || 0), 0)
  const totalItemsReceived = totalUnloadedQty + totalSampleQty
  const hasSjQty = !isBlank(form.qty_surat_jalan)
  const totalVariance = hasSjQty ? totalItemsReceived - Number(form.qty_surat_jalan || 0) : null
  const totalVarianceStyle = hasSjQty
    ? getVarianceStyle(totalVariance)
    : { color: '#64748b', background: '#f8fafc', borderColor: '#e2e8f0' }
  const contentGridStyle = isCompactLayout
    ? { ...styles.contentGrid, gridTemplateColumns: '1fr' }
    : styles.contentGrid
  const summaryGridStyle = isCompactLayout ? styles.summaryGridCompact : styles.summaryGrid
  const summaryItems = [
    {
      label: 'Total Sample Qty',
      value: totalSampleQty,
      title: 'Jumlah sample yang dicatat dari proses inbound.',
      valueStyle: { color: '#1d4ed8' },
      cardStyle: { background: '#eff6ff', borderColor: '#bfdbfe' },
    },
    {
      label: 'Total Unloaded Qty',
      value: totalUnloadedQty,
      title: 'Qty yang telah dibongkar, tidak termasuk sample.',
      valueStyle: { color: '#4338ca' },
      cardStyle: { background: '#eef2ff', borderColor: '#c7d2fe' },
    },
    {
      label: 'Total Items Received',
      value: totalItemsReceived,
      title: 'Total barang diterima, termasuk qty bongkar dan sample.',
      valueStyle: { color: '#166534' },
      cardStyle: { background: '#f0fdf4', borderColor: '#bbf7d0' },
    },
    {
      label: 'Total Variance',
      value: hasSjQty ? (totalVariance > 0 ? `+${totalVariance}` : totalVariance) : 'No data',
      title: hasSjQty
        ? 'Selisih antara total barang diterima dan SJ Qty. Minus berarti barang diterima lebih sedikit dari SJ.'
        : 'SJ Qty belum diisi, jadi variance terhadap SJ belum bisa dihitung.',
      valueStyle: { color: totalVarianceStyle.color },
      cardStyle: totalVarianceStyle,
    },
  ]

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) {
      return
    }

    if (!form.grn_number) {
      setError('GRN number is not ready yet.')
      return
    }

    if (
      isBlank(form.inbound_date) ||
      isBlank(form.item_name) ||
      isBlank(form.payment_on_site) ||
      isBlank(form.total_koli)
    ) {
      setError('Inbound Date, Item / Item Name, Paid on Site, and Koli Qty are required.')
      return
    }

    const totalKoli = Number(form.total_koli || 0)

    if (!Number.isFinite(totalKoli) || totalKoli < 1) {
      setError('Koli Qty must be at least 1.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const activeRows = buildKoliRows(totalKoli, koliRows)
    const nextStatus = 'inbound'
    const totalReceivedQty = activeRows.reduce(
      (sum, row) => sum + Number(row.bongkar_qty || 0) + Number(row.sample_qty || 0),
      0
    )

    const { data: order, error: orderError } = await supabase
      .from('inbound')
      .insert([
        {
          grn_number: form.grn_number.trim(),
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
          inbound_date: form.inbound_date,
          item_name: form.item_name.trim().toUpperCase(),
          payment_on_site: form.payment_on_site === 'yes',
          total_claimed_qty: isBlank(form.qty_surat_jalan) ? null : Number(form.qty_surat_jalan),
          total_received_qty: totalReceivedQty,
          total_koli: totalKoli,
          status: nextStatus,
          notes: form.notes.trim() || null,
        },
      ])
      .select('id')
      .single()

    if (orderError) {
      setError(orderError.message)
      setLoading(false)
      return
    }

    if (activeRows.length > 0) {
      const inboundPayload = activeRows.map((row) => ({
        inbound_id: order.id,
        claimed_qty: Number(row.supplier_qty || 0),
        actual_qty: Number(row.bongkar_qty || 0),
        supplier_colli_no: row.supplier_colli_no.trim() || null,
        sample_qty: Number(row.sample_qty || 0),
        unload_pic: row.unload_pic.trim() || null,
        koli_sequence: row.row_no,
      }))

      const { error: inboundError } = await supabase.from('inbound_receiving').insert(inboundPayload)

      if (inboundError) {
        setError(inboundError.message)
        setLoading(false)
        return
      }
    }

    setSuccess('Receiving saved successfully.')
    setLoading(false)

    setTimeout(() => {
      router.push('/dashboard/inbound/receiving')
      router.refresh()
    }, 600)
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ ...styles.panel, ...(loading ? styles.panelSaving : {}) }} aria-busy={loading}>
        <fieldset disabled={loading} style={styles.formLock}>
        <div style={styles.formTopBar}>
          <div>
            <p style={styles.eyebrow}>Inbound</p>
            <h1 style={styles.title}>Receiving</h1>
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={() => router.push('/dashboard/inbound/receiving')} style={styles.secondaryButton}>Cancel</button>
            <button
              type="submit"
              disabled={loading || loadingOptions || loadingRoNumber}
              style={styles.primaryButton}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}
        {loading ? <p style={styles.savingText}>Saving receiving data. Please wait until the process is complete.</p> : null}

        <div style={contentGridStyle}>
          <section style={styles.headerColumn}>
            <div style={styles.grnCard}>
              <span style={styles.grnLabel}>GRN Number</span>
              <strong style={styles.grnValue}>{loadingRoNumber ? 'GENERATING...' : form.grn_number}</strong>
            </div>

            <div style={styles.headerGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Inbound Date</label>
                <input type="date" name="inbound_date" value={form.inbound_date} onChange={handleChange} style={styles.input} required />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Supplier</label>
                <select name="supplier_id" value={form.supplier_id} onChange={handleChange} style={styles.select} disabled={loadingOptions}>
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ ...styles.field, ...styles.fieldFull }}>
                <label style={styles.label}>Item / Item Name</label>
                <textarea
                  name="item_name"
                  value={form.item_name}
                  onChange={handleChange}
                  style={{ ...styles.textarea, ...styles.itemTextarea }}
                  placeholder="ITEM NAME"
                  required
                />
              </div>

              <div style={styles.threeFieldGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>SJ Qty</label>
                  <input
                    type="text"
                    name="qty_surat_jalan"
                    value={form.qty_surat_jalan}
                    onChange={handleChange}
                    onWheel={preventNumberWheel}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    style={styles.input}
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Koli Qty</label>
                  <input
                    type="text"
                    name="total_koli"
                    value={form.total_koli}
                    onChange={handleChange}
                    onWheel={preventNumberWheel}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Paid on Site</label>
                  <div style={styles.switchRow}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.payment_on_site === 'yes'}
                      onClick={handlePaidOnSiteChange}
                      style={{
                        ...styles.switchButton,
                        ...(form.payment_on_site === 'yes' ? styles.switchButtonOn : styles.switchButtonOff),
                      }}
                    >
                      <span
                        style={{
                          ...styles.switchKnob,
                          ...(form.payment_on_site === 'yes' ? styles.switchKnobOn : {}),
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ ...styles.field, ...styles.fieldWide }}>
                <label style={styles.label}>Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} style={styles.textarea} placeholder="Optional notes" />
              </div>
            </div>
          </section>

          <section style={styles.breakdownColumn}>
            <div style={summaryGridStyle}>
              {summaryItems.map((item) => (
                <div key={item.label} style={{ ...styles.summaryCard, ...(item.cardStyle || {}) }} title={item.title}>
                  <span style={styles.summaryLabel}>{item.label}</span>
                  <strong style={{ ...styles.summaryValue, ...(item.valueStyle || {}) }}>{item.value}</strong>
                </div>
              ))}
            </div>

            {koliRows.length === 0 ? (
              <div style={styles.helperBox}>No inbound breakdown rows yet.</div>
            ) : (
              <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>No</th>
                  <th style={styles.th}>Supplier Koli No</th>
                  <th style={styles.th}>Supplier Qty</th>
                  <th style={styles.th}>Sample Qty</th>
                  <th style={styles.th}>Unloaded Qty</th>
                  <th style={styles.th}>Variance</th>
                  <th style={styles.th}>Unload PIC</th>
                </tr>
              </thead>
              <tbody>
                {koliRows.map((row) => {
                  const difference = getDifference(row)
                  const diffStyle = getVarianceStyle(difference)

                  return (
                    <tr key={row.row_no}>
                      <td style={styles.td}>{row.row_no}</td>
                      <td style={styles.td}>
                        <span style={styles.displayCell}>{row.supplier_colli_no || '-'}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.displayCell}>{row.supplier_qty || 0}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.displayCell}>{row.sample_qty || 0}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.displayCell}>{row.bongkar_qty || 0}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.diffBadge, ...diffStyle }}>
                          {difference > 0 ? `+${difference}` : difference}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.displayCell}>{row.unload_pic || '-'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
              </div>
            )}
          </section>
        </div>
        </fieldset>
      </form>
    </div>
  )
}
