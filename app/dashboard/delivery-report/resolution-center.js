'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { deliverySupabase } from '@/lib/delivery-supabase'
import { EmptyState, Modal, ModuleHeader, StatusMessage } from './delivery-report-client'
import { GROUPS, formatDate, jakartaEnd, jakartaStart, romanMonth, safeNumber, todayIso } from './delivery-report-helpers'
import styles from './delivery-report.module.css'

const TABS = [
  ['registration', 'Return Registration'],
  ['receiving', 'Receiving Confirmation'],
  ['issues', 'Order Issues'],
  ['search', 'Product Search'],
]

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00+07:00`)
  value.setDate(value.getDate() + days)
  return value.toISOString().slice(0, 10)
}

const blankReturn = (date) => ({
  tanggal_pengajuan: date,
  batas_tanggal_retur: addDays(date, 14),
  group_order: 'MOB',
  internal_external: 'Internal',
  order_id: '',
  nama_customer: '',
  no_handphone: '',
  alamat: '',
  no_resi_pengiriman: '',
  nomor_tim: '',
  retur_reason: '',
  retur_action: '',
  produk_diretur: '',
  produk_pengganti: '',
  courier_name: '',
  courier_service: '',
  ongkir_masuk: '',
  ongkir_keluar: '',
  nilai_refund_kompensasi: '',
  total_retur: '',
  keterangan_tambahan: '',
  note_konsumen: '',
  status_barang: 'Pending',
  need_prioritized: false,
})

const blankIssue = () => ({ group_order: 'MOB', order_id: '', nama: '', no_hp: '', produk_bermasalah: '', alasan_bermasalah: '', tindak_lanjut: '', produk_pengganti: '', tim: '', biaya_timbul: '', keterangan: '' })

export default function ResolutionCenter() {
  const today = useMemo(() => todayIso(), [])
  const [activeTab, setActiveTab] = useState('registration')
  const [pic, setPic] = useState('')
  const [picInput, setPicInput] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filters, setFilters] = useState({ from: addDays(today, -6), to: today, group: '', search: '' })
  const [cases, setCases] = useState([])
  const [issues, setIssues] = useState([])
  const [masters, setMasters] = useState({ reasons: [], actions: [], couriers: [], services: [], issueReasons: [], issueActions: [] })
  const [returnForm, setReturnForm] = useState(blankReturn(today))
  const [issueForm, setIssueForm] = useState(blankIssue())
  const [detail, setDetail] = useState(null)
  const [productSearch, setProductSearch] = useState('')

  const loadMasters = useCallback(async () => {
    const results = await Promise.all([
      deliverySupabase.from('Retur_Reason').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('Retur_Action').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('Delivery_Courier').select('*').neq('is_active', false).order('nama'),
      deliverySupabase.from('Courier_Subclass').select('*').neq('is_active', false).order('courier_name'),
      deliverySupabase.from('Order_Issue').select('*').neq('is_active', false).order('id'),
      deliverySupabase.from('Order_Handling').select('*').neq('is_active', false).order('id'),
    ])
    const error = results.find((result) => result.error)?.error
    if (error) setStatus({ type: 'error', message: `Gagal memuat master Resolution Center: ${error.message}` })
    setMasters({ reasons: results[0].data || [], actions: results[1].data || [], couriers: results[2].data || [], services: results[3].data || [], issueReasons: results[4].data || [], issueActions: results[5].data || [] })
  }, [])

  const loadCases = useCallback(async () => {
    let query = deliverySupabase
      .from('Error_Retur_Cases')
      .select('*')
      .gte('tanggal_pengajuan', jakartaStart(filters.from))
      .lte('tanggal_pengajuan', jakartaEnd(filters.to))
      .order('tanggal_pengajuan', { ascending: false })
    if (filters.group) query = query.eq('group_order', filters.group)
    const { data, error } = await query
    if (error) setStatus({ type: 'error', message: `Gagal memuat case retur: ${error.message}` })
    else setCases(data || [])
  }, [filters.from, filters.group, filters.to])

  const loadIssues = useCallback(async () => {
    const { data, error } = await deliverySupabase.from('Order_Issue_Cases').select('*').order('created_at', { ascending: false }).limit(500)
    if (error) setStatus({ type: 'error', message: `Gagal memuat order issues: ${error.message}` })
    else setIssues(data || [])
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { loadMasters(); loadCases(); loadIssues() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCases, loadIssues, loadMasters])

  const caseCode = useMemo(() => {
    const date = new Date(`${returnForm.tanggal_pengajuan}T00:00:00+07:00`)
    const prefix = returnForm.group_order === 'ARKLINE' ? 'A' : returnForm.group_order === 'OI' ? 'O' : 'M'
    return `${prefix}${romanMonth(date)}${String(date.getFullYear()).slice(-2)}-${cases.length + 1}`
  }, [cases.length, returnForm.group_order, returnForm.tanggal_pengajuan])

  const visibleCases = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase()
    if (!keyword) return cases
    return cases.filter((row) => [row.kode_kejadian, row.order_id, row.no_resi_pengiriman, row.nama_customer].some((value) => String(value || '').toLowerCase().includes(keyword)))
  }, [cases, filters.search])

  const stats = useMemo(() => {
    const now = new Date()
    const warning = cases.filter((row) => {
      const deadline = new Date(row.batas_tanggal_retur)
      const days = (deadline - now) / 86400000
      return days >= 0 && days <= 1 && row.status_barang !== 'Completed'
    }).length
    const overdue = cases.filter((row) => new Date(row.batas_tanggal_retur) < now && row.status_barang !== 'Completed').length
    const internal = cases.filter((row) => row.internal_external === 'Internal').length
    return { warning, overdue, internal, external: cases.length - internal }
  }, [cases])

  async function saveReturn() {
    if (!pic || !returnForm.order_id || !returnForm.nama_customer || !returnForm.no_handphone || !returnForm.alamat || !returnForm.no_resi_pengiriman || !returnForm.retur_reason || !returnForm.retur_action) {
      setStatus({ type: 'error', message: 'Lengkapi PIC dan seluruh field bertanda wajib.' })
      return
    }
    setBusy(true)
    const { error } = await deliverySupabase.from('Error_Retur_Cases').insert({
      ...returnForm,
      kode_kejadian: caseCode,
      pic,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tanggal_pengajuan: new Date(`${returnForm.tanggal_pengajuan}T08:00:00+07:00`).toISOString(),
      batas_tanggal_retur: new Date(`${returnForm.batas_tanggal_retur}T08:00:00+07:00`).toISOString(),
      ongkir_masuk: safeNumber(returnForm.ongkir_masuk),
      ongkir_keluar: safeNumber(returnForm.ongkir_keluar),
      nilai_refund_kompensasi: safeNumber(returnForm.nilai_refund_kompensasi),
      total_retur: safeNumber(returnForm.total_retur),
    })
    setBusy(false)
    if (error) setStatus({ type: 'error', message: `Gagal menyimpan case: ${error.message}` })
    else {
      setStatus({ type: 'success', message: `Case ${caseCode} berhasil disimpan.` })
      setReturnForm(blankReturn(today))
      await loadCases()
    }
  }

  async function saveIssue() {
    if (!pic || !issueForm.order_id || !issueForm.nama || !issueForm.alasan_bermasalah || !issueForm.tindak_lanjut) {
      setStatus({ type: 'error', message: 'Lengkapi PIC, Order ID, nama, alasan, dan tindak lanjut.' })
      return
    }
    setBusy(true)
    const { error } = await deliverySupabase.from('Order_Issue_Cases').insert({ ...issueForm, pic, biaya_timbul: safeNumber(issueForm.biaya_timbul), created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) setStatus({ type: 'error', message: `Gagal menyimpan issue: ${error.message}` })
    else { setStatus({ type: 'success', message: 'Order issue berhasil disimpan.' }); setIssueForm(blankIssue()); await loadIssues() }
  }

  async function updateStatus(row, nextStatus) {
    const { error } = await deliverySupabase.from('Error_Retur_Cases').update({ status_barang: nextStatus, pic, updated_at: new Date().toISOString() }).eq('id', row.id)
    if (error) setStatus({ type: 'error', message: `Gagal update status: ${error.message}` })
    else { setStatus({ type: 'success', message: `${row.kode_kejadian} diperbarui menjadi ${nextStatus}.` }); await loadCases() }
  }

  const returnField = (key) => (event) => setReturnForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))
  const issueField = (key) => (event) => setIssueForm((current) => ({ ...current, [key]: event.target.value }))
  const serviceOptions = masters.services.filter((item) => item.courier_name === returnForm.courier_name)
  const searchResults = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase()
    if (!keyword) return []
    const returnRows = cases.filter((row) => [row.produk_diretur, row.produk_pengganti, row.order_id, row.nama_customer].some((value) => String(value || '').toLowerCase().includes(keyword))).map((row) => ({ type: 'RETURN', title: row.produk_diretur || row.order_id, subtitle: `${row.kode_kejadian} • ${row.nama_customer}`, row }))
    const issueRows = issues.filter((row) => [row.produk_bermasalah, row.produk_pengganti, row.order_id, row.nama].some((value) => String(value || '').toLowerCase().includes(keyword))).map((row) => ({ type: 'ISSUE', title: row.produk_bermasalah || row.order_id, subtitle: `${row.order_id} • ${row.nama}`, row }))
    return [...returnRows, ...issueRows]
  }, [cases, issues, productSearch])

  return (
    <div className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Delivery Report • Error & Retur"
        title="Resolution Monitoring Center"
        subtitle="Kelola dan pantau kasus retur pengiriman dan barang kosong secara cepat, terstruktur dan terkontrol."
        actions={pic ? <span className={styles.picChip}>PIC: {pic}</span> : null}
      />
      <div className={styles.resolutionTabs}>{TABS.map(([id, label]) => <button key={id} className={activeTab === id ? styles.active : ''} onClick={() => setActiveTab(id)}>{label}</button>)}</div>
      <StatusMessage status={status} />

      {activeTab === 'registration' ? (
        <>
          <section className={styles.resolutionSummary}>
            <label><span>DATE FROM</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
            <label><span>DATE TO</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
            <button className={styles.primaryButton} onClick={loadCases}>Apply Summary</button>
            <div><span>KASUS</span><strong>{cases.length}</strong><p>Akumulasi kasus dalam periode tanggal yang dipilih.</p></div>
            <div><span>WARNING H-1</span><strong>{stats.warning}</strong><p>Kasus yang mendekati deadline retur.</p></div>
            <div><span>OVERDUE</span><strong>{stats.overdue}</strong><p>Kasus yang sudah melewati batas retur.</p></div>
            <div><span>INTERNAL / EXTERNAL</span><strong>{stats.internal} / {stats.external}</strong><p>Komposisi tipe kasus aktif.</p></div>
          </section>

          <section className={styles.resolutionGrid}>
            <article className={styles.formPanel}>
              <div className={styles.panelHeader}><h2>INPUT NEW CASE</h2><span>Case Overview</span></div>
              <div className={styles.panelBody}>
                <div className={styles.caseCode}><span>KODE KEJADIAN</span><strong>{caseCode}</strong></div>
                <div className={styles.formGrid}>
                  <label><span>TANGGAL PENGAJUAN</span><input type="date" value={returnForm.tanggal_pengajuan} onChange={(event) => setReturnForm({ ...returnForm, tanggal_pengajuan: event.target.value, batas_tanggal_retur: addDays(event.target.value, 14) })} /></label>
                  <label><span>BATAS TANGGAL RETUR</span><input type="date" value={returnForm.batas_tanggal_retur} onChange={returnField('batas_tanggal_retur')} /></label>
                  <div className={styles.fullField}><span className={styles.fieldTitle}>GROUP ORDER</span><div className={styles.choicePills}>{GROUPS.map((group) => <button key={group} className={returnForm.group_order === group ? styles.active : ''} onClick={() => setReturnForm({ ...returnForm, group_order: group })}>{group}</button>)}</div></div>
                  <div className={styles.fullField}><span className={styles.fieldTitle}>INTERNAL / EXTERNAL</span><div className={styles.choicePills}>{['Internal', 'External'].map((type) => <button key={type} className={returnForm.internal_external === type ? styles.active : ''} onClick={() => setReturnForm({ ...returnForm, internal_external: type })}>{type}</button>)}</div></div>
                  <label><span>ORDER ID*</span><input value={returnForm.order_id} onChange={returnField('order_id')} /></label>
                  <label><span>NAMA CUST*</span><input value={returnForm.nama_customer} onChange={returnField('nama_customer')} /></label>
                  <label><span>NO HP*</span><input value={returnForm.no_handphone} onChange={returnField('no_handphone')} /></label>
                  <label><span>NO RESI PENGIRIMAN*</span><input value={returnForm.no_resi_pengiriman} onChange={returnField('no_resi_pengiriman')} /></label>
                  <label className={styles.fullField}><span>ALAMAT*</span><textarea value={returnForm.alamat} onChange={returnField('alamat')} /></label>
                  <label><span>ALASAN RETUR*</span><select value={returnForm.retur_reason} onChange={returnField('retur_reason')}><option value="">PILIH ALASAN</option>{masters.reasons.filter((item) => !item.reasoning_type || item.reasoning_type.toLowerCase() === returnForm.internal_external.toLowerCase()).map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
                  <label><span>TINDAK LANJUT*</span><select value={returnForm.retur_action} onChange={returnField('retur_action')}><option value="">PILIH TINDAK LANJUT</option>{masters.actions.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
                  <label className={styles.fullField}><span>PRODUK YANG DIRETUR / BERMASALAH</span><textarea placeholder="> " value={returnForm.produk_diretur} onChange={returnField('produk_diretur')} /></label>
                  <label className={styles.fullField}><span>PRODUK PENGGANTI</span><textarea placeholder="> " value={returnForm.produk_pengganti} onChange={returnField('produk_pengganti')} /></label>
                  <label><span>EKSPEDISI PENGIRIMAN</span><select value={returnForm.courier_name} onChange={(event) => setReturnForm({ ...returnForm, courier_name: event.target.value, courier_service: '' })}><option value="">PILIH EKSPEDISI</option>{masters.couriers.map((item) => <option key={item.id}>{item.nama}</option>)}</select></label>
                  <label><span>LAYANAN PENGIRIMAN</span><select value={returnForm.courier_service} onChange={returnField('courier_service')}><option value="">PILIH LAYANAN</option>{serviceOptions.map((item) => <option key={item.id}>{item.courier_service}</option>)}</select></label>
                  {[['ongkir_masuk','ONGKIR MASUK'],['ongkir_keluar','ONGKIR KELUAR'],['nilai_refund_kompensasi','NILAI KERUGIAN'],['total_retur','NILAI BARANG RETUR']].map(([key,label]) => <label key={key}><span>{label}</span><input inputMode="numeric" value={returnForm[key]} onChange={returnField(key)} /></label>)}
                  <label className={styles.fullField}><span>KETERANGAN TAMBAHAN INTERNAL</span><textarea value={returnForm.keterangan_tambahan} onChange={returnField('keterangan_tambahan')} /></label>
                  <label className={styles.fullField}><span>NOTES KONSUMEN</span><textarea value={returnForm.note_konsumen} onChange={returnField('note_konsumen')} /></label>
                  <div className={styles.fullField}><span className={styles.fieldTitle}>STATUS AKTIF</span><div className={styles.choicePills}>{['Pending','Sending','Cancel'].map((item) => <button key={item} className={returnForm.status_barang === item ? styles.active : ''} onClick={() => setReturnForm({ ...returnForm, status_barang: item })}>{item}</button>)}</div></div>
                  <label className={`${styles.checkboxField} ${styles.fullField}`}><input type="checkbox" checked={returnForm.need_prioritized} onChange={returnField('need_prioritized')} /><span>Kasus dengan perhatian khusus</span></label>
                </div>
                <div className={styles.formActions}><button className={styles.primaryButton} disabled={busy} onClick={saveReturn}>{busy ? 'Saving...' : 'Save'}</button><button className={styles.softButton} onClick={() => setReturnForm(blankReturn(today))}>Reset Form</button></div>
              </div>
            </article>

            <article className={styles.tablePanel}>
              <div className={styles.panelHeader}><h2>CASE LISTS</h2><span>{visibleCases.length} Rows</span></div>
              <div className={styles.panelBody}>
                <div className={styles.databaseFilter}>
                  <label><span>GROUP</span><select value={filters.group} onChange={(event) => setFilters({ ...filters, group: event.target.value })}><option value="">SEMUA GROUP</option>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
                  <label className={styles.searchField}><span>SEARCH</span><input placeholder="Cari kode kejadian, order ID, no resi, atau nama customer" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
                  <button className={styles.softButton} onClick={loadCases}>Refresh</button>
                </div>
                <div className={styles.tableWrap}><table><thead><tr><th>Tanggal</th><th>Kode</th><th>Group</th><th>Tipe</th><th>Customer</th><th>Order ID</th><th>No Resi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
                  {!visibleCases.length ? <tr><td colSpan="9"><EmptyState /></td></tr> : visibleCases.map((row) => <tr key={row.id}><td>{formatDate(row.tanggal_pengajuan)}</td><td><strong>{row.kode_kejadian}</strong></td><td>{row.group_order}</td><td>{row.internal_external}</td><td>{row.nama_customer}</td><td>{row.order_id}</td><td>{row.no_resi_pengiriman}</td><td><span className={styles.statusBadge}>{row.status_barang}</span></td><td><button className={styles.editButton} onClick={() => setDetail(row)}>Detail</button></td></tr>)}
                </tbody></table></div>
              </div>
            </article>
          </section>
        </>
      ) : null}

      {activeTab === 'receiving' ? (
        <section className={styles.dataCard}>
          <div className={styles.cardTitleRow}><div><h2>RECEIVING CONFIRMATION</h2><p className={styles.cardHint}>Case berstatus Sending dapat dikonfirmasi saat barang sudah diterima.</p></div><button className={styles.softButton} onClick={loadCases}>Refresh</button></div>
          <div className={styles.tableWrap}><table><thead><tr><th>Kode</th><th>Customer</th><th>No Resi</th><th>Courier</th><th>Deadline</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
            {!cases.filter((row) => ['Sending','Completed'].includes(row.status_barang)).length ? <tr><td colSpan="7"><EmptyState /></td></tr> : cases.filter((row) => ['Sending','Completed'].includes(row.status_barang)).map((row) => <tr key={row.id}><td><strong>{row.kode_kejadian}</strong></td><td>{row.nama_customer}</td><td>{row.no_resi_pengiriman}</td><td>{row.courier_name || '-'}</td><td>{formatDate(row.batas_tanggal_retur)}</td><td>{row.status_barang}</td><td>{row.status_barang === 'Sending' ? <button className={styles.primaryButton} onClick={() => updateStatus(row, 'Completed')}>Complete</button> : <button className={styles.editButton} onClick={() => setDetail(row)}>Detail</button>}</td></tr>)}
          </tbody></table></div>
        </section>
      ) : null}

      {activeTab === 'issues' ? (
        <section className={styles.resolutionGrid}>
          <article className={styles.formPanel}><div className={styles.panelHeader}><h2>INPUT ORDER ISSUE</h2><span>PIC {pic || '-'}</span></div><div className={styles.panelBody}><div className={styles.formGrid}>
            <label><span>GROUP ORDER</span><select value={issueForm.group_order} onChange={issueField('group_order')}>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
            <label><span>ORDER ID*</span><input value={issueForm.order_id} onChange={issueField('order_id')} /></label>
            <label><span>NAMA*</span><input value={issueForm.nama} onChange={issueField('nama')} /></label>
            <label><span>NO HP</span><input value={issueForm.no_hp} onChange={issueField('no_hp')} /></label>
            <label className={styles.fullField}><span>PRODUK BERMASALAH</span><textarea value={issueForm.produk_bermasalah} onChange={issueField('produk_bermasalah')} /></label>
            <label><span>ALASAN BERMASALAH*</span><select value={issueForm.alasan_bermasalah} onChange={issueField('alasan_bermasalah')}><option value="">PILIH ALASAN</option>{masters.issueReasons.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
            <label><span>TINDAK LANJUT*</span><select value={issueForm.tindak_lanjut} onChange={issueField('tindak_lanjut')}><option value="">PILIH PENANGANAN</option>{masters.issueActions.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
            <label className={styles.fullField}><span>PRODUK PENGGANTI</span><textarea value={issueForm.produk_pengganti} onChange={issueField('produk_pengganti')} /></label>
            <label><span>TIM</span><input value={issueForm.tim} onChange={issueField('tim')} /></label>
            <label><span>BIAYA TIMBUL</span><input value={issueForm.biaya_timbul} onChange={issueField('biaya_timbul')} /></label>
            <label className={styles.fullField}><span>KETERANGAN</span><textarea value={issueForm.keterangan} onChange={issueField('keterangan')} /></label>
          </div><div className={styles.formActions}><button className={styles.primaryButton} disabled={busy} onClick={saveIssue}>Save</button><button className={styles.softButton} onClick={() => setIssueForm(blankIssue())}>Reset</button></div></div></article>
          <article className={styles.tablePanel}><div className={styles.panelHeader}><h2>ORDER ISSUE LIST</h2><span>{issues.length} Rows</span></div><div className={styles.panelBody}><div className={styles.tableWrap}><table><thead><tr><th>Tanggal</th><th>Group</th><th>Order ID</th><th>Nama</th><th>Issue</th><th>Handling</th><th>PIC</th></tr></thead><tbody>{!issues.length ? <tr><td colSpan="7"><EmptyState /></td></tr> : issues.map((row) => <tr key={row.id}><td>{formatDate(row.created_at)}</td><td>{row.group_order}</td><td><strong>{row.order_id}</strong></td><td>{row.nama}</td><td>{row.alasan_bermasalah}</td><td>{row.tindak_lanjut}</td><td>{row.pic}</td></tr>)}</tbody></table></div></div></article>
        </section>
      ) : null}

      {activeTab === 'search' ? (
        <section className={styles.dataCard}><div className={styles.cardTitleRow}><div><h2>PRODUCT SEARCH</h2><p className={styles.cardHint}>Cari produk, customer, atau Order ID dari case retur dan order issue.</p></div></div><label className={styles.bigSearch}><span>SEARCH</span><input autoFocus placeholder="Ketik nama produk, customer, atau Order ID" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></label><div className={styles.searchResults}>{!productSearch ? <EmptyState label="Masukkan kata pencarian." /> : !searchResults.length ? <EmptyState label="Data tidak ditemukan." /> : searchResults.map((result, index) => <button key={`${result.type}-${index}`} onClick={() => setDetail(result.row)}><span>{result.type}</span><strong>{result.title}</strong><small>{result.subtitle}</small></button>)}</div></section>
      ) : null}

      <Modal open={!pic} title="PIC Entry" description="Masukkan inisial PIC sebelum menggunakan halaman ini." actions={<><button className={styles.softButton} onClick={() => setStatus({ type: 'warning', message: 'Inisial PIC diperlukan untuk menyimpan perubahan.' })}>Cancel</button><button className={styles.primaryButton} onClick={() => picInput.trim() && setPic(picInput.trim().toUpperCase())}>Submit</button></>}>
        <label className={styles.modalField}><span>INISIAL PIC</span><input autoFocus placeholder="MISAL: ADS / RY / FN" value={picInput} onChange={(event) => setPicInput(event.target.value.toUpperCase())} /></label>
      </Modal>

      <Modal open={Boolean(detail)} title={detail?.kode_kejadian ? `Case ${detail.kode_kejadian}` : `Order ${detail?.order_id || ''}`} description={detail?.nama_customer || detail?.nama || ''} onClose={() => setDetail(null)} actions={<button className={styles.softButton} onClick={() => setDetail(null)}>Tutup</button>}>
        {detail ? <div className={styles.detailGrid}>{Object.entries(detail).filter(([, value]) => value !== null && value !== '').slice(0, 18).map(([key, value]) => <div key={key}><span>{key.replaceAll('_',' ')}</span><strong>{typeof value === 'boolean' ? (value ? 'Ya' : 'Tidak') : String(value)}</strong></div>)}</div> : null}
      </Modal>
    </div>
  )
}
