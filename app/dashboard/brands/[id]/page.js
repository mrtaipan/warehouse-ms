'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

const styles = {
  title: { marginTop: 0, marginBottom: '8px', fontSize: '28px' },
  subtitle: { marginTop: 0, marginBottom: '24px', color: '#6b7280' },
  formCard: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
    padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', fontWeight: '600' },
  input: { height: '42px', padding: '0 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' },
  inputReadonly: { height: '42px', padding: '0 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', backgroundColor: '#f3f4f6', color: '#6b7280' },
  textarea: { minHeight: '100px', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  primaryButton: { height: '42px', padding: '0 16px', border: 'none', borderRadius: '8px', background: '#111827', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  secondaryButton: { height: '42px', padding: '0 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#111827', fontWeight: '600', cursor: 'pointer' },
  error: { color: '#dc2626', margin: 0 },
  success: { color: '#16a34a', margin: 0 },
  loading: { color: '#6b7280' },
}

export default function EditBrandPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const brandId = params.id
  const [form, setForm] = useState({ brand_code: '', brand_name: '', description: '', is_active: true })
  const [pageLoading, setPageLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function fetchBrand() {
      setPageLoading(true)
      setError('')
      const { data, error } = await supabase.from('dir_brands').select('id, brand_code, brand_name, description, is_active').eq('id', brandId).single()
      if (error) {
        setError(error.message)
        setPageLoading(false)
        return
      }
      setForm({
        brand_code: data.brand_code || '',
        brand_name: data.brand_name || '',
        description: data.description || '',
        is_active: data.is_active ?? true,
      })
      setPageLoading(false)
    }
    if (brandId) fetchBrand()
  }, [brandId, supabase])

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: checked }))
      return
    }

    if (name === 'brand_code') {
      setForm((prev) => ({
        ...prev,
        brand_code: value.replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 3),
      }))
      return
    }

    setForm((prev) => ({
      ...prev,
      [name]: name === 'description' ? value : value.toUpperCase(),
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const { error } = await supabase.from('dir_brands').update({
      brand_code: form.brand_code.trim() || null,
      brand_name: form.brand_name.trim() || null,
      description: form.description.trim() || null,
      is_active: form.is_active,
    }).eq('id', brandId)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setSuccess('Brand updated successfully.')
    setLoading(false)
    setTimeout(() => { router.push('/dashboard/brands'); router.refresh() }, 800)
  }

  if (pageLoading) return <p style={styles.loading}>Loading brand data...</p>

  return (
    <div>
      <h1 style={styles.title}>Edit Brand</h1>
      <p style={styles.subtitle}>Update brand master data</p>
      <form onSubmit={handleSubmit} style={styles.formCard}>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Brand Code</label>
            <input
              name="brand_code"
              value={form.brand_code}
              onChange={handleChange}
              style={styles.input}
              maxLength={3}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Brand Name</label>
            <input name="brand_name" value={form.brand_name} onChange={handleChange} style={styles.input} required />
          </div>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} style={styles.textarea} />
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
          <button type="button" onClick={() => router.push('/dashboard/brands')} style={styles.secondaryButton}>Cancel</button>
          <button type="submit" disabled={loading} style={styles.primaryButton}>{loading ? 'Saving...' : 'Update Brand'}</button>
        </div>
      </form>
    </div>
  )
}
