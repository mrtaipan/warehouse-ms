'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { deliverySupabase } from '@/lib/delivery-supabase'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import { EmptyState, Modal, ModuleHeader, StatusMessage } from './delivery-report-client'
import { GROUPS, safeNumber, todayIso } from './delivery-report-helpers'
import styles from './delivery-report.module.css'

const CREATED_BY_COLUMNS = ['created_by', 'created by']
const UPDATED_BY_COLUMNS = ['update_by', 'updated_by', 'update by', 'updated by']

const blankForm = (date) => ({
  delivery_date: date,
  group_order: '',
  delivery_category: '',
  channel: '',
  courier: '',
  quantity: '',
  keterangan: '',
})

function isColumnLookupError(error) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return error?.code === 'PGRST204' || text.includes('schema cache') || text.includes('could not find')
}

async function insertOrderWithAudit(payload, actorName) {
  let lastError = null

  for (const createdByColumn of CREATED_BY_COLUMNS) {
    for (const updatedByColumn of UPDATED_BY_COLUMNS) {
      const result = await deliverySupabase.from('Delivery_Order').insert({
        ...payload,
        [createdByColumn]: actorName,
        [updatedByColumn]: actorName,
      })

      if (!result.error) return result
      if (!isColumnLookupError(result.error)) return result
      lastError = result.error
    }
  }

  return { error: lastError }
}

async function updateOrderWithAudit(id, payload, actorName) {
  let lastError = null

  for (const updatedByColumn of UPDATED_BY_COLUMNS) {
    const result = await deliverySupabase
      .from('Delivery_Order')
      .update({ ...payload, [updatedByColumn]: actorName })
      .eq('id', id)

    if (!result.error) return result
    if (!isColumnLookupError(result.error)) return result
    lastError = result.error
  }

  return { error: lastError }
}

export default function DeliveryOrder() {
  const supabase = useMemo(() => createClient(), [])
  const today = useMemo(() => todayIso(), [])
  const [form, setForm] = useState(blankForm(today))
  const [filters, setFilters] = useState({ date: today, group: '', category: '', channel: '', courier: '' })
  const [rows, setRows] = useState([])
  const [masters, setMasters] = useState({ categories: [], channels: [], couriers: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [deleteRow, setDeleteRow] = useState(null)
  const [masterModal, setMasterModal] = useState(null)
  const [masterName, setMasterName] = useState('')

  const loadMasters = useCallback(async () => {
    const [categoryResult, channelResult, courierResult] = await Promise.all([
      deliverySupabase.from('Delivery_Kategori').select('*').neq('is_active', false).order('nama'),
      deliverySupabase.from('Delivery_Channel').select('*').neq('is_active', false).order('nama'),
      deliverySupabase.from('Delivery_Courier').select('*').neq('is_active', false).order('nama'),
    ])
    const error = categoryResult.error || channelResult.error || courierResult.error
    if (error) setStatus({ type: 'error', message: `Gagal memuat master data: ${error.message}` })
    setMasters({
      categories: categoryResult.data || [],
      channels: channelResult.data || [],
      couriers: courierResult.data || [],
    })
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    let query = deliverySupabase
      .from('Delivery_Order')
      .select('*')
      .eq('delivery_date', filters.date)
      .order('id', { ascending: false })
    if (filters.group) query = query.eq('group_order', filters.group)
    if (filters.category) query = query.eq('delivery_category', filters.category)
    if (filters.channel) query = query.eq('channel', filters.channel)
    if (filters.courier) query = query.eq('courier', filters.courier)
    const { data, error } = await query
    if (error) setStatus({ type: 'error', message: `Gagal memuat Delivery Order: ${error.message}` })
    else {
      const orderedRows = [...(data || [])].sort((first, second) => {
        const firstGroup = GROUPS.indexOf(first.group_order)
        const secondGroup = GROUPS.indexOf(second.group_order)
        const firstOrder = firstGroup === -1 ? GROUPS.length : firstGroup
        const secondOrder = secondGroup === -1 ? GROUPS.length : secondGroup
        if (firstOrder !== secondOrder) return firstOrder - secondOrder
        return safeNumber(second.id) - safeNumber(first.id)
      })
      setRows(orderedRows)
    }
    setLoading(false)
  }, [filters])

  useEffect(() => {
    const timer = window.setTimeout(loadMasters, 0)
    return () => window.clearTimeout(timer)
  }, [loadMasters])

  useEffect(() => {
    const timer = window.setTimeout(loadRows, 0)
    return () => window.clearTimeout(timer)
  }, [loadRows])

  const totalQuantity = rows.reduce((sum, row) => sum + safeNumber(row.quantity), 0)
  const nextPart = useMemo(() => {
    if (!form.delivery_date || !form.group_order || !form.delivery_category || !form.courier) return null
    const matches = rows.filter(
      (row) =>
        row.delivery_date === form.delivery_date &&
        row.group_order === form.group_order &&
        row.delivery_category === form.delivery_category &&
        row.courier === form.courier
    )
    return Math.max(0, ...matches.map((row) => safeNumber(row.part_no))) + 1
  }, [form, rows])

  async function getActorDisplayName() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) throw error
    if (!user) throw new Error('User session tidak ditemukan.')

    const { data: profile, error: profileError } = await getProfileByAuthenticatedUser(supabase, user, 'display_name')
    if (profileError) throw profileError

    const metadataName =
      String(user.user_metadata?.display_name || '').trim() ||
      String(user.user_metadata?.full_name || '').trim() ||
      String(user.user_metadata?.name || '').trim()
    const displayName = String(profile?.display_name || metadataName).trim()

    if (!displayName) throw new Error('Display name user tidak ditemukan. Lengkapi profile terlebih dahulu.')
    return displayName
  }

  async function saveOrder() {
    if (!form.delivery_date || !form.group_order || !form.delivery_category || !form.channel || !form.courier || !safeNumber(form.quantity)) {
      setStatus({ type: 'error', message: 'Lengkapi tanggal, group, kategori, channel, ekspedisi, dan quantity.' })
      return
    }
    setSaving(true)
    try {
      const actorName = await getActorDisplayName()
      const { error } = await insertOrderWithAudit(
        {
          ...form,
          quantity: safeNumber(form.quantity),
          part_no: nextPart || 1,
          updated_time: new Date().toISOString(),
        },
        actorName
      )
      if (error) setStatus({ type: 'error', message: `Gagal menyimpan: ${error.message}` })
      else {
        setStatus({ type: 'success', message: 'Delivery Order berhasil disimpan.' })
        setForm(blankForm(form.delivery_date))
        await loadRows()
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Gagal membaca profile user.' })
    } finally {
      setSaving(false)
    }
  }

  async function saveMaster() {
    const name = masterName.trim().toUpperCase()
    if (!name || !masterModal) return
    const config = {
      category: ['Delivery_Kategori', 'categories'],
      channel: ['Delivery_Channel', 'channels'],
      courier: ['Delivery_Courier', 'couriers'],
    }[masterModal]
    const { error } = await deliverySupabase.from(config[0]).insert({ nama: name, is_active: true })
    if (error) setStatus({ type: 'error', message: `Gagal menambah master: ${error.message}` })
    else {
      setStatus({ type: 'success', message: `${name} berhasil ditambahkan.` })
      await loadMasters()
      setMasterModal(null)
      setMasterName('')
    }
  }

  async function updateOrder() {
    if (!editRow) return
    try {
      const actorName = await getActorDisplayName()
      const { error } = await updateOrderWithAudit(
        editRow.id,
        { quantity: safeNumber(editRow.quantity), keterangan: editRow.keterangan || '', updated_time: new Date().toISOString() },
        actorName
      )
      if (error) setStatus({ type: 'error', message: `Gagal update: ${error.message}` })
      else {
        setStatus({ type: 'success', message: 'Data database berhasil diperbarui.' })
        setEditRow(null)
        await loadRows()
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Gagal membaca profile user.' })
    }
  }

  async function removeOrder() {
    if (!deleteRow) return
    const { error } = await deliverySupabase.from('Delivery_Order').delete().eq('id', deleteRow.id)
    if (error) setStatus({ type: 'error', message: `Gagal menghapus: ${error.message}` })
    else {
      setStatus({ type: 'success', message: 'Data database berhasil dihapus.' })
      setDeleteRow(null)
      await loadRows()
    }
  }

  const field = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const groupClass = (group) =>
    ({
      ARKLINE: styles.groupBadgeArkline,
      MOB: styles.groupBadgeMob,
      OI: styles.groupBadgeOi,
    }[group] || '')

  return (
    <div className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Delivery Report • Admin Input"
        title="Delivery Order"
        subtitle="Enter daily delivery targets and save them directly to the database."
      />
      <StatusMessage status={status} />

      <section className={styles.splitBoard}>
        <article className={styles.formPanel}>
          <div className={styles.panelHeader}><h2>INPUT FORM</h2></div>
          <div className={styles.panelBody}>
            <div className={styles.miniMetrics}>
              <div><span>ROWS</span><strong>{rows.length}</strong></div>
              <div><span>TOTAL QTY</span><strong>{totalQuantity}</strong></div>
            </div>
            <h3 className={styles.sectionLabel}>DELIVERY ORDER DATA</h3>
            <div className={styles.formGrid}>
              <label><span>TANGGAL</span><input type="date" value={form.delivery_date} onChange={field('delivery_date')} /></label>
              <label><span>GROUP ORDER</span><select value={form.group_order} onChange={field('group_order')}><option value="">PILIH GROUP</option>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
              <label className={styles.fullField}>
                <span>KATEGORI DELIVERY</span>
                <div className={styles.inputWithAction}><select value={form.delivery_category} onChange={field('delivery_category')}><option value="">PILIH KATEGORI DELIVERY</option>{masters.categories.map((item) => <option key={item.id}>{item.nama}</option>)}</select><button onClick={() => setMasterModal('category')}>+ Add</button></div>
              </label>
              <label className={styles.fullField}>
                <span>CHANNEL</span>
                <div className={styles.inputWithAction}><select value={form.channel} onChange={field('channel')}><option value="">PILIH CHANNEL</option>{masters.channels.map((item) => <option key={item.id}>{item.nama}</option>)}</select><button onClick={() => setMasterModal('channel')}>+ Add</button></div>
              </label>
              <label className={styles.fullField}>
                <span>EKSPEDISI</span>
                <div className={styles.inputWithAction}><select value={form.courier} onChange={field('courier')}><option value="">PILIH EKSPEDISI</option>{masters.couriers.map((item) => <option key={item.id}>{item.nama}</option>)}</select><button onClick={() => setMasterModal('courier')}>+ Add</button></div>
              </label>
              <div className={`${styles.partPreview} ${styles.fullField}`}><span>NOMOR PART <small>AUTO ITERATION</small></span><strong>{nextPart ? `Part ${nextPart}` : '-'}</strong><p>{nextPart ? 'Nomor part siap dibuat otomatis.' : 'Pilih tanggal, group order, kategori, dan ekspedisi.'}</p></div>
              <label className={styles.fullField}><span>QUANTITY</span><input type="number" min="1" placeholder="MASUKKAN QUANTITY" value={form.quantity} onChange={field('quantity')} /></label>
              <label className={styles.fullField}><span>KETERANGAN</span><textarea placeholder="JIKA ADA MASUKKAN KETERANGAN TAMBAHAN" value={form.keterangan} onChange={field('keterangan')} /></label>
            </div>
            <div className={styles.formActions}>
              <button className={styles.softButton} onClick={() => setForm(blankForm(form.delivery_date))}>Clear Form</button>
              <button className={styles.primaryButton} disabled={saving} onClick={saveOrder}>{saving ? 'Saving...' : 'Save to Database'}</button>
            </div>
          </div>
        </article>

        <article className={styles.tablePanel}>
          <div className={styles.panelHeader}><h2>DELIVERY ORDERS</h2></div>
          <div className={styles.panelBody}>
            <div className={styles.databaseFilter}>
              <label><span>TANGGAL</span><input type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} /></label>
              <label><span>GROUP</span><select value={filters.group} onChange={(event) => setFilters({ ...filters, group: event.target.value })}><option value="">SEMUA GROUP</option>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
              <label><span>KATEGORI</span><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">SEMUA KATEGORI</option>{masters.categories.map((item) => <option key={item.id}>{item.nama}</option>)}</select></label>
              <label><span>CHANNEL</span><select value={filters.channel} onChange={(event) => setFilters({ ...filters, channel: event.target.value })}><option value="">SEMUA CHANNEL</option>{masters.channels.map((item) => <option key={item.id}>{item.nama}</option>)}</select></label>
              <label><span>COURIER</span><select value={filters.courier} onChange={(event) => setFilters({ ...filters, courier: event.target.value })}><option value="">SEMUA COURIER</option>{masters.couriers.map((item) => <option key={item.id}>{item.nama}</option>)}</select></label>
              <button className={styles.softButton} aria-label="Refresh delivery orders" title="Refresh" onClick={loadRows}>↻</button>
            </div>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Tanggal</th><th>Group</th><th>Kategori</th><th>Channel</th><th>Courier</th><th>Part</th><th>Qty</th><th>Note</th><th>Action</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan="9"><EmptyState label="Loading data..." /></td></tr> : null}
                  {!loading && !rows.length ? <tr><td colSpan="9"><EmptyState /></td></tr> : null}
                  {!loading ? rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.delivery_date}</td><td><span className={`${styles.groupBadge} ${groupClass(row.group_order)}`}>{row.group_order}</span></td><td>{row.delivery_category}</td><td>{row.channel}</td><td>{row.courier}</td><td><strong>Part {row.part_no || 1}</strong></td><td><strong>{row.quantity}</strong></td><td>{row.keterangan ? <span className={styles.noteBadge} title={row.keterangan} aria-label={`Note: ${row.keterangan}`}>ⓘ</span> : '-'}</td>
                      <td><div className={styles.rowActions}><button className={styles.editButton} aria-label="Edit order" title="Edit" onClick={() => setEditRow({ ...row })}>✎</button><button className={styles.deleteButton} aria-label="Delete order" title="Delete" onClick={() => setDeleteRow(row)}>×</button></div></td>
                    </tr>
                  )) : null}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </section>

      <Modal
        open={Boolean(masterModal)}
        title={`Tambah ${masterModal === 'category' ? 'Kategori Delivery' : masterModal === 'channel' ? 'Channel' : 'Ekspedisi'}`}
        description="Tambahkan opsi baru ke database master."
        onClose={() => setMasterModal(null)}
        actions={<><button className={styles.softButton} onClick={() => setMasterModal(null)}>Batal</button><button className={styles.primaryButton} onClick={saveMaster}>Simpan</button></>}
      >
        <label className={styles.modalField}><span>NAMA</span><input autoFocus placeholder="MASUKKAN NAMA BARU" value={masterName} onChange={(event) => setMasterName(event.target.value)} /></label>
      </Modal>

      <Modal
        open={Boolean(editRow)}
        title="Edit Data Database"
        description={editRow ? `Update quantity untuk ${editRow.group_order} • ${editRow.channel} • Part ${editRow.part_no || 1}.` : ''}
        onClose={() => setEditRow(null)}
        actions={<><button className={styles.softButton} onClick={() => setEditRow(null)}>Batal</button><button className={styles.primaryButton} onClick={updateOrder}>Save</button></>}
      >
        <label className={styles.modalField}><span>QUANTITY BARU</span><input type="number" value={editRow?.quantity || ''} onChange={(event) => setEditRow({ ...editRow, quantity: event.target.value })} /></label>
        <label className={styles.modalField}><span>KETERANGAN</span><textarea value={editRow?.keterangan || ''} onChange={(event) => setEditRow({ ...editRow, keterangan: event.target.value })} /></label>
      </Modal>

      <Modal
        open={Boolean(deleteRow)}
        title="Hapus Data Database"
        description="Yakin mau hapus data database ini?"
        onClose={() => setDeleteRow(null)}
        actions={<><button className={styles.softButton} onClick={() => setDeleteRow(null)}>Batal</button><button className={styles.primaryButton} onClick={removeOrder}>Ya, Hapus</button></>}
      >
        <p>{deleteRow ? `${deleteRow.group_order} • ${deleteRow.channel} • Part ${deleteRow.part_no || 1} • Qty ${deleteRow.quantity}` : ''}</p>
      </Modal>
    </div>
  )
}
