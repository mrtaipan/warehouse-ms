'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { createClient } from '@/utils/supabase/browser'
import styles from './packaging-supplies-client.module.css'
import switchStyles from './reject-storage-release.module.css'

const supabase = createClient()
const EMPTY_FORM = { kind: 'IN', qty: '', note: '', point: '' }

function consumptionReorderPoint(item, consumption) {
  const spent = consumption.get(item.id) || 0
  return Math.ceil(spent / 30 * item.coverage_days)
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24" className={styles.refreshIcon} aria-hidden="true">
    <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
}

export default function PackagingSuppliesClient({ canReorder, qrItemId }) {
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [movements, setMovements] = useState([])
  const [consumption, setConsumption] = useState(new Map())
  const [actors, setActors] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [view, setView] = useState('stock')
  const [collapsedCategories, setCollapsedCategories] = useState([])
  const [selected, setSelected] = useState(null)
  const [actionCategoryId, setActionCategoryId] = useState('')
  const [dialog, setDialog] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [printOpen, setPrintOpen] = useState(false)
  const [printCategoryId, setPrintCategoryId] = useState('')
  const [printItemIds, setPrintItemIds] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [categoryResult, itemResult, movementResult, consumptionResult, profileResult] = await Promise.all([
      supabase.from('packaging_categories').select('id,name,sort_order').order('sort_order'),
      supabase.from('packaging_items').select('id,category_id,name,unit,pieces_per_unit,qty,inventory_qty,display_qty,reorder_point_qty,coverage_days,sort_order').eq('active', true).order('sort_order'),
      supabase.from('packaging_movements').select('id,item_id,movement_type,qty_change,qty_after,inventory_delta,display_delta,note,created_by,created_at').order('created_at', { ascending: false }).limit(50),
      supabase.rpc('packaging_outbound_30d'),
      supabase.from('dir_user_profiles').select('authenticated_id,display_name'),
    ])
    const failure = categoryResult.error || itemResult.error || movementResult.error || consumptionResult.error
    if (failure) setError(`${failure.message}. Run supabase/packaging_supplies.sql if the tables are not installed.`)
    else {
      setCategories(categoryResult.data || [])
      setItems(itemResult.data || [])
      setMovements(movementResult.data || [])
      setConsumption(new Map((consumptionResult.data || []).map((row) => [row.item_id, Number(row.out_qty)])))
      setActors(new Map((profileResult.data || []).filter((row) => row.authenticated_id).map((row) => [row.authenticated_id, row.display_name])))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!dialog && !printOpen) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [dialog, printOpen])

  useEffect(() => {
    if (!qrItemId || !/^\d+$/.test(String(qrItemId))) return
    window.location.replace(`/packaging/${qrItemId}`)
  }, [qrItemId])

  const filtered = useMemo(() => items.filter((item) =>
    (categoryFilter === 'ALL' || String(item.category_id) === categoryFilter)
    && item.name.toLowerCase().includes(search.trim().toLowerCase())), [items, categoryFilter, search])

  const chart = useMemo(() => filtered.map((item) => {
    const fixedPoint = item.reorder_point_qty
    const consumptionPoint = consumptionReorderPoint(item, consumption)
    const fill = fixedPoint === null ? 0 : Math.min(100, Math.round(item.qty / Math.max(1, fixedPoint * 2) * 100))
    return { ...item, fixedPoint, consumptionPoint, fill }
  }), [filtered, consumption])
  const groupedItems = useMemo(() => categories.map((category) => ({
    ...category,
    rows: chart.filter((item) => item.category_id === category.id),
  })).filter((category) => category.rows.length), [categories, chart])

  function toggleCategory(id) {
    setCollapsedCategories((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  function open(item, type) {
    setSelected(item)
    setActionCategoryId(String(item.category_id))
    setDialog(type)
    setError('')
    setForm({ ...EMPTY_FORM, point: item.reorder_point_qty ?? '' })
  }

  function openAction(type) {
    setSelected(null)
    setActionCategoryId('')
    setDialog(type)
    setError('')
    setForm({ ...EMPTY_FORM })
  }

  function togglePrintItem(id) {
    setPrintItemIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  async function printLabels() {
    const chosen = items.filter((item) => printItemIds.includes(item.id))
    if (!chosen.length) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) { setError('Print window was blocked by the browser.'); return }
    try {
      const labels = await Promise.all(chosen.map(async (item) => ({
        item,
        qr: await QRCode.toDataURL(new URL(`/packaging/${item.id}`, window.location.origin).href, { width: 300, margin: 1, errorCorrectionLevel: 'M' }),
      })))
      const doc = printWindow.document
      doc.title = 'Packaging Supplies QR Labels'
      const style = doc.createElement('style')
      style.textContent = '@page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111827}.sheet{display:grid;grid-template-columns:repeat(2,70mm);gap:5mm;justify-content:center}.label{width:70mm;height:70mm;border:1px solid #9ca3af;padding:4mm;display:flex;flex-direction:column;align-items:center;justify-content:center;break-inside:avoid;text-align:center}.label img{width:43mm;height:43mm;image-rendering:pixelated}.name{margin-top:2mm;font-size:11pt;font-weight:700;line-height:1.2;overflow-wrap:anywhere}.unit{margin-top:1mm;font-size:8pt;color:#475569}@media screen{body{padding:20px;background:#eef1f5}.label{background:#fff}}'
      doc.head.appendChild(style)
      const sheet = doc.createElement('main')
      sheet.className = 'sheet'
      labels.forEach(({ item, qr }) => {
        const label = doc.createElement('section')
        label.className = 'label'
        const image = doc.createElement('img')
        image.src = qr
        image.alt = `QR code for ${item.name}`
        const name = doc.createElement('div')
        name.className = 'name'
        name.textContent = item.name
        const unit = doc.createElement('div')
        unit.className = 'unit'
        unit.textContent = item.unit
        label.append(image, name, unit)
        sheet.appendChild(label)
      })
      doc.body.appendChild(sheet)
      await Promise.all(Array.from(doc.images, (image) => image.decode()))
      printWindow.focus()
      printWindow.print()
    } catch (caughtError) {
      printWindow.close()
      setError(caughtError?.message || 'Could not prepare QR labels.')
    }
  }

  async function save(event) {
    event.preventDefault()
    if (!selected || busy) return
    setBusy(true)
    setError('')
    let result
    if (dialog === 'reorder') {
      result = await supabase.rpc('set_packaging_reorder', {
        p_item_id: selected.id, p_mode: 'FIXED',
        p_point: Number(form.point),
        p_days: selected.coverage_days,
      })
    } else {
      result = await supabase.rpc('apply_packaging_action', {
        p_item_id: selected.id, p_action: form.kind,
        p_qty: Number(form.qty), p_area: null, p_reason: null,
      })
    }
    setBusy(false)
    if (result.error) { setError(result.error.message); return }
    setDialog('')
    setSelected(null)
    await load()
  }

  return <section className={styles.root} aria-label="Packaging Supplies">
    <div className={styles.heading}>
      <button type="button" role="switch" aria-label="Show packaging movements" aria-checked={view === 'movement'} className={switchStyles.sourceSwitch} onClick={() => setView((current) => current === 'stock' ? 'movement' : 'stock')}>
        <span data-active={view === 'stock'}>Stock</span>
        <i aria-hidden="true" />
        <span data-active={view === 'movement'}>Movement</span>
      </button>
      <h2>Packaging Supplies</h2>
    </div>
    {view === 'stock' ? <div className={styles.headingControls}>
      <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item" /></label>
      <label><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="ALL">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      {canReorder ? <div className={styles.toolbarActions}><button type="button" onClick={() => openAction('reorder')}>Reorder</button></div> : null}
      <button type="button" className={styles.printButton} onClick={() => { setPrintCategoryId(''); setPrintItemIds([]); setPrintOpen(true) }}>Print QR</button>
      <button type="button" className={styles.refresh} onClick={load} disabled={loading || busy} aria-label="Refresh packaging supplies" title="Refresh"><RefreshIcon /></button>
    </div> : <div className={styles.movementToolbar}><button type="button" className={styles.refresh} onClick={load} disabled={loading || busy} aria-label="Refresh movements" title="Refresh"><RefreshIcon /></button></div>}
    {error && !dialog ? <p className={styles.error} role="alert">{error}</p> : null}
    {view === 'stock' ? <div className={styles.chart} aria-label="Stock level by item">
      {groupedItems.map((category) => <section key={category.id} className={styles.chartGroup}>
        <button type="button" className={styles.categoryToggle} onClick={() => toggleCategory(category.id)} aria-expanded={!collapsedCategories.includes(category.id)}><span className={styles.expandIcon} data-open={!collapsedCategories.includes(category.id)} aria-hidden="true">{collapsedCategories.includes(category.id) ? '+' : '−'}</span><strong>{category.name}</strong><small>{category.rows.length} items</small></button>
        {!collapsedCategories.includes(category.id) ? <div className={styles.categoryItems}>{category.rows.map((item) => <div key={item.id} className={styles.chartRow}>
          <div className={styles.chartName}><strong>{item.name}</strong><span>{item.qty.toLocaleString()} {item.unit} available<br />Reorder Fixed: {item.fixedPoint === null ? 'Not set' : `${item.fixedPoint.toLocaleString()} ${item.unit}`}, Consumption: {item.consumptionPoint.toLocaleString()} {item.unit} / {item.coverage_days} days{item.pieces_per_unit ? ` · 1 ${item.unit} = ${item.pieces_per_unit} pcs` : ''}</span></div>
          <div className={styles.barTrack} role="img" aria-label={`${item.name}: ${item.qty} ${item.unit} available, fixed reorder point ${item.fixedPoint ?? 'not set'}, consumption reorder point ${item.consumptionPoint}`}><div className={styles.barFill} data-level={item.fixedPoint === null ? 'unset' : item.fill <= 50 ? 'low' : item.fill < 100 ? 'medium' : 'healthy'} style={{ width: `${item.fill}%` }} /><div className={styles.barMarks} aria-hidden="true" /></div>
          <span className={styles.percent}>{item.fixedPoint === null ? '—' : `${item.fill}%`}</span>
        </div>)}</div> : null}
      </section>)}
      {!loading && chart.length === 0 ? <p className={styles.muted}>No packaging items found.</p> : null}
    </div> : null}
    {loading ? <p className={styles.muted}>Loading packaging supplies...</p> : null}
    {view === 'movement' ? <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Date</th><th>Item</th><th>Movement</th><th className={styles.numeric}>Inventory</th><th className={styles.numeric}>Display</th><th className={styles.numeric}>Total</th><th>By</th><th>Note</th></tr></thead><tbody>{movements.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString('id-ID')}</td><td>{items.find((item) => item.id === row.item_id)?.name || '—'}</td><td>{({ OPENING: 'Opening', IN: 'Stock In', OUT: 'Stock Out', MOVE: 'Move', ADJUSTMENT: 'Adjustment' })[row.movement_type] || row.movement_type}</td><td className={styles.numeric}>{row.inventory_delta > 0 ? '+' : ''}{row.inventory_delta ?? '—'}</td><td className={styles.numeric}>{row.display_delta > 0 ? '+' : ''}{row.display_delta ?? '—'}</td><td className={styles.numeric}>{row.qty_after}</td><td>{actors.get(row.created_by) || row.created_by?.slice(0, 8) || '—'}</td><td>{row.note}</td></tr>)}{!movements.length ? <tr><td colSpan="8" className={styles.empty}>No movements yet.</td></tr> : null}</tbody></table></div> : null}
    {printOpen ? createPortal(<div className={styles.overlay} role="presentation"><div className={styles.modal} role="dialog" aria-modal="true" aria-label="Print packaging QR labels"><div className={styles.modalHeading}><h3>Print QR Labels</h3><button type="button" onClick={() => setPrintOpen(false)} aria-label="Close">×</button></div><label className={styles.field}><span>Category</span><select value={printCategoryId} onChange={(event) => setPrintCategoryId(event.target.value)}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>{printCategoryId ? <><label className={styles.printSelectAll}><input type="checkbox" checked={items.filter((item) => String(item.category_id) === printCategoryId).every((item) => printItemIds.includes(item.id))} onChange={(event) => { const categoryIds = items.filter((item) => String(item.category_id) === printCategoryId).map((item) => item.id); setPrintItemIds((current) => event.target.checked ? [...new Set([...current, ...categoryIds])] : current.filter((id) => !categoryIds.includes(id))) }} /> Select all in category</label><div className={styles.printItemList}>{items.filter((item) => String(item.category_id) === printCategoryId).map((item) => <label key={item.id}><input type="checkbox" checked={printItemIds.includes(item.id)} onChange={() => togglePrintItem(item.id)} />{item.name}</label>)}</div></> : null}<div className={styles.modalActions}><button type="button" onClick={() => setPrintOpen(false)}>Cancel</button><button type="button" disabled={!printItemIds.length} onClick={() => void printLabels()}>Print {printItemIds.length || ''} label{printItemIds.length === 1 ? '' : 's'}</button></div></div></div>, document.body) : null}
    {dialog ? createPortal(<div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDialog('') }}><form className={styles.modal} onSubmit={save} role="dialog" aria-modal="true" aria-label={dialog === 'reorder' ? 'Set reorder point' : 'Record stock movement'}>
      <div className={styles.modalHeading}><div><h3>{dialog === 'reorder' ? 'Reorder Point' : 'Stock Movement'}</h3></div><button type="button" onClick={() => setDialog('')} disabled={busy} aria-label="Close">×</button></div>
      <label className={styles.field}><span>Category</span><select required value={actionCategoryId} onChange={(event) => { setActionCategoryId(event.target.value); setSelected(null) }}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className={styles.field}><span>Item</span><select required disabled={!actionCategoryId} value={selected?.id || ''} onChange={(event) => { const item = items.find((row) => String(row.id) === event.target.value); if (item) open(item, dialog) }}><option value="">Select item</option>{items.filter((item) => String(item.category_id) === actionCategoryId).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></label>
      {selected ? dialog === 'reorder' ? <label className={styles.field}><span>Fixed reorder point ({selected.unit})</span><input type="number" min="0" required value={form.point} onChange={(event) => setForm({ ...form, point: event.target.value })} /></label> : <><label className={styles.field}><span>Movement</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="IN">Stock In / Input</option><option value="MOVE">Move to Display</option><option value="OUT">Stock Out / Take</option></select></label><p className={styles.modalStock}>Available in {form.kind === 'OUT' ? 'Display' : 'Inventory'}: <strong>{Number(form.kind === 'OUT' ? selected.display_qty : selected.inventory_qty).toLocaleString()} {selected.unit}</strong></p><label className={styles.field}><span>Quantity ({selected.unit})</span><input type="number" required min="1" max={form.kind === 'IN' ? undefined : form.kind === 'OUT' ? selected.display_qty : selected.inventory_qty} value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} /></label></> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}<div className={styles.modalActions}><button type="button" onClick={() => setDialog('')} disabled={busy}>Cancel</button><button type="submit" disabled={busy || !selected}>{busy ? 'Saving...' : 'Save'}</button></div>
    </form></div>, document.body) : null}
  </section>
}
