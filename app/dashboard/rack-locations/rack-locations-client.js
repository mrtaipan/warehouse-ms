'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import styles from './rack-locations.module.css'

function uniqueValues(rows, field) {
  return [...new Set(rows.map((row) => String(row[field] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

function getWarehouseNumber(locationId) {
  const match = String(locationId || '').match(/\bLV\s*0*(\d+)\b/i)
  return match?.[1] || ''
}

function buildPalletLocationName(form) {
  const warehouseNumber = getWarehouseNumber(form.location_id)
  const parts = ['PL', warehouseNumber, form.location_code, form.sub_location]
  return warehouseNumber && form.location_code && form.sub_location.trim()
    ? parts.join('-')
    : ''
}

export default function RackLocationsClient({ rackLocations, loadError }) {
  const router = useRouter()
  const supabase = createClient()
  const [groupFilter, setGroupFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [collapsedWarehouses, setCollapsedWarehouses] = useState({})
  const [form, setForm] = useState({
    group_code: '',
    location_type: '',
    location_id: '',
    location_code: '',
    location_name: '',
    sub_location: '',
  })

  const groups = useMemo(() => uniqueValues(rackLocations, 'group_code'), [rackLocations])
  const types = useMemo(() => uniqueValues(rackLocations, 'location_type'), [rackLocations])
  const warehouses = useMemo(() => uniqueValues(rackLocations, 'location_id'), [rackLocations])
  const formWarehouses = useMemo(() => uniqueValues(
    rackLocations.filter((row) =>
      (!form.group_code || row.group_code === form.group_code) &&
      (!form.location_type || row.location_type === form.location_type)
    ),
    'location_id'
  ), [rackLocations, form.group_code, form.location_type])
  const locationCodes = useMemo(() => uniqueValues(
    rackLocations.filter((row) =>
      (!form.group_code || row.group_code === form.group_code) &&
      (!form.location_type || row.location_type === form.location_type) &&
      (!form.location_id || row.location_id === form.location_id)
    ),
    'location_code'
  ), [rackLocations, form.group_code, form.location_type, form.location_id])

  const filteredRows = useMemo(() => rackLocations.filter((row) =>
    (!groupFilter || row.group_code === groupFilter) &&
    (!typeFilter || row.location_type === typeFilter)
  ), [rackLocations, groupFilter, typeFilter])

  const warehouseGroups = useMemo(() => {
    const grouped = new Map()
    for (const row of filteredRows) {
      const warehouse = row.location_id || 'Warehouse not set'
      if (!grouped.has(warehouse)) grouped.set(warehouse, [])
      grouped.get(warehouse).push(row)
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  }, [filteredRows])

  function openCreateModal() {
    const firstRow = rackLocations.find((row) => row.location_type === 'PALLET') || rackLocations[0]
    setForm({
      group_code: firstRow?.group_code || groups[0] || '',
      location_type: firstRow?.location_type || types[0] || '',
      location_id: firstRow?.location_id || warehouses[0] || '',
      location_code: firstRow?.location_code || '',
      location_name: '',
      sub_location: '',
    })
    setFormError('')
    setIsModalOpen(true)
  }

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => {
      const next = { ...current, [name]: name === 'sub_location' ? value.toUpperCase() : value }

      if (name === 'group_code') {
        let matchingRows = rackLocations.filter((row) => row.group_code === value)
        if (!matchingRows.some((row) => row.location_type === current.location_type)) {
          next.location_type = matchingRows[0]?.location_type || ''
        }
        matchingRows = matchingRows.filter((row) => row.location_type === next.location_type)
        next.location_id = matchingRows[0]?.location_id || ''
        next.location_code = matchingRows[0]?.location_code || ''
      }

      if (name === 'location_type') {
        let matchingRows = rackLocations.filter((row) => row.location_type === value)
        const currentWarehouseMatch = matchingRows.find((row) =>
          row.group_code === current.group_code && row.location_id === current.location_id
        )
        if (!currentWarehouseMatch && !matchingRows.some((row) => row.group_code === current.group_code)) {
          next.group_code = matchingRows[0]?.group_code || ''
        }
        matchingRows = matchingRows.filter((row) => row.group_code === next.group_code)
        const matchingWarehouse = matchingRows.find((row) => row.location_id === current.location_id)
        next.location_id = matchingWarehouse?.location_id || matchingRows[0]?.location_id || ''
        next.location_code = matchingRows.find((row) => row.location_id === next.location_id)?.location_code || ''
      }

      if (name === 'location_id') {
        const matchingRow = rackLocations.find((row) =>
          row.group_code === current.group_code &&
          row.location_type === current.location_type &&
          row.location_id === value
        )
        next.location_code = matchingRow?.location_code || ''
      }
      return next
    })
  }

  async function handleCreate(event) {
    event.preventDefault()
    setIsSaving(true)
    setFormError('')
    const { error } = await supabase.from('dir_rack_locations').insert({
      group_code: form.group_code,
      location_type: form.location_type,
      location_id: form.location_id,
      location_code: form.location_code,
      location_name: form.location_type === 'PALLET'
        ? buildPalletLocationName(form)
        : form.location_name.trim() || null,
      sub_location: form.sub_location.trim() || null,
      is_active: true,
    })
    setIsSaving(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setIsModalOpen(false)
    router.refresh()
  }

  async function toggleActive(row) {
    setActionError('')
    const { error } = await supabase
      .from('dir_rack_locations')
      .update({ is_active: !row.is_active })
      .eq('id', row.id)
    if (error) {
      setActionError(error.message)
      return
    }
    router.refresh()
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>MASTER DATA</p>
          <h1 className={styles.title}>Rack Locations</h1>
          <p className={styles.subtitle}>Kelola lokasi penyimpanan berdasarkan warehouse, group, dan tipe.</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
          <span aria-hidden="true">+</span> Add Rack Location
        </button>
      </header>

      <section className={styles.filterBar} aria-label="Filter rack locations">
        <label className={styles.filterField}>
          <span>Group</span>
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
            <option value="">All groups</option>
            {groups.map((group) => <option key={group} value={group}>{group}</option>)}
          </select>
        </label>
        <label className={styles.filterField}>
          <span>Storage type</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">All types</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <div className={styles.resultCount}>
          <strong>{filteredRows.length.toLocaleString()}</strong> location{filteredRows.length === 1 ? '' : 's'}
        </div>
      </section>

      {actionError && <div className={styles.errorState}>{actionError}</div>}

      {loadError ? (
        <div className={styles.errorState}>Gagal memuat rack locations: {loadError}</div>
      ) : warehouseGroups.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">⌖</div>
          <h2>No rack locations found</h2>
          <p>{rackLocations.length ? 'Coba ubah filter yang dipilih.' : 'Tambahkan lokasi pertama untuk mulai mengelola storage.'}</p>
        </div>
      ) : (
        <div className={styles.warehouseList}>
          {warehouseGroups.map(([warehouse, rows]) => (
            <section className={styles.warehouseCard} key={warehouse}>
              <button
                type="button"
                className={styles.warehouseHeader}
                aria-expanded={!collapsedWarehouses[warehouse]}
                onClick={() => setCollapsedWarehouses((current) => ({ ...current, [warehouse]: !current[warehouse] }))}
              >
                <div className={styles.warehouseIdentity}>
                  <span className={styles.warehouseMark} aria-hidden="true">W</span>
                  <div>
                    <h2>{warehouse}</h2>
                    <p>{rows.length.toLocaleString()} storage location{rows.length === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <span className={styles.warehouseHeaderActions}>
                  <span className={styles.warehouseCount}>{rows.length}</span>
                  <span className={`${styles.chevron} ${collapsedWarehouses[warehouse] ? '' : styles.chevronOpen}`} aria-hidden="true">⌄</span>
                </span>
              </button>
              {!collapsedWarehouses[warehouse] && <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Group</th><th>Type</th><th>Pallet / Shelving</th><th>Location Name</th><th>Carton Number</th><th>Status</th><th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td><span className={styles.groupPill}>{row.group_code || '-'}</span></td>
                        <td><span className={`${styles.typePill} ${row.location_type === 'SHELVING' ? styles.shelving : styles.pallet}`}>{row.location_type || '-'}</span></td>
                        <td className={styles.locationCode}>{row.location_code || '-'}</td>
                        <td>{row.location_name || <span className={styles.muted}>—</span>}</td>
                        <td>{row.sub_location || <span className={styles.muted}>—</span>}</td>
                        <td><button type="button" className={`${styles.statusButton} ${row.is_active ? styles.active : styles.inactive}`} onClick={() => toggleActive(row)} aria-label={`${row.is_active ? 'Deactivate' : 'Activate'} ${row.location_code || 'rack location'}`}><i />{row.is_active ? 'Active' : 'Inactive'}</button></td>
                        <td className={styles.actionCell}><Link href={`/dashboard/rack-locations/${row.id}`} className={styles.editLink}>Edit</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
            </section>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false) }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="rack-modal-title">
            <header className={styles.modalHeader}>
              <div><p className={styles.eyebrow}>NEW LOCATION</p><h2 id="rack-modal-title">Add Rack Location</h2></div>
              <button type="button" className={styles.closeButton} onClick={() => setIsModalOpen(false)} aria-label="Close">×</button>
            </header>
            <form onSubmit={handleCreate} className={styles.modalForm}>
              <div className={styles.formGrid}>
                <label className={styles.formField}><span>Group <b>*</b></span>
                  <select name="group_code" value={form.group_code} onChange={updateForm} required>
                    <option value="" disabled>Select group</option>
                    {groups.map((group) => <option key={group} value={group}>{group}</option>)}
                  </select>
                </label>
                <label className={styles.formField}><span>Storage type <b>*</b></span>
                  <select name="location_type" value={form.location_type} onChange={updateForm} required>
                    <option value="" disabled>Select type</option>
                    {types.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className={styles.formField}><span>Warehouse location <b>*</b></span>
                  <select name="location_id" value={form.location_id} onChange={updateForm} required>
                    <option value="" disabled>Select warehouse</option>
                    {formWarehouses.map((warehouse) => <option key={warehouse} value={warehouse}>{warehouse}</option>)}
                  </select>
                </label>
                <label className={styles.formField}><span>Pallet / Shelving <b>*</b></span>
                  <select name="location_code" value={form.location_code} onChange={updateForm} required disabled={!locationCodes.length}>
                    <option value="" disabled>{locationCodes.length ? 'Select location' : 'No matching locations'}</option>
                    {locationCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                </label>
                <label className={styles.formField}><span>Location Name</span>
                  <input name="location_name" value={form.location_name} onChange={updateForm} placeholder="Enter a recognizable location name" />
                </label>
                <label className={styles.formField}><span>Carton Number</span>
                  <input name="sub_location" value={form.sub_location} onChange={updateForm} placeholder="Enter carton / sub-location" required={form.location_type === 'PALLET'} />
                </label>
                {form.location_type === 'PALLET' && (
                  <div className={`${styles.formField} ${styles.fullWidth}`}>
                    <span>Location Name</span>
                    <output className={styles.namePreview} aria-live="polite">
                      {buildPalletLocationName(form) || 'PL-[warehouse]-[pallet]-[carton]'}
                    </output>
                  </div>
                )}
                {form.location_type !== 'PALLET' && (
                  <label className={styles.formField}>
                    <span>Location Name</span>
                    <input name="location_name" value={form.location_name} onChange={updateForm} placeholder="Enter a recognizable location name" />
                  </label>
                )}
              </div>
              {formError && <p className={styles.formError}>{formError}</p>}
              <footer className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={isSaving || !groups.length || !types.length || !warehouses.length || !locationCodes.length}>
                  {isSaving ? 'Saving…' : 'Save location'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
