'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
}

export default function NewSupplierPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    supplier_code: '',
    supplier_name: '',
    contact_person: '',
    phone: '',
    address: '',
    notes: '',
  })

  const [loading, setLoading] = useState(false)
  const [codeLoading, setCodeLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function generateSupplierCode() {
      setCodeLoading(true)

      const { data, error } = await supabase
        .from('suppliers')
        .select('supplier_code')
        .order('supplier_code', { ascending: false })
        .limit(1)

      if (error) {
        setError(`Failed to generate supplier code: ${error.message}`)
        setCodeLoading(false)
        return
      }

      let nextNumber = 1

      if (data && data.length > 0 && data[0].supplier_code) {
        const lastCode = data[0].supplier_code
        const match = lastCode.match(/^SUPP-(\d+)$/)

        if (match) {
          nextNumber = Number(match[1]) + 1
        }
      }

      const newCode = `SUPP-${String(nextNumber).padStart(3, '0')}`

      setForm((prev) => ({
        ...prev,
        supplier_code: newCode,
      }))

      setCodeLoading(false)
    }

    generateSupplierCode()
  }, [supabase])

  function handleChange(e) {
    const { name, value } = e.target
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

    if (!form.supplier_code) {
      setError('Supplier code is not ready yet.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const payload = {
      supplier_code: form.supplier_code,
      supplier_name: form.supplier_name.trim() || null,
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      is_active: true,
    }

    const { error } = await supabase.from('suppliers').insert([payload])

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess('Supplier created successfully.')
    setLoading(false)

    setTimeout(() => {
      router.push('/dashboard/suppliers')
      router.refresh()
    }, 800)
  }

  return (
    <div>
      <h1 style={styles.title}>Add Supplier</h1>
      <p style={styles.subtitle}>Create a new supplier master data</p>

      <form onSubmit={handleSubmit} style={styles.formCard}>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Supplier Code</label>
            <input
              name="supplier_code"
              value={codeLoading ? 'GENERATING...' : form.supplier_code}
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
              placeholder="SUPPLIER NAME"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Contact Person</label>
            <input
              name="contact_person"
              value={form.contact_person}
              onChange={handleChange}
              style={styles.input}
              placeholder="CONTACT PERSON"
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
            placeholder="ADDRESS"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            style={styles.textarea}
            placeholder="Notes"
          />
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
            disabled={loading || codeLoading}
            style={styles.primaryButton}
          >
            {loading ? 'Saving...' : 'Save Supplier'}
          </button>
        </div>
      </form>
    </div>
  )
}