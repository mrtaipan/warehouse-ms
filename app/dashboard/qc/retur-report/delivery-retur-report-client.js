'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import styles from './retur-report.module.css'

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export default function DeliveryReturReportClient({ rows = [], draftRejectKoliNumbers = [], canAdd = false }) {
  const router = useRouter()
  const supabase = createClient()
  const [productMode, setProductMode] = useState(() => rows.length > 0 && rows.every((row) => row.isArklineProduct) ? 'arkline' : 'mob_oi')
  const [selectedIds, setSelectedIds] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [targetKoli, setTargetKoli] = useState('')
  const [grade, setGrade] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const mobOiRows = useMemo(() => rows.filter((row) => !row.isArklineProduct), [rows])
  const arklineRows = useMemo(() => rows.filter((row) => row.isArklineProduct), [rows])
  const visibleRows = productMode === 'arkline' ? arklineRows : mobOiRows
  const selectedRows = useMemo(() => mobOiRows.filter((row) => selectedIds.includes(row.id)), [mobOiRows, selectedIds])
  const allVisibleSelected = mobOiRows.length > 0 && mobOiRows.every((row) => selectedIds.includes(row.id))

  function openAllocation() {
    if (!canAdd || !selectedRows.length || !draftRejectKoliNumbers.length) return
    setTargetKoli('')
    setGrade('')
    setNote('')
    setError('')
    setModalOpen(true)
  }

  async function addSelectedToKoli(event) {
    event.preventDefault()
    if (busy || !selectedRows.length) return
    if (!draftRejectKoliNumbers.includes(targetKoli) || !['B', 'C'].includes(grade)) {
      setError('Choose a draft R koli and grade B or C.')
      return
    }

    setBusy(true)
    setError('')
    const { error: saveError } = await supabase.rpc('allocate_delivery_rejects_to_koli', {
      p_return_item_ids: selectedRows.map((row) => row.id),
      p_koli_number: targetKoli,
      p_grade: grade,
      p_additional_note: note.trim() || null,
    })
    setBusy(false)
    if (saveError) {
      setError(saveError.message || 'Failed to add the selected Delivery rejects.')
      return
    }

    setModalOpen(false)
    setSelectedIds([])
    setSuccess(`${selectedRows.length} item(s) added to ${targetKoli}.`)
    router.refresh()
  }

  return (
    <section className={styles.regularArrangementPanel}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Delivery</p>
          <h2 className={styles.sectionTitle}>Delivery Reject</h2>
        </div>
        {productMode === 'mob_oi' ? (
          <div className={styles.regularHeaderActions}>
            <span className={styles.deliveryRejectCount}>{selectedRows.length} selected</span>
            <button type="button" className={styles.primaryButton} onClick={openAllocation} disabled={!canAdd || !selectedRows.length || !draftRejectKoliNumbers.length || busy}>
              Add Selected to Koli
            </button>
          </div>
        ) : null}
      </div>

      <div className={`${styles.preparationSourceFilter} ${styles.deliveryRouteToggle}`} role="group" aria-label="Delivery product route">
        <button type="button" aria-pressed={productMode === 'mob_oi'} className={productMode === 'mob_oi' ? styles.preparationSourceActive : ''} onClick={() => { setProductMode('mob_oi'); setError('') }}>
          MOB-OI <span>{mobOiRows.length}</span>
        </button>
        <button type="button" aria-pressed={productMode === 'arkline'} className={productMode === 'arkline' ? styles.preparationSourceActive : ''} onClick={() => { setProductMode('arkline'); setError('') }}>
          Arkline <span>{arklineRows.length}</span>
        </button>
      </div>

      {success ? <p className={styles.notice} role="status">{success}</p> : null}
      {productMode === 'mob_oi' && mobOiRows.length > 0 && !draftRejectKoliNumbers.length ? (
        <p className={styles.empty}>Create a draft R koli in Reject Storage before allocating these items.</p>
      ) : null}
      {!visibleRows.length ? (
        <p className={styles.empty}>No Delivery rejects are waiting in this tab.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {productMode === 'mob_oi' ? (
                  <th aria-label="Select">
                    <input
                      className={styles.checkbox}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => setSelectedIds(event.target.checked ? mobOiRows.map((row) => row.id) : [])}
                      disabled={!canAdd || !draftRejectKoliNumbers.length || busy}
                      aria-label="Select all MOB-OI Delivery rejects"
                    />
                  </th>
                ) : null}
                <th>Date</th>
                <th>Case Code</th>
                <th>Group</th>
                <th>Product</th>
                <th>SKU</th>
                <th>Size</th>
                <th className={styles.centerNumberCell}>Qty</th>
                <th>Reject Reason</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  {productMode === 'mob_oi' ? (
                    <td>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
                        disabled={!canAdd || !draftRejectKoliNumbers.length || busy}
                        aria-label={`Select Delivery reject ${row.return_case?.kode_kejadian || row.case_id}`}
                      />
                    </td>
                  ) : null}
                  <td>{formatDate(row.created_at)}</td>
                  <td><strong>{row.return_case?.kode_kejadian || `#${row.case_id}`}</strong></td>
                  <td>{row.group_code}</td>
                  <td>{row.product_name}</td>
                  <td>{row.sku || '-'}</td>
                  <td>{row.size || '-'}</td>
                  <td className={styles.centerNumberCell}>{row.qty}</td>
                  <td>{row.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div className={styles.deliveryRejectOverlay}>
          <form className={styles.deliveryRejectModal} onSubmit={addSelectedToKoli} role="dialog" aria-modal="true" aria-labelledby="delivery-reject-modal-title">
            <div className={styles.deliveryRejectModalHeader}>
              <div>
                <p className={styles.eyebrow}>Delivery Reject</p>
                <h2 id="delivery-reject-modal-title">Add to Reject Storage</h2>
              </div>
              <button type="button" className={styles.deliveryRejectClose} onClick={() => setModalOpen(false)} disabled={busy} aria-label="Close">X</button>
            </div>
            <div className={styles.deliveryRejectSource}>
              <strong>{selectedRows.length} selected / {selectedRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)} pcs</strong>
              <span>{selectedRows.map((row) => row.return_case?.kode_kejadian || `#${row.case_id}`).join(', ')}</span>
            </div>
            <div className={styles.deliveryRejectFields}>
              <label className={styles.field}><span>Existing draft R koli</span><select className={styles.input} value={targetKoli} onChange={(event) => setTargetKoli(event.target.value)} required><option value="">Choose R koli</option>{draftRejectKoliNumbers.map((number) => <option key={number} value={number}>{number}</option>)}</select></label>
              <label className={styles.field}><span>Grade for selected items</span><select className={styles.input} value={grade} onChange={(event) => setGrade(event.target.value)} required><option value="">Choose grade</option><option value="B">B</option><option value="C">C</option></select></label>
            </div>
            <label className={styles.field}><span>Additional reject note <small>(optional)</small></span><textarea className={styles.deliveryRejectTextarea} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Add details if needed" /></label>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <div className={styles.deliveryRejectModalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setModalOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={busy}>{busy ? 'Adding...' : `Add to ${targetKoli || 'R koli'}`}</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}
