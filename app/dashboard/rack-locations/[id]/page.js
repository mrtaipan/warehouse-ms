'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

const styles = {
  title: { marginTop: 0, marginBottom: '8px', fontSize: '28px' },
  subtitle: { marginTop: 0, marginBottom: '24px', color: '#6b7280' },
  formCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', fontWeight: '600' },
  input: { height: '42px', padding: '0 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' },
  select: { height: '42px', padding: '0 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', backgroundColor: '#fff' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  primaryButton: { height: '42px', padding: '0 16px', border: 'none', borderRadius: '8px', background: '#111827', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  secondaryButton: { height: '42px', padding: '0 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#111827', fontWeight: '600', cursor: 'pointer' },
  error: { color: '#dc2626', margin: 0 },
  success: { color: '#16a34a', margin: 0 },
  loading: { color: '#6b7280' },
}

export default function EditRackLocationPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const rackLocationId = params.id
  const [form, setForm] = useState({ location_type: 'PALLET', location_id: '', location_code: '', sub_location: '', is_active: true })
  const [pageLoading, setPageLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function fetchRackLocation() {
      setPageLoading(true)
      setError('')
      const { data, error } = await supabase.from('rack_locations').select('id, location_type, location_id, location_code, sub_location, is_active').eq('id', rackLocationId).single()
      if (error) {
        setError(error.message)
        setPageLoading(false)
        return
      }
      setForm({
        location_type: data.location_type || 'PALLET',
        location_id: data.location_id || '',
        location_code: data.location_code || '',
        sub_location: data.sub_location || '',
        is_active: data.is_active ?? true,
      })
      setPageLoading(false)
    }
    if (rackLocationId) fetchRackLocation()
  }, [rackLocationId, supabase])

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: checked }))
      return
    }
    setForm((prev) => ({ ...prev, [name]: value.toUpperCase() }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const { error } = await supabase.from('rack_locations').update({
      location_type: form.location_type.trim() || null,
      location_id: form.location_id.trim() || null,
      location_code: form.location_code.trim() || null,
      sub_location: form.sub_location.trim() || null,
      is_active: form.is_active,
    }).eq('id', rackLocationId)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess('Rack location updated successfully.')
    setLoading(false)
    setTimeout(() => { router.push('/dashboard/rack-locations'); router.refresh() }, 800)
  }

  if (pageLoading) return <p style={styles.loading}>Loading rack location data...</p>

  return (
    <div>
      <h1 style={styles.title}>Edit Rack Location</h1>
      <p style={styles.subtitle}>Update rack location master data</p>
      <form onSubmit={handleSubmit} style={styles.formCard}>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Storage Type</label>
            <select name="location_type" value={form.location_type} onChange={handleChange} style={styles.select} required>
              <option value="PALLET">PALLET</option>
              <option value="SHELVING">SHELVING</option>
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Warehouse Location</label>
            <input name="location_id" value={form.location_id} onChange={handleChange} style={styles.input} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Pallet/Shelving Number</label>
            <input name="location_code" value={form.location_code} onChange={handleChange} style={styles.input} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Carton Number</label>
            <input name="sub_location" value={form.sub_location} onChange={handleChange} style={styles.input} required />
          </div>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} style={{ marginRight: '8px' }} />
            Active
          </label>
        </div>
        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}
        <div style={styles.actions}>
          <button type="button" onClick={() => router.push('/dashboard/rack-locations')} style={styles.secondaryButton}>Cancel</button>
          <button type="submit" disabled={loading} style={styles.primaryButton}>{loading ? 'Saving...' : 'Update Rack Location'}</button>
        </div>
      </form>
    </div>
  )
}
