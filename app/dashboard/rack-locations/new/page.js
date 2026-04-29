'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
}

export default function NewRackLocationPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ location_type: 'PALLET', location_id: '', location_code: '', sub_location: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value.toUpperCase() }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const { error } = await supabase.from('dir_rack_locations').insert([{
      location_type: form.location_type.trim() || null,
      location_id: form.location_id.trim() || null,
      location_code: form.location_code.trim() || null,
      sub_location: form.sub_location.trim() || null,
      is_active: true,
    }])

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess('Rack location created successfully.')
    setLoading(false)
    setTimeout(() => { router.push('/dashboard/rack-locations'); router.refresh() }, 800)
  }

  return (
    <div>
      <h1 style={styles.title}>Add Rack Location</h1>
      <p style={styles.subtitle}>Create a new rack location master data</p>
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
            <input name="location_id" value={form.location_id} onChange={handleChange} style={styles.input} placeholder="WAREHOUSE LOCATION" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Pallet/Shelving Number</label>
            <input name="location_code" value={form.location_code} onChange={handleChange} style={styles.input} placeholder="PALLET/SHELVING NUMBER" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Carton Number</label>
            <input name="sub_location" value={form.sub_location} onChange={handleChange} style={styles.input} placeholder="CARTON NUMBER" required />
          </div>
        </div>
        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}
        <div style={styles.actions}>
          <button type="button" onClick={() => router.push('/dashboard/rack-locations')} style={styles.secondaryButton}>Cancel</button>
          <button type="submit" disabled={loading} style={styles.primaryButton}>{loading ? 'Saving...' : 'Save Rack Location'}</button>
        </div>
      </form>
    </div>
  )
}
