'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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

function escapePrintHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
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

async function loadAllRows(buildQuery) {
  const pageSize = 1000
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return { data: rows, error: null }
  }
}

export default function RegularReQcWorkflow({ view = 'queue', summaryStyles = {}, onSummaryMetricsChange }) {
  const [categoryRows, setCategoryRows] = useState([])
  const [queueRows, setQueueRows] = useState([])
  const [tasks, setTasks] = useState([])
  const [resultRows, setResultRows] = useState([])
  const [inspectors, setInspectors] = useState([])
  const [draftKolis, setDraftKolis] = useState([])
  const [allocation, setAllocation] = useState({})
  const [selectedProductKey, setSelectedProductKey] = useState('')
  const [selectedSizeKey, setSelectedSizeKey] = useState('')
  const [rejectModalId, setRejectModalId] = useState('')
  const [rejectKoli, setRejectKoli] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [selectedPrintKeys, setSelectedPrintKeys] = useState([])
  const [resultTab, setResultTab] = useState('arrangement')
  const [search, setSearch] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [detailKey, setDetailKey] = useState('')
  const [profileRows, setProfileRows] = useState([])
  const [rejectStorageRows, setRejectStorageRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = useCallback(async () => {
    const [queueResult, taskResult, resultResult, profileResult, roleResult, rejectResult, categoryResult, rejectStorageResult] = await Promise.all([
      loadAllRows(() => {
        const query = supabase.from('reqc_queue').select('*').order('created_at', { ascending: false }).order('id')
        return view === 'queue' ? query.neq('status', 'CANCELLED') : query
      }),
      loadAllRows(() => supabase.from('qc_items').select('id, reqc_queue_id, assigned_to, allocated_qty, status, qty_a, qty_b, qty_c').not('reqc_queue_id', 'is', null).order('id')),
      view === 'results' ? loadAllRows(() => supabase.from('reqc_results').select('*').order('created_at', { ascending: false }).order('id')) : Promise.resolve({ data: [], error: null }),
      loadAllRows(() => supabase.from('dir_user_profiles').select('id, email, display_name, role, is_qc_active, qc_active_date').order('id')),
      view === 'queue' ? getRolesForPermissionCode(supabase, 'qc.grading_task.view') : Promise.resolve({ data: [], error: null }),
      view === 'results' ? loadAllRows(() => supabase.from('warehouse_reject_storage').select('id, koli_number').eq('status', 'DRAFT').like('koli_number', 'R-%').order('id')) : Promise.resolve({ data: [], error: null }),
      view === 'results' ? supabase.from('dir_categories').select('id, category_name, full_name') : Promise.resolve({ data: [], error: null }),
      view === 'results' ? loadAllRows(() => supabase.from('warehouse_reject_storage').select('id, reqc_result_id, koli_number, status').not('reqc_result_id', 'is', null).order('id')) : Promise.resolve({ data: [], error: null }),
    ])
    const failure = queueResult.error || taskResult.error || resultResult.error || profileResult.error || roleResult.error || rejectResult.error || categoryResult.error || rejectStorageResult.error
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
    setProfileRows(profileResult.data || [])
    setRejectStorageRows(rejectStorageResult.data || [])
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

  const summaryMetrics = useMemo(() => {
    const allocation = tasks.reduce((sum, task) => sum + Number(task.allocated_qty || 0), 0)
    const graded = tasks.reduce((sum, task) => task.status === 'done'
      ? sum + Number(task.qty_a || 0) + Number(task.qty_b || 0) + Number(task.qty_c || 0)
      : sum, 0)
    return { allocation, graded, gap: graded - allocation }
  }, [tasks])

  useEffect(() => {
    if (view === 'results' && !loading) onSummaryMetricsChange?.(summaryMetrics)
  }, [loading, onSummaryMetricsChange, summaryMetrics, view])

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
  const filteredQueueProducts = queueProducts.filter(({ row }) =>
    !search.trim() || [row.sku_id, row.source_variant_code, row.item_name].some((value) => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))
  )
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
    if (result.grade !== 'A' && !rejectNote.trim()) {
      setError('Enter a reject note before storing Grade B/C.')
      return
    }
    setBusyKey(`review-${result.id}`)
    setError('')
    setSuccess('')
    const { data: userResult } = await supabase.auth.getUser()
    const userEmail = userResult?.user?.email || null
    const isGradeA = result.grade === 'A'
    const { error: actionError } = isGradeA
      ? await supabase.rpc('confirm_reqc_grade_a_to_storage', { p_result_id: result.id, p_confirmed_by: userEmail })
      : await supabase.rpc('confirm_reqc_reject_to_storage_with_note', { p_result_id: result.id, p_koli_number: rejectKoli || null, p_reject_note: rejectNote.trim(), p_confirmed_by: userEmail })
    if (actionError) setError(actionError.message)
    else {
      setSuccess(isGradeA ? 'Grade A is ready in Storage Queue.' : 'Grade B/C added to Rejection Storage.')
      if (!isGradeA) setRejectModalId('')
      await loadData()
    }
    setBusyKey('')
  }

  const pendingResults = resultRows.filter((row) => row.status === 'PENDING_REVIEW')
  const profileByEmail = new Map(profileRows.map((row) => [String(row.email || '').trim().toLowerCase(), row.display_name]))
  const inspectorName = (email) => profileByEmail.get(String(email || '').trim().toLowerCase()) || 'Inspector not found'
  const rejectKoliByResult = new Map(rejectStorageRows.map((row) => [row.reqc_result_id, row.koli_number]))
  const sizeOptionsForResults = Array.from(new Set(resultRows.map((row) => queueById.get(row.reqc_queue_id)?.size).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const matchesResultFilters = (result) => {
    const queue = queueById.get(result.reqc_queue_id)
    if (!queue) return false
    const keyword = search.trim().toLowerCase()
    return (!keyword || [queue.sku_id, queue.source_variant_code, queue.item_name].some((value) => String(value || '').toLowerCase().includes(keyword))) &&
      (!sizeFilter || String(queue.size || '').toUpperCase() === sizeFilter)
  }
  const filteredPendingResults = pendingResults.filter(matchesResultFilters)
  const filteredResults = resultRows.filter(matchesResultFilters)
  const summaryGroups = Array.from(filteredResults.reduce((groups, result) => {
    const queue = queueById.get(result.reqc_queue_id)
    const sku = String(queue?.sku_id || queue?.source_variant_code || '').trim()
    const key = sku.toUpperCase() || getQueueProductKey(queue)
    const group = groups.get(key) || { key, sku: sku || 'No SKU', name: queue?.item_name || 'Product', brand: queue?.brand_code || '', qtyA: 0, qtyB: 0, qtyC: 0, rows: [] }
    group[`qty${result.grade}`] += Number(result.qty || 0)
    group.rows.push(result)
    groups.set(key, group)
    return groups
  }, new Map()).values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const selectedDetail = summaryGroups.find((group) => group.key === detailKey)
  const selectedRejectResult = pendingResults.find((result) => result.id === rejectModalId)
  const printableGroups = summaryGroups.filter((group) => selectedPrintKeys.includes(group.key))
  const allVisibleSelected = summaryGroups.length > 0 && summaryGroups.every((group) => selectedPrintKeys.includes(group.key))

  function printSelectedResults() {
    if (!printableGroups.length) return
    const printWindow = window.open('', '_blank', 'width=960,height=720')
    if (!printWindow) {
      setError('The print window was blocked. Please allow pop-ups and try again.')
      return
    }
    const totals = printableGroups.reduce((sum, group) => ({
      a: sum.a + group.qtyA, b: sum.b + group.qtyB, c: sum.c + group.qtyC,
    }), { a: 0, b: 0, c: 0 })
    const printedAt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date())
    const rows = printableGroups.map((group) => `<tr>
      <td>${escapePrintHtml(group.sku)}</td><td>${escapePrintHtml(group.name)}</td>
      <td class="qty">${formatQty(group.qtyA)}</td><td class="qty">${formatQty(group.qtyB)}</td>
      <td class="qty">${formatQty(group.qtyC)}</td><td class="qty">${formatQty(group.qtyA + group.qtyB + group.qtyC)}</td>
    </tr>`).join('')
    printWindow.document.write(`<!doctype html><html><head><title>Reguler Re-QC Result Summary</title><style>
      @page { size: A4; margin: 20mm; }
      body { color: #172033; font: 12px Arial, sans-serif; margin: 0; }
      header { border-bottom: 2px solid #172033; padding-bottom: 14px; margin-bottom: 20px; }
      h1 { font-size: 22px; margin: 4px 0 8px; }
      .eyebrow { color: #526176; font-size: 11px; font-weight: bold; text-transform: uppercase; }
      .meta { color: #526176; }
      table { border-collapse: collapse; width: 100%; }
      th, td { padding: 9px 7px; border-bottom: 1px solid #dbe2ea; text-align: left; vertical-align: top; }
      th { background: #f4f6f8; font-size: 11px; }
      .qty { text-align: right; font-variant-numeric: tabular-nums; }
      tfoot td { border-top: 2px solid #172033; font-weight: bold; }
      tr { break-inside: avoid; }
    </style></head><body><header><div class="eyebrow">Quality Control</div><h1>Reguler Re-QC Result Summary</h1>
      <div class="meta">Printed ${escapePrintHtml(printedAt)} WIB · ${printableGroups.length} SKU selected</div></header>
      <table><thead><tr><th>SKU</th><th>Item</th><th class="qty">Grade A</th><th class="qty">Grade B</th><th class="qty">Grade C</th><th class="qty">Total</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><td colspan="2">Total</td><td class="qty">${formatQty(totals.a)}</td><td class="qty">${formatQty(totals.b)}</td><td class="qty">${formatQty(totals.c)}</td><td class="qty">${formatQty(totals.a + totals.b + totals.c)}</td></tr></tfoot></table>
    </body></html>`)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <main className={`${styles.page} ${view === 'queue' ? styles.queuePage : styles.resultPage}`}>
      {error ? <p className={styles.messageError} role="alert">{error}</p> : null}
      {success ? <p className={styles.messageSuccess} role="status">{success}</p> : null}
      {loading ? <p className={styles.empty}>Loading Re-QC workflow...</p> : null}

      {!loading && view === 'queue' ? (
        <section>
          <div className={styles.sectionHeader}><h2>Re-QC Arrangement</h2><span className={styles.count}>{openQueueRows.length} waiting</span></div>
          <label className={styles.queueField}>
            <span>SKU / Item</span>
            <input className={styles.queueSelect} type="search" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedProductKey(''); setSelectedSizeKey('') }} placeholder="Search SKU or item name" />
          </label>
          <div className={styles.queueSelectors}>
            <label className={styles.queueField}>
              <span>Product</span>
              <select className={styles.queueSelect} value={selectedProduct ? selectedProductKey : ''} onChange={(event) => { setSelectedProductKey(event.target.value); setSelectedSizeKey('') }}>
                <option value="">Choose product</option>
                {filteredQueueProducts.map((product) => (
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
                          return <div key={task.id}><span>{grader?.display_name || inspectorName(task.assigned_to)}</span><strong>{formatQty(task.allocated_qty)} pcs</strong><span>{task.status}</span></div>
                        })}
                      </div>
                    ) : null}
                    {remaining > 0 ? <div className={styles.allocationForm}>
                      <label className={styles.queueField}>
                        <span>Grader</span>
                        <select className={styles.queueSelect} value={draft.inspector} onChange={(event) => setAllocation((current) => ({ ...current, [row.id]: { ...draft, inspector: event.target.value } }))}>
                          <option value="">Choose grader</option>
                          {inspectors.map((person) => <option key={person.id} value={person.email}>{person.display_name || 'Unnamed inspector'}</option>)}
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
        <section className={styles.resultsSection}>
          <div className={styles.resultFilters}>
            <label style={summaryStyles.field}><span style={summaryStyles.label}>SKU / Item</span><input style={summaryStyles.input} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SKU or item name" /></label>
            <label style={summaryStyles.field}><span style={summaryStyles.label}>Size</span><select style={summaryStyles.select} value={sizeFilter} onChange={(event) => setSizeFilter(event.target.value)}><option value="">All sizes</option>{sizeOptionsForResults.map((size) => <option key={size} value={size.toUpperCase()}>{size}</option>)}</select></label>
          </div>
          <div style={summaryStyles.summaryTabs} className={styles.resultTabs}>
            <div style={summaryStyles.summaryTabList} className={styles.resultTabList} role="tablist" aria-label="Re-QC Reguler views">
              {[['arrangement', 'Arrangement'], ['summary', 'Result Summary']].map(([key, label]) => (
                <button key={key} id={`reqc-tab-${key}`} type="button" role="tab" aria-controls="reqc-result-panel" aria-selected={resultTab === key} className={styles.resultTabButton} style={{ ...summaryStyles.summaryTabButton, ...(resultTab === key ? summaryStyles.summaryTabButtonActive : {}) }} onClick={() => setResultTab(key)}>
                  <span style={summaryStyles.summaryTabLabel}>{label}</span>
                  {resultTab === key ? <span style={summaryStyles.summaryTabUnderline} /> : null}
                </button>
              ))}
            </div>
            <div id="reqc-result-panel" role="tabpanel" aria-labelledby={`reqc-tab-${resultTab}`} style={summaryStyles.summaryTabPanel} className={styles.resultPanel}>
              <div style={summaryStyles.panelHeader} className={styles.resultPanelHeader}>
                <div>
                  <p style={{ ...summaryStyles.panelEyebrow, letterSpacing: 0 }}>Reguler Re-QC</p>
                  <h2 style={summaryStyles.sectionTitle}>{resultTab === 'arrangement' ? 'Arrangement' : 'Result Summary'}</h2>
                </div>
                {resultTab === 'summary' ? <button className={styles.primaryButton} type="button" onClick={printSelectedResults} disabled={!printableGroups.length} title="Print selected results">Print Selected</button> : null}
              </div>
          {resultTab === 'arrangement' ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>SKU</th><th>Item</th><th>Size</th><th>Inspector</th><th>Grade</th><th className={styles.numeric}>Qty</th><th>Action</th></tr></thead>
                <tbody>{filteredPendingResults.map((row) => {
                  const queue = queueById.get(row.reqc_queue_id)
                  const task = tasks.find((item) => item.id === row.qc_item_id)
                  return <tr key={row.id}>
                    <td>{queue?.sku_id || queue?.source_variant_code || '—'}</td>
                    <td><strong>{queue?.item_name || 'Product'}</strong><small>{[queue?.brand_code, categoryById.get(Number(queue?.category_id))?.full_name || categoryById.get(Number(queue?.category_id))?.category_name].filter(Boolean).join(' · ')}</small></td>
                    <td>{queue?.size || '—'}</td><td>{inspectorName(task?.assigned_to)}</td>
                    <td><span className={`${styles.grade} ${row.grade === 'A' ? styles.gradeA : styles.gradeReject}`}>{row.grade}</span></td>
                    <td className={styles.numeric}>{formatQty(row.qty)}</td>
                    <td><button className={styles.primaryButton} type="button" disabled={busyKey === `review-${row.id}`} onClick={() => {
                      if (row.grade === 'A') reviewResult(row)
                      else { setRejectModalId(row.id); setRejectKoli(''); setRejectNote(''); setError('') }
                    }}>{row.grade === 'A' ? 'Confirm A' : 'Store Reject'}</button></td>
                  </tr>
                })}{!filteredPendingResults.length ? <tr><td colSpan={7} className={styles.empty}>No Re-QC results are waiting for review.</td></tr> : null}</tbody>
              </table>
            </div>
          ) : (
            <>
              <div style={summaryStyles.grid}>
                {['A', 'B', 'C'].map((grade) => <div key={grade} style={summaryStyles.summaryCard}><span style={summaryStyles.summaryLabel}>Total Grade {grade}</span><strong style={summaryStyles.summaryValue}>{formatQty(filteredResults.filter((row) => row.grade === grade).reduce((sum, row) => sum + Number(row.qty || 0), 0))}</strong></div>)}
                <div style={summaryStyles.summaryCard}><span style={summaryStyles.summaryLabel}>Total Checked</span><strong style={summaryStyles.summaryValue}>{formatQty(filteredResults.reduce((sum, row) => sum + Number(row.qty || 0), 0))}</strong></div>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th className={styles.checkboxCell}><input type="checkbox" aria-label="Select all visible results" checked={allVisibleSelected} onChange={(event) => setSelectedPrintKeys((current) => event.target.checked
                    ? Array.from(new Set([...current, ...summaryGroups.map((group) => group.key)]))
                    : current.filter((key) => !summaryGroups.some((group) => group.key === key)))} /></th><th>SKU</th><th>Item</th><th className={styles.numeric}>Grade A</th><th className={styles.numeric}>Grade B</th><th className={styles.numeric}>Grade C</th><th className={styles.numeric}>Total</th><th>Action</th></tr></thead>
                  <tbody>{summaryGroups.map((group) => <tr key={group.key}>
                    <td className={styles.checkboxCell}><input type="checkbox" aria-label={`Select ${group.sku} for printing`} checked={selectedPrintKeys.includes(group.key)} onChange={(event) => setSelectedPrintKeys((current) => event.target.checked ? [...current, group.key] : current.filter((key) => key !== group.key))} /></td>
                    <td>{group.sku}</td><td><strong>{group.name}</strong><small>{group.brand || '—'}</small></td>
                    <td className={styles.numeric}>{formatQty(group.qtyA)}</td><td className={styles.numeric}>{formatQty(group.qtyB)}</td><td className={styles.numeric}>{formatQty(group.qtyC)}</td><td className={styles.numeric}>{formatQty(group.qtyA + group.qtyB + group.qtyC)}</td>
                    <td><button className={styles.backLink} type="button" onClick={() => setDetailKey(group.key)}>Detail</button></td>
                  </tr>)}{!summaryGroups.length ? <tr><td colSpan={8} className={styles.empty}>No Re-QC results match these filters.</td></tr> : null}</tbody>
                </table>
              </div>
            </>
          )}
            </div>
          </div>
        </section>
      ) : null}
      {selectedRejectResult && typeof document !== 'undefined' ? createPortal(
        <div className={styles.modalOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !busyKey) setRejectModalId('') }}>
          <form className={`${styles.detailModal} ${styles.rejectModal}`} role="dialog" aria-modal="true" aria-labelledby="reqc-reject-title" onSubmit={(event) => { event.preventDefault(); reviewResult(selectedRejectResult) }}>
            <div className={styles.modalHeader}>
              <div><p className={styles.eyebrow}>Reguler Re-QC</p><h2 id="reqc-reject-title">Store Reject</h2></div>
              <button className={styles.closeButton} type="button" onClick={() => setRejectModalId('')} disabled={Boolean(busyKey)} aria-label="Close reject form">×</button>
            </div>
            <p className={styles.rejectContext}>{queueById.get(selectedRejectResult.reqc_queue_id)?.item_name || 'Product'} · {queueById.get(selectedRejectResult.reqc_queue_id)?.size || 'No size'} · Grade {selectedRejectResult.grade} · {formatQty(selectedRejectResult.qty)} pcs</p>
            {error ? <p className={styles.messageError} role="alert">{error}</p> : null}
            <label className={styles.queueField}><span>Reject Koli</span><select className={styles.queueSelect} value={rejectKoli} onChange={(event) => setRejectKoli(event.target.value)}><option value="">New R-koli</option>{draftKolis.map((koli) => <option key={koli} value={koli}>{koli}</option>)}</select></label>
            <label className={styles.queueField}><span>Reject Note</span><textarea className={styles.rejectNote} value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="Describe the rejection" required /></label>
            <div className={styles.modalActions}><button className={styles.backLink} type="button" onClick={() => setRejectModalId('')} disabled={Boolean(busyKey)}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={!rejectNote.trim() || Boolean(busyKey)}>{busyKey ? 'Saving...' : 'Store Reject'}</button></div>
          </form>
        </div>, document.body
      ) : null}
      {selectedDetail && typeof document !== 'undefined' ? createPortal(
        <div className={styles.modalOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailKey('') }}>
          <div className={styles.detailModal} role="dialog" aria-modal="true" aria-labelledby="reqc-detail-title">
            <div className={styles.modalHeader}><div><p className={styles.eyebrow}>Reguler Re-QC</p><h2 id="reqc-detail-title">{selectedDetail.name}</h2><span>{selectedDetail.sku} · {selectedDetail.brand || 'No brand'}</span></div><button className={styles.closeButton} type="button" onClick={() => setDetailKey('')} aria-label="Close detail">×</button></div>
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Size</th><th>Inspector</th><th>Grade</th><th className={styles.numeric}>Qty</th><th>Status</th><th>Destination</th><th>Koli</th></tr></thead><tbody>{selectedDetail.rows.map((row) => {
              const queue = queueById.get(row.reqc_queue_id)
              const task = tasks.find((item) => item.id === row.qc_item_id)
              return <tr key={row.id}><td>{queue?.size || '—'}</td><td>{inspectorName(task?.assigned_to)}</td><td>{row.grade}</td><td className={styles.numeric}>{formatQty(row.qty)}</td><td>{row.status === 'PENDING_REVIEW' ? 'Pending review' : row.status === 'STORAGE_QUEUE' ? 'Storage Queue' : row.status === 'STORED' ? 'Stored' : row.status === 'SHELVING_QUEUE' ? 'Shelving Queue (legacy)' : row.status === 'REJECTION_STORAGE' ? 'Reject Storage' : row.status}</td><td>{row.grade === 'A' ? row.status === 'SHELVING_QUEUE' ? 'Shelving Queue (legacy)' : 'Storage Queue' : 'Reject Storage'}</td><td>{row.grade === 'A' ? '—' : rejectKoliByResult.get(row.id) || 'Pending'}</td></tr>
            })}</tbody></table></div>
          </div>
        </div>, document.body
      ) : null}
    </main>
  )
}
