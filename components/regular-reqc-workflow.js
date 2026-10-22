'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { getRolesForPermissionCode } from '@/utils/role-permissions'
import styles from './regular-reqc-workflow.module.css'

const supabase = createClient()

function getTodayJakarta() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function formatQty(value) {
  return Number(value || 0).toLocaleString('en-US')
}

function getQueueProductKey(row) {
  return JSON.stringify([
    row.sku_id || '', row.source_variant_code || '', row.item_name || '',
    row.brand_code || '', row.category_id || '',
  ].map((value) => String(value).trim().toUpperCase()))
}

function getQueueSizeKey(row) {
  return String(row.size || '').trim().toUpperCase() || '__NO_SIZE__'
}

export default function RegularReQcWorkflow({ view = 'queue' }) {
  const [categoryRows, setCategoryRows] = useState([])
  const [queueRows, setQueueRows] = useState([])
  const [tasks, setTasks] = useState([])
  const [resultRows, setResultRows] = useState([])
  const [inspectors, setInspectors] = useState([])
  const [draftKolis, setDraftKolis] = useState([])
  const [allocation, setAllocation] = useState({})
  const [selectedProductKey, setSelectedProductKey] = useState('')
  const [selectedSizeKey, setSelectedSizeKey] = useState('')
  const [reviewTargets, setReviewTargets] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = useCallback(async () => {
    const [queueResult, taskResult, resultResult, profileResult, roleResult, rejectResult, categoryResult] = await Promise.all([
      supabase.from('reqc_queue').select('*').neq('status', 'CANCELLED').order('created_at', { ascending: false }),
      supabase.from('qc_items').select('id, reqc_queue_id, assigned_to, allocated_qty, status, qty_a, qty_b, qty_c').not('reqc_queue_id', 'is', null),
      view === 'results' ? supabase.from('reqc_results').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      view === 'queue' ? supabase.from('dir_user_profiles').select('id, email, display_name, role, is_qc_active, qc_active_date').eq('is_qc_active', true).order('display_name') : Promise.resolve({ data: [], error: null }),
      view === 'queue' ? getRolesForPermissionCode(supabase, 'qc.grading_task.view') : Promise.resolve({ data: [], error: null }),
      view === 'results' ? supabase.from('warehouse_reject_storage').select('koli_number').eq('status', 'DRAFT').order('koli_number') : Promise.resolve({ data: [], error: null }),
      view === 'results' ? supabase.from('dir_categories').select('id, category_name, full_name') : Promise.resolve({ data: [], error: null }),
    ])
    const failure = queueResult.error || taskResult.error || resultResult.error || profileResult.error || roleResult.error || rejectResult.error || categoryResult.error
    if (failure) {
      setError(failure.message || 'Unable to load Re-QC data.')
      setLoading(false)
      return
    }

    setError('')
    const roles = new Set((roleResult.data || []).map((row) => row.role))
    const today = getTodayJakarta()
    setCategoryRows(categoryResult.data || [])
    setQueueRows(queueResult.data || [])
    setTasks(taskResult.data || [])
    setResultRows(resultResult.data || [])
    setInspectors((profileResult.data || []).filter((profile) =>
      (roles.has(profile.role) || String(profile.role || '').toLowerCase() === 'admin') &&
      profile.is_qc_active && String(profile.qc_active_date || '').slice(0, 10) === today
    ))
    setDraftKolis(Array.from(new Set((rejectResult.data || []).map((row) => row.koli_number).filter(Boolean))))
    setLoading(false)
  }, [view])

  useEffect(() => {
    const timer = window.setTimeout(() => { loadData() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const queueStats = useMemo(() => {
    const allocatedByQueue = new Map()
    tasks.forEach((task) => {
      const id = task.reqc_queue_id
      if (!id) return
      const current = allocatedByQueue.get(id) || { allocated: 0, completed: 0 }
      current.allocated += Number(task.allocated_qty || 0)
      if (task.status === 'done') current.completed += Number(task.allocated_qty || 0)
      allocatedByQueue.set(id, current)
    })
    return allocatedByQueue
  }, [tasks])

  const queueById = useMemo(() => new Map(queueRows.map((row) => [row.id, row])), [queueRows])
  const categoryById = useMemo(() => new Map(categoryRows.map((row) => [Number(row.id), row])), [categoryRows])
  const openQueueRows = useMemo(
    () => queueRows.filter((row) => Number(row.qty || 0) > (queueStats.get(row.id)?.allocated || 0)),
    [queueRows, queueStats]
  )
  const activeQueueRows = useMemo(
    () => queueRows.filter((row) => row.status !== 'QC_DONE'),
    [queueRows]
  )
  const queueProducts = useMemo(() => {
    const products = new Map()
    activeQueueRows.forEach((row) => {
      const key = getQueueProductKey(row)
      if (!products.has(key)) products.set(key, { key, row })
    })
    return Array.from(products.values())
  }, [activeQueueRows])
  const selectedProduct = queueProducts.find((product) => product.key === selectedProductKey)
  const productNameCounts = useMemo(() => {
    const counts = new Map()
    queueProducts.forEach(({ row }) => counts.set(row.item_name, (counts.get(row.item_name) || 0) + 1))
    return counts
  }, [queueProducts])
  const sizeOptions = useMemo(() => {
    if (!selectedProduct) return []
    const sizes = new Map()
    activeQueueRows.filter((row) => getQueueProductKey(row) === selectedProduct.key).forEach((row) => {
      const key = getQueueSizeKey(row)
      if (!sizes.has(key)) sizes.set(key, { key, label: row.size || 'No size' })
    })
    return Array.from(sizes.values())
  }, [activeQueueRows, selectedProduct])
  const activeSizeKey = sizeOptions.some((size) => size.key === selectedSizeKey) ? selectedSizeKey : ''
  const selectedQueueRows = activeSizeKey
    ? activeQueueRows.filter((row) => getQueueProductKey(row) === selectedProductKey && getQueueSizeKey(row) === activeSizeKey)
    : []
  async function allocate(queue) {
    const draft = allocation[queue.id] || {}
    const qty = Number(draft.qty || 0)
    const remaining = Number(queue.qty || 0) - (queueStats.get(queue.id)?.allocated || 0)
    if (!draft.inspector || !Number.isInteger(qty) || qty < 1 || qty > remaining) {
      setError('Choose a grader and enter a whole-number quantity within the remaining stock.')
      return
    }
    setBusyKey(`allocate-${queue.id}`)
    setError('')
    setSuccess('')
    const { error: actionError } = await supabase.rpc('create_reqc_qc_task', {
      p_reqc_queue_id: queue.id,
      p_assigned_to: draft.inspector,
      p_qty: qty,
    })
    if (actionError) setError(actionError.message)
    else {
      setSuccess('Re-QC task allocated.')
      setAllocation((current) => ({ ...current, [queue.id]: { inspector: draft.inspector, qty: '' } }))
      await loadData()
    }
    setBusyKey('')
  }

  async function reviewResult(result) {
    setBusyKey(`review-${result.id}`)
    setError('')
    setSuccess('')
    const { data: userResult } = await supabase.auth.getUser()
    const userEmail = userResult?.user?.email || null
    const isGradeA = result.grade === 'A'
    const targetKoli = reviewTargets[result.id] || ''
    const { error: actionError } = isGradeA
      ? await supabase.rpc('confirm_reqc_grade_a_to_shelving', { p_result_id: result.id, p_confirmed_by: userEmail })
      : await supabase.rpc('confirm_reqc_reject_to_storage', { p_result_id: result.id, p_koli_number: targetKoli || null, p_confirmed_by: userEmail })
    if (actionError) setError(actionError.message)
    else {
      setSuccess(isGradeA ? 'Grade A moved to the shelving queue.' : 'Grade B/C added to Rejection Storage.')
      await loadData()
    }
    setBusyKey('')
  }

  const pendingResults = resultRows.filter((row) => row.status === 'PENDING_REVIEW')

  return (
    <main className={`${styles.page} ${view === 'queue' ? styles.queuePage : ''}`}>
      {error ? <p className={styles.messageError} role="alert">{error}</p> : null}
      {success ? <p className={styles.messageSuccess} role="status">{success}</p> : null}
      {loading ? <p className={styles.empty}>Loading Re-QC workflow...</p> : null}

      {!loading && view === 'queue' ? (
        <section>
          <div className={styles.sectionHeader}><h2>Re-QC Reguler</h2><span className={styles.count}>{openQueueRows.length} waiting</span></div>
          <div className={styles.queueSelectors}>
            <label className={styles.queueField}>
              <span>Product</span>
              <select className={styles.queueSelect} value={selectedProduct ? selectedProductKey : ''} onChange={(event) => { setSelectedProductKey(event.target.value); setSelectedSizeKey('') }}>
                <option value="">Choose product</option>
                {queueProducts.map((product) => (
                  <option key={product.key} value={product.key}>
                    {product.row.item_name}{productNameCounts.get(product.row.item_name) > 1 ? ` - ${product.row.sku_id || product.row.source_variant_code || product.row.brand_code || 'Other'}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.queueField}>
              <span>Size</span>
              <select className={styles.queueSelect} value={activeSizeKey} disabled={!selectedProduct} onChange={(event) => setSelectedSizeKey(event.target.value)}>
                <option value="">{selectedProduct ? 'Choose size' : 'Choose product first'}</option>
                {sizeOptions.map((size) => <option key={size.key} value={size.key}>{size.label}</option>)}
              </select>
            </label>
          </div>
          {selectedQueueRows.length ? (
            <div className={styles.allocationList}>
              {selectedQueueRows.map((row) => {
                const allocated = queueStats.get(row.id)?.allocated || 0
                const remaining = Math.max(0, Number(row.qty || 0) - allocated)
                const draft = allocation[row.id] || { inspector: '', qty: '' }
                const assignedTasks = tasks.filter((task) => task.reqc_queue_id === row.id)
                return (
                  <div key={row.id} className={styles.allocationCard}>
                    <div className={styles.allocationItemHeader}>
                      <div><strong>{row.item_name}</strong><span>{[row.brand_code, row.sku_id || row.source_variant_code, row.source_location_label].filter(Boolean).join(' · ')}</span></div>
                      <span className={styles.allocationSize}>{row.size || 'No size'}</span>
                    </div>
                    <div className={styles.allocationStats}>
                      <div><span>Queue Qty</span><strong>{formatQty(row.qty)}</strong></div>
                      <div><span>Allocated</span><strong>{formatQty(allocated)}</strong></div>
                      <div><span>Remaining</span><strong>{formatQty(remaining)}</strong></div>
                    </div>
                    {assignedTasks.length ? (
                      <div className={styles.assignedGraders}>
                        {assignedTasks.map((task) => {
                          const grader = inspectors.find((person) => person.email === task.assigned_to)
                          return <div key={task.id}><span>{grader?.display_name || task.assigned_to}</span><strong>{formatQty(task.allocated_qty)} pcs</strong><span>{task.status}</span></div>
                        })}
                      </div>
                    ) : null}
                    {remaining > 0 ? <div className={styles.allocationForm}>
                      <label className={styles.queueField}>
                        <span>Grader</span>
                        <select className={styles.queueSelect} value={draft.inspector} onChange={(event) => setAllocation((current) => ({ ...current, [row.id]: { ...draft, inspector: event.target.value } }))}>
                          <option value="">Choose grader</option>
                          {inspectors.map((person) => <option key={person.id} value={person.email}>{person.display_name || person.email}</option>)}
                        </select>
                      </label>
                      <label className={styles.queueField}>
                        <span>Qty</span>
                        <input className={styles.queueQtyInput} type="number" min="1" max={remaining} inputMode="numeric" value={draft.qty} onChange={(event) => setAllocation((current) => ({ ...current, [row.id]: { ...draft, qty: event.target.value } }))} />
                      </label>
                      <button className={styles.primaryButton} type="button" disabled={!inspectors.length || busyKey === `allocate-${row.id}`} onClick={() => allocate(row)}>{busyKey === `allocate-${row.id}` ? 'Saving...' : 'Allocate'}</button>
                    </div> : null}
                  </div>
                )
              })}
            </div>
          ) : !openQueueRows.length ? <p className={styles.empty}>No Re-QC stock is waiting.</p> : null}
          {selectedQueueRows.length > 0 && inspectors.length === 0 ? <p className={styles.helper}>No active QC inspector found for today.</p> : null}
        </section>
      ) : null}

      {!loading && view === 'results' ? (
        <section>
          <div className={styles.sectionHeader}><div><h2>Completed Re-QC Results</h2><p>Grade A goes to shelving after confirmation. Grade B/C goes into a Rejection Storage koli.</p></div><span className={styles.count}>{pendingResults.length} pending</span></div>
          <div className={styles.metrics}>
            {['A', 'B', 'C'].map((grade) => (
              <div key={grade} className={styles.metric}><span>Grade {grade}</span><strong>{formatQty(resultRows.filter((row) => row.grade === grade).reduce((sum, row) => sum + Number(row.qty || 0), 0))}</strong></div>
            ))}
            <div className={styles.metric}><span>Pending Review</span><strong>{formatQty(pendingResults.reduce((sum, row) => sum + Number(row.qty || 0), 0))}</strong></div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Product</th><th>SKU / Variant</th><th>Size</th><th>Inspector</th><th>Grade</th><th className={styles.numeric}>Qty</th><th>Route</th><th>Koli</th><th /></tr></thead>
              <tbody>{resultRows.map((row) => {
                const queue = queueById.get(row.reqc_queue_id)
                const task = tasks.find((item) => item.id === row.qc_item_id)
                const isPending = row.status === 'PENDING_REVIEW'
                return <tr key={row.id}>
                  <td><strong>{queue?.item_name || 'Product'}</strong><small>{[queue?.brand_code, categoryById.get(Number(queue?.category_id))?.full_name || categoryById.get(Number(queue?.category_id))?.category_name].filter(Boolean).join(' · ')}</small></td><td>{queue?.sku_id || queue?.source_variant_code || '—'}</td><td>{queue?.size || '—'}</td><td>{task?.assigned_to || '—'}</td><td><span className={`${styles.grade} ${row.grade === 'A' ? styles.gradeA : styles.gradeReject}`}>{row.grade}</span></td><td className={styles.numeric}>{formatQty(row.qty)}</td><td>{row.grade === 'A' ? 'Shelving Queue' : 'Rejection Storage'}</td>
                  <td>{row.grade === 'A' ? '—' : <select className={styles.select} value={reviewTargets[row.id] || ''} disabled={!isPending} onChange={(event) => setReviewTargets((current) => ({ ...current, [row.id]: event.target.value }))}><option value="">New koli</option>{draftKolis.map((koli) => <option key={koli} value={koli}>{koli}</option>)}</select>}</td>
                  <td>{isPending ? <button className={styles.primaryButton} type="button" disabled={busyKey === `review-${row.id}`} onClick={() => reviewResult(row)}>{row.grade === 'A' ? 'Confirm A' : 'Store B/C'}</button> : <span className={styles.reviewed}>{row.status === 'SHELVING_QUEUE' ? 'In shelving queue' : row.status === 'REJECTION_STORAGE' ? 'In rejection storage' : row.status}</span>}</td>
                </tr>
              })}{!resultRows.length ? <tr><td colSpan={9} className={styles.empty}>No completed Re-QC results yet.</td></tr> : null}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  )
}
