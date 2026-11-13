'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/utils/supabase/browser'
import { stockSizesMatch } from '@/app/dashboard/storage/stock-sizes'
import styles from './warehouse-loans-client.module.css'

const supabase = createClient()
const GROUPS = ['ARKLINE', 'MOB', 'OI']
const ARKLINE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const PAGE_SIZE = 20
const DESTINATIONS = [
  ['PALLET', 'Pallet'],
  ['SHELVING', 'Shelving'],
  ['TEMP_SALES', 'Temp. Sales Area'],
  ['RE_QC', 'Re-QC'],
  ['SHELVING_QUEUE', 'Shelving Queue'],
  ['STORAGE_QUEUE', 'Storage Queue'],
]
const LOAN_STATUS_GUIDE = [
  ['REQUESTED', 'Barang sudah diminta, tetapi belum seluruh qty aktif disiapkan melalui Issue.'],
  ['IN_LOAN', 'Seluruh qty aktif sudah disiapkan melalui Issue. Barang bisa masih menunggu penyerahan atau sedang dipinjam; sistem belum membedakan keduanya.'],
  ['RETURN_PENDING', 'Peminjam sudah menyatakan barang akan dikembalikan, tetapi penerima belum mengonfirmasi barangnya.'],
  ['COMPLETED', 'Seluruh barang yang di-Issue sudah diterima kembali dan dikonfirmasi.'],
  ['CLOSED', 'Pinjaman atau sisa pinjaman tidak dikembalikan; penyelesaiannya dicatat bersama alasan.'],
  ['CANCELLED', 'Seluruh permintaan dibatalkan sebelum Issue. Pembatalan setelah Issue belum tersedia; stok harus dikembalikan ke sumber dan pembatalannya dicatat.'],
]

const cleanSku = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const qty = (value) => Number(value || 0)
const formatTime = (value) => value ? new Date(value).toLocaleString('en-GB') : '-'
const formatLocation = (row) => [row.location_type, row.location_name || row.location_id, row.location_code, row.sub_location].filter(Boolean).join(' / ')
const formatSourceLocation = (row) => [row.location_type, row.location_name || row.location_id].filter(Boolean).join(' / ')
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const shortName = (value) => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  return parts.length > 1 ? `${parts[0]} ${parts.slice(1).map((part) => `${part[0].toUpperCase()}.`).join(' ')}` : parts[0] || '-'
}

function eventTotals(events, itemId) {
  const rows = events.filter((row) => row.request_item_id === itemId)
  const sum = (type) => rows.filter((row) => row.event_type === type).reduce((total, row) => total + qty(row.qty), 0)
  return { issued: sum('ISSUE'), declared: sum('DECLARE_RETURN'), received: sum('RECEIVE'), closed: sum('CLOSE') }
}

async function loadLoanEvents(loanIds) {
  if (!loanIds.length) return { data: [], error: null }
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from('warehouse_loan_items').select('*')
      .in('loan_id', loanIds).order('created_at', { ascending: true }).order('id')
      .range(offset, offset + 999)
    if (result.error) return result
    rows.push(...(result.data || []))
    if (!result.data || result.data.length < 1000) return { data: rows, error: null }
  }
}

export default function WarehouseLoansClient({ currentUserId, canManage, isAdmin = false, userProfilesByEmail = {}, lockedGroup = '', storageRows = [], queueRows = [], locations = [], arklineProducts = [], onStockChanged }) {
  const [cases, setCases] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [borrowerFilter, setBorrowerFilter] = useState('')
  const [page, setPage] = useState(1)
  const [activeCaseId, setActiveCaseId] = useState('')
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestMode, setRequestMode] = useState('new')
  const [existingLoanId, setExistingLoanId] = useState('')
  const [eligibleLoans, setEligibleLoans] = useState([])
  const [eligibleLoansLoading, setEligibleLoansLoading] = useState(false)
  const [eligibleLoansError, setEligibleLoansError] = useState('')
  const [showStatusGuide, setShowStatusGuide] = useState(false)
  const statusGuideCloseRef = useRef(null)
  const [formError, setFormError] = useState('')
  const [group, setGroup] = useState(lockedGroup || 'MOB')
  const [purpose, setPurpose] = useState('')
  const [arklineQuery, setArklineQuery] = useState('')
  const [arklineMenuOpen, setArklineMenuOpen] = useState(false)
  const arklineInputRef = useRef(null)
  const [purposeOptions, setPurposeOptions] = useState([])
  const [newPurposeName, setNewPurposeName] = useState('')
  const [purposeLoadError, setPurposeLoadError] = useState('')
  const [draft, setDraft] = useState({ sku: '', name: '', size: '', qty: '' })
  const [draftItems, setDraftItems] = useState([])
  const [forms, setForms] = useState({})
  const [editingItemId, setEditingItemId] = useState('')
  const [itemEdit, setItemEdit] = useState({ size: '', qty: '' })

  const reload = useCallback(async () => {
    setLoading(true)
    const caseResult = await supabase.from('warehouse_loans').select('*')
      .order('created_at', { ascending: false }).limit(200)
    const eventResult = caseResult.error
      ? { data: [], error: null }
      : await loadLoanEvents((caseResult.data || []).map((row) => row.id))
    if (caseResult.error || eventResult.error) setError(caseResult.error?.message || eventResult.error?.message)
    else {
      setCases(caseResult.data || [])
      setEvents(eventResult.data || [])
      setError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => { void reload() }, [reload])
  const loadPurposes = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('warehouse_loan_purposes')
      .select('id,name').eq('is_active', true).order('name')
    if (loadError) { setPurposeLoadError(loadError.message); return [] }
    setPurposeOptions(data || [])
    setPurposeLoadError('')
    return data || []
  }, [])
  useEffect(() => { void loadPurposes() }, [loadPurposes])
  useEffect(() => {
    if (!showRequestModal || requestMode !== 'existing' || (!isAdmin && !currentUserId)) return undefined
    let disposed = false
    async function loadEligibleLoans() {
      setEligibleLoansLoading(true)
      setEligibleLoansError('')
      let query = supabase.from('warehouse_loans')
        .select('id,loan_number,purpose,group_code,requester_id,requester_email')
        .eq('status', 'REQUESTED')
        .order('created_at', { ascending: false })
        .limit(500)
      if (!isAdmin) query = query.eq('requester_id', currentUserId)
      if (lockedGroup) query = query.eq('group_code', lockedGroup)
      const { data, error: loadError } = await query
      if (disposed) return
      setEligibleLoans(data || [])
      setEligibleLoansError(loadError?.message || '')
      setEligibleLoansLoading(false)
    }
    void loadEligibleLoans()
    return () => { disposed = true }
  }, [currentUserId, isAdmin, lockedGroup, requestMode, showRequestModal])
  useEffect(() => {
    if (!showStatusGuide) return undefined
    statusGuideCloseRef.current?.focus()
    const onKeyDown = (event) => { if (event.key === 'Escape') setShowStatusGuide(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showStatusGuide])
  const setForm = (id, patch) => setForms((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  const selectedProduct = arklineProducts.find((product) => cleanSku(product.sku) === cleanSku(draft.sku))
  const existingLoan = eligibleLoans.find((loan) => loan.id === existingLoanId)
  const filteredArklineProducts = arklineProducts.filter((product) => `${product.sku} ${product.productName}`.toLowerCase().includes(arklineQuery.toLowerCase())).slice(0, 60)
  const draftTotalQty = draftItems.reduce((total, item) => total + item.qty, 0)
  const draftModelCount = new Set(draftItems.map((item) => `${cleanSku(item.sku)}|${item.name.trim().toUpperCase()}`)).size
  const requestsByLoan = useMemo(() => {
    const result = new Map()
    events.forEach((item) => {
      if (item.event_type !== 'REQUEST') return
      const items = result.get(item.loan_id) || []
      items.push(item)
      result.set(item.loan_id, items)
    })
    return result
  }, [events])
  const visibleCases = cases.filter((row) => {
    if (lockedGroup && row.group_code !== lockedGroup) return false
    if (groupFilter && row.group_code !== groupFilter) return false
    if (borrowerFilter && row.requester_id !== borrowerFilter) return false
    const items = requestsByLoan.get(row.id) || []
    const displayName = userProfilesByEmail[String(row.requester_email || '').toLowerCase()] || String(row.requester_email || '').split('@')[0]
    const text = `${row.id} ${row.purpose} ${displayName} ${row.group_code} ${items.map((item) => `${item.sku_id} ${item.item_name} ${item.size}`).join(' ')}`.toLowerCase()
    return text.includes(search.toLowerCase())
  })
  const borrowerOptions = Array.from(new Map(cases.filter((row) => !lockedGroup || row.group_code === lockedGroup).map((row) => [row.requester_id, userProfilesByEmail[String(row.requester_email || '').toLowerCase()] || String(row.requester_email || '').split('@')[0]])).entries()).sort((a, b) => a[1].localeCompare(b[1]))
  const totalPages = Math.max(1, Math.ceil(visibleCases.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedCases = visibleCases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function resetRequestDraft() {
    setRequestMode('new')
    setExistingLoanId('')
    setEligibleLoans([])
    setEligibleLoansError('')
    setGroup(lockedGroup || 'MOB')
    setPurpose('')
    setArklineQuery('')
    setArklineMenuOpen(false)
    setNewPurposeName('')
    setDraft({ sku: '', name: '', size: '', qty: '' })
    setDraftItems([])
    setFormError('')
  }

  function changeRequestMode(mode) {
    if (mode === requestMode) return
    setRequestMode(mode)
    setExistingLoanId('')
    setGroup(lockedGroup || 'MOB')
    setPurpose('')
    setNewPurposeName('')
    setDraft({ sku: '', name: '', size: '', qty: '' })
    setDraftItems([])
    setFormError('')
  }

  function closeRequestModal() {
    if (busy) return
    setShowRequestModal(false)
    resetRequestDraft()
  }

  async function perform(key, operation, { refreshStock = false } = {}) {
    if (busy) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const { error: operationError } = await operation()
      if (operationError) throw operationError
      await reload()
      if (refreshStock) await onStockChanged?.()
      setSuccess(key)
    } catch (operationError) {
      setError(operationError.message || 'Action failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function addDraftItem() {
    const item = { sku: draft.sku.trim().toUpperCase(), name: draft.name.trim(), size: draft.size.trim(), qty: Number(draft.qty) }
    if (!item.sku || !item.name || !Number.isInteger(item.qty) || item.qty <= 0 || (group === 'ARKLINE' && (!selectedProduct || !ARKLINE_SIZES.includes(item.size)))) {
      setFormError('Choose a valid product, size, and positive quantity.')
      return
    }
    setDraftItems((current) => {
      const existingIndex = current.findIndex((row) => cleanSku(row.sku) === cleanSku(item.sku)
        && row.name.trim().toUpperCase() === item.name.toUpperCase()
        && row.size.trim().toUpperCase() === item.size.toUpperCase())
      if (existingIndex < 0) return [...current, item]
      return current.map((row, index) => index === existingIndex ? { ...row, qty: row.qty + item.qty } : row)
    })
    setDraft((current) => ({ ...current, size: '', qty: '' }))
    setFormError('')
  }

  async function createCase() {
    if (busy) return
    if (!draftItems.length) { setFormError('Add at least one product.'); return }
    if (requestMode === 'existing' && !existingLoan) { setFormError('Choose an existing loan number.'); return }
    if (requestMode === 'new' && !purpose) { setFormError('Choose a purpose.'); return }
    setBusy(true)
    setFormError('')
    setSuccess('')
    try {
      let loanId
      if (requestMode === 'existing') {
        const { error: addError } = await supabase.rpc('add_warehouse_loan_items', { p_loan_id: existingLoan.id, p_items: draftItems })
        if (addError) throw addError
        loanId = existingLoan.id
      } else {
        let purposeName = purposeOptions.find((option) => option.id === purpose)?.name
        if (purpose === '__new__') {
          purposeName = newPurposeName.trim().replace(/\s+/g, ' ')
          if (!purposeName) throw new Error('Enter the new purpose name.')
          const existing = purposeOptions.find((option) => option.name.toLowerCase() === purposeName.toLowerCase())
          if (existing) purposeName = existing.name
          else {
            const { data: added, error: addError } = await supabase.from('warehouse_loan_purposes')
              .insert({ name: purposeName }).select('id,name').single()
            if (addError) {
              const refreshed = await loadPurposes()
              const matching = refreshed.find((option) => option.name.toLowerCase() === purposeName.toLowerCase())
              if (!matching) throw addError
              purposeName = matching.name
            } else {
              purposeName = added.name
              setPurposeOptions((current) => [...current, added].sort((a, b) => a.name.localeCompare(b.name)))
            }
          }
        }
        if (!purposeName) throw new Error('Choose a valid purpose.')
        const { data, error: createError } = await supabase.rpc('create_warehouse_loan', { p_group: group, p_purpose: purposeName, p_items: draftItems })
        if (createError) throw createError
        loanId = data
      }
      await reload()
      setActiveCaseId(loanId)
      setSearch('')
      setPage(1)
      setShowRequestModal(false)
      resetRequestDraft()
      setSuccess(requestMode === 'existing' ? 'Items added to the loan.' : 'Loan request created.')
    } catch (createError) {
      setFormError(createError.message || 'Unable to create the loan request.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteCase(loan) {
    if (busy || !window.confirm(`Delete the loan request for ${loan.purpose}?`)) return
    await perform('Loan request deleted.', () => supabase.rpc('delete_warehouse_loan', { p_loan_id: loan.id }))
    if (activeCaseId === loan.id) setActiveCaseId('')
  }

  async function removeRequestItem(item, remainingIssue, issued) {
    const action = issued === 0 ? 'Remove' : 'Cancel the unissued quantity of'
    if (busy || !window.confirm(`${action} ${item.item_name} (${item.size || '-'})?`)) return
    if (issued === 0) await perform('Loan item removed.', () => supabase.rpc('delete_warehouse_loan_request_item', { p_item_id: item.id }))
    else await perform('Unissued quantity cancelled.', () => supabase.rpc('cancel_warehouse_loan_request_item', { p_item_id: item.id, p_qty: remainingIssue }))
  }

  async function saveRequestItem(item, minimumQty) {
    const nextQty = Number(itemEdit.qty)
    if (busy || !Number.isInteger(nextQty) || nextQty < Math.max(1, minimumQty)) {
      setError(`Qty must be at least ${Math.max(1, minimumQty)}.`)
      return
    }
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const { error: updateError } = await supabase.rpc('update_warehouse_loan_request_item', {
        p_item_id: item.id,
        p_size: itemEdit.size.trim(),
        p_qty: nextQty,
      })
      if (updateError) throw updateError
      await reload()
      setEditingItemId('')
      setSuccess('Loan item updated.')
    } catch (updateError) {
      setError(updateError.message || 'Unable to update the loan item.')
    } finally {
      setBusy(false)
    }
  }

  function sourceOptions(item, caseGroup) {
    const stock = storageRows.filter((row) => {
      const location = row.location
      return location?.group_code === caseGroup && qty(row.qty) > 0 && stockSizesMatch(row.size, item.size)
        && [row.sku_id, row.source_variant_code].some((value) => cleanSku(value) === cleanSku(item.sku_id))
    }).map((row) => ({ key: `STORAGE:${row.id}`, label: `${formatSourceLocation(row.location)} (${qty(row.qty)} pcs)`, isShelf: row.location?.location_type === 'SHELVING' }))
    const queue = queueRows.filter((row) => {
      if (row.storage_status !== 'queued' || row.storing_type !== caseGroup || !row.inbound_id) return false
      return stockSizesMatch(row.size_label, item.size)
        && cleanSku(row.resolved_sku || row.source_variant_code) === cleanSku(item.sku_id)
        && qty(row.qty) > 0
    }).map((row) => ({
      key: `PL_QUEUE:${row.id}`,
      label: `Storage Queue / ${row.koli_sequence ? `Koli ${row.koli_sequence}` : row.package_type === 'PHOTO' ? 'Photo' : row.package_type === 'RE_QC' ? 'Re-QC Grade A' : 'Koli -'} (${qty(row.qty)} pcs)`,
      isShelf: false,
    }))
    return [...stock.filter((entry) => entry.isShelf), ...stock.filter((entry) => !entry.isShelf), ...queue, { key: 'OTHER', label: 'Other' }]
  }

  function printCase(loan) {
    const items = events.filter((row) => row.loan_id === loan.id && row.event_type === 'REQUEST')
    const issues = events.filter((row) => row.loan_id === loan.id && row.event_type === 'ISSUE')
    const popup = window.open('', '_blank')
    if (!popup) { setError('Allow pop-ups to print the loan slip.'); return }
    popup.opener = null
    popup.document.write(`<!doctype html><html><head><title>Loan ${escapeHtml(loan.loan_number || loan.id.slice(0, 8))}</title><style>body{font:14px Arial,sans-serif;margin:32px;color:#111827}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #d1d5db;padding:9px;text-align:left}.sign{display:flex;justify-content:space-between;margin-top:64px}.sign span{width:40%;border-top:1px solid #111;padding-top:8px}</style></head><body><h1>Product Loan Slip</h1><p>No. ${escapeHtml(loan.loan_number || loan.id)}</p><p>Group: ${escapeHtml(loan.group_code)} | Purpose: ${escapeHtml(loan.purpose)}</p><p>Borrower: ${escapeHtml(loan.requester_email)} | ${escapeHtml(formatTime(loan.created_at))}</p><table><thead><tr><th>SKU / Product</th><th>Size</th><th>Qty</th><th>Source</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(item.sku_id)} / ${escapeHtml(item.item_name)}</td><td>${escapeHtml(item.size || '-')}</td><td>${eventTotals(issues, item.id).issued}</td><td>${escapeHtml(issues.filter((row) => row.request_item_id === item.id).map((row) => row.source_label).join(', '))}</td></tr>`).join('')}</tbody></table><div class="sign"><span>Issued by</span><span>Received by</span></div><script>window.print()<\/script></body></html>`)
    popup.document.close()
  }

  return <section className={styles.shell}>
    <div className={styles.heading}>
      <div className={styles.titleGroup}><h2>Product Loans</h2>{success ? <span className={styles.inlineSuccess} role="status">{success}</span> : null}</div>
    </div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <div className={styles.casesHeader}>
      <input aria-label="Search loans" placeholder="Search product, SKU, borrower, purpose..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
      {!lockedGroup ? <select aria-label="Filter group" value={groupFilter} onChange={(event) => { setGroupFilter(event.target.value); setPage(1) }}><option value="">All groups</option>{GROUPS.map((value) => <option key={value}>{value}</option>)}</select> : null}
      <select aria-label="Filter borrower" value={borrowerFilter} onChange={(event) => { setBorrowerFilter(event.target.value); setPage(1) }}><option value="">All borrowers</option>{borrowerOptions.map(([id, name]) => <option key={id} value={id}>{shortName(name)}</option>)}</select>
      <div className={styles.toolbarActions}>
        <button type="button" className={styles.iconButton} onClick={reload} disabled={loading || busy} title="Refresh loans" aria-label="Refresh loans">↻</button>
        <button type="button" className={styles.primary} disabled={busy} onClick={() => { resetRequestDraft(); setShowRequestModal(true) }}>+ New Loan</button>
      </div>
    </div>
    <div className={styles.tableScroll}>
      <table className={styles.loansTable}>
        <thead><tr><th scope="col">Loan Number</th><th scope="col">Purpose</th><th scope="col">Group</th><th scope="col" className={styles.number}>Requested</th><th scope="col" className={styles.number}>Issued</th><th scope="col" className={styles.number}>Returned</th><th scope="col">Borrower</th><th scope="col">Created</th><th scope="col"><span className={styles.statusHeader}>Status <button type="button" className={styles.statusHelpButton} onClick={() => setShowStatusGuide(true)} aria-label="Lihat penjelasan status pinjaman" title="Penjelasan status pinjaman">?</button></span></th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={9} className={styles.emptyState}>Loading loans...</td></tr> : visibleCases.length === 0 ? <tr><td colSpan={9} className={styles.emptyState}>No loans found.</td></tr> : pagedCases.map((loan) => {
          const requestItems = requestsByLoan.get(loan.id) || []
          const totals = requestItems.reduce((sum, item) => {
            const itemTotals = eventTotals(events, item.id)
            const cancelled = events.filter((row) => row.request_item_id === item.id && row.event_type === 'CANCEL_REQUEST').reduce((total, row) => total + qty(row.qty), 0)
            return { requested: sum.requested + qty(item.qty), issued: sum.issued + itemTotals.issued, returned: sum.returned + itemTotals.received, closed: sum.closed + itemTotals.closed, unissued: sum.unissued + Math.max(0, qty(item.qty) - itemTotals.issued - cancelled) }
          }, { requested: 0, issued: 0, returned: 0, closed: 0, unissued: 0 })
          const isOpen = activeCaseId === loan.id
          return <Fragment key={loan.id}>
            <tr className={isOpen ? styles.activeRow : undefined}>
              <td className={styles.purposeCell}><div className={styles.loanNumberCell}>{canManage ? <button type="button" className={styles.detailButton} data-open={isOpen} onClick={() => setActiveCaseId(isOpen ? '' : loan.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'View'} details for ${loan.loan_number || loan.purpose}`} title={isOpen ? 'Hide details' : 'View details'}>{isOpen ? '−' : '+'}</button> : loan.requester_id === currentUserId && (totals.issued > totals.returned + totals.closed || totals.unissued > 0) ? <button type="button" className={styles.returnButton} onClick={() => setActiveCaseId(isOpen ? '' : loan.id)} aria-expanded={isOpen}>{isOpen ? 'Close' : totals.issued > totals.returned + totals.closed ? 'Return' : 'Edit Items'}</button> : null}<strong>{loan.loan_number || loan.id.slice(0, 8)}</strong></div></td>
              <td>{loan.purpose}</td>
              <td>{loan.group_code}</td>
              <td className={styles.number}>{totals.requested}</td>
              <td className={styles.number}>{totals.issued}</td>
              <td className={styles.number}>{totals.returned}</td>
              <td className={styles.borrowerCell}>{shortName(userProfilesByEmail[String(loan.requester_email || '').toLowerCase()] || String(loan.requester_email || '').split('@')[0])}</td>
              <td className={styles.dateCell}>{formatTime(loan.created_at)}</td>
              <td><div className={styles.statusActions}><span className={styles.status} data-status={loan.status}>{loan.status.replaceAll('_', ' ')}</span>{canManage && events.some((row) => row.loan_id === loan.id && row.event_type === 'ISSUE') ? <button type="button" className={styles.printButton} onClick={() => printCase(loan)} aria-label={`Print loan slip for ${loan.loan_number || loan.id}`} title="Print loan slip"><svg viewBox="0 0 24 24" className={styles.printIcon} aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg></button> : (loan.requester_id === currentUserId || isAdmin) && totals.issued === 0 && ['REQUESTED', 'CANCELLED'].includes(loan.status) ? <button type="button" className={styles.deleteButton} onClick={() => void deleteCase(loan)} disabled={busy} aria-label={`Delete loan for ${loan.purpose}`} title="Delete unissued loan"><span aria-hidden="true">&#x1F5D1;&#xFE0E;</span></button> : null}</div></td>
            </tr>
            {isOpen ? <tr className={styles.detailsRow}><td colSpan={9}><div className={styles.caseBody}>
              {requestItems.map((item) => {
                const totals = eventTotals(events, item.id)
                const cancelled = events.filter((row) => row.request_item_id === item.id && row.event_type === 'CANCEL_REQUEST').reduce((sum, row) => sum + qty(row.qty), 0)
                const remainingIssue = qty(item.qty) - totals.issued - cancelled
                const outstanding = totals.issued - totals.received - totals.closed
                const declarations = events.filter((row) => row.request_item_id === item.id && row.event_type === 'DECLARE_RETURN')
                const availableDeclare = outstanding - (totals.declared - totals.received)
                const options = sourceOptions(item, loan.group_code)
                const form = forms[item.id] || {}
                const matchingStockLocationIds = new Set(storageRows.filter((stock) => (
                  [stock.sku_id, stock.source_variant_code].some((code) => cleanSku(code) === cleanSku(item.sku_id))
                  && stockSizesMatch(stock.size, item.size)
                )).map((stock) => Number(stock.rack_location_id)))
                const returnLocations = locations.filter((row) => (
                  row.group_code === loan.group_code
                  && ['PALLET', 'SHELVING'].includes(row.location_type)
                  && matchingStockLocationIds.has(Number(row.id))
                ))
                const canIssue = canManage && (isAdmin || loan.requester_id !== currentUserId) && remainingIssue > 0
                const canRemove = (loan.requester_id === currentUserId || isAdmin) && (totals.issued === 0 || remainingIssue > 0)
                const canEdit = loan.status === 'REQUESTED' && (loan.requester_id === currentUserId || isAdmin)
                return <div className={styles.item} key={item.id}>
                  <div className={styles.itemTop}>
                    <div className={styles.itemIdentity}><strong>{item.sku_id} · {item.item_name} · {item.size || '-'}</strong><span className={styles.itemSummary}>{totals.issued}/{item.qty} issued · {totals.received} returned · {totals.closed} closed</span></div>
                    <div className={styles.itemActions}>
                      {editingItemId === item.id ? <div className={styles.editControls}>
                        <label>Size{loan.group_code === 'ARKLINE' ? <select value={itemEdit.size} onChange={(event) => setItemEdit((current) => ({ ...current, size: event.target.value }))} disabled={totals.issued > 0}>{ARKLINE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select> : <input value={itemEdit.size} onChange={(event) => setItemEdit((current) => ({ ...current, size: event.target.value }))} disabled={totals.issued > 0} />}</label>
                        <label>Qty<input type="number" min={Math.max(1, totals.issued + cancelled)} step="1" value={itemEdit.qty} onChange={(event) => setItemEdit((current) => ({ ...current, qty: event.target.value }))} /></label>
                        <button type="button" className={styles.primary} disabled={busy || !itemEdit.qty || (loan.group_code === 'ARKLINE' && !ARKLINE_SIZES.includes(itemEdit.size))} onClick={() => void saveRequestItem(item, totals.issued + cancelled)}>Save</button>
                        <button type="button" className={styles.secondary} disabled={busy} onClick={() => setEditingItemId('')}>Cancel</button>
                      </div> : canIssue || canRemove || canEdit ? <div className={styles.issueControls}>{canIssue ? <><select aria-label={`Source for ${item.item_name}`} value={form.source || ''} onChange={(event) => setForm(item.id, { source: event.target.value, manualSource: '' })}><option value="">Select source</option>{options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select>{form.source === 'OTHER' ? <input aria-label="Other source location" value={form.manualSource || ''} maxLength={160} onChange={(event) => setForm(item.id, { manualSource: event.target.value })} placeholder="Type source location" /> : null}<input className={styles.issueQty} aria-label="Issue qty" type="number" min="1" max={remainingIssue} value={form.issueQty || ''} onChange={(event) => setForm(item.id, { issueQty: event.target.value === '' ? '' : Math.min(remainingIssue, Math.max(1, Number(event.target.value) || 1)) })} placeholder="Qty" /><button type="button" className={styles.primary} disabled={busy || !form.source || !Number(form.issueQty) || Number(form.issueQty) > remainingIssue || (form.source === 'OTHER' && !form.manualSource?.trim())} onClick={() => { const [sourceType, sourceId] = form.source.split(':'); void perform('Loan item issued.', () => sourceType === 'OTHER' ? supabase.rpc('issue_warehouse_loan_item_other', { p_item_id: item.id, p_qty: Number(form.issueQty), p_source_label: form.manualSource.trim() }) : supabase.rpc('issue_warehouse_loan_item', { p_item_id: item.id, p_source_type: sourceType, p_source_id: Number(sourceId), p_qty: Number(form.issueQty) }), { refreshStock: sourceType !== 'OTHER' }) }}>Issue</button></> : null}{canEdit ? <button type="button" className={styles.editItemButton} disabled={busy} onClick={() => { setEditingItemId(item.id); setItemEdit({ size: item.size || '', qty: String(item.qty) }); setError('') }} aria-label={`Edit size and qty for ${item.item_name}`} title="Edit size and qty">✎</button> : null}{canRemove ? <button type="button" className={styles.removeItemButton} disabled={busy} onClick={() => void removeRequestItem(item, remainingIssue, totals.issued)} aria-label={`Remove ${item.item_name} size ${item.size || '-'}`} title="Remove unissued item">×</button> : null}</div> : null}
                  {canManage && declarations.map((declaration) => {
                    const accepted = events.filter((row) => row.declaration_id === declaration.id && row.event_type === 'RECEIVE').reduce((sum, row) => sum + qty(row.qty), 0)
                    const remaining = qty(declaration.qty) - accepted
                    const receiveForm = forms[declaration.id] || {}
                    const issueRows = events.filter((row) => row.request_item_id === item.id && row.event_type === 'ISSUE')
                    const allowQueue = issueRows.length > 0 && issueRows.every((row) => row.source_type === 'PL_QUEUE')
                    const destinationOptions = DESTINATIONS.filter(([type]) => (
                      (type !== 'STORAGE_QUEUE' || allowQueue)
                      && (!['PALLET', 'SHELVING'].includes(type) || returnLocations.some((row) => row.location_type === type))
                    ))
                    const defaultDestination = returnLocations.some((row) => row.location_type === 'SHELVING')
                      ? 'SHELVING' : returnLocations.some((row) => row.location_type === 'PALLET') ? 'PALLET' : 'SHELVING_QUEUE'
                    const destination = destinationOptions.some(([type]) => type === receiveForm.destination)
                      ? receiveForm.destination : defaultDestination
                    const storageDestination = destination === 'PALLET' || destination === 'SHELVING'
                    const selectedLocation = returnLocations.find((row) => Number(row.id) === Number(receiveForm.locationId) && row.location_type === destination)
                    return remaining > 0 ? <div className={styles.returnBox} key={declaration.id}><span>{remaining} unit(s) awaiting receipt</span><div className={styles.actionRow}><select aria-label="Return destination" value={destination} onChange={(event) => setForm(declaration.id, { destination: event.target.value, locationId: '' })}>{destinationOptions.map(([type, label]) => <option value={type} key={type}>{label}</option>)}</select>{storageDestination ? <select className={styles.returnLocationSelect} aria-label="Return location" value={receiveForm.locationId || ''} onChange={(event) => setForm(declaration.id, { locationId: event.target.value })}><option value="">Select {destination.toLowerCase()} location</option>{returnLocations.filter((row) => row.location_type === destination).map((row) => <option key={row.id} value={row.id}>{formatLocation(row)}</option>)}</select> : null}<input aria-label="Receive qty" type="number" min="1" max={remaining} value={receiveForm.receiveQty || ''} onChange={(event) => setForm(declaration.id, { receiveQty: event.target.value })} placeholder="Qty" /><button type="button" className={styles.primary} disabled={busy || !receiveForm.receiveQty || (storageDestination && !selectedLocation)} onClick={() => void perform('Return received.', () => supabase.rpc('receive_warehouse_loan_return', { p_declaration_id: declaration.id, p_qty: Number(receiveForm.receiveQty), p_destination: storageDestination ? 'STORAGE' : destination, p_rack_location_id: storageDestination ? selectedLocation.id : null }), { refreshStock: true })}>Receive</button></div></div> : null
                  })}
                    </div>
                  </div>
                  {loan.requester_id === currentUserId && availableDeclare > 0 ? <div className={styles.actionRow}><input aria-label="Declare return qty" type="number" min="1" max={availableDeclare} value={form.declareQty || ''} onChange={(event) => setForm(item.id, { declareQty: event.target.value })} placeholder="Return qty" /><button type="button" className={styles.secondary} disabled={busy || !form.declareQty} onClick={() => void perform('Return declared. Awaiting receipt.', () => supabase.rpc('declare_warehouse_loan_return', { p_item_id: item.id, p_qty: Number(form.declareQty) }))}>Declare Return</button></div> : null}
                  {canManage && outstanding - (totals.declared - totals.received) > 0 ? <div className={styles.actionRow}><select aria-label="Close outcome" value={form.disposition || ''} onChange={(event) => setForm(item.id, { disposition: event.target.value })}><option value="">Select outcome</option>{['LOST','DAMAGED','PURCHASED','OTHER'].map((value) => <option key={value}>{value}</option>)}</select><input aria-label="Close qty" type="number" min="1" max={outstanding - (totals.declared - totals.received)} value={form.closeQty || ''} onChange={(event) => setForm(item.id, { closeQty: event.target.value })} placeholder="Qty" /><input aria-label="Close reason" value={form.reason || ''} onChange={(event) => setForm(item.id, { reason: event.target.value })} placeholder="Reason required" /><button type="button" className={styles.secondary} disabled={busy || !form.closeQty || !form.disposition || !form.reason?.trim()} onClick={() => { if (window.confirm('Close this quantity with the selected outcome and reason?')) void perform('Remaining loan quantity closed.', () => supabase.rpc('close_warehouse_loan_item', { p_item_id: item.id, p_qty: Number(form.closeQty), p_disposition: form.disposition, p_reason: form.reason })) }}>Close Loan</button></div> : null}
                </div>
              })}
            </div></td></tr> : null}
          </Fragment>
        })}
        </tbody>
      </table>
    </div>
    {!loading && visibleCases.length > PAGE_SIZE ? <div className={styles.pagination}>
      <span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, visibleCases.length)} of {visibleCases.length}</span>
      <div><button type="button" className={styles.secondary} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {totalPages}</span><button type="button" className={styles.secondary} disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
    </div> : null}
    {showStatusGuide && typeof document !== 'undefined' ? createPortal(<div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setShowStatusGuide(false) }}>
      <div className={`${styles.modal} ${styles.statusGuideDialog}`} role="dialog" aria-modal="true" aria-labelledby="loan-status-guide-title">
        <div className={styles.modalHeader}><h3 id="loan-status-guide-title">Status Product Loans</h3><button ref={statusGuideCloseRef} type="button" className={styles.modalClose} onClick={() => setShowStatusGuide(false)} aria-label="Tutup penjelasan status" title="Tutup">×</button></div>
        <div className={styles.statusGuideBody}>{LOAN_STATUS_GUIDE.map(([status, description]) => <div className={styles.statusGuideRow} key={status}><span className={styles.status} data-status={status}>{status.replaceAll('_', ' ')}</span><p>{description}</p></div>)}</div>
      </div>
    </div>, document.body) : null}
    {showRequestModal && typeof document !== 'undefined' ? createPortal(<div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeRequestModal() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="new-loan-title" onKeyDown={(event) => { if (event.key === 'Escape') closeRequestModal() }}>
        <div className={styles.modalHeader}><h3 id="new-loan-title">{requestMode === 'existing' ? 'Add Items to Loan' : 'New Loan Request'}</h3><button type="button" className={styles.modalClose} onClick={closeRequestModal} disabled={busy} aria-label="Close loan form" title="Close">×</button></div>
        <form className={styles.request} onSubmit={(event) => { event.preventDefault(); void createCase() }}>
          <div className={styles.modalBody}>
            <div className={styles.requestModeToggle} role="group" aria-label="Loan request mode">{[['new', 'New Loan'], ['existing', 'Add to Existing Loan']].map(([mode, label]) => <button type="button" key={mode} data-active={requestMode === mode} aria-pressed={requestMode === mode} onClick={() => changeRequestMode(mode)} disabled={busy}>{label}</button>)}</div>
            {requestMode === 'new' ? <div className={styles.row}><label>Group<select value={group} onChange={(event) => { setGroup(event.target.value); setDraftItems([]); setDraft({ sku: '', name: '', size: '', qty: '' }); setArklineQuery('') }} disabled={Boolean(lockedGroup)}>{(lockedGroup ? [lockedGroup] : GROUPS).map((value) => <option key={value}>{value}</option>)}</select></label><label>Purpose{purpose === '__new__' ? <span className={styles.inlineInput}><input value={newPurposeName} onChange={(event) => setNewPurposeName(event.target.value)} placeholder="New purpose" maxLength={80} required autoFocus /><button type="button" onClick={() => { setPurpose(''); setNewPurposeName('') }} aria-label="Cancel new purpose" title="Cancel new purpose">×</button></span> : <select value={purpose} onChange={(event) => { setPurpose(event.target.value); setFormError('') }} required><option value="">Select purpose</option>{purposeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}<option value="__new__">Add new purpose</option></select>}</label></div> : <><label>Loan Number<select value={existingLoanId} onChange={(event) => { const loan = eligibleLoans.find((row) => row.id === event.target.value); setExistingLoanId(event.target.value); setGroup(loan?.group_code || lockedGroup || 'MOB'); setDraft({ sku: '', name: '', size: '', qty: '' }); setDraftItems([]); setArklineQuery(''); setFormError('') }} required disabled={eligibleLoansLoading}><option value="">{eligibleLoansLoading ? 'Loading loans...' : 'Select loan number'}</option>{eligibleLoans.map((loan) => <option key={loan.id} value={loan.id}>{loan.loan_number || loan.id.slice(0, 8)} · {loan.group_code} · {loan.purpose}{isAdmin ? ` · ${shortName(userProfilesByEmail[String(loan.requester_email || '').toLowerCase()] || String(loan.requester_email || '').split('@')[0])}` : ''}</option>)}</select></label>{existingLoan ? <div className={styles.existingLoanMeta}><span>Group: <strong>{existingLoan.group_code}</strong></span><span>Purpose: <strong>{existingLoan.purpose}</strong></span></div> : null}{!eligibleLoansLoading && !eligibleLoansError && !eligibleLoans.length ? <p className={styles.emptyLoanHint}>No Requested loans available to add items to.</p> : null}{eligibleLoansError ? <p className={styles.error} role="alert">{eligibleLoansError}</p> : null}</>}
            {requestMode === 'new' && purposeLoadError ? <p className={styles.error} role="alert">Unable to load purposes: {purposeLoadError}</p> : null}
            {requestMode === 'new' || existingLoan ? <>
            {group === 'ARKLINE' ? <div className={styles.productPicker}><label>Arkline Product{draft.name ? <button type="button" className={styles.selectedProduct} onClick={() => { setDraft((current) => ({ ...current, sku: '', name: '', size: '' })); setArklineQuery(''); setArklineMenuOpen(true); window.setTimeout(() => arklineInputRef.current?.focus(), 0) }}><strong>{draft.sku}</strong><small>{draft.name}</small></button> : <input ref={arklineInputRef} value={arklineQuery} onFocus={() => setArklineMenuOpen(true)} onChange={(event) => { setArklineQuery(event.target.value); setArklineMenuOpen(true) }} onBlur={() => window.setTimeout(() => setArklineMenuOpen(false), 120)} placeholder="Search SKU or product" autoComplete="off" />}</label>{arklineMenuOpen && !draft.name ? <div className={styles.productMenu}>{filteredArklineProducts.map((product) => <button type="button" key={product.sku} onMouseDown={(event) => event.preventDefault()} onClick={() => { setDraft((current) => ({ ...current, sku: product.sku, name: product.productName, size: '' })); setArklineMenuOpen(false) }}><strong>{product.sku}</strong><small>{product.productName}</small></button>)}{filteredArklineProducts.length === 0 ? <span>No matching product</span> : null}</div> : null}</div> : <div className={styles.row}><label>SKU<input value={draft.sku} onChange={(event) => { const sku = event.target.value; const match = storageRows.find((row) => [row.sku_id, row.source_variant_code].some((value) => cleanSku(value) === cleanSku(sku))); setDraft((current) => ({ ...current, sku, name: match?.item_name || current.name })) }} /></label><label>Product Name<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label></div>}
            <div className={styles.row}><label>Size{group === 'ARKLINE' ? <select value={draft.size} onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value }))}><option value="">Select size</option>{ARKLINE_SIZES.map((size) => <option key={size}>{size}</option>)}</select> : <input value={draft.size} onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value }))} />}</label><label>Quantity<input type="number" min="1" step="1" value={draft.qty} onChange={(event) => setDraft((current) => ({ ...current, qty: event.target.value }))} /></label><button type="button" className={styles.secondary} onClick={addDraftItem}>Add Item</button><button type="button" className={styles.iconButton} onClick={() => { setDraft({ sku: '', name: '', size: '', qty: '' }); setFormError('') }} title="Clear fields for another product" aria-label="Clear product fields">↻</button></div>
            </> : null}
            {draftItems.length ? <div className={styles.draftSection}><div className={styles.draftHeading}><h4>Items to Borrow</h4><span>{draftTotalQty} qty · {draftModelCount} model{draftModelCount === 1 ? '' : 's'}</span></div><ul className={styles.draftList}>{draftItems.map((item, index) => <li key={`${item.sku}-${index}`}><span><strong>{item.name}</strong><small>{item.sku} · {item.size || '-'} · {item.qty} qty</small></span><button type="button" onClick={() => setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.name}`} title="Remove item">×</button></li>)}</ul></div> : null}
            {formError ? <p className={styles.error} role="alert">{formError}</p> : null}
          </div>
          <div className={styles.modalFooter}><button type="button" className={styles.secondary} onClick={closeRequestModal} disabled={busy}>Cancel</button><button type="submit" className={styles.primary} disabled={busy || !draftItems.length || (requestMode === 'existing' && !existingLoan)}>{busy ? 'Submitting...' : requestMode === 'existing' ? 'Add to Loan' : 'Submit Loan'}</button></div>
        </form>
      </div>
    </div>, document.body) : null}
  </section>
}

export function WarehouseLoanQueueReturns({ locations = [], lockedGroup = '', canManage = false, onStockChanged }) {
  const [returns, setReturns] = useState([])
  const [placements, setPlacements] = useState([])
  const [loans, setLoans] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [forms, setForms] = useState({})
  const reload = useCallback(async () => {
    const [returnResult, placedResult, loanResult] = await Promise.all([
      supabase.from('warehouse_loan_items').select('*').eq('event_type', 'RECEIVE').eq('destination_type', 'STORAGE_QUEUE').order('created_at', { ascending: false }).limit(1000),
      supabase.from('warehouse_loan_items').select('queue_return_id,qty').eq('event_type', 'QUEUE_STORED').limit(3000),
      supabase.from('warehouse_loans').select('id,group_code,requester_email').limit(1000),
    ])
    if (returnResult.error || placedResult.error || loanResult.error) {
      setError(returnResult.error?.message || placedResult.error?.message || loanResult.error?.message)
      return
    }
    setReturns(returnResult.data || [])
    setPlacements(placedResult.data || [])
    setLoans(loanResult.data || [])
    setError('')
  }, [])
  useEffect(() => { void reload() }, [reload])
  const groupByLoan = new Map(loans.map((loan) => [loan.id, loan]))
  const placedByReturn = new Map()
  placements.forEach((row) => placedByReturn.set(row.queue_return_id, (placedByReturn.get(row.queue_return_id) || 0) + qty(row.qty)))
  const visible = returns.filter((row) => (!lockedGroup || groupByLoan.get(row.loan_id)?.group_code === lockedGroup)
    && qty(row.qty) > qty(placedByReturn.get(row.id)))

  async function place(row) {
    const form = forms[row.id] || {}
    if (busy || !form.destination || !form.qty) return
    setBusy(true)
    setError('')
    try {
      const { error: operationError } = await supabase.rpc('place_warehouse_loan_queue_return', {
        p_receive_id: row.id, p_qty: Number(form.qty), p_destination: form.destination,
        p_rack_location_id: form.destination === 'STORAGE' ? Number(form.locationId) : null,
      })
      if (operationError) throw operationError
      await reload()
      await onStockChanged?.()
    } catch (operationError) { setError(operationError.message || 'Unable to place returned loan item.') }
    finally { setBusy(false) }
  }

  if (!visible.length && !error) return null
  return <section className={styles.queueReturns} aria-label="Returned loan items in Storage Queue">
    <div className={styles.heading}><h3>Loan Returns</h3><span>{visible.length} awaiting placement</span></div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {visible.map((row) => {
      const loan = groupByLoan.get(row.loan_id)
      const available = qty(row.qty) - qty(placedByReturn.get(row.id))
      const form = forms[row.id] || {}
      const update = (patch) => setForms((current) => ({ ...current, [row.id]: { ...current[row.id], ...patch } }))
      return <div className={styles.queueReturn} key={row.id}>
        <div><strong>{row.sku_id} · {row.item_name}</strong><small>{loan?.group_code || '-'} · Size {row.size || '-'} · {available} available · {loan?.requester_email || '-'}</small></div>
        {canManage ? <div className={styles.actionRow}><select aria-label="Placement destination" value={form.destination || ''} onChange={(event) => update({ destination: event.target.value })}><option value="">Select destination</option><option value="STORAGE">Pallet / Shelving</option><option value="TEMP_SALES">Temp. Sales Area</option></select>{form.destination === 'STORAGE' ? <select aria-label="Placement location" value={form.locationId || ''} onChange={(event) => update({ locationId: event.target.value })}><option value="">Select location</option>{locations.filter((location) => location.group_code === loan?.group_code && ['PALLET', 'SHELVING'].includes(location.location_type)).map((location) => <option key={location.id} value={location.id}>{formatLocation(location)}</option>)}</select> : null}<input aria-label="Placement qty" type="number" min="1" max={available} value={form.qty || ''} onChange={(event) => update({ qty: event.target.value })} placeholder="Qty" /><button type="button" className={styles.primary} disabled={busy || !form.destination || !form.qty || (form.destination === 'STORAGE' && !form.locationId)} onClick={() => void place(row)}>Place</button></div> : null}
      </div>
    })}
  </section>
}
