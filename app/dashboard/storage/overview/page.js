'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()
const BATCH_SIZE = 1000
const naturalSort = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

function getTodayDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocalDateValue(dateString) {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function fetchAllRackLocations() {
  const allRows = []
  let from = 0

  while (true) {
    const to = from + BATCH_SIZE - 1
    const { data, error } = await supabase
      .from('rack_locations')
      .select('id, location_type, location_id, location_code, sub_location')
      .order('location_type', { ascending: true })
      .order('location_id', { ascending: true })
      .order('location_code', { ascending: true })
      .order('sub_location', { ascending: true })
      .range(from, to)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)

    if (data.length < BATCH_SIZE) {
      break
    }

    from += BATCH_SIZE
  }

  return allRows
}

async function fetchAllWarehouseStorage() {
  const allRows = []
  let from = 0

  while (true) {
    const to = from + BATCH_SIZE - 1
    const { data, error } = await supabase
      .from('warehouse_storage')
      .select('id, rack_location_id, item_name, size, qty, notes, created_at')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)

    if (data.length < BATCH_SIZE) {
      break
    }

    from += BATCH_SIZE
  }

  return allRows
}

async function getCurrentUserEmail() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.email || null
}

export default function StorageOverviewPage() {
  const [rackLocations, setRackLocations] = useState([])
  const [storageEntries, setStorageEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [taking, setTaking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [takeModalEntry, setTakeModalEntry] = useState(null)
  const [editModalEntry, setEditModalEntry] = useState(null)
  const [takeForm, setTakeForm] = useState({
    takeOutAll: false,
    qty: '',
  })
  const [editForm, setEditForm] = useState({
    itemName: '',
    size: '',
    qty: '',
    notes: '',
  })
  const [filters, setFilters] = useState({
    locationCode: '',
    subLocation: '',
  })
  const [kpiDate, setKpiDate] = useState(getTodayDateValue())

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const [rackData, storageData] = await Promise.all([
          fetchAllRackLocations(),
          fetchAllWarehouseStorage(),
        ])

        const normalizedRackLocations = (rackData || []).map((item) => ({
          ...item,
          location_type: typeof item.location_type === 'string' ? item.location_type.trim() : item.location_type,
          location_id: typeof item.location_id === 'string' ? item.location_id.trim() : item.location_id,
          location_code: typeof item.location_code === 'string' ? item.location_code.trim() : item.location_code,
          sub_location: typeof item.sub_location === 'string' ? item.sub_location.trim() : item.sub_location,
        }))

        setRackLocations(normalizedRackLocations)
        setStorageEntries(storageData || [])
        setLoading(false)
      } catch (loadError) {
        setError(loadError.message || 'Failed to load storage overview.')
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const locationById = useMemo(
    () => new Map(rackLocations.map((item) => [item.id, item])),
    [rackLocations]
  )

  const storageRows = useMemo(
    () =>
      storageEntries
        .map((entry) => ({
          ...entry,
          location: locationById.get(entry.rack_location_id) || null,
        }))
        .filter((entry) => entry.location),
    [locationById, storageEntries]
  )

  const locationCodeOptions = Array.from(
    new Set(
      rackLocations
        .filter((item) => !filters.subLocation || item.sub_location === filters.subLocation)
        .map((item) => item.location_code)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const subLocationOptions = Array.from(
    new Set(
      rackLocations
        .filter((item) => !filters.locationCode || item.location_code === filters.locationCode)
        .map((item) => item.sub_location)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const filteredRows = storageRows.filter((entry) => {
    const location = entry.location

    if (
      filters.locationCode &&
      !String(location.location_code).toUpperCase().includes(filters.locationCode.toUpperCase())
    ) {
      return false
    }

    if (
      filters.subLocation &&
      !String(location.sub_location).toUpperCase().includes(filters.subLocation.toUpperCase())
    ) {
      return false
    }

    return true
  })

  const palletCountForKpiDate = new Set(
    storageRows
      .filter(
        (entry) =>
          entry.location &&
          entry.created_at &&
          getLocalDateValue(entry.created_at) === kpiDate
      )
      .map((entry) => entry.location.location_code)
      .filter(Boolean)
  ).size

  function handleFilterChange(event) {
    const { name, value } = event.target

    setFilters((prev) => ({
      ...prev,
      [name]: value.toUpperCase(),
    }))
  }

  function clearFilters() {
    setFilters({
      locationCode: '',
      subLocation: '',
    })
  }

  function openTakeModal(entry) {
    setTakeModalEntry(entry)
    setTakeForm({
      takeOutAll: false,
      qty: String(entry.qty || ''),
    })
    setError('')
    setSuccess('')
  }

  function openEditModal(entry) {
    setEditModalEntry(entry)
    setEditForm({
      itemName: entry.item_name || '',
      size: entry.size || '',
      qty: String(entry.qty || ''),
      notes: entry.notes || '',
    })
    setError('')
    setSuccess('')
  }

  function closeTakeModal() {
    setTakeModalEntry(null)
    setTakeForm({
      takeOutAll: false,
      qty: '',
    })
  }

  function closeEditModal() {
    setEditModalEntry(null)
    setEditForm({
      itemName: '',
      size: '',
      qty: '',
      notes: '',
    })
  }

  function handleTakeFormChange(event) {
    const { name, value, type, checked } = event.target

    if (type === 'checkbox') {
      setTakeForm((prev) => ({
        ...prev,
        [name]: checked,
        qty: checked && takeModalEntry ? String(takeModalEntry.qty || '') : prev.qty,
      }))
      return
    }

    const numericValue = value.replace(/\D/g, '')
    setTakeForm((prev) => ({
      ...prev,
      [name]: numericValue,
    }))
  }

  function handleEditFormChange(event) {
    const { name, value } = event.target

    if (name === 'qty') {
      const numericValue = value.replace(/\D/g, '')
      setEditForm((prev) => ({
        ...prev,
        qty: numericValue,
      }))
      return
    }

    setEditForm((prev) => ({
      ...prev,
      [name]: name === 'itemName' ? value.toUpperCase() : value,
    }))
  }

  async function handleTakeOut(event) {
    event.preventDefault()

    if (!takeModalEntry) {
      return
    }

    setTaking(true)
    setError('')
    setSuccess('')

    const currentQty = Number(takeModalEntry.qty || 0)
    const takeQty = takeForm.takeOutAll ? currentQty : Number(takeForm.qty || 0)

    if (!takeForm.takeOutAll && takeQty <= 0) {
      setError('Take out quantity must be greater than 0.')
      setTaking(false)
      return
    }

    if (takeQty > currentQty) {
      setError('Take out quantity cannot be greater than available quantity.')
      setTaking(false)
      return
    }

    if (takeQty === currentQty) {
      const { error: deleteError } = await supabase
        .from('warehouse_storage')
        .delete()
        .eq('id', takeModalEntry.id)

      if (deleteError) {
        setError(deleteError.message)
        setTaking(false)
        return
      }
    } else {
      const updatedBy = await getCurrentUserEmail()

      const { error: updateError } = await supabase
        .from('warehouse_storage')
        .update({
          qty: currentQty - takeQty,
          updated_by: updatedBy,
        })
        .eq('id', takeModalEntry.id)

      if (updateError) {
        setError(updateError.message)
        setTaking(false)
        return
      }
    }

    const refreshedStorage = await fetchAllWarehouseStorage()
    setStorageEntries(refreshedStorage || [])
    setSuccess('Storage quantity updated successfully.')
    setTaking(false)
    closeTakeModal()
  }

  async function handleEditSubmit(event) {
    event.preventDefault()

    if (!editModalEntry) {
      return
    }

    setEditing(true)
    setError('')
    setSuccess('')

    if (!editForm.itemName.trim()) {
      setError('Item name is required.')
      setEditing(false)
      return
    }

    const nextQty = Number(editForm.qty || 0)

    if (nextQty <= 0) {
      setError('Quantity must be greater than 0.')
      setEditing(false)
      return
    }

    const updatedBy = await getCurrentUserEmail()

    const { error: updateError } = await supabase
      .from('warehouse_storage')
      .update({
        item_name: editForm.itemName.trim(),
        size: editForm.size.trim() || null,
        qty: nextQty,
        notes: editForm.notes.trim() || null,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editModalEntry.id)

    if (updateError) {
      setError(updateError.message)
      setEditing(false)
      return
    }

    const refreshedStorage = await fetchAllWarehouseStorage()
    setStorageEntries(refreshedStorage || [])
    setSuccess('Storage item updated successfully.')
    setEditing(false)
    closeEditModal()
  }

  function getLocationLabel(location) {
    return `${location.location_type} / ${location.location_id} / ${location.location_code} / ${location.sub_location}`
  }

  if (loading) {
    return <p style={styles.loading}>Loading storage overview...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div>
        <h1 style={styles.title}>Storage Overview</h1>
        <p style={styles.subtitle}>
          View all items stored in the warehouse and filter by pallet or carton location.
        </p>
      </div>

      <div style={styles.kpiCard}>
        <div style={styles.kpiHeader}>
          <div>
            <h2 style={styles.kpiTitle}>Daily Pallet KPI</h2>
            <p style={styles.kpiText}>
              Unique pallet/shelving numbers with storage records on the selected date.
            </p>
          </div>

          <div style={styles.kpiDateField}>
            <label style={styles.label}>Activity Date</label>
            <input
              type="date"
              value={kpiDate}
              onChange={(event) => setKpiDate(event.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.kpiValueRow}>
          <div style={styles.kpiValueCard}>
            <span style={styles.kpiValueLabel}>Pallets Recorded</span>
            <strong style={styles.kpiValue}>{palletCountForKpiDate}</strong>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.filtersGrid}>
          <div style={styles.field}>
            <label style={styles.label}>Pallet/Shelving Number</label>
            <input
              name="locationCode"
              value={filters.locationCode}
              onChange={handleFilterChange}
              style={styles.input}
              list="location-code-options"
              placeholder="Type or select a pallet/shelving number"
            />
            <datalist id="location-code-options">
              {locationCodeOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Carton Number</label>
            <input
              name="subLocation"
              value={filters.subLocation}
              onChange={handleFilterChange}
              style={styles.input}
              list="sub-location-options"
              placeholder="Type or select a carton number"
            />
            <datalist id="sub-location-options">
              {subLocationOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
        </div>

        <div style={styles.toolbar}>
          <p style={styles.summary}>Showing {filteredRows.length} item record(s)</p>
          <button type="button" onClick={clearFilters} style={styles.clearButton}>
            Clear Filters
          </button>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}

        {filteredRows.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ margin: 0 }}>No stored items found for the selected filters.</p>
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Location</th>
                  <th style={styles.th}>Item</th>
                  <th style={styles.th}>Size</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Notes</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((entry) => (
                  <tr key={entry.id}>
                    <td style={styles.td}>{getLocationLabel(entry.location)}</td>
                    <td style={styles.td}>{entry.item_name}</td>
                    <td style={styles.td}>{entry.size || '-'}</td>
                    <td style={styles.td}>{entry.qty}</td>
                    <td style={styles.td}>{entry.notes || '-'}</td>
                    <td style={styles.td}>
                      <div style={styles.actionGroup}>
                        <button
                          type="button"
                          onClick={() => openEditModal(entry)}
                          style={styles.editButton}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openTakeModal(entry)}
                          style={styles.takeButton}
                        >
                          Take
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {takeModalEntry ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Take Storage Item</h2>
              <button type="button" onClick={closeTakeModal} style={styles.modalCloseButton}>
                Close
              </button>
            </div>

            <p style={styles.modalText}>
              <strong>Item:</strong> {takeModalEntry.item_name}
            </p>
            <p style={styles.modalText}>
              <strong>Size:</strong> {takeModalEntry.size || '-'}
            </p>
            <p style={styles.modalText}>
              <strong>Location:</strong> {getLocationLabel(takeModalEntry.location)}
            </p>
            <p style={styles.modalText}>
              <strong>Available Qty:</strong> {takeModalEntry.qty}
            </p>

            <form onSubmit={handleTakeOut} style={styles.modalForm}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="takeOutAll"
                  checked={takeForm.takeOutAll}
                  onChange={handleTakeFormChange}
                />
                Take out all
              </label>

              <div style={styles.field}>
                <label style={styles.label}>Take Out Qty</label>
                <input
                  name="qty"
                  value={takeForm.takeOutAll ? String(takeModalEntry.qty || '') : takeForm.qty}
                  onChange={handleTakeFormChange}
                  style={styles.input}
                  inputMode="numeric"
                  disabled={takeForm.takeOutAll}
                  required
                />
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={closeTakeModal} style={styles.secondaryButton}>
                  Cancel
                </button>
                <button type="submit" style={styles.takeButton} disabled={taking}>
                  {taking ? 'Processing...' : 'Take Out'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editModalEntry ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Edit Storage Item</h2>
              <button type="button" onClick={closeEditModal} style={styles.modalCloseButton}>
                Close
              </button>
            </div>

            <p style={styles.modalText}>
              <strong>Location:</strong> {getLocationLabel(editModalEntry.location)}
            </p>

            <form onSubmit={handleEditSubmit} style={styles.modalForm}>
              <div style={styles.field}>
                <label style={styles.label}>Item Name</label>
                <input
                  name="itemName"
                  value={editForm.itemName}
                  onChange={handleEditFormChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Size</label>
                <input
                  name="size"
                  value={editForm.size}
                  onChange={handleEditFormChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Qty</label>
                <input
                  name="qty"
                  value={editForm.qty}
                  onChange={handleEditFormChange}
                  style={styles.input}
                  inputMode="numeric"
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Notes</label>
                <textarea
                  name="notes"
                  value={editForm.notes}
                  onChange={handleEditFormChange}
                  style={styles.textarea}
                />
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={closeEditModal} style={styles.secondaryButton}>
                  Cancel
                </button>
                <button type="submit" style={styles.editButton} disabled={editing}>
                  {editing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  title: {
    margin: 0,
    fontSize: '30px',
  },
  subtitle: {
    marginTop: '8px',
    marginBottom: 0,
    color: '#6b7280',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  kpiCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  kpiHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  kpiTitle: {
    margin: 0,
    fontSize: '20px',
  },
  kpiText: {
    marginTop: '8px',
    marginBottom: 0,
    color: '#6b7280',
    fontSize: '14px',
  },
  kpiDateField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: '220px',
  },
  kpiValueRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  kpiValueCard: {
    minWidth: '220px',
    padding: '18px 20px',
    borderRadius: '14px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  kpiValueLabel: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1d4ed8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  kpiValue: {
    fontSize: '34px',
    lineHeight: 1,
    color: '#1e3a8a',
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
  },
  select: {
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    padding: '0 12px',
    fontSize: '14px',
    background: '#fff',
  },
  input: {
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    padding: '0 12px',
    fontSize: '14px',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  summary: {
    margin: 0,
    color: '#374151',
    fontSize: '14px',
    fontWeight: '600',
  },
  clearButton: {
    height: '40px',
    padding: '0 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  loading: {
    color: '#6b7280',
  },
  error: {
    margin: 0,
    color: '#dc2626',
  },
  success: {
    margin: 0,
    color: '#16a34a',
  },
  emptyState: {
    border: '1px dashed #d1d5db',
    borderRadius: '12px',
    padding: '24px',
    color: '#6b7280',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '13px',
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    verticalAlign: 'top',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  editButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '36px',
    padding: '0 14px',
    border: 'none',
    borderRadius: '8px',
    background: '#2563eb',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  takeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '36px',
    padding: '0 14px',
    border: 'none',
    borderRadius: '8px',
    background: '#111827',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 50,
  },
  modalCard: {
    width: '100%',
    maxWidth: '520px',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '22px',
  },
  modalCloseButton: {
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    borderRadius: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  modalText: {
    margin: 0,
    color: '#374151',
    lineHeight: 1.5,
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  secondaryButton: {
    height: '36px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
}
