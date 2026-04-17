'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()
const RACK_LOCATION_BATCH_SIZE = 1000
const naturalSort = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

async function fetchAllRackLocations() {
  const allRows = []
  let from = 0

  while (true) {
    const to = from + RACK_LOCATION_BATCH_SIZE - 1
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

    if (data.length < RACK_LOCATION_BATCH_SIZE) {
      break
    }

    from += RACK_LOCATION_BATCH_SIZE
  }

  return allRows
}

export default function RegistryStoragePage() {
  const [rackLocations, setRackLocations] = useState([])
  const [storageEntries, setStorageEntries] = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    locationType: '',
    locationId: '',
    locationCode: '',
    subLocation: '',
    itemName: '',
    size: '',
    qty: '1',
    notes: '',
  })

  useEffect(() => {
    async function loadData() {
      setPageLoading(true)
      setError('')

      try {
        const [rackData, { data: storageData, error: storageError }] =
          await Promise.all([
            fetchAllRackLocations(),
            supabase
              .from('warehouse_storage')
              .select('id, rack_location_id, item_name, size, qty, notes, created_at')
              .order('created_at', { ascending: false })
              .limit(20),
          ])

        if (storageError) {
          setError(storageError.message || 'Failed to load storage data.')
          setPageLoading(false)
          return
        }

        const normalizedRackLocations = (rackData || []).map((item) => ({
          ...item,
          location_type: typeof item.location_type === 'string' ? item.location_type.trim() : item.location_type,
          location_id: typeof item.location_id === 'string' ? item.location_id.trim() : item.location_id,
          location_code: typeof item.location_code === 'string' ? item.location_code.trim() : item.location_code,
          sub_location: typeof item.sub_location === 'string' ? item.sub_location.trim() : item.sub_location,
        }))

        setRackLocations(normalizedRackLocations)
        setStorageEntries(storageData || [])
        setPageLoading(false)
      } catch (loadError) {
        setError(loadError.message || 'Failed to load storage data.')
        setPageLoading(false)
      }
    }

    loadData()
  }, [])

  const locationTypeOptions = Array.from(
    new Set(rackLocations.map((item) => item.location_type).filter(Boolean))
  )

  const locationIdOptions = Array.from(
    new Set(
      rackLocations
        .filter((item) => item.location_type === form.locationType)
        .map((item) => item.location_id)
        .filter(Boolean)
    )
  )

  const locationCodeOptions = Array.from(
    new Set(
      rackLocations
        .filter(
          (item) =>
            item.location_type === form.locationType &&
            String(item.location_id) === form.locationId
        )
        .map((item) => item.location_code)
        .filter(Boolean)
    )
  ).sort((left, right) => naturalSort.compare(String(left), String(right)))

  const subLocationOptions = rackLocations.filter(
    (item) =>
      item.location_type === form.locationType &&
      String(item.location_id) === form.locationId &&
      item.location_code === form.locationCode
  ).sort((left, right) =>
    naturalSort.compare(String(left.sub_location), String(right.sub_location))
  )

  const selectedRackLocation = subLocationOptions.find(
    (item) => item.sub_location === form.subLocation
  )

  function handleSelectChange(event) {
    const { name, value } = event.target

    if (name === 'locationType') {
      setForm((prev) => ({
        ...prev,
        locationType: value,
        locationId: '',
        locationCode: '',
        subLocation: '',
      }))
      return
    }

    if (name === 'locationId') {
      setForm((prev) => ({
        ...prev,
        locationId: value,
        locationCode: '',
        subLocation: '',
      }))
      return
    }

    if (name === 'locationCode') {
      setForm((prev) => ({
        ...prev,
        locationCode: value,
        subLocation: '',
      }))
      return
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function handleInputChange(event) {
    const { name, value } = event.target

    if (name === 'qty') {
      const numericValue = value.replace(/\D/g, '')
      setForm((prev) => ({
        ...prev,
        qty: numericValue || '',
      }))
      return
    }

    setForm((prev) => ({
      ...prev,
      [name]: name === 'itemName' ? value.toUpperCase() : value,
    }))
  }

  async function refreshStorageEntries() {
    const { data, error: storageError } = await supabase
      .from('warehouse_storage')
      .select('id, rack_location_id, item_name, size, qty, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (storageError) {
      setError(storageError.message)
      return
    }

    setStorageEntries(data || [])
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    if (!selectedRackLocation) {
      setError('Please complete the location selection first.')
      setSaving(false)
      return
    }

    if (!form.itemName.trim()) {
      setError('Item name is required.')
      setSaving(false)
      return
    }

    const payload = {
      rack_location_id: selectedRackLocation.id,
      item_name: form.itemName.trim(),
      size: form.size.trim() || null,
      qty: Number(form.qty || 0),
      notes: form.notes.trim() || null,
    }

    const { error: insertError } = await supabase.from('warehouse_storage').insert([payload])

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setSuccess('Item stored successfully.')
    setForm((prev) => ({
      ...prev,
      itemName: '',
      size: '',
      qty: '1',
      notes: '',
    }))
    await refreshStorageEntries()
    setSaving(false)
  }

  function getLocationLabel(rackLocationId) {
    const location = rackLocations.find((item) => item.id === rackLocationId)

    if (!location) {
      return '-'
    }

    return `${location.location_type} / ${location.location_id} / ${location.location_code} / ${location.sub_location}`
  }

  if (pageLoading) {
    return <p style={styles.loading}>Loading storage data...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div>
        <h1 style={styles.title}>Registry Storage</h1>
        <p style={styles.subtitle}>
          Select the exact storage slot first, then store the item.
        </p>
      </div>

      <div style={styles.contentGrid}>
        <form onSubmit={handleSubmit} style={styles.formCard}>
          <div style={styles.formHeader}>
            <h2 style={styles.cardTitle}>Add Product to Storage</h2>
            <p style={styles.cardText}>
              Live input only for now, without edit or delete.
            </p>
          </div>

          <div style={styles.grid}>
            <div style={styles.field}>
              <label style={styles.label}>Storage Type</label>
              <select
                name="locationType"
                value={form.locationType}
                onChange={handleSelectChange}
                style={styles.select}
                required
              >
                <option value="">Select location type</option>
                {locationTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Warehouse Location</label>
              <select
                name="locationId"
                value={form.locationId}
                onChange={handleSelectChange}
                style={styles.select}
                required
                disabled={!form.locationType}
              >
                <option value="">Select location id</option>
                {locationIdOptions.map((option) => (
                  <option key={option} value={String(option)}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Pallet/Shelving Number</label>
              <select
                name="locationCode"
                value={form.locationCode}
                onChange={handleSelectChange}
                style={styles.select}
                required
                disabled={!form.locationId}
              >
                <option value="">Select location code</option>
                {locationCodeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Carton Number</label>
              <select
                name="subLocation"
                value={form.subLocation}
                onChange={handleSelectChange}
                style={styles.select}
                required
                disabled={!form.locationCode}
              >
                <option value="">Select sub location</option>
                {subLocationOptions.map((option) => (
                  <option key={option.id} value={option.sub_location}>
                    {option.sub_location}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.selectedLocationBox}>
            <span style={styles.selectedLocationLabel}>Selected Slot</span>
            <strong style={styles.selectedLocationValue}>
              {selectedRackLocation
                ? `${selectedRackLocation.location_type} / ${selectedRackLocation.location_id} / ${selectedRackLocation.location_code} / ${selectedRackLocation.sub_location}`
                : 'Choose a full location first'}
            </strong>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Item Name</label>
            <input
              name="itemName"
              value={form.itemName}
              onChange={handleInputChange}
              style={styles.input}
              placeholder="ITEM NAME"
              required
            />
          </div>

          <div style={styles.grid}>
            <div style={styles.field}>
              <label style={styles.label}>Size</label>
              <input
                name="size"
                value={form.size}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="SIZE"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Qty</label>
              <input
                name="qty"
                value={form.qty}
                onChange={handleInputChange}
                style={styles.input}
                inputMode="numeric"
                placeholder="1"
                required
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleInputChange}
              style={styles.textarea}
              placeholder="Optional notes"
            />
          </div>

          {rackLocations.length === 0 ? (
            <p style={styles.warning}>
              No rack locations found yet. Please fill `rack_locations` first.
            </p>
          ) : null}
          {error ? <p style={styles.error}>{error}</p> : null}
          {success ? <p style={styles.success}>{success}</p> : null}

          <div style={styles.actions}>
            <button type="submit" disabled={saving || rackLocations.length === 0} style={styles.button}>
              {saving ? 'Saving...' : 'Save to Storage'}
            </button>
          </div>
        </form>

        <div style={styles.listCard}>
          <div style={styles.formHeader}>
            <h2 style={styles.cardTitle}>Recent Stored Items</h2>
            <p style={styles.cardText}>Quick view of the latest storage input.</p>
          </div>

          {storageEntries.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ margin: 0 }}>No stored items yet.</p>
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
                  </tr>
                </thead>
                <tbody>
                  {storageEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td style={styles.td}>{getLocationLabel(entry.rack_location_id)}</td>
                      <td style={styles.td}>{entry.item_name}</td>
                      <td style={styles.td}>{entry.size || '-'}</td>
                      <td style={styles.td}>{entry.qty}</td>
                      <td style={styles.td}>{entry.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
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
  contentGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  formCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  listCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '20px',
  },
  cardText: {
    margin: 0,
    color: '#6b7280',
    fontSize: '14px',
  },
  grid: {
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
  input: {
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    padding: '0 12px',
    fontSize: '14px',
  },
  select: {
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    padding: '0 12px',
    fontSize: '14px',
    background: '#fff',
  },
  textarea: {
    minHeight: '100px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    padding: '12px',
    fontSize: '14px',
    resize: 'vertical',
  },
  selectedLocationBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '16px',
    borderRadius: '12px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
  },
  selectedLocationLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#1d4ed8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  selectedLocationValue: {
    color: '#1e3a8a',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  button: {
    height: '44px',
    padding: '0 18px',
    border: 'none',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  error: {
    margin: 0,
    color: '#dc2626',
  },
  success: {
    margin: 0,
    color: '#16a34a',
  },
  warning: {
    margin: 0,
    color: '#b45309',
  },
  loading: {
    color: '#6b7280',
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
}
