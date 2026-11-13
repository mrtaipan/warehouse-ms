'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/utils/supabase/browser'
import styles from './reject-storage-release.module.css'

const supabase = createClient()
const PAGE_SIZE = 1000
const getProductKey = (item) => String(item.sku || item.name || '').trim().toUpperCase()

export async function loadRejectStorageOutbounds(sourceType) {
  const rows = []
  const column = sourceType === 'ARKLINE' ? 'arkline_line_id' : 'regular_reject_id'
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from('warehouse_reject_storage_outbounds')
      .select('id, regular_reject_id, arkline_line_id, qty, reason, destination, released_by, released_at')
      .not(column, 'is', null)
      .order('released_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if ((data || []).length < PAGE_SIZE) return rows
  }
}

export function getReleasedQtyBySource(rows, sourceType) {
  const amounts = new Map()
  const column = sourceType === 'ARKLINE' ? 'arkline_line_id' : 'regular_reject_id'
  for (const row of rows) {
    const key = String(row[column])
    amounts.set(key, (amounts.get(key) || 0) + Number(row.qty || 0))
  }
  return amounts
}

export default function RejectStorageRelease({ sourceType, items, outbounds, onSaved, onClose, initialItemId = '' }) {
  const initialItem = items.find((item) => String(item.id) === String(initialItemId))
  const [selectedKoli, setSelectedKoli] = useState(initialItem?.koli || '')
  const [selectedProduct, setSelectedProduct] = useState(initialItem ? getProductKey(initialItem) : '')
  const [selectedSize, setSelectedSize] = useState(initialItem ? JSON.stringify([initialItem.size.trim().toUpperCase(), initialItem.grade.trim().toUpperCase()]) : '')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [destination, setDestination] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const koliOptions = useMemo(() => Array.from(new Set(items.filter((item) => item.available > 0).map((item) => item.koli))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })), [items])
  const koliItems = items.filter((item) => item.koli === selectedKoli && item.available > 0)
  const productOptions = Array.from(new Map(koliItems.map((item) => [getProductKey(item), item.sku ? `${item.name} · ${item.sku}` : item.name])).entries())
    .sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }))
  const productItems = koliItems.filter((item) => getProductKey(item) === selectedProduct)
  const sizeOptions = Array.from(new Map(productItems.map((item) => {
    const size = item.size.trim().toUpperCase()
    const grade = item.grade.trim().toUpperCase()
    return [JSON.stringify([size, grade]), { size, grade }]
  })).entries()).sort((a, b) => a[1].size.localeCompare(b[1].size, undefined, { numeric: true }) || a[1].grade.localeCompare(b[1].grade))
  const selectedItems = productItems.filter((item) => JSON.stringify([item.size.trim().toUpperCase(), item.grade.trim().toUpperCase()]) === selectedSize)
  const availableQty = selectedItems.reduce((sum, item) => sum + Number(item.available || 0), 0)
  const sourceColumn = sourceType === 'ARKLINE' ? 'arkline_line_id' : 'regular_reject_id'
  const selectedIds = new Set(selectedItems.map((item) => String(item.id)))
  const history = outbounds.filter((row) => selectedIds.has(String(row[sourceColumn])))

  useEffect(() => {
    function onKeyDown(event) { if (event.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  async function handleSubmit(event) {
    event.preventDefault()
    const amount = Number(qty)
    if (!selectedItems.length || !Number.isInteger(amount) || amount < 1 || amount > availableQty) {
      setError('Enter a quantity within the available balance.')
      return
    }
    if (!reason.trim()) {
      setError('Enter the reason for releasing this item.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { error: saveError } = await supabase.rpc('release_reject_storage_selection', {
        p_source_type: sourceType,
        p_source_ids: selectedItems.map((item) => String(item.id)),
        p_qty: amount,
        p_reason: reason.trim(),
        p_destination: destination.trim() || null,
      })
      if (saveError) throw saveError
      await onSaved()
      onClose()
    } catch (saveError) {
      setError(saveError.message || 'Could not release the item.')
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal((
    <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="reject-release-title" onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div><span className={styles.eyebrow}>Reject Storage</span><h2 id="reject-release-title">Release from Koli</h2></div>
          <button type="button" className={styles.close} onClick={onClose} disabled={saving} aria-label="Close">×</button>
        </header>
        <div className={styles.sourceGrid}>
          <label>Koli Number
            <select value={selectedKoli} onChange={(event) => { setSelectedKoli(event.target.value); setSelectedProduct(''); setSelectedSize(''); setQty(''); setError('') }} required disabled={saving || Boolean(initialItemId)}>
              <option value="">Choose koli</option>
              {koliOptions.map((koli) => <option key={koli} value={koli}>{koli}</option>)}
            </select>
          </label>
          <label>Product
            <select value={selectedProduct} onChange={(event) => { setSelectedProduct(event.target.value); setSelectedSize(''); setQty(''); setError('') }} required disabled={saving || !selectedKoli || Boolean(initialItemId)}>
              <option value="">Choose product</option>
              {productOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label>Size
            <select value={selectedSize} onChange={(event) => { setSelectedSize(event.target.value); setQty(''); setError('') }} required disabled={saving || !selectedProduct || Boolean(initialItemId)}>
              <option value="">Choose size</option>
              {sizeOptions.map(([key, option]) => <option key={key} value={key}>{option.size || 'No size'} · Grade {option.grade || '-'}</option>)}
            </select>
          </label>
        </div>
        {selectedSize ? (
          <div className={styles.releaseDetails}>
            <div className={styles.availability}><span>Available in koli</span><strong>{availableQty} <small>pcs</small></strong></div>
            <div className={styles.detailGrid}>
              <label>Qty to release
                <div className={styles.qtyControl}>
                  <input type="number" min="1" max={availableQty} step="1" value={qty} onChange={(event) => { const value = event.target.value; setQty(value === '' ? '' : String(Math.min(availableQty, Math.max(0, Number(value) || 0)))) }} required disabled={saving || availableQty < 1} />
                  <button type="button" onClick={() => setQty(String(availableQty))} disabled={saving || availableQty < 1} title="Use all available quantity">All</button>
                </div>
              </label>
              <label>Destination / recipient <span className={styles.optional}>(optional)</span>
                <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Where is it going?" disabled={saving} />
              </label>
              <label className={styles.reasonField}>Release reason
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter the reason for this release" rows="3" required disabled={saving} />
              </label>
            </div>
          </div>
        ) : null}
        {history.length > 0 ? <details className={styles.history}><summary>Previous releases ({history.length})</summary>{history.slice(0, 5).map((row) => <p key={row.id}>{new Date(row.released_at).toLocaleString('id-ID')} · {row.qty} unit(s) · {row.reason}</p>)}</details> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <footer><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className={styles.primary} disabled={saving || !selectedSize || availableQty < 1 || !qty || !reason.trim()}>{saving ? 'Processing...' : 'Confirm Release'}</button></footer>
      </form>
    </div>
  ), document.body)
}
