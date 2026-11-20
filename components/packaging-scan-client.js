'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import styles from './packaging-scan-client.module.css'

const supabase = createClient()
const actions = [
  { id: 'IN', label: 'Input', detail: 'Add to Inventory' },
  { id: 'MOVE', label: 'Move', detail: 'Inventory to Display' },
  { id: 'OUT', label: 'Take', detail: 'Remove from Display' },
]

export default function PackagingScanClient({ itemId }) {
  const [item, setItem] = useState(null)
  const [canAdjust, setCanAdjust] = useState(false)
  const [action, setAction] = useState('')
  const [area, setArea] = useState('INVENTORY')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('packaging_items')
      .select('id,name,unit,qty,inventory_qty,display_qty,reorder_point_qty,active').eq('id', itemId).single()
    if (loadError || !data?.active) setError(loadError?.message || 'Item not found')
    else { setItem(data); setError('') }
    setLoading(false)
  }, [itemId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')
      if (!cancelled) setCanAdjust(['warehouse_leader', 'admin'].includes(String(profile?.role || '').toLowerCase()))
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [])

  const source = action === 'OUT' ? 'Display' : area === 'DISPLAY' && action === 'ADJUSTMENT' ? 'Display' : 'Inventory'
  const available = source === 'Display' ? item?.display_qty : item?.inventory_qty
  const fixedPoint = item?.reorder_point_qty
  const restockNeeded = fixedPoint !== null && fixedPoint !== undefined && item?.qty <= fixedPoint

  function balanceState(value) {
    if (value === 0) return 'empty'
    if (fixedPoint !== null && fixedPoint !== undefined && value <= fixedPoint) return 'low'
    return 'healthy'
  }

  async function submit(event) {
    event.preventDefault()
    if (busy || !item) return
    setBusy(true)
    setError('')
    setSuccess('')
    const { error: actionError } = await supabase.rpc('apply_packaging_action', {
      p_item_id: item.id, p_action: action, p_qty: Number(qty),
      p_area: action === 'ADJUSTMENT' ? area : null,
      p_reason: action === 'ADJUSTMENT' ? reason.trim() : null,
    })
    if (actionError) setError(actionError.message)
    else {
      await load()
      setSuccess(`${action === 'ADJUSTMENT' ? 'Adjustment' : action === 'OUT' ? 'Take' : action === 'IN' ? 'Input' : 'Move'} recorded.`)
      setAction('')
      setQty('')
      setReason('')
    }
    setBusy(false)
  }

  return <main className={styles.page}>
    <div className={styles.shell}>
      <div className={styles.top}><Link href="/dashboard/storage/overview?mode=packaging-supplies" aria-label="Back to Packaging Supplies">←</Link></div>
      {loading ? <p className={styles.message}>Loading item...</p> : error && !item ? <p className={styles.error}>{error}</p> : item ? <>
        <h1>{item.name}</h1>
        {restockNeeded ? <p className={styles.restockNotice}>Restock needed · Total {item.qty.toLocaleString()} {item.unit} · Reorder at {fixedPoint.toLocaleString()} {item.unit}</p> : null}
        <div className={styles.balances}>
          <div data-level={balanceState(item.inventory_qty)}><span>Inventory</span><small className={styles.qtyLabel}>Qty</small><strong>{item.inventory_qty.toLocaleString()} <small>{item.unit}</small></strong><em>{item.inventory_qty === 0 ? 'Out of stock' : balanceState(item.inventory_qty) === 'low' ? 'Low stock' : 'Available'}</em></div>
          <div data-level={balanceState(item.display_qty)}><span>Display</span><small className={styles.qtyLabel}>Qty</small><strong>{item.display_qty.toLocaleString()} <small>{item.unit}</small></strong><em>{item.display_qty === 0 ? 'Empty' : balanceState(item.display_qty) === 'low' ? 'Refill soon' : 'Available'}</em></div>
        </div>
        {!action ? <div className={styles.choices}>{actions.map((option) => <button key={option.id} type="button" onClick={() => { setAction(option.id); setQty(''); setError(''); setSuccess('') }}><strong>{option.label}</strong><span>{option.detail}</span><b aria-hidden="true">→</b></button>)}{canAdjust ? <button type="button" onClick={() => { setAction('ADJUSTMENT'); setQty(''); setError(''); setSuccess('') }}><strong>Adjustment</strong><span>Correct Inventory or Display with a reason</span><b aria-hidden="true">→</b></button> : null}</div> : <form onSubmit={submit} className={styles.form}>
          <div className={styles.formTitle}><h2>{action === 'OUT' ? 'Take' : action === 'IN' ? 'Input' : action === 'MOVE' ? 'Move' : 'Adjustment'}</h2><button type="button" onClick={() => { setAction(''); setError('') }} aria-label="Back to actions">×</button></div>
          {action === 'ADJUSTMENT' ? <label className={styles.field}>Area<select value={area} onChange={(event) => setArea(event.target.value)}><option value="INVENTORY">Inventory</option><option value="DISPLAY">Display</option></select></label> : null}
          <p className={styles.available}>Available in {source}: <strong>{Number(available || 0).toLocaleString()} {item.unit}</strong></p>
          <label className={styles.field}>Qty {action === 'ADJUSTMENT' ? '(+/-)' : ''}<input autoFocus type="number" step="1" min={action === 'ADJUSTMENT' ? undefined : 1} max={action === 'MOVE' || action === 'OUT' ? available : undefined} required value={qty} onChange={(event) => setQty(event.target.value)} /></label>
          {action === 'ADJUSTMENT' ? <label className={styles.field}>Reason<textarea required maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <button className={styles.submit} type="submit" disabled={busy || !qty || (action === 'ADJUSTMENT' && !reason.trim())}>{busy ? 'Processing...' : 'Submit'}</button>
        </form>}
        {success ? <p className={styles.success} role="status">{success}</p> : null}
      </> : null}
    </div>
  </main>
}
