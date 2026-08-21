'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { deliverySupabase } from '@/lib/delivery-supabase'
import { EmptyState, Modal, ModuleHeader, StatusMessage } from './delivery-report-client'
import { formatDate, inferCourier } from './delivery-report-helpers'
import styles from './delivery-report.module.css'

const PACKING_TEAMS = ['TIM 1', 'TIM 2', 'TIM 3', 'INSTANT PACKER']
const DELIVERY_GROUPS = ['MOB', 'ARKLINE', 'OI']

function beep(frequency, duration = 80) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = frequency
    gain.gain.value = 0.06
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    window.setTimeout(() => {
      oscillator.stop()
      context.close()
    }, duration)
  } catch {}
}

export default function BarcodeScanner() {
  const inputRef = useRef(null)
  const [phase, setPhase] = useState('PACKING')
  const [team, setTeam] = useState('TIM 2')
  const [group, setGroup] = useState('MOB')
  const [barcode, setBarcode] = useState('')
  const [rows, setRows] = useState([])
  const [rules, setRules] = useState([])
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [searchResult, setSearchResult] = useState(null)

  useEffect(() => {
    deliverySupabase
      .from('Barcode_Rules')
      .select('*')
      .eq('is_active', true)
      .order('priority')
      .then(({ data }) => setRules(data || []))
  }, [])

  const switchPhase = (next) => {
    if (phase === next || busy) return
    setPhase(next)
    setRows([])
    setSelected(null)
    setStatus({ type: 'info', message: `Queue direset karena phase diganti ke ${next}.` })
    inputRef.current?.focus()
  }

  function addBarcode() {
    const normalized = barcode.trim().toUpperCase()
    if (!normalized || busy) return
    if (rows.some((row) => row.barcode === normalized && row.phase === phase)) {
      setStatus({ type: 'error', message: `DUPLICATE dalam sesi ini: ${normalized} (${phase})` })
      beep(180, 120)
      return
    }
    const info = phase === 'PACKING' ? team : group
    setRows((current) => [
      {
        id: `${Date.now()}-${normalized}`,
        timestamp: new Date().toISOString(),
        barcode: normalized,
        phase,
        info,
        group: phase === 'DELIVERY' ? group : '',
        courier: inferCourier(normalized, rules),
      },
      ...current,
    ])
    setBarcode('')
    setSelected(null)
    setStatus({ type: 'success', message: `Tersimpan ke tabel: ${normalized} (${phase} • ${info})` })
    beep(880)
  }

  const counters = useMemo(() => {
    const labels = phase === 'PACKING' ? ['TIM 1', 'TIM 2', 'TIM 3'] : DELIVERY_GROUPS
    return labels.map((label) => rows.filter((row) => row.phase === phase && (phase === 'PACKING' ? row.info : row.group) === label).length)
  }, [phase, rows])

  async function uploadRows() {
    if (!rows.length) {
      setStatus({ type: 'error', message: 'Tidak ada data untuk di-upload.' })
      beep(180, 120)
      return
    }
    setBusy(true)
    const inserted = []
    const rejected = []
    for (const row of rows) {
      const { data: existing, error: readError } = await deliverySupabase
        .from('Delivery_Barcode')
        .select('*')
        .eq('barcode', row.barcode)
        .maybeSingle()
      if (readError) {
        rejected.push(row.barcode)
        continue
      }
      const duplicate = row.phase === 'PACKING' ? existing?.is_packed : existing?.is_delivered
      if (duplicate) {
        rejected.push(row.barcode)
        continue
      }
      const payload = row.phase === 'PACKING'
        ? {
            barcode: row.barcode,
            timestamp_packing: row.timestamp,
            packing_team: row.info,
            is_packed: true,
            courier: existing?.courier || row.courier,
            is_defined: Boolean(existing?.courier || row.courier),
          }
        : {
            barcode: row.barcode,
            timestamp_delivery: row.timestamp,
            group_order: row.group,
            is_delivered: true,
            courier: existing?.courier || row.courier,
            is_defined: Boolean(existing?.courier || row.courier),
          }
      const query = existing
        ? deliverySupabase.from('Delivery_Barcode').update(payload).eq('barcode', row.barcode)
        : deliverySupabase.from('Delivery_Barcode').insert(payload)
      const { error } = await query
      if (error) rejected.push(row.barcode)
      else inserted.push(row.barcode)
    }
    setRows((current) => current.filter((row) => !inserted.includes(row.barcode)))
    setSelected(null)
    setBusy(false)
    const message = inserted.length
      ? `Upload berhasil (${inserted.length} barcode).${rejected.length ? ` Ditolak: ${rejected.join(', ')}` : ''}`
      : `Upload gagal. Ditolak: ${rejected.join(', ')}`
    setStatus({ type: inserted.length && !rejected.length ? 'success' : inserted.length ? 'warning' : 'error', message })
    beep(inserted.length ? 880 : 180, 120)
    inputRef.current?.focus()
  }

  async function cancelRows() {
    setCancelOpen(false)
    setBusy(true)
    const barcodes = rows.map((row) => row.barcode)
    const { data, error } = await deliverySupabase.from('Delivery_Barcode').delete().in('barcode', barcodes).select('barcode')
    const deleted = (data || []).map((row) => row.barcode)
    setRows((current) => current.filter((row) => !deleted.includes(row.barcode)))
    setBusy(false)
    setStatus(error
      ? { type: 'error', message: `Cancel error: ${error.message}` }
      : { type: 'success', message: `Cancel berhasil (${deleted.length} barcode).` })
  }

  async function searchBarcode() {
    const normalized = barcode.trim().toUpperCase()
    if (!normalized) {
      setStatus({ type: 'error', message: 'Isi barcode dulu untuk search.' })
      return
    }
    setBusy(true)
    const { data, error } = await deliverySupabase.from('Delivery_Barcode').select('*').eq('barcode', normalized).maybeSingle()
    setBusy(false)
    if (error || !data) {
      setSearchResult({ found: false, text: error ? error.message : 'Barcode tidak ditemukan di database.' })
      return
    }
    const lines = [
      data.timestamp_packing
        ? `Telah discan packing pada ${formatDate(data.timestamp_packing, { time: true, short: true })}${data.packing_team ? ` oleh ${data.packing_team}` : ''}`
        : 'Belum discan packing.',
      data.timestamp_delivery
        ? `Telah discan delivery pada ${formatDate(data.timestamp_delivery, { time: true, short: true })}`
        : 'Belum discan delivery.',
    ]
    setSearchResult({ found: true, text: `Ditemukan barcode: ${data.barcode}\n\n${lines.join('\n')}` })
  }

  return (
    <div className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Delivery Report • Barcode Scanner"
        title="Barcode Scanner"
        subtitle="Pilih phase, lalu scan barcode. Packing memakai tim, delivery memakai group."
      />

      <section className={styles.scannerBoard}>
        <article className={styles.scannerPanel}>
          <div className={styles.panelHeader}><h2>CONTROL PANEL</h2><span>Scan & action</span></div>
          <div className={styles.panelBody}>
            <h3 className={styles.sectionLabel}>PHASE</h3>
            <div className={styles.choiceGrid}>
              {['PACKING', 'DELIVERY'].map((item) => <button disabled={busy} key={item} onClick={() => switchPhase(item)} className={phase === item ? styles.selectedChoiceDark : ''}><span>{item}</span><i /></button>)}
            </div>
            <h3 className={styles.sectionLabel}>{phase === 'PACKING' ? 'SELECT TEAM' : 'SELECT GROUP'}</h3>
            <div className={styles.choiceGrid}>
              {(phase === 'PACKING' ? PACKING_TEAMS : DELIVERY_GROUPS).map((item) => {
                const active = phase === 'PACKING' ? team === item : group === item
                return <button disabled={busy} key={item} onClick={() => phase === 'PACKING' ? setTeam(item) : setGroup(item)} className={active ? styles.selectedChoice : ''}><span>{item}</span><i /></button>
              })}
            </div>

            <div className={styles.scannerInputCard}>
              <div className={styles.activePills}><span>● {phase}</span><span>● {phase === 'PACKING' ? team : group}</span></div>
              <p>Barcode scanner akan mengikuti phase {phase} dan {phase === 'PACKING' ? 'TIM' : 'GROUP'} yang sedang aktif.</p>
              <label><span>BARCODE INPUT</span><input ref={inputRef} autoFocus inputMode="none" autoComplete="off" placeholder="Scan barcode here..." value={barcode} onChange={(event) => setBarcode(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === 'Enter' && addBarcode()} /></label>
              <div className={styles.scannerActions}>
                <button className={styles.dangerButton} disabled={selected == null || busy} onClick={() => { setRows(rows.filter((row) => row.id !== selected)); setSelected(null) }}>Erase Selected</button>
                <button className={styles.softButton} disabled={busy} onClick={() => { setRows([]); setSelected(null); setStatus({ type: 'info', message: 'Tabel dikosongkan.' }) }}>Clear Table</button>
                <button className={styles.uploadButton} disabled={busy} onClick={uploadRows}>{busy ? 'Working...' : 'Upload'}</button>
                <button className={styles.dangerButton} disabled={busy} onClick={() => rows.length ? setCancelOpen(true) : setStatus({ type: 'error', message: 'Tidak ada data untuk di-cancel.' })}>Cancel Order</button>
                <button className={styles.softButton} disabled={busy} onClick={searchBarcode}>{busy ? 'Searching...' : 'Search'}</button>
              </div>
            </div>
            <StatusMessage status={status} />
            <p className={styles.centerHint}>Packing dan Delivery dianggap phase berbeda. Scan phase yang sama dua kali akan ditolak.</p>
          </div>
        </article>

        <article className={styles.scannerPanel}>
          <div className={styles.panelHeader}><h2>MONITORING</h2><span>Live summary & scan queue</span></div>
          <div className={styles.panelBody}>
            <div className={styles.scannerStats}>
              {(phase === 'PACKING' ? ['TIM 1', 'TIM 2', 'TIM 3'] : DELIVERY_GROUPS).map((label, index) => <div key={label}><span>Qty {label}</span><strong>{counters[index]}</strong></div>)}
              <div><span>Total Scan</span><strong>{rows.length}</strong></div>
            </div>
            <div className={styles.queueCard}>
              <div className={styles.cardTitleRow}><h3>SCAN QUEUE</h3><span>Klik row untuk pilih lalu erase jika perlu</span></div>
              <div className={styles.tableWrap}>
                <table><thead><tr><th>Timestamp</th><th>Barcode</th><th>Phase</th><th>Info</th></tr></thead><tbody>
                  {!rows.length ? <tr><td colSpan="4"><EmptyState /></td></tr> : rows.map((row) => <tr key={row.id} onClick={() => setSelected(selected === row.id ? null : row.id)} className={selected === row.id ? styles.selectedRow : ''}><td>{formatDate(row.timestamp, { time: true, short: true })}</td><td><strong>{row.barcode}</strong></td><td>{row.phase}</td><td>{row.info}</td></tr>)}
                </tbody></table>
              </div>
            </div>
          </div>
        </article>
      </section>

      <Modal open={cancelOpen} title="Cancel Order" description={`Yakin mau cancel ${rows.length} barcode ini?`} onClose={() => setCancelOpen(false)} actions={<><button className={styles.softButton} onClick={() => setCancelOpen(false)}>Kembali</button><button className={styles.dangerButton} onClick={cancelRows}>Ya, Cancel Order</button></>} />
      <Modal open={Boolean(searchResult)} title="Search Barcode" onClose={() => setSearchResult(null)} actions={<button className={styles.softButton} onClick={() => setSearchResult(null)}>Tutup</button>}>
        <p className={searchResult?.found ? styles.searchFound : ''}>{searchResult?.text}</p>
      </Modal>
    </div>
  )
}
