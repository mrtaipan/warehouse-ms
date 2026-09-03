'use client'

import JsBarcode from 'jsbarcode'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { deliverySupabase } from '@/lib/delivery-supabase'
import { EmptyState, ModuleHeader, StatusMessage } from './delivery-report-client'
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

export default function ManualWaybill() {
  const today = useMemo(() => todayIso(), [])
  const [form, setForm] = useState(blankForm())
  const [rows, setRows] = useState([])
  const [couriers, setCouriers] = useState([])
  const [services, setServices] = useState([])
  const [filters, setFilters] = useState({ courier: '', date: today, group: '', search: '' })
  const [selected, setSelected] = useState([])
  const [nextResi, setNextResi] = useState('')
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [printRows, setPrintRows] = useState([])

  const loadMasters = useCallback(async () => {
    const [courierResult, serviceResult] = await Promise.all([
      deliverySupabase.from('Delivery_Courier').select('*').neq('is_active', false).order('nama'),
      deliverySupabase.from('Courier_Subclass').select('*').neq('is_active', false).order('courier_name'),
    ])
    setCouriers(courierResult.data || [])
    setServices(serviceResult.data || [])
    if (courierResult.error || serviceResult.error) setStatus({ type: 'error', message: 'Failed to load courier master data.' })
  }, [])

  const loadRows = useCallback(async () => {
    const { data, error } = await deliverySupabase
      .from('Resi_Manual')
      .select('*')
      .gte('created_at', jakartaStart(filters.date))
      .lte('created_at', jakartaEnd(filters.date))
      .order('id', { ascending: false })
    if (error) setStatus({ type: 'error', message: `Failed to load manual waybills: ${error.message}` })
    else {
      setRows(data || [])
      setSelected([])
    }
  }, [filters.date])

  const calculateNextResi = useCallback(async () => {
    const prefix = manualWaybillPrefix(form.group_order)
    const { data } = await deliverySupabase.from('Resi_Manual').select('resi_manual').like('resi_manual', `${prefix}%`)
    const max = Math.max(0, ...(data || []).map((row) => Number(String(row.resi_manual).split('-').pop()) || 0))
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
    const { error } = await deliverySupabase.from('Resi_Manual').insert({
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
      setForm(blankForm())
      await Promise.all([loadRows(), calculateNextResi()])
    }
  }

  function printSelected() {
    const chosen = visibleRows.filter((row) => selected.includes(row.id))
    if (!chosen.length) {
      setStatus({ type: 'warning', message: 'Select at least one row to print.' })
      return
    }
    setPrintRows(chosen)
    window.setTimeout(() => window.print(), 180)
  }

  const field = (key) => (event) => {
    const rawValue = event.target.value
    const value = key === 'no_hp' ? cleanDigits(rawValue) : rawValue
    setForm((current) => ({ ...current, [key]: value }))
  }
  const availableServices = services.filter((item) => item.courier_name === form.nama_courier)
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
  const selectedVisibleRows = visibleRows.filter((row) => selected.includes(row.id))
  const allVisibleSelected = visibleRows.length > 0 && selectedVisibleRows.length === visibleRows.length

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
            <div className={styles.fullField}><span className={styles.fieldTitle}>GROUP ORDER</span><div className={styles.choicePills}>{GROUPS.map((group) => <button key={group} className={form.group_order === group ? styles.active : ''} onClick={() => setForm({ ...form, group_order: group })}>{group}</button>)}</div></div>
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
            <div className={styles.formActions}><button className={styles.primaryButton} disabled={saving} onClick={saveData}>{saving ? 'Saving...' : 'Save Data'}</button><button className={styles.softButton} onClick={() => setForm(blankForm())}>Reset</button></div>
          </div>
        </article>

        <article className={styles.tablePanel}>
          <div className={styles.panelHeader}><div><h2>MANUAL WAYBILL LIST</h2><p>Print only selected rows from the current table.</p></div><span>{visibleRows.length} Rows</span></div>
          <div className={styles.panelBody}>
            <div className={styles.databaseFilter}>
              <label><span>DATE</span><input type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} /></label>
              <label><span>GROUP</span><select value={filters.group} onChange={(event) => setFilters({ ...filters, group: event.target.value })}><option value="">ALL GROUPS</option>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
              <label><span>COURIER</span><select value={filters.courier} onChange={(event) => setFilters({ ...filters, courier: event.target.value })}><option value="">ALL COURIERS</option>{rowCourierOptions.map((courier) => <option key={courier}>{courier}</option>)}</select></label>
              <label className={styles.searchField}><span>SEARCH</span><input placeholder="Search recipient, phone, item, address, or waybill" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
              <label className={styles.inlineCheck}><input className={styles.compactCheckbox} type="checkbox" checked={allVisibleSelected} onChange={(event) => setSelected(event.target.checked ? visibleRows.map((row) => row.id) : [])} /> Select All</label>
              <button className={styles.softButton} onClick={loadRows}>Refresh</button>
              <button className={styles.primaryButton} onClick={printSelected}>Print Selected</button>
            </div>
            <div className={styles.tableWrap}><table><thead><tr><th>Select</th><th>Date</th><th>Recipient</th><th>Group</th><th>Courier</th><th>Address</th><th>Item</th><th>Value</th><th>Waybill</th></tr></thead><tbody>
              {!visibleRows.length ? <tr><td colSpan="9"><EmptyState label="No manual waybill data yet." /></td></tr> : visibleRows.map((row) => <tr key={row.id}><td><input className={styles.compactCheckbox} type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, row.id])] : selected.filter((id) => id !== row.id))} /></td><td>{formatDate(row.created_at, { short: true })}</td><td><strong>{row.nama}</strong><small>{row.no_hp}</small></td><td><GroupPill group={getStoredGroup(row)} /></td><td>{row.nama_courier}<small>{row.layanan_courier || '-'}</small></td><td>{row.alamat}</td><td>{row.barang}<small>{getStoredNote(row) || '-'}</small></td><td>{formatMoney(row.harga_paket)}</td><td><Barcode value={row.resi_manual} compact /></td></tr>)}
            </tbody></table></div>
          </div>
        </article>
      </section>

      <div className={styles.printArea} aria-hidden="true">
        {printRows.map((row) => <article key={row.id}><h1>DELIVERY WAYBILL</h1><Barcode value={row.resi_manual} /><dl><div><dt>Recipient</dt><dd>{row.nama}</dd></div><div><dt>Phone</dt><dd>{row.no_hp}</dd></div><div><dt>Address</dt><dd>{row.alamat}</dd></div><div><dt>Item</dt><dd>{row.barang}</dd></div><div><dt>Courier</dt><dd>{row.nama_courier} {row.layanan_courier}</dd></div><div><dt>Group</dt><dd>{getStoredGroup(row)}</dd></div><div><dt>Package Value</dt><dd>{formatMoney(row.harga_paket)}</dd></div><div><dt>Notes</dt><dd>{getStoredNote(row) || '-'}</dd></div></dl></article>)}
      </div>
    </div>
  )
}
