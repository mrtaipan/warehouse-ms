'use client'

import JsBarcode from 'jsbarcode'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { deliverySupabase } from '@/lib/delivery-supabase'
import { EmptyState, Modal, ModuleHeader, StatusMessage } from './delivery-report-client'
import { GROUPS, formatDate, jakartaEnd, jakartaStart, manualWaybillPrefix, todayIso } from './delivery-report-helpers'
import styles from './delivery-report.module.css'

function Barcode({ value, compact = false }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    JsBarcode(ref.current, value, {
      format: 'CODE128',
      displayValue: true,
      font: 'Arial',
      fontSize: compact ? 12 : 16,
      height: compact ? 34 : 58,
      margin: compact ? 4 : 8,
      width: compact ? 1.2 : 1.7,
    })
  }, [compact, value])
  return <canvas ref={ref} className={styles.barcodeCanvas} aria-label={`Barcode ${value}`} />
}

const blankForm = () => ({ alamat: '', barang: '', group_order: 'ARKLINE', harga_paket: '', keterangan: '', layanan_courier: '', nama: '', nama_courier: '', no_hp: '' })
const MANUAL_WAYBILL_COLUMNS = 'id,created_at,resi_manual,nama,no_hp,alamat,barang,harga_paket,nama_courier,layanan_courier,keterangan'

function normalizeLockedGroup(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return GROUPS.includes(normalized) ? normalized : ''
}

function cleanText(value) {
  return String(value || '').trim()
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase()
}

function cleanDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function cleanNumeric(value) {
  const normalized = String(value || '').replace(/\./g, '').replace(/,/g, '.').trim()
  if (!normalized) return null
  const numberValue = Number(normalized)
  return Number.isFinite(numberValue) ? numberValue : null
}

function formatMoney(value) {
  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value) || 0)
}

function getManualWaybillIteration(value) {
  const match = String(value || '').trim().toUpperCase().match(/-(\d+)(?:-[A-Z0-9&\s/]+)?$/)
  return match ? Number(match[1]) || 0 : 0
}

function getStoredGroup(row) {
  const fromNote = String(row?.keterangan || '').split(' • ')[0]
  return GROUPS.includes(cleanUpper(row?.group_order)) ? cleanUpper(row.group_order) : GROUPS.includes(cleanUpper(fromNote)) ? cleanUpper(fromNote) : '-'
}

function getStoredNote(row) {
  const parts = String(row?.keterangan || '').split(' • ')
  return GROUPS.includes(cleanUpper(parts[0])) ? parts.slice(1).join(' • ') : row?.keterangan || ''
}

function groupPillClass(group) {
  const value = cleanUpper(group)
  return styles[`casePill${value.charAt(0)}${value.slice(1).toLowerCase()}`] || ''
}

function GroupPill({ group }) {
  return <span className={`${styles.casePill} ${groupPillClass(group)}`}>{group || '-'}</span>
}

export default function ManualWaybill({ lockedGroup: lockedGroupProp = '' }) {
  const today = useMemo(() => todayIso(), [])
  const lockedGroup = useMemo(() => normalizeLockedGroup(lockedGroupProp), [lockedGroupProp])
  const groupOptions = useMemo(() => (lockedGroup ? [lockedGroup] : GROUPS), [lockedGroup])
  const [form, setForm] = useState({ ...blankForm(), group_order: lockedGroup || 'ARKLINE' })
  const [rows, setRows] = useState([])
  const [couriers, setCouriers] = useState([])
  const [services, setServices] = useState([])
  const [filters, setFilters] = useState({ courier: '', date: today, group: lockedGroup, search: '' })
  const [nextResi, setNextResi] = useState('')
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [printRows, setPrintRows] = useState([])
  const [editForm, setEditForm] = useState(null)

  const loadMasters = useCallback(async () => {
    const [courierResult, serviceResult] = await Promise.all([
      deliverySupabase.from('delivery_courier').select('*').neq('is_active', false).order('nama'),
      deliverySupabase.from('delivery_courier_subclass').select('*').neq('is_active', false).order('courier_name'),
    ])
    setCouriers(courierResult.data || [])
    setServices(serviceResult.data || [])
    if (courierResult.error || serviceResult.error) setStatus({ type: 'error', message: 'Failed to load courier master data.' })
  }, [])

  const loadRows = useCallback(async () => {
    const { data, error } = await deliverySupabase
      .from('delivery_resi_manual')
      .select(MANUAL_WAYBILL_COLUMNS)
      .gte('created_at', jakartaStart(filters.date))
      .lte('created_at', jakartaEnd(filters.date))
      .order('id', { ascending: false })
    if (error) setStatus({ type: 'error', message: `Failed to load manual waybills: ${error.message}` })
    else {
      setRows(data || [])
    }
  }, [filters.date])

  const calculateNextResi = useCallback(async () => {
    const prefix = manualWaybillPrefix(form.group_order)
    const { data } = await deliverySupabase.from('delivery_resi_manual').select('resi_manual').like('resi_manual', `${prefix}%`)
    const max = Math.max(0, ...(data || []).map((row) => getManualWaybillIteration(row.resi_manual)))
    setNextResi(`${prefix}${max + 1}`)
  }, [form.group_order])

  useEffect(() => { const timer = window.setTimeout(loadMasters, 0); return () => window.clearTimeout(timer) }, [loadMasters])
  useEffect(() => { const timer = window.setTimeout(loadRows, 0); return () => window.clearTimeout(timer) }, [loadRows])
  useEffect(() => { const timer = window.setTimeout(calculateNextResi, 0); return () => window.clearTimeout(timer) }, [calculateNextResi])
  async function saveData() {
    if (!form.nama_courier || !form.nama || !form.no_hp || !form.alamat || !form.barang) {
      setStatus({ type: 'error', message: 'Please complete courier, recipient name, phone number, address, and item.' })
      return
    }
    setSaving(true)
    const { error } = await deliverySupabase.from('delivery_resi_manual').insert({
      resi_manual: nextResi,
      nama: cleanText(form.nama),
      no_hp: cleanDigits(form.no_hp),
      alamat: cleanText(form.alamat),
      barang: cleanText(form.barang),
      harga_paket: cleanNumeric(form.harga_paket),
      nama_courier: form.nama_courier,
      layanan_courier: form.layanan_courier,
      keterangan: `${form.group_order}${form.keterangan ? ` • ${cleanText(form.keterangan)}` : ''}`,
      created_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) setStatus({ type: 'error', message: `Failed to save manual waybill: ${error.message}` })
    else {
      setStatus({ type: 'success', message: `Manual waybill ${nextResi} was saved successfully.` })
      setForm({ ...blankForm(), group_order: lockedGroup || 'ARKLINE' })
      await Promise.all([loadRows(), calculateNextResi()])
    }
  }

  function printSingle(row) {
    setPrintRows([row])
    window.setTimeout(() => window.print(), 180)
  }

  function openEdit(row) {
    setEditForm({
      id: row.id,
      resi_manual: row.resi_manual,
      created_at: row.created_at,
      group_order: getStoredGroup(row),
      nama_courier: row.nama_courier || '',
      layanan_courier: row.layanan_courier || '',
      nama: row.nama || '',
      no_hp: row.no_hp || '',
      alamat: row.alamat || '',
      barang: row.barang || '',
      harga_paket: row.harga_paket || '',
      keterangan: getStoredNote(row) || '',
    })
  }

  async function saveEdit() {
    if (!editForm) return
    if (!editForm.nama_courier || !editForm.nama || !editForm.no_hp || !editForm.alamat || !editForm.barang) {
      setStatus({ type: 'error', message: 'Please complete courier, recipient name, phone number, address, and item.' })
      return
    }
    setSaving(true)
    const cleanCourier = cleanText(editForm.nama_courier)
    const payload = {
      nama: cleanText(editForm.nama),
      no_hp: cleanDigits(editForm.no_hp),
      alamat: cleanText(editForm.alamat),
      barang: cleanText(editForm.barang),
      harga_paket: cleanNumeric(editForm.harga_paket),
      nama_courier: cleanCourier,
      layanan_courier: editForm.layanan_courier,
      keterangan: `${editForm.group_order}${editForm.keterangan ? ` • ${cleanText(editForm.keterangan)}` : ''}`,
    }
    const { error } = await deliverySupabase
      .from('delivery_resi_manual')
      .update(payload)
      .eq('id', editForm.id)
      .eq('resi_manual', editForm.resi_manual)

    if (!error) {
      await deliverySupabase
        .from('delivery_barcode')
        .update({ courier: cleanCourier || null, is_defined: Boolean(cleanCourier) })
        .eq('barcode', editForm.resi_manual)
    }

    setSaving(false)
    if (error) {
      setStatus({ type: 'error', message: `Failed to update manual waybill: ${error.message}` })
      return
    }
    setEditForm(null)
    setStatus({ type: 'success', message: `Manual waybill ${editForm.resi_manual} was updated successfully.` })
    await loadRows()
  }

  const field = (key) => (event) => {
    const rawValue = event.target.value
    const value = key === 'no_hp' ? cleanDigits(rawValue) : rawValue
    setForm((current) => ({ ...current, [key]: value }))
  }
  const availableServices = services.filter((item) => item.courier_name === form.nama_courier)
  const editServiceOptions = editForm ? services.filter((item) => item.courier_name === editForm.nama_courier) : []
  const rowCourierOptions = Array.from(new Set(rows.map((row) => cleanText(row.nama_courier)).filter(Boolean))).sort()
  const keyword = filters.search.trim().toLowerCase()
  const visibleRows = rows.filter((row) => {
    const group = getStoredGroup(row)
    const haystack = [row.resi_manual, row.nama, row.no_hp, row.alamat, row.barang, row.nama_courier, row.layanan_courier, row.keterangan].join(' ').toLowerCase()
    if (filters.group && group !== filters.group) return false
    if (filters.courier && row.nama_courier !== filters.courier) return false
    if (keyword && !haystack.includes(keyword)) return false
    return true
  })
  return (
    <div className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Delivery Report • Manual Waybill"
        title="Manual Waybill"
        subtitle="Create manual shipment waybills with system-generated barcodes."
      />
      <StatusMessage status={status} />

      <section className={styles.waybillGrid}>
        <article className={styles.formPanel}>
          <div className={styles.panelHeader}><h2>INPUT FORM</h2><span>Manual waybill is auto-generated by system.</span></div>
          <div className={styles.panelBody}>
            <div className={styles.resiPreview}><span>MANUAL WAYBILL</span><strong>{nextResi || '-'}</strong>{nextResi ? <Barcode value={nextResi} compact /> : null}</div>
            <div className={styles.fullField}><span className={styles.fieldTitle}>GROUP ORDER</span><div className={styles.choicePills}>{groupOptions.map((group) => <button key={group} disabled={Boolean(lockedGroup)} className={form.group_order === group ? styles.active : ''} onClick={() => setForm({ ...form, group_order: lockedGroup || group })}>{group}</button>)}</div></div>
            <div className={styles.formGrid}>
              <label><span>COURIER NAME</span><select value={form.nama_courier} onChange={(event) => setForm({ ...form, nama_courier: event.target.value, layanan_courier: '' })}><option value="">Select courier</option>{couriers.map((item) => <option key={item.id}>{item.nama}</option>)}</select></label>
              <label><span>COURIER SERVICE</span><select value={form.layanan_courier} onChange={field('layanan_courier')}><option value="">{availableServices.length ? 'Select service' : 'No service available'}</option>{availableServices.map((item) => <option key={item.id}>{item.courier_service}</option>)}</select></label>
              <label><span>RECIPIENT NAME</span><input placeholder="Recipient name" value={form.nama} onChange={field('nama')} /></label>
              <label><span>PHONE NUMBER</span><input type="tel" placeholder="08xxxxxxxxxx" value={form.no_hp} onChange={field('no_hp')} /></label>
              <label className={styles.fullField}><span>ADDRESS</span><textarea placeholder="Recipient full address" value={form.alamat} onChange={field('alamat')} /></label>
              <label className={styles.fullField}><span>ITEM TO SHIP</span><textarea placeholder="Item details" value={form.barang} onChange={field('barang')} /></label>
              <label className={styles.fullField}><span>NOTES</span><textarea placeholder="Add notes if needed" value={form.keterangan} onChange={field('keterangan')} /></label>
              <label className={styles.fullField}><span>PACKAGE VALUE</span><input inputMode="numeric" placeholder="150000" value={form.harga_paket} onChange={field('harga_paket')} /></label>
            </div>
            <div className={styles.formActions}><button className={styles.primaryButton} disabled={saving} onClick={saveData}>{saving ? 'Saving...' : 'Save Data'}</button><button className={styles.softButton} onClick={() => setForm({ ...blankForm(), group_order: lockedGroup || 'ARKLINE' })}>Reset</button></div>
          </div>
        </article>

        <article className={styles.tablePanel}>
          <div className={styles.panelHeader}><div><h2>MANUAL WAYBILL LIST</h2><p>Edit a manual waybill or reprint one label from the row action.</p></div><span>{visibleRows.length} Rows</span></div>
          <div className={styles.panelBody}>
            <div className={styles.databaseFilter}>
              <label><span>DATE</span><input type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} /></label>
              <label><span>GROUP</span><select value={filters.group} onChange={(event) => setFilters({ ...filters, group: lockedGroup || event.target.value })} disabled={Boolean(lockedGroup)}>{lockedGroup ? null : <option value="">ALL GROUPS</option>}{groupOptions.map((group) => <option key={group}>{group}</option>)}</select></label>
              <label><span>COURIER</span><select value={filters.courier} onChange={(event) => setFilters({ ...filters, courier: event.target.value })}><option value="">ALL COURIERS</option>{rowCourierOptions.map((courier) => <option key={courier}>{courier}</option>)}</select></label>
              <label className={styles.searchField}><span>SEARCH</span><input placeholder="Search recipient, phone, item, address, or waybill" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
              <button className={styles.softButton} onClick={loadRows}>Refresh</button>
            </div>
            <div className={styles.tableWrap}><table><thead><tr><th>Actions</th><th>Date</th><th>Recipient</th><th>Group</th><th>Courier</th><th>Address</th><th>Item</th><th>Value</th><th>Waybill</th></tr></thead><tbody>
              {!visibleRows.length ? <tr><td colSpan="9"><EmptyState label="No manual waybill data yet." /></td></tr> : visibleRows.map((row) => <tr key={row.id}><td><div className={styles.rowActions}><button type="button" className={styles.softButton} title="Edit waybill" aria-label={`Edit ${row.resi_manual}`} onClick={() => openEdit(row)}>✎</button><button type="button" className={styles.softButton} title="Reprint waybill" aria-label={`Reprint ${row.resi_manual}`} onClick={() => printSingle(row)}>🖨️</button></div></td><td>{formatDate(row.created_at, { short: true })}</td><td><strong>{row.nama}</strong><small>{row.no_hp}</small></td><td><GroupPill group={getStoredGroup(row)} /></td><td>{row.nama_courier}<small>{row.layanan_courier || '-'}</small></td><td>{row.alamat}</td><td>{row.barang}<small>{getStoredNote(row) || '-'}</small></td><td>{formatMoney(row.harga_paket)}</td><td><Barcode value={row.resi_manual} compact /></td></tr>)}
            </tbody></table></div>
          </div>
        </article>
      </section>

      <Modal
        open={Boolean(editForm)}
        title="Edit Manual Waybill"
        description={editForm ? `${editForm.resi_manual} • barcode number cannot be changed.` : ''}
        onClose={() => setEditForm(null)}
        actions={<><button className={styles.softButton} onClick={() => setEditForm(null)}>Cancel</button><button className={styles.primaryButton} disabled={saving} onClick={saveEdit}>{saving ? 'Saving...' : 'Save Changes'}</button></>}
      >
        {editForm ? (
          <div className={styles.waybillEditBody}>
            <div className={styles.resiPreview}><span>MANUAL WAYBILL</span><strong>{editForm.resi_manual}</strong><Barcode value={editForm.resi_manual} compact /></div>
            <div className={styles.formGrid}>
              <label><span>GROUP ORDER</span><input value={editForm.group_order} disabled readOnly /></label>
              <label><span>CREATED DATE</span><input value={formatDate(editForm.created_at, { short: true })} disabled readOnly /></label>
              <label><span>COURIER NAME</span><select value={editForm.nama_courier} onChange={(event) => setEditForm({ ...editForm, nama_courier: event.target.value, layanan_courier: '' })}><option value="">Select courier</option>{couriers.map((item) => <option key={item.id}>{item.nama}</option>)}</select></label>
              <label><span>COURIER SERVICE</span><select value={editForm.layanan_courier} onChange={(event) => setEditForm({ ...editForm, layanan_courier: event.target.value })}><option value="">{editServiceOptions.length ? 'Select service' : 'No service available'}</option>{editServiceOptions.map((item) => <option key={item.id}>{item.courier_service}</option>)}</select></label>
              <label><span>RECIPIENT NAME</span><input value={editForm.nama} onChange={(event) => setEditForm({ ...editForm, nama: event.target.value })} /></label>
              <label><span>PHONE NUMBER</span><input type="tel" value={editForm.no_hp} onChange={(event) => setEditForm({ ...editForm, no_hp: cleanDigits(event.target.value) })} /></label>
              <label className={styles.fullField}><span>ADDRESS</span><textarea value={editForm.alamat} onChange={(event) => setEditForm({ ...editForm, alamat: event.target.value })} /></label>
              <label className={styles.fullField}><span>ITEM TO SHIP</span><textarea value={editForm.barang} onChange={(event) => setEditForm({ ...editForm, barang: event.target.value })} /></label>
              <label className={styles.fullField}><span>NOTES</span><textarea value={editForm.keterangan} onChange={(event) => setEditForm({ ...editForm, keterangan: event.target.value })} /></label>
              <label className={styles.fullField}><span>PACKAGE VALUE</span><input inputMode="numeric" value={editForm.harga_paket} onChange={(event) => setEditForm({ ...editForm, harga_paket: event.target.value })} /></label>
            </div>
          </div>
        ) : null}
      </Modal>

      <div className={styles.printArea} aria-hidden="true">
        {printRows.map((row) => <article key={row.id}><h1>DELIVERY WAYBILL</h1><Barcode value={row.resi_manual} /><dl><div><dt>Recipient</dt><dd>{row.nama}</dd></div><div><dt>Phone</dt><dd>{row.no_hp}</dd></div><div><dt>Address</dt><dd>{row.alamat}</dd></div><div><dt>Item</dt><dd>{row.barang}</dd></div><div><dt>Courier</dt><dd>{row.nama_courier} {row.layanan_courier}</dd></div><div><dt>Group</dt><dd>{getStoredGroup(row)}</dd></div><div><dt>Package Value</dt><dd>{formatMoney(row.harga_paket)}</dd></div><div><dt>Notes</dt><dd>{getStoredNote(row) || '-'}</dd></div></dl></article>)}
      </div>
    </div>
  )
}
