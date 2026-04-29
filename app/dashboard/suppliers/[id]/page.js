'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

const styles = {
  title: {
    marginTop: 0,
    marginBottom: '8px',
    fontSize: '28px',
  },
  subtitle: {
    marginTop: 0,
    marginBottom: '24px',
    color: '#6b7280',
  },
  formCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
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
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
  },
  inputReadonly: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  textarea: {
    minHeight: '100px',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  primaryButton: {
    height: '42px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '8px',
    background: '#111827',
    color: '#fff',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    height: '42px',
    padding: '0 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontWeight: '600',
    cursor: 'pointer',
  },
  error: {
    color: '#dc2626',
    margin: 0,
  },
  success: {
    color: '#16a34a',
    margin: 0,
  },
  loading: {
    color: '#6b7280',
  },
}

export default function EditSupplierPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const supplierId = params.id

  const [form, setForm] = useState({
    supplier_code: '',
    supplier_name: '',
    contact_person: '',
    phone: '',
    address: '',
    notes: '',
    is_active: true,
  })

  const [pageLoading, setPageLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function fetchSupplier() {
      setPageLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('dir_suppliers')
        .select('id, supplier_code, supplier_name, contact_person, phone, address, notes, is_active')
        .eq('id', supplierId)
        .single()

      if (error) {
        setError(error.message)
        setPageLoading(false)
        return
      }

      setForm({
        supplier_code: data.supplier_code || '',
        supplier_name: data.supplier_name || '',
        contact_person: data.contact_person || '',
        phone: data.phone || '',
        address: data.address || '',
        notes: data.notes || '',
        is_active: data.is_active ?? true,
      })

      setPageLoading(false)
    }

    if (supplierId) {
      fetchSupplier()
    }
  }, [supplierId, supabase])

  function handleChange(e) {
    const { name, value, type, checked } = e.target

    if (type === 'checkbox') {
      setForm((prev) => ({
        ...prev,
        [name]: checked,
      }))
      return
    }

    let newValue = value

    if (name === 'phone') {
      newValue = value.replace(/\D/g, '')
    } else if (name !== 'notes') {
      newValue = value.toUpperCase()
    }

    setForm((prev) => ({
      ...prev,
      [name]: newValue,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const payload = {
      supplier_name: form.supplier_name.trim() || null,
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    }

    const { error } = await supabase
      .from('dir_suppliers')
      .update(payload)
      .eq('id', supplierId)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess('Supplier updated successfully.')
    setLoading(false)

    setTimeout(() => {
      router.push('/dashboard/suppliers')
      router.refresh()
    }, 800)
  }

  if (pageLoading) {
    return <p style={styles.loading}>Loading supplier data...</p>
  }

  return (
    <div>
      <h1 style={styles.title}>Edit Supplier</h1>
      <p style={styles.subtitle}>Update supplier master data</p>

      <form onSubmit={handleSubmit} style={styles.formCard}>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Supplier Code</label>
            <input
              name="supplier_code"
              value={form.supplier_code}
              readOnly
              style={styles.inputReadonly}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Supplier Name</label>
            <input
              name="supplier_name"
              value={form.supplier_name}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Contact Person</label>
            <input
              name="contact_person"
              value={form.contact_person}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Phone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              inputMode="numeric"
              pattern="[0-9]*"
              style={styles.input}
              placeholder="NUMBERS ONLY"
            />
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Address</label>
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            style={styles.textarea}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            style={styles.textarea}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={handleChange}
              style={{ marginRight: '8px' }}
            />
            Active
          </label>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}

        <div style={styles.actions}>
          <button
            type="button"
            onClick={() => router.push('/dashboard/suppliers')}
            style={styles.secondaryButton}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            style={styles.primaryButton}
          >
            {loading ? 'Saving...' : 'Update Supplier'}
          </button>
        </div>
      </form>
    </div>
  )
}