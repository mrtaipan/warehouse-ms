'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { stockSizesMatch } from '@/app/dashboard/storage/stock-sizes'
import styles from './warehouse-loans-client.module.css'

const supabase = createClient()
const GROUPS = ['ARKLINE', 'MOB', 'OI']
const ARKLINE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const DESTINATIONS = [
  ['STORAGE', 'Pallet / Shelving'],
  ['SHELVING_QUEUE', 'Shelving Queue'],
  ['STORAGE_QUEUE', 'Storage Queue'],
  ['TEMP_SALES', 'Temp. Sales Area'],
  ['RE_QC', 'Re-QC'],
]

const cleanSku = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const qty = (value) => Number(value || 0)
const formatTime = (value) => value ? new Date(value).toLocaleString('id-ID') : '-'
const formatLocation = (row) => [row.location_type, row.location_name || row.location_id, row.location_code, row.sub_location].filter(Boolean).join(' / ')
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

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

export default function WarehouseLoansClient({ currentUserId, canManage, lockedGroup = '', storageRows = [], queueRows = [], locations = [], arklineProducts = [], onStockChanged }) {
  const [cases, setCases] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCaseId, setActiveCaseId] = useState('')
  const [group, setGroup] = useState(lockedGroup || 'MOB')
  const [purpose, setPurpose] = useState('')
  const [draft, setDraft] = useState({ sku: '', name: '', size: '', qty: '' })
  const [draftItems, setDraftItems] = useState([])
  const [forms, setForms] = useState({})

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
  const setForm = (id, patch) => setForms((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  const selectedProduct = arklineProducts.find((product) => cleanSku(product.sku) === cleanSku(draft.sku))
  const visibleCases = cases.filter((row) => {
    if (lockedGroup && row.group_code !== lockedGroup) return false
    const text = `${row.id} ${row.purpose} ${row.requester_email} ${row.group_code}`.toLowerCase()
    return text.includes(search.toLowerCase())
  })

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
      setError('Choose a valid product, size, and positive qty.')
      return
    }
    setDraftItems((current) => [...current, item])
    setDraft({ sku: '', name: '', size: '', qty: '' })
    setError('')
  }

  async function createCase() {
    if (!purpose.trim() || !draftItems.length) { setError('Enter a purpose and at least one product.'); return }
    await perform('Loan request created.', async () => {
      const result = await supabase.rpc('create_warehouse_loan', { p_group: group, p_purpose: purpose.trim(), p_items: draftItems })
      if (!result.error) { setPurpose(''); setDraftItems([]); setActiveCaseId(result.data) }
      return result
    })
  }

  function sourceOptions(item, caseGroup) {
    const stock = storageRows.filter((row) => {
      const location = row.location
      return location?.group_code === caseGroup && qty(row.qty) > 0 && stockSizesMatch(row.size, item.size)
        && [row.sku_id, row.source_variant_code].some((value) => cleanSku(value) === cleanSku(item.sku_id))
    }).map((row) => ({ key: `STORAGE:${row.id}`, label: `${formatLocation(row.location)} (${row.qty})`, isShelf: row.location?.location_type === 'SHELVING' }))
    const queue = queueRows.filter((row) => {
      if (row.storage_status !== 'queued' || row.storing_type !== caseGroup || !row.inbound_id) return false
      return stockSizesMatch(row.size_label, item.size)
        && cleanSku(row.resolved_sku || row.source_variant_code) === cleanSku(item.sku_id)
        && qty(row.qty) > 0
    }).map((row) => ({ key: `PL_QUEUE:${row.id}`, label: `Storage Queue / PL ${row.id} (${qty(row.qty)})`, isShelf: false }))
    return [...stock.filter((entry) => entry.isShelf), ...stock.filter((entry) => !entry.isShelf), ...queue]
  }

  function printCase(loan) {
    const items = events.filter((row) => row.loan_id === loan.id && row.event_type === 'REQUEST')
    const issues = events.filter((row) => row.loan_id === loan.id && row.event_type === 'ISSUE')
    const popup = window.open('', '_blank')
    if (!popup) { setError('Allow pop-ups to print the loan slip.'); return }
    popup.opener = null
    popup.document.write(`<!doctype html><html><head><title>Loan ${escapeHtml(loan.id.slice(0, 8))}</title><style>body{font:14px Arial,sans-serif;margin:32px;color:#111827}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #d1d5db;padding:9px;text-align:left}.sign{display:flex;justify-content:space-between;margin-top:64px}.sign span{width:40%;border-top:1px solid #111;padding-top:8px}</style></head><body><h1>Surat Jalan Peminjaman</h1><p>No. ${escapeHtml(loan.id)}</p><p>Group: ${escapeHtml(loan.group_code)} | Keperluan: ${escapeHtml(loan.purpose)}</p><p>Peminjam: ${escapeHtml(loan.requester_email)} | ${escapeHtml(formatTime(loan.created_at))}</p><table><thead><tr><th>SKU / Barang</th><th>Size</th><th>Qty</th><th>Diambil dari</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(item.sku_id)} / ${escapeHtml(item.item_name)}</td><td>${escapeHtml(item.size || '-')}</td><td>${eventTotals(issues, item.id).issued}</td><td>${escapeHtml(issues.filter((row) => row.request_item_id === item.id).map((row) => row.source_label).join(', '))}</td></tr>`).join('')}</tbody></table><div class="sign"><span>Diserahkan oleh</span><span>Diterima oleh</span></div><script>window.print()<\/script></body></html>`)
    popup.document.close()
  }

  return <section className={styles.shell}>
    <div className={styles.heading}><h2>Peminjaman Barang</h2><button type="button" className={styles.iconButton} onClick={reload} disabled={loading || busy} title="Refresh" aria-label="Refresh loans">↻</button></div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {success ? <p className={styles.success}>{success}</p> : null}
    <div className={styles.layout}>
      <form className={styles.request} onSubmit={(event) => { event.preventDefault(); void createCase() }}>
        <h3>Ajukan Peminjaman</h3>
        <div className={styles.row}><label>Group<select value={group} onChange={(event) => { setGroup(event.target.value); setDraftItems([]); setDraft({ sku: '', name: '', size: '', qty: '' }) }} disabled={Boolean(lockedGroup)}>{(lockedGroup ? [lockedGroup] : GROUPS).map((value) => <option key={value}>{value}</option>)}</select></label><label>Keperluan<input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Photoshoot, Content..." /></label></div>
        {group === 'ARKLINE' ? <label>Produk Arkline<input list="loan-arkline-products" value={draft.sku} onChange={(event) => { const sku = event.target.value.split(' | ')[0]; const product = arklineProducts.find((row) => cleanSku(row.sku) === cleanSku(sku)); setDraft((current) => ({ ...current, sku, name: product?.productName || '' })) }} placeholder="Ketik SKU atau pilih produk" /><datalist id="loan-arkline-products">{arklineProducts.map((product) => <option key={product.sku} value={`${product.sku} | ${product.productName}`} />)}</datalist></label> : <div className={styles.row}><label>SKU / Tagar<input value={draft.sku} onChange={(event) => { const sku = event.target.value; const match = storageRows.find((row) => [row.sku_id, row.source_variant_code].some((value) => cleanSku(value) === cleanSku(sku))); setDraft((current) => ({ ...current, sku, name: match?.item_name || current.name })) }} /></label><label>Nama Produk<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label></div>}
        {group === 'ARKLINE' && draft.name ? <div className={styles.productName}>{draft.name}</div> : null}
        <div className={styles.row}><label>Size{group === 'ARKLINE' ? <select value={draft.size} onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value }))}><option value="">Pilih size</option>{ARKLINE_SIZES.map((size) => <option key={size}>{size}</option>)}</select> : <input value={draft.size} onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value }))} />}</label><label>Qty<input type="number" min="1" step="1" value={draft.qty} onChange={(event) => setDraft((current) => ({ ...current, qty: event.target.value }))} /></label><button type="button" className={styles.secondary} onClick={addDraftItem}>Add</button></div>
        {draftItems.length ? <ul className={styles.draftList}>{draftItems.map((item, index) => <li key={index}>{item.sku} / {item.name} / {item.size || '-'} / {item.qty}<button type="button" onClick={() => setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.name}`}>×</button></li>)}</ul> : null}
        <button type="submit" className={styles.primary} disabled={busy || !draftItems.length}>Ajukan</button>
      </form>
      <div className={styles.cases}><div className={styles.casesHeader}><h3>Kasus Peminjaman</h3><input aria-label="Search loans" placeholder="Cari peminjam, tujuan, nomor..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        {loading ? <p>Memuat peminjaman...</p> : visibleCases.length === 0 ? <p>Belum ada peminjaman.</p> : visibleCases.map((loan) => {
          const requestItems = events.filter((row) => row.loan_id === loan.id && row.event_type === 'REQUEST')
          const isOpen = activeCaseId === loan.id
          return <article className={styles.case} key={loan.id}>
            <button type="button" className={styles.caseHeader} onClick={() => setActiveCaseId(isOpen ? '' : loan.id)} aria-expanded={isOpen}><span><strong>{loan.purpose}</strong><small>{loan.group_code} · {loan.requester_email} · {formatTime(loan.created_at)}</small></span><span className={styles.status}>{loan.status.replaceAll('_', ' ')}</span></button>
            {isOpen ? <div className={styles.caseBody}>
              <div className={styles.caseActions}><code>{loan.id}</code>{events.some((row) => row.loan_id === loan.id && row.event_type === 'ISSUE') ? <button type="button" className={styles.secondary} onClick={() => printCase(loan)}>Print SJ</button> : null}</div>
              {requestItems.map((item) => {
                const totals = eventTotals(events, item.id)
                const cancelled = events.filter((row) => row.request_item_id === item.id && row.event_type === 'CANCEL_REQUEST').reduce((sum, row) => sum + qty(row.qty), 0)
                const remainingIssue = qty(item.qty) - totals.issued - cancelled
                const outstanding = totals.issued - totals.received - totals.closed
                const declarations = events.filter((row) => row.request_item_id === item.id && row.event_type === 'DECLARE_RETURN')
                const availableDeclare = outstanding - (totals.declared - totals.received)
                const options = sourceOptions(item, loan.group_code)
                const form = forms[item.id] || {}
                const matchingShelves = locations.filter((row) => row.group_code === loan.group_code && row.location_type === 'SHELVING')
                return <div className={styles.item} key={item.id}>
                  <div className={styles.itemHeading}><strong>{item.sku_id} · {item.item_name} · {item.size || '-'}</strong><span>{totals.issued}/{item.qty} keluar · {totals.received} kembali · {totals.closed} ditutup</span></div>
                  {canManage && remainingIssue > 0 ? <div className={styles.actionRow}><select aria-label={`Source for ${item.item_name}`} value={form.source || ''} onChange={(event) => setForm(item.id, { source: event.target.value })}><option value="">Pilih sumber</option>{options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select><input aria-label="Issue qty" type="number" min="1" max={remainingIssue} value={form.issueQty || ''} onChange={(event) => setForm(item.id, { issueQty: event.target.value })} placeholder="Qty" /><button type="button" className={styles.primary} disabled={busy || !form.source} onClick={() => { const [sourceType, sourceId] = form.source.split(':'); void perform('Barang diserahkan.', () => supabase.rpc('issue_warehouse_loan_item', { p_item_id: item.id, p_source_type: sourceType, p_source_id: Number(sourceId), p_qty: Number(form.issueQty) }), { refreshStock: true }) }}>Serahkan</button></div> : null}
                  {remainingIssue > 0 && (loan.requester_id === currentUserId || canManage) ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => { if (window.confirm(`Batalkan ${remainingIssue} qty yang belum diserahkan?`)) void perform('Sisa permintaan dibatalkan.', () => supabase.rpc('cancel_warehouse_loan_request_item', { p_item_id: item.id, p_qty: remainingIssue })) }}>Batalkan sisa permintaan</button> : null}
                  {loan.requester_id === currentUserId && availableDeclare > 0 ? <div className={styles.actionRow}><input aria-label="Declare return qty" type="number" min="1" max={availableDeclare} value={form.declareQty || ''} onChange={(event) => setForm(item.id, { declareQty: event.target.value })} placeholder="Qty kembali" /><button type="button" className={styles.secondary} disabled={busy || !form.declareQty} onClick={() => void perform('Pengembalian dinyatakan, menunggu penerima.', () => supabase.rpc('declare_warehouse_loan_return', { p_item_id: item.id, p_qty: Number(form.declareQty) }))}>Nyatakan Kembali</button></div> : null}
                  {canManage && declarations.map((declaration) => {
                    const accepted = events.filter((row) => row.declaration_id === declaration.id && row.event_type === 'RECEIVE').reduce((sum, row) => sum + qty(row.qty), 0)
                    const remaining = qty(declaration.qty) - accepted
                    const receiveForm = forms[declaration.id] || {}
                    const destination = receiveForm.destination || (matchingShelves.some((shelf) => storageRows.some((stock) => stock.rack_location_id === shelf.id && cleanSku(stock.sku_id) === cleanSku(item.sku_id) && stockSizesMatch(stock.size, item.size))) ? 'STORAGE' : 'SHELVING_QUEUE')
                    const issueRows = events.filter((row) => row.request_item_id === item.id && row.event_type === 'ISSUE')
                    const allowQueue = issueRows.length > 0 && issueRows.every((row) => row.source_type === 'PL_QUEUE')
                    return remaining > 0 ? <div className={styles.returnBox} key={declaration.id}><span>Dinyatakan kembali: {remaining} qty menunggu penerimaan</span><div className={styles.actionRow}><select aria-label="Return destination" value={destination} onChange={(event) => setForm(declaration.id, { destination: event.target.value })}>{DESTINATIONS.filter(([type]) => type !== 'STORAGE_QUEUE' || allowQueue).map(([type, label]) => <option value={type} key={type}>{label}</option>)}</select>{destination === 'STORAGE' ? <select aria-label="Return location" value={receiveForm.locationId || ''} onChange={(event) => setForm(declaration.id, { locationId: event.target.value })}><option value="">Pilih lokasi</option>{locations.filter((row) => row.group_code === loan.group_code && ['PALLET', 'SHELVING'].includes(row.location_type)).map((row) => <option key={row.id} value={row.id}>{formatLocation(row)}</option>)}</select> : null}<input aria-label="Receive qty" type="number" min="1" max={remaining} value={receiveForm.receiveQty || ''} onChange={(event) => setForm(declaration.id, { receiveQty: event.target.value })} placeholder="Qty" /><button type="button" className={styles.primary} disabled={busy || !receiveForm.receiveQty || (destination === 'STORAGE' && !receiveForm.locationId)} onClick={() => void perform('Pengembalian diterima.', () => supabase.rpc('receive_warehouse_loan_return', { p_declaration_id: declaration.id, p_qty: Number(receiveForm.receiveQty), p_destination: destination, p_rack_location_id: destination === 'STORAGE' ? Number(receiveForm.locationId) : null }), { refreshStock: true })}>Terima</button></div></div> : null
                  })}
                  {canManage && outstanding - (totals.declared - totals.received) > 0 ? <div className={styles.actionRow}><select aria-label="Close outcome" value={form.disposition || ''} onChange={(event) => setForm(item.id, { disposition: event.target.value })}><option value="">Hasil akhir</option>{['LOST','DAMAGED','PURCHASED','OTHER'].map((value) => <option key={value}>{value}</option>)}</select><input aria-label="Close qty" type="number" min="1" max={outstanding - (totals.declared - totals.received)} value={form.closeQty || ''} onChange={(event) => setForm(item.id, { closeQty: event.target.value })} placeholder="Qty" /><input aria-label="Close reason" value={form.reason || ''} onChange={(event) => setForm(item.id, { reason: event.target.value })} placeholder="Alasan wajib" /><button type="button" className={styles.secondary} disabled={busy || !form.closeQty || !form.disposition || !form.reason?.trim()} onClick={() => { if (window.confirm('Tutup qty ini dengan hasil akhir dan alasan yang dipilih?')) void perform('Sisa pinjaman ditutup.', () => supabase.rpc('close_warehouse_loan_item', { p_item_id: item.id, p_qty: Number(form.closeQty), p_disposition: form.disposition, p_reason: form.reason })) }}>Close Case</button></div> : null}
                </div>
              })}
            </div> : null}
          </article>
        })}
      </div>
    </div>
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
    <div className={styles.heading}><h3>Pengembalian Peminjaman</h3><span>{visible.length} menunggu penempatan</span></div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {visible.map((row) => {
      const loan = groupByLoan.get(row.loan_id)
      const available = qty(row.qty) - qty(placedByReturn.get(row.id))
      const form = forms[row.id] || {}
      const update = (patch) => setForms((current) => ({ ...current, [row.id]: { ...current[row.id], ...patch } }))
      return <div className={styles.queueReturn} key={row.id}>
        <div><strong>{row.sku_id} · {row.item_name}</strong><small>{loan?.group_code || '-'} · Size {row.size || '-'} · {available} tersedia · {loan?.requester_email || '-'}</small></div>
        {canManage ? <div className={styles.actionRow}><select aria-label="Placement destination" value={form.destination || ''} onChange={(event) => update({ destination: event.target.value })}><option value="">Pilih tujuan</option><option value="STORAGE">Pallet / Shelving</option><option value="TEMP_SALES">Temp. Sales Area</option></select>{form.destination === 'STORAGE' ? <select aria-label="Placement location" value={form.locationId || ''} onChange={(event) => update({ locationId: event.target.value })}><option value="">Pilih lokasi</option>{locations.filter((location) => location.group_code === loan?.group_code && ['PALLET', 'SHELVING'].includes(location.location_type)).map((location) => <option key={location.id} value={location.id}>{formatLocation(location)}</option>)}</select> : null}<input aria-label="Placement qty" type="number" min="1" max={available} value={form.qty || ''} onChange={(event) => update({ qty: event.target.value })} placeholder="Qty" /><button type="button" className={styles.primary} disabled={busy || !form.destination || !form.qty || (form.destination === 'STORAGE' && !form.locationId)} onClick={() => void place(row)}>Simpan</button></div> : null}
      </div>
    })}
  </section>
}
