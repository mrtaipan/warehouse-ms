'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import styles from './retur-report.module.css'

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export default function DeliveryReturReportClient({ rows = [], draftRejectKoliNumbers = [], arklineStorageNumbers = [], rejectReasons = [], canAdd = false, canEdit = false }) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('mob_oi')
  const [selectedIds, setSelectedIds] = useState({ mob_oi: [], arkline: [] })
  const [dialog, setDialog] = useState('')
  const [targetKoli, setTargetKoli] = useState('')
  const [grade, setGrade] = useState('')
  const [note, setNote] = useState('')
  const [editingReasonId, setEditingReasonId] = useState(null)
  const [reasonDraft, setReasonDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const mobOiRows = useMemo(() => rows.filter((row) => !row.isArklineProduct), [rows])
  const arklineRows = useMemo(() => rows.filter((row) => row.isArklineProduct), [rows])
  const visibleRows = activeTab === 'arkline' ? arklineRows : mobOiRows
  const selectedRows = visibleRows.filter((row) => selectedIds[activeTab].includes(row.id))
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds[activeTab].includes(row.id))
  const selectedQty = selectedRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const validReasonNames = new Set(rejectReasons.map((reason) => String(reason.reason_name || '').trim().toLowerCase()))
  const hasUnlistedReason = activeTab === 'arkline' && selectedRows.some((row) => !validReasonNames.has(String(row.reason || '').trim().toLowerCase()))

  function changeTab(tab) {
    setActiveTab(tab)
    setEditingReasonId(null)
    setError('')
    setSuccess('')
  }

  function selectRows(ids) {
    setSelectedIds((current) => ({ ...current, [activeTab]: ids }))
  }

  function openDialog(type) {
    if (!canAdd || !selectedRows.length || busy) return
    if (type === 'mob-koli' && !draftRejectKoliNumbers.length) return
    if (type === 'arkline-koli' && !arklineStorageNumbers.length) return
    if (type === 'arkline-koli' && hasUnlistedReason) return
    setTargetKoli('')
    setGrade('')
    setNote('')
    setError('')
    setDialog(type)
  }

  async function submitDialog(event) {
    event.preventDefault()
    if (busy || !selectedRows.length) return
    if (dialog === 'mob-koli' && (!draftRejectKoliNumbers.includes(targetKoli) || !['B', 'C'].includes(grade))) {
      setError('Choose a draft R koli and grade B or C.')
      return
    }
    if (dialog === 'arkline-koli' && !arklineStorageNumbers.includes(targetKoli)) {
      setError('Choose an existing Arkline reject storage number.')
      return
    }
    if (dialog === 'arkline-koli' && hasUnlistedReason) {
      setError('Select an Arkline reject reason for every selected item first.')
      return
    }

    setBusy(true)
    setError('')
    const ids = selectedRows.map((row) => row.id)
    const result = dialog === 'mob-koli'
      ? await supabase.rpc('allocate_delivery_rejects_to_koli', {
        p_return_item_ids: ids, p_koli_number: targetKoli, p_grade: grade,
        p_additional_note: note.trim() || null,
      })
      : dialog === 'arkline-koli'
        ? await supabase.rpc('allocate_arkline_delivery_rejects_to_storage', {
          p_return_item_ids: ids, p_storage_number: targetKoli,
        })
        : dialog === 'arkline-store'
          ? await supabase.rpc('store_arkline_delivery_rejects', { p_return_item_ids: ids })
          : await supabase.rpc('store_mob_oi_delivery_rejects', { p_return_item_ids: ids })
    setBusy(false)
    if (result.error) {
      setError(result.error.message || 'Could not process the selected Delivery rejects.')
      return
    }

    const message = dialog === 'arkline-store'
      ? `${result.data?.stored || 0} item(s) stored in shelving, ${result.data?.waiting_shelving || 0} waiting for shelving.`
      : dialog === 'mob-store'
        ? `${result.data || 0} item(s) sent to the shelving queue.`
      : `${ids.length} item(s) added to ${targetKoli}.`
    setDialog('')
    selectRows([])
    setSuccess(message)
    router.refresh()
  }

  async function saveReason(event) {
    event.preventDefault()
    if (!rejectReasons.some((reason) => reason.id === reasonDraft)) {
      setError('Choose an Arkline reject reason.')
      return
    }
    setBusy(true)
    setError('')
    const { error: saveError } = await supabase.rpc('update_arkline_delivery_reject_reason', {
      p_return_item_id: editingReasonId, p_reason_id: reasonDraft,
    })
    setBusy(false)
    if (saveError) {
      setError(saveError.message || 'Could not update the reject reason.')
      return
    }
    setEditingReasonId(null)
    setSuccess('Reject reason updated.')
    router.refresh()
  }

  return (
    <div className={styles.subPageTabsPage}>
      <div className={styles.subPageTabsShell}>
        <div className={styles.subPageTabsBar} role="tablist" aria-label="Delivery reject route">
          <button type="button" role="tab" aria-selected={activeTab === 'mob_oi'} className={`${styles.subPageTabLink} ${activeTab === 'mob_oi' ? styles.subPageTabLinkActive : ''}`.trim()} onClick={() => changeTab('mob_oi')}>
            <span className={styles.subPageTabLabel}>MOB - OI</span><span className={styles.subPageTabUnderline} />
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'arkline'} className={`${styles.subPageTabLink} ${activeTab === 'arkline' ? styles.subPageTabLinkActive : ''}`.trim()} onClick={() => changeTab('arkline')}>
            <span className={styles.subPageTabLabel}>Arkline</span><span className={styles.subPageTabUnderline} />
          </button>
        </div>
      </div>

      <div className={styles.subPageTabsPanel}>
        <section className={styles.regularArrangementPanel} role="tabpanel">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{activeTab === 'arkline' ? 'Arkline' : 'MOB - OI'}</p>
              <h2 className={styles.sectionTitle}>Delivery Reject</h2>
            </div>
            <div className={`${styles.regularHeaderActions} ${styles.deliveryHeaderActions}`}>
              <span className={styles.deliveryRejectCount}>{selectedRows.length} selected / {selectedQty} pcs</span>
              {activeTab === 'arkline' ? (
                <>
                  <button type="button" className={styles.deliveryApproveButton} onClick={() => openDialog('arkline-store')} disabled={!canAdd || !selectedRows.length || busy}>OK Selected</button>
                  <button type="button" className={styles.primaryButton} onClick={() => openDialog('arkline-koli')} disabled={!canAdd || !selectedRows.length || !arklineStorageNumbers.length || hasUnlistedReason || busy} title={hasUnlistedReason ? 'Select an Arkline reject reason for each item first' : undefined}>Add Selected to Reject Koli</button>
                </>
              ) : (
                <>
                  <button type="button" className={styles.deliveryApproveButton} onClick={() => openDialog('mob-store')} disabled={!canAdd || !selectedRows.length || busy}>OK Selected</button>
                  <button type="button" className={styles.primaryButton} onClick={() => openDialog('mob-koli')} disabled={!canAdd || !selectedRows.length || !draftRejectKoliNumbers.length || busy}>Add Selected to Koli</button>
                </>
              )}
            </div>
          </div>

          {success ? <p className={styles.notice} role="status">{success}</p> : null}
          {error && !dialog ? <p className={styles.error} role="alert">{error}</p> : null}
          {activeTab === 'mob_oi' && mobOiRows.length > 0 && !draftRejectKoliNumbers.length ? <p className={styles.empty}>Create a draft R koli in Reject Storage before allocating these items.</p> : null}
          {activeTab === 'arkline' && arklineRows.length > 0 && !arklineStorageNumbers.length ? <p className={styles.empty}>Create an Arkline reject storage koli before adding selected items.</p> : null}
          {hasUnlistedReason ? <p className={styles.notice}>Choose an Arkline reject reason for each selected item before adding it to a reject koli.</p> : null}
          {!visibleRows.length ? (
            <p className={styles.empty}>No Delivery rejects are waiting in this tab.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.deliveryTable}`}>
                <thead>
                  <tr>
                    <th aria-label="Select"><input className={styles.checkbox} type="checkbox" checked={allVisibleSelected} onChange={(event) => selectRows(event.target.checked ? visibleRows.map((row) => row.id) : [])} disabled={!canAdd || busy} aria-label={`Select all ${activeTab === 'arkline' ? 'Arkline' : 'MOB-OI'} Delivery rejects`} /></th>
                    <th>Date</th><th>Case Code</th><th>Group</th><th>Product</th><th>SKU</th><th>Size</th><th className={styles.centerNumberCell}>Qty</th><th>Reject Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td><input className={styles.checkbox} type="checkbox" checked={selectedIds[activeTab].includes(row.id)} onChange={(event) => selectRows(event.target.checked ? [...selectedIds[activeTab], row.id] : selectedIds[activeTab].filter((id) => id !== row.id))} disabled={!canAdd || busy} aria-label={`Select Delivery reject ${row.return_case?.kode_kejadian || row.case_id}`} /></td>
                      <td>{formatDate(row.created_at)}</td>
                      <td><strong>{row.return_case?.kode_kejadian || `#${row.case_id}`}</strong></td>
                      <td>{row.group_code}</td>
                      <td>{row.product_name}</td>
                      <td>{row.sku || '-'}</td>
                      <td>{row.size || '-'}</td>
                      <td className={styles.centerNumberCell}>{row.qty}</td>
                      <td>
                        {activeTab === 'arkline' && editingReasonId === row.id ? (
                          <form className={styles.deliveryReasonEditor} onSubmit={saveReason}>
                            <select className={styles.input} value={reasonDraft} onChange={(event) => setReasonDraft(event.target.value)} aria-label="Arkline reject reason" required autoFocus>
                              <option value="">Choose reject reason</option>
                              {rejectReasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.reason_name}</option>)}
                            </select>
                            <button type="submit" className={styles.deliveryReasonAction} disabled={busy} title="Save reason">Save</button>
                            <button type="button" className={styles.deliveryReasonAction} onClick={() => { setEditingReasonId(null); setError('') }} disabled={busy} title="Cancel editing">Cancel</button>
                          </form>
                        ) : (
                          <div className={styles.deliveryReasonCell}>
                            <span>{row.reason || '-'}</span>
                            {activeTab === 'arkline' && canEdit ? <button type="button" className={`${styles.deliveryReasonAction} ${styles.deliveryReasonIcon}`} onClick={() => { setEditingReasonId(row.id); setReasonDraft(rejectReasons.find((reason) => reason.reason_name?.trim().toLowerCase() === row.reason?.trim().toLowerCase())?.id || ''); setError('') }} disabled={busy} title="Edit reject reason" aria-label={`Edit reject reason for ${row.product_name}`}><span aria-hidden="true">&#9998;</span></button> : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {dialog ? (
        <div className={styles.deliveryRejectOverlay}>
          <form className={styles.deliveryRejectModal} onSubmit={submitDialog} role="dialog" aria-modal="true" aria-labelledby="delivery-reject-modal-title">
            <div className={styles.deliveryRejectModalHeader}>
              <div>
                <p className={styles.eyebrow}>{activeTab === 'arkline' ? 'Arkline' : 'MOB - OI'}</p>
                <h2 id="delivery-reject-modal-title">{dialog.endsWith('-store') ? 'Approve for Shelving' : 'Add to Reject Storage'}</h2>
              </div>
              <button type="button" className={styles.deliveryRejectClose} onClick={() => setDialog('')} disabled={busy} aria-label="Close">X</button>
            </div>
            <div className={styles.deliveryRejectSource}>
              <strong>{selectedRows.length} selected / {selectedQty} pcs</strong>
              <span>{selectedRows.map((row) => row.return_case?.kode_kejadian || `#${row.case_id}`).join(', ')}</span>
            </div>
            {dialog.endsWith('-store') ? (
              <p className={styles.deliveryDialogHint}>{dialog === 'arkline-store' ? 'These items will return to Arkline shelving. If no unique shelving location exists, they will wait in the shelving queue.' : 'These items will return through the MOB/OI shelving queue.'}</p>
            ) : (
              <div className={styles.deliveryRejectFields}>
                <label className={styles.field}><span>{dialog === 'arkline-koli' ? 'Arkline Reject Storage Koli' : 'Existing draft R koli'}</span><select className={styles.input} value={targetKoli} onChange={(event) => setTargetKoli(event.target.value)} required><option value="">Choose koli</option>{(dialog === 'arkline-koli' ? arklineStorageNumbers : draftRejectKoliNumbers).map((number) => <option key={number} value={number}>{number}</option>)}</select></label>
                {dialog === 'mob-koli' ? <label className={styles.field}><span>Grade for selected items</span><select className={styles.input} value={grade} onChange={(event) => setGrade(event.target.value)} required><option value="">Choose grade</option><option value="B">B</option><option value="C">C</option></select></label> : null}
              </div>
            )}
            {dialog === 'mob-koli' ? <label className={styles.field}><span>Additional reject note <small>(optional)</small></span><textarea className={styles.deliveryRejectTextarea} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Add details if needed" /></label> : null}
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <div className={styles.deliveryRejectModalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setDialog('')} disabled={busy}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={busy}>{busy ? 'Processing...' : dialog.endsWith('-store') ? 'Confirm OK' : `Add to ${targetKoli || 'koli'}`}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
