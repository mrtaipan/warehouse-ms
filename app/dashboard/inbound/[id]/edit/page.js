'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
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
      id: existing?.id || null,
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

const styles = {
  title: { marginTop: 0, marginBottom: '8px', fontSize: '28px' },
  subtitle: { marginTop: 0, marginBottom: '24px', color: '#6b7280' },
  topActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  formCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sectionTitle: { margin: 0, fontSize: '20px' },
  sectionSubtitle: { margin: '4px 0 0', color: '#6b7280', fontSize: '14px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' },
  compactGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', fontWeight: '600' },
  helperText: { fontSize: '12px', color: '#6b7280' },
  input: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
  },
  inputReadonly: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  select: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#fff',
  },
  textarea: {
    minHeight: '100px',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
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
    gap: '8px',
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: '24px',
    color: '#111827',
    fontWeight: '700',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
  },
  th: {
    padding: '12px 14px',
    textAlign: 'left',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '13px',
    fontWeight: '700',
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 14px',
    borderTop: '1px solid #f1f5f9',
    fontSize: '14px',
    verticalAlign: 'top',
  },
  tableInput: {
    width: '100%',
    minWidth: '110px',
    height: '38px',
    padding: '0 10px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
  },
  tableInputShort: {
    width: '86px',
    height: '38px',
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
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: '700',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  primaryButton: {
    height: '42px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '8px',
    background: '#111827',
    color: '#fff',
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
    fontWeight: '600',
    cursor: 'pointer',
  },
  linkButton: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '42px',
    padding: '0 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    textDecoration: 'none',
    fontWeight: '600',
  },
  error: { color: '#dc2626', margin: 0 },
  success: { color: '#16a34a', margin: 0 },
}

export default function EditReceivingPage() {
  const router = useRouter()
  const params = useParams()
  const inboundId = params.id
  const [suppliers, setSuppliers] = useState([])
  const [loadedDetailIds, setLoadedDetailIds] = useState([])
  const [loadingPage, setLoadingPage] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    grn_number: '',
    inbound_date: '',
    supplier_id: '',
    item_name: '',
    payment_on_site: 'yes',
    qty_surat_jalan: '',
    total_koli: '',
    notes: '',
  })
  const [koliRows, setKoliRows] = useState([])

  const loadData = useEffectEvent(async () => {
    setLoadingPage(true)
    setError('')

    const [
      { data: supplierRows, error: supplierError },
      { data: inboundRow, error: inboundError },
      { data: detailRows, error: detailError },
    ] = await Promise.all([
      supabase.from('suppliers').select('id, supplier_name').eq('is_active', true).order('supplier_name', { ascending: true }),
      supabase.from('inbound').select('*').eq('id', inboundId).single(),
      supabase.from('inbound_receiving').select('*').eq('inbound_id', inboundId).order('koli_sequence', { ascending: true }),
    ])

    if (supplierError || inboundError || detailError) {
      setError(supplierError?.message || inboundError?.message || detailError?.message || 'Failed to load receiving data.')
      setLoadingPage(false)
      return
    }

    const mappedRows = (detailRows || []).map((row, index) => ({
      id: row.id,
      row_no: row.koli_sequence || index + 1,
      supplier_colli_no: row.supplier_colli_no || '',
      supplier_qty: row.claimed_qty ?? '',
      sample_qty: row.sample_qty ?? '',
      bongkar_qty: row.actual_qty ?? '',
      unload_pic: row.unload_pic || '',
    }))

    setSuppliers(supplierRows || [])
    setLoadedDetailIds((detailRows || []).map((row) => row.id))
    setForm({
      grn_number: inboundRow.grn_number || '',
      inbound_date: normalizeDateInput(inboundRow.inbound_date),
      supplier_id: inboundRow.supplier_id ? String(inboundRow.supplier_id) : '',
      item_name: inboundRow.item_name || '',
      payment_on_site: inboundRow.payment_on_site ? 'yes' : 'no',
      qty_surat_jalan: inboundRow.total_claimed_qty ?? '',
      total_koli: inboundRow.total_koli ? String(inboundRow.total_koli) : mappedRows.length ? String(mappedRows.length) : '',
      notes: inboundRow.notes || '',
    })
    setKoliRows(buildKoliRows(Number(inboundRow.total_koli || mappedRows.length || 0), mappedRows))
    setLoadingPage(false)
  })

  useEffect(() => {
    loadData()
  }, [inboundId])

  function handleChange(event) {
    const { name, value } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: name === 'item_name' ? value.toUpperCase() : value,
    }))

    if (name === 'total_koli') {
      const nextCount = Math.max(0, Number.parseInt(value || '0', 10) || 0)
      setKoliRows((prev) => buildKoliRows(nextCount, prev))
    }
  }

  function handleKoliChange(index, field, value) {
    setKoliRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]:
                field === 'supplier_colli_no' || field === 'unload_pic'
                  ? value.toUpperCase()
                  : value,
            }
          : row
      )
    )
  }

  const totalQtySample = koliRows.reduce((sum, row) => sum + Number(row.sample_qty || 0), 0)
  const totalQtyBongkar = koliRows.reduce((sum, row) => sum + Number(row.bongkar_qty || 0), 0)
  const totalBarangDiterima = totalQtyBongkar + totalQtySample
  const totalSelisih = koliRows.reduce((sum, row) => sum + getDifference(row), 0)
  const totalSelisihStyle =
    totalSelisih < 0
      ? { color: '#dc2626', background: '#fee2e2' }
      : totalSelisih > 0
        ? { color: '#166534', background: '#dcfce7' }
        : { color: '#374151', background: '#f3f4f6' }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!form.grn_number || !form.supplier_id || !form.item_name.trim()) {
      setError('GRN number, supplier, and Barang are required.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const totalKoli = Number(form.total_koli || 0)
    const hasKoliRows = totalKoli > 0 && koliRows.length === totalKoli
    const activeRows = hasKoliRows ? koliRows.slice(0, totalKoli) : []
    const totalReceivedQty = activeRows.reduce(
      (sum, row) => sum + Number(row.bongkar_qty || 0) + Number(row.sample_qty || 0),
      0
    )
    const nextStatus = hasKoliRows ? 'inbound' : 'draft'

    const { error: updateError } = await supabase
      .from('inbound')
      .update({
        supplier_id: Number(form.supplier_id),
        inbound_date: form.inbound_date,
        item_name: form.item_name.trim().toUpperCase(),
        payment_on_site: form.payment_on_site === 'yes',
        total_claimed_qty: Number(form.qty_surat_jalan || 0),
        total_received_qty: totalReceivedQty,
        total_koli: totalKoli,
        status: nextStatus,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const keptIds = activeRows.map((row) => row.id).filter(Boolean)
    const removedIds = loadedDetailIds.filter((id) => !keptIds.includes(id))

    if (removedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('inbound_receiving')
        .delete()
        .in('id', removedIds)

      if (deleteError) {
        setError(`Failed to remove deleted koli rows. Please check DELETE policy for inbound_receiving. ${deleteError.message}`)
        setLoading(false)
        return
      }
    }

    const rowsToUpdate = activeRows.filter((row) => row.id)
    for (const row of rowsToUpdate) {
      const { error: rowUpdateError } = await supabase
        .from('inbound_receiving')
        .update({
          claimed_qty: Number(row.supplier_qty || 0),
          actual_qty: Number(row.bongkar_qty || 0),
          supplier_colli_no: row.supplier_colli_no.trim() || null,
          sample_qty: Number(row.sample_qty || 0),
          unload_pic: row.unload_pic.trim() || null,
          koli_sequence: row.row_no,
        })
        .eq('id', row.id)

      if (rowUpdateError) {
        setError(rowUpdateError.message)
        setLoading(false)
        return
      }
    }

    const rowsToInsert = activeRows.filter((row) => !row.id)
    if (rowsToInsert.length > 0) {
      const payload = rowsToInsert.map((row) => ({
        inbound_id: Number(inboundId),
        claimed_qty: Number(row.supplier_qty || 0),
        actual_qty: Number(row.bongkar_qty || 0),
        supplier_colli_no: row.supplier_colli_no.trim() || null,
        sample_qty: Number(row.sample_qty || 0),
        unload_pic: row.unload_pic.trim() || null,
        koli_sequence: row.row_no,
      }))

      const { error: insertError } = await supabase.from('inbound_receiving').insert(payload)

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }
    }

    setSuccess('Receiving updated successfully.')
    setLoading(false)

    setTimeout(() => {
      window.location.reload()
    }, 300)
  }

  if (loadingPage) {
    return <p style={styles.subtitle}>Loading receiving data...</p>
  }

  return (
    <div>
      <div style={styles.topActions}>
        <div>
          <h1 style={styles.title}>Edit Receiving</h1>
          <p style={styles.subtitle}>Update the receiving header and koli breakdown any time from this page.</p>
        </div>

        <Link href={`/dashboard/inbound/${inboundId}`} style={styles.linkButton}>
          View Detail
        </Link>
      </div>

      <form onSubmit={handleSubmit} style={styles.formCard}>
        <div>
          <h2 style={styles.sectionTitle}>Receiving Header</h2>
          <p style={styles.sectionSubtitle}>Main receiving information before the koli details are saved.</p>
        </div>

        <div style={styles.compactGrid}>
          <div style={styles.field}>
            <label style={styles.label}>GRN Number</label>
            <input value={form.grn_number} readOnly style={styles.inputReadonly} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              Inbound Date
              <span style={{ ...styles.helperText, marginLeft: '8px' }}>
                {formatDateDisplay(form.inbound_date)}
              </span>
            </label>
            <input type="date" name="inbound_date" value={form.inbound_date} onChange={handleChange} style={styles.input} required />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Supplier</label>
            <select name="supplier_id" value={form.supplier_id} onChange={handleChange} style={styles.select} required>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.compactGrid}>
          <div style={styles.field}>
            <label style={styles.label}>Barang</label>
            <input name="item_name" value={form.item_name} onChange={handleChange} style={styles.input} placeholder="NAMA BARANG" required />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Qty Surat Jalan</label>
            <input type="number" name="qty_surat_jalan" value={form.qty_surat_jalan} onChange={handleChange} min="0" style={styles.input} required />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Apakah pembayaran dilakukan di tempat?</label>
            <select name="payment_on_site" value={form.payment_on_site} onChange={handleChange} style={styles.select} required>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Notes</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} style={styles.textarea} placeholder="Optional notes" />
        </div>

        <div style={styles.helperBox}>
          You can save this receiving as draft first, then continue the koli breakdown later.
        </div>

        <div>
          <h2 style={styles.sectionTitle}>Koli Breakdown</h2>
          <p style={styles.sectionSubtitle}>Fill each supplier carton line and unloading result.</p>
        </div>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Jumlah Koli</label>
            <input type="number" name="total_koli" value={form.total_koli} onChange={handleChange} min="0" style={styles.input} />
          </div>
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Qty Sample</span>
            <strong style={styles.summaryValue}>{totalQtySample}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Bongkar</span>
            <strong style={styles.summaryValue}>{totalQtyBongkar}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Barang Diterima</span>
            <strong style={styles.summaryValue}>{totalBarangDiterima}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Selisih</span>
            <strong
              style={{
                ...styles.summaryValue,
                ...totalSelisihStyle,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'flex-start',
                minWidth: '72px',
                minHeight: '40px',
                padding: '0 12px',
                borderRadius: '999px',
              }}
            >
              {totalSelisih > 0 ? `+${totalSelisih}` : totalSelisih}
            </strong>
          </div>
        </div>

        {koliRows.length === 0 ? (
          <div style={styles.helperBox}>Set the jumlah koli first to generate the detail rows.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>No</th>
                  <th style={styles.th}>No Koli Supplier</th>
                  <th style={styles.th}>Qty Supplier</th>
                  <th style={styles.th}>Qty Sample</th>
                  <th style={styles.th}>Qty Bongkar</th>
                  <th style={styles.th}>Selisih</th>
                  <th style={styles.th}>PIC yang Membongkar</th>
                </tr>
              </thead>
              <tbody>
                {koliRows.map((row, index) => {
                  const difference = getDifference(row)
                  const diffStyle = difference < 0
                    ? { background: '#fee2e2', color: '#dc2626' }
                    : difference > 0
                      ? { background: '#dcfce7', color: '#166534' }
                      : { background: '#f3f4f6', color: '#374151' }

                  return (
                    <tr key={row.id || row.row_no}>
                      <td style={styles.td}>{row.row_no}</td>
                      <td style={styles.td}>
                        <input value={row.supplier_colli_no} onChange={(event) => handleKoliChange(index, 'supplier_colli_no', event.target.value)} style={styles.tableInput} placeholder="NO KOLI" />
                      </td>
                      <td style={styles.td}>
                        <input type="number" min="0" value={row.supplier_qty} onChange={(event) => handleKoliChange(index, 'supplier_qty', event.target.value)} style={styles.tableInputShort} placeholder="0" />
                      </td>
                      <td style={styles.td}>
                        <input type="number" min="0" value={row.sample_qty} onChange={(event) => handleKoliChange(index, 'sample_qty', event.target.value)} style={styles.tableInputShort} placeholder="0" />
                      </td>
                      <td style={styles.td}>
                        <input type="number" min="0" value={row.bongkar_qty} onChange={(event) => handleKoliChange(index, 'bongkar_qty', event.target.value)} style={styles.tableInputShort} placeholder="0" />
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.diffBadge, ...diffStyle }}>
                          {difference > 0 ? `+${difference}` : difference}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <input value={row.unload_pic} onChange={(event) => handleKoliChange(index, 'unload_pic', event.target.value)} style={styles.tableInput} placeholder="PIC" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}

        <div style={styles.actions}>
          <Link href="/dashboard/inbound" style={styles.linkButton}>Back</Link>
          <button type="submit" disabled={loading || loadingPage} style={styles.primaryButton}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
