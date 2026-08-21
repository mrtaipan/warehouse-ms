'use client'

import JsBarcode from 'jsbarcode'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { deliverySupabase } from '@/lib/delivery-supabase'
import { EmptyState, ModuleHeader, StatusMessage } from './delivery-report-client'
import { GROUPS, jakartaEnd, jakartaStart, manualWaybillPrefix, todayIso } from './delivery-report-helpers'
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

const blankForm = () => ({ group_order: 'ARKLINE', nama_courier: '', layanan_courier: '', nama: '', no_hp: '', alamat: '', barang: '', keterangan: '', harga_paket: '' })

export default function ManualWaybill() {
  const today = useMemo(() => todayIso(), [])
  const [form, setForm] = useState(blankForm())
  const [rows, setRows] = useState([])
  const [couriers, setCouriers] = useState([])
  const [services, setServices] = useState([])
  const [dateFilter, setDateFilter] = useState(today)
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
    if (courierResult.error || serviceResult.error) setStatus({ type: 'error', message: 'Gagal memuat data ekspedisi.' })
  }, [])

  const loadRows = useCallback(async () => {
    const { data, error } = await deliverySupabase
      .from('Resi_Manual')
      .select('*')
      .gte('created_at', jakartaStart(dateFilter))
      .lte('created_at', jakartaEnd(dateFilter))
      .order('id', { ascending: false })
    if (error) setStatus({ type: 'error', message: `Gagal memuat data entry: ${error.message}` })
    else setRows(data || [])
  }, [dateFilter])

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
      setStatus({ type: 'error', message: 'Lengkapi ekspedisi, nama, no HP, alamat, dan barang.' })
      return
    }
    setSaving(true)
    const { error } = await deliverySupabase.from('Resi_Manual').insert({
      resi_manual: nextResi,
      nama: form.nama,
      no_hp: form.no_hp,
      alamat: form.alamat,
      barang: form.barang,
      harga_paket: form.harga_paket,
      nama_courier: form.nama_courier,
      layanan_courier: form.layanan_courier,
      keterangan: `${form.group_order}${form.keterangan ? ` • ${form.keterangan}` : ''}`,
      created_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) setStatus({ type: 'error', message: `Gagal menyimpan resi manual: ${error.message}` })
    else {
      setStatus({ type: 'success', message: `Resi ${nextResi} berhasil disimpan.` })
      setForm(blankForm())
      await Promise.all([loadRows(), calculateNextResi()])
    }
  }

  function printSelected() {
    const chosen = rows.filter((row) => selected.includes(row.id))
    if (!chosen.length) {
      setStatus({ type: 'warning', message: 'Centang minimal satu row untuk print.' })
      return
    }
    setPrintRows(chosen)
    window.setTimeout(() => window.print(), 180)
  }

  const field = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const availableServices = services.filter((item) => item.courier_name === form.nama_courier)

  return (
    <div className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Data Entry Manual"
        title="Manual Entry"
        subtitle="Pembuatan form resi manual dengan barcode untuk mendata pengiriman yang diinisiasi secara sistem internal."
      />
      <StatusMessage status={status} />

      <section className={styles.waybillGrid}>
        <article className={styles.formPanel}>
          <div className={styles.panelHeader}><h2>FORM INPUT</h2><span>Resi manual tetap auto generate by system.</span></div>
          <div className={styles.panelBody}>
            <div className={styles.resiPreview}><span>RESI MANUAL</span><strong>{nextResi || '-'}</strong>{nextResi ? <Barcode value={nextResi} compact /> : null}</div>
            <div className={styles.fullField}><span className={styles.fieldTitle}>GROUP ORDER</span><div className={styles.choicePills}>{GROUPS.map((group) => <button key={group} className={form.group_order === group ? styles.active : ''} onClick={() => setForm({ ...form, group_order: group })}>{group}</button>)}</div></div>
            <div className={styles.formGrid}>
              <label><span>NAMA EKSPEDISI</span><select value={form.nama_courier} onChange={(event) => setForm({ ...form, nama_courier: event.target.value, layanan_courier: '' })}><option value="">Pilih ekspedisi</option>{couriers.map((item) => <option key={item.id}>{item.nama}</option>)}</select></label>
              <label><span>LAYANAN EKSPEDISI</span><select value={form.layanan_courier} onChange={field('layanan_courier')}><option value="">{availableServices.length ? 'Pilih layanan' : 'Belum ada layanan'}</option>{availableServices.map((item) => <option key={item.id}>{item.courier_service}</option>)}</select></label>
              <label><span>NAMA</span><input placeholder="Nama penerima" value={form.nama} onChange={field('nama')} /></label>
              <label><span>NO HP</span><input type="tel" placeholder="08xxxxxxxxxx" value={form.no_hp} onChange={field('no_hp')} /></label>
              <label className={styles.fullField}><span>ALAMAT</span><textarea placeholder="Alamat lengkap penerima" value={form.alamat} onChange={field('alamat')} /></label>
              <label className={styles.fullField}><span>BARANG YANG DIKIRIMKAN</span><textarea placeholder="Isi barang yang dikirim" value={form.barang} onChange={field('barang')} /></label>
              <label className={styles.fullField}><span>KETERANGAN</span><textarea placeholder="Tambahkan keterangan bila perlu" value={form.keterangan} onChange={field('keterangan')} /></label>
              <label className={styles.fullField}><span>HARGA PAKET</span><input inputMode="numeric" placeholder="150000" value={form.harga_paket} onChange={field('harga_paket')} /></label>
            </div>
            <div className={styles.formActions}><button className={styles.primaryButton} disabled={saving} onClick={saveData}>{saving ? 'Menyimpan...' : 'Simpan Data'}</button><button className={styles.softButton} onClick={() => setForm(blankForm())}>Reset</button></div>
          </div>
        </article>

        <article className={styles.tablePanel}>
          <div className={styles.panelHeader}><div><h2>DATA ENTRY</h2><p>Default tampil data hari ini. Print hanya untuk row yang dicentang.</p></div></div>
          <div className={styles.panelBody}>
            <div className={styles.databaseFilter}>
              <label><span>TANGGAL DATA</span><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label>
              <button className={styles.softButton} onClick={loadRows}>Refresh Data</button>
              <button className={styles.primaryButton} onClick={printSelected}>Print</button>
            </div>
            <div className={styles.tableWrap}><table><thead><tr><th>Print</th><th>Nama</th><th>Group</th><th>Ekspedisi</th><th>Alamat</th><th>Barang</th><th>Resi</th></tr></thead><tbody>
              {!rows.length ? <tr><td colSpan="7"><EmptyState label="Belum ada data entry manual." /></td></tr> : rows.map((row) => <tr key={row.id}><td><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></td><td><strong>{row.nama}</strong><small>{row.no_hp}</small></td><td>{String(row.keterangan || '').split(' • ')[0] || '-'}</td><td>{row.nama_courier}<small>{row.layanan_courier}</small></td><td>{row.alamat}</td><td>{row.barang}</td><td><Barcode value={row.resi_manual} compact /></td></tr>)}
            </tbody></table></div>
          </div>
        </article>
      </section>

      <div className={styles.printArea} aria-hidden="true">
        {printRows.map((row) => <article key={row.id}><h1>DELIVERY WAYBILL</h1><Barcode value={row.resi_manual} /><dl><div><dt>Nama</dt><dd>{row.nama}</dd></div><div><dt>No HP</dt><dd>{row.no_hp}</dd></div><div><dt>Alamat</dt><dd>{row.alamat}</dd></div><div><dt>Barang</dt><dd>{row.barang}</dd></div><div><dt>Ekspedisi</dt><dd>{row.nama_courier} {row.layanan_courier}</dd></div><div><dt>Keterangan</dt><dd>{row.keterangan || '-'}</dd></div></dl></article>)}
      </div>
    </div>
  )
}
