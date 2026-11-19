'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/utils/supabase/browser'
import styles from './packaging-supplies-client.module.css'

const supabase = createClient()
const EMPTY_FORM = { kind: 'IN', qty: '', note: '', mode: 'FIXED', point: '', days: '14' }

function reorderPoint(item, consumption) {
  if (item.reorder_mode === 'FIXED') return item.reorder_point_qty
  const spent = consumption.get(item.id) || 0
  return spent ? Math.ceil(spent / 30 * item.coverage_days) : null
}

export default function PackagingSuppliesClient({ canManage }) {
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
  const [selected, setSelected] = useState(null)
  const [dialog, setDialog] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [categoryResult, itemResult, movementResult, consumptionResult, profileResult] = await Promise.all([
      supabase.from('packaging_categories').select('id,name,sort_order').order('sort_order'),
      supabase.from('packaging_items').select('id,category_id,name,unit,pieces_per_unit,qty,reorder_mode,reorder_point_qty,coverage_days,sort_order').eq('active', true).order('sort_order'),
      supabase.from('packaging_movements').select('id,item_id,movement_type,qty_change,qty_after,note,created_by,created_at').order('created_at', { ascending: false }).limit(50),
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
    if (!dialog) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [dialog])

  const filtered = useMemo(() => items.filter((item) =>
    (categoryFilter === 'ALL' || String(item.category_id) === categoryFilter)
    && item.name.toLowerCase().includes(search.trim().toLowerCase())), [items, categoryFilter, search])

  const chart = useMemo(() => categories.map((category) => {
    const rows = items.filter((item) => item.category_id === category.id)
    const configured = rows.map((item) => ({ item, point: reorderPoint(item, consumption) }))
      .filter(({ point }) => point !== null)
    const low = configured.filter(({ item, point }) => item.qty <= point).length
    const fill = configured.length ? Math.round(configured.reduce((sum, { item, point }) =>
      sum + Math.min(100, item.qty / (Math.max(1, point) * 2) * 100), 0) / configured.length) : 0
    return { ...category, total: rows.length, configured: configured.length, low, fill }
  }), [categories, items, consumption])

  function open(item, type) {
    setSelected(item)
    setDialog(type)
    setError('')
    setForm({ ...EMPTY_FORM, kind: 'IN',
      mode: item.reorder_mode, point: item.reorder_point_qty ?? '', days: String(item.coverage_days) })
  }

  async function save(event) {
    event.preventDefault()
    if (!selected || busy) return
    setBusy(true)
    setError('')
    let result
    if (dialog === 'reorder') {
      result = await supabase.rpc('set_packaging_reorder', {
        p_item_id: selected.id, p_mode: form.mode,
        p_point: form.mode === 'FIXED' ? Number(form.point) : null,
        p_days: Number(form.days),
      })
    } else {
      result = await supabase.rpc('record_packaging_movement', {
        p_item_id: selected.id, p_movement_type: form.kind,
        p_qty: Number(form.qty), p_note: form.note.trim(),
      })
    }
    setBusy(false)
    if (result.error) { setError(result.error.message); return }
    setDialog('')
    setSelected(null)
    await load()
  }

  return <section className={styles.root} aria-label="Packaging Supplies">
    <div className={styles.heading}><div><h2>Packaging Supplies</h2><p>One warehouse balance across all packaging supplies.</p></div>
      <button type="button" className={styles.refresh} onClick={load} disabled={loading || busy} aria-label="Refresh packaging supplies" title="Refresh">↻</button></div>
    {error && !dialog ? <p className={styles.error} role="alert">{error}</p> : null}
    <div className={styles.chart} aria-label="Stock level by category">
      {chart.map((category) => <div key={category.id} className={styles.chartRow}>
        <div className={styles.chartName}><strong>{category.name}</strong><span>{category.configured ? `${category.low} reorder · ${category.configured}/${category.total} configured` : 'Reorder points not set'}</span></div>
        <div className={styles.barTrack} role="img" aria-label={`${category.name}: ${category.configured ? `${category.fill}% stock level, ${category.low} need reorder` : 'not configured'}`}>
          <div className={styles.barFill} data-level={category.configured ? category.fill <= 50 ? 'low' : category.fill < 100 ? 'medium' : 'healthy' : 'unset'} style={{ width: `${category.fill}%` }} />
          <div className={styles.barMarks} aria-hidden="true" />
        </div><span className={styles.percent}>{category.configured ? `${category.fill}%` : '—'}</span>
      </div>)}
    </div>
    <div className={styles.filters}>
      <label><span>Search item</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search packaging item" /></label>
      <label><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="ALL">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    </div>
    <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Item</th><th>Category</th><th className={styles.numeric}>Available</th><th className={styles.numeric}>Reorder at</th><th>Status</th>{canManage ? <th>Actions</th> : null}</tr></thead>
      <tbody>{filtered.map((item) => {
        const category = categories.find((row) => row.id === item.category_id)
        const point = reorderPoint(item, consumption)
        const state = point === null ? 'Unset' : item.qty <= point ? 'Reorder' : item.qty <= point * 2 ? 'Watch' : 'Healthy'
        return <tr key={item.id}><td><strong>{item.name}</strong>{item.pieces_per_unit ? <small>1 {item.unit} = {item.pieces_per_unit} pcs</small> : null}</td><td>{category?.name || '—'}</td><td className={styles.numeric}>{item.qty.toLocaleString()} {item.unit}</td><td className={styles.numeric}>{point === null ? '—' : `${point.toLocaleString()} ${item.unit}`}</td><td><span className={styles.status} data-status={state}>{state}</span></td>{canManage ? <td><div className={styles.actions}><button type="button" onClick={() => open(item, 'movement')} title="Record stock movement">± Stock</button><button type="button" onClick={() => open(item, 'reorder')} title="Set reorder point">Reorder</button></div></td> : null}</tr>
      })}{!loading && filtered.length === 0 ? <tr><td colSpan={canManage ? 6 : 5} className={styles.empty}>No packaging items found.</td></tr> : null}</tbody></table></div>
    {loading ? <p className={styles.muted}>Loading packaging supplies...</p> : null}
    <h3 className={styles.historyTitle}>Recent movements</h3>
    <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Date</th><th>Item</th><th>Movement</th><th className={styles.numeric}>Change</th><th className={styles.numeric}>Balance</th><th>By</th><th>Note</th></tr></thead><tbody>{movements.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString('id-ID')}</td><td>{items.find((item) => item.id === row.item_id)?.name || '—'}</td><td>{row.movement_type}</td><td className={styles.numeric}>{row.qty_change > 0 ? '+' : ''}{row.qty_change}</td><td className={styles.numeric}>{row.qty_after}</td><td>{actors.get(row.created_by) || row.created_by?.slice(0, 8) || '—'}</td><td>{row.note}</td></tr>)}{!movements.length ? <tr><td colSpan="7" className={styles.empty}>No movements yet.</td></tr> : null}</tbody></table></div>
    {dialog && selected ? createPortal(<div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDialog('') }}><form className={styles.modal} onSubmit={save} role="dialog" aria-modal="true" aria-label={dialog === 'reorder' ? 'Set reorder point' : 'Record stock movement'}>
      <div className={styles.modalHeading}><div><h3>{dialog === 'reorder' ? 'Reorder Point' : 'Stock Movement'}</h3><p>{selected.name}</p></div><button type="button" onClick={() => setDialog('')} disabled={busy} aria-label="Close">×</button></div>
      {dialog === 'reorder' ? <><label className={styles.field}><span>Method</span><select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}><option value="FIXED">Fixed quantity</option><option value="CONSUMPTION">30-day consumption</option></select></label>{form.mode === 'FIXED' ? <label className={styles.field}><span>Reorder at ({selected.unit})</span><input type="number" min="0" required value={form.point} onChange={(event) => setForm({ ...form, point: event.target.value })} /></label> : <label className={styles.field}><span>Coverage (days)</span><input type="number" min="1" max="365" required value={form.days} onChange={(event) => setForm({ ...form, days: event.target.value })} /></label>}</> : <><label className={styles.field}><span>Movement</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="OPENING">Opening stock</option><option value="IN">Stock in</option><option value="OUT">Stock out</option><option value="ADJUSTMENT">Adjustment (+/-)</option></select></label><label className={styles.field}><span>Quantity ({selected.unit})</span><input type="number" required min={form.kind === 'ADJUSTMENT' ? undefined : '1'} value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} /></label><label className={styles.field}><span>Reason / note</span><input required maxLength="300" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label></>}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}<div className={styles.modalActions}><button type="button" onClick={() => setDialog('')} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button></div>
    </form></div>, document.body) : null}
  </section>
}
