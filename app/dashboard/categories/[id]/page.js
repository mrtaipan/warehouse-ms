'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()

function getUiLevelFromDbLevel(dbLevel) {
  return String(Number(dbLevel) - 1)
}

function getDbLevelFromUiLevel(uiLevel) {
  return Number(uiLevel) + 1
}

const styles = {
  title: { marginTop: 0, marginBottom: '8px', fontSize: '28px' },
  subtitle: { marginTop: 0, marginBottom: '24px', color: '#6b7280' },
  formCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', fontWeight: '600' },
  input: { height: '42px', padding: '0 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' },
  select: { height: '42px', padding: '0 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', backgroundColor: '#fff' },
  helperBox: { padding: '14px 16px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '14px' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  primaryButton: { height: '42px', padding: '0 16px', border: 'none', borderRadius: '8px', background: '#111827', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  secondaryButton: { height: '42px', padding: '0 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', color: '#111827', fontWeight: '600', cursor: 'pointer' },
  error: { color: '#dc2626', margin: 0 },
  success: { color: '#16a34a', margin: 0 },
  loading: { color: '#6b7280' },
}

export default function EditCategoryPage() {
  const params = useParams()
  const router = useRouter()
  const categoryId = params.id
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    targetLevel: '0',
    level0ParentId: '',
    level1ParentId: '',
    category_code: '',
    category_name: '',
    is_active: true,
  })
  const [pageLoading, setPageLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadData() {
      setPageLoading(true)
      setError('')

      const [{ data: allCategories, error: allError }, { data: currentCategory, error: currentError }] =
        await Promise.all([
          supabase.from('categories').select('id, category_code, category_name, parent_id, level, is_active').order('id', { ascending: true }),
          supabase.from('categories').select('id, category_code, category_name, parent_id, level, is_active').eq('id', categoryId).single(),
        ])

      if (allError || currentError) {
        setError(allError?.message || currentError?.message || 'Failed to load category data.')
        setPageLoading(false)
        return
      }

      const rows = allCategories || []
      const byId = new Map(rows.map((item) => [String(item.id), item]))
      const uiLevel = getUiLevelFromDbLevel(currentCategory.level)

      let level0ParentId = ''
      let level1ParentId = ''

      if (uiLevel === '1') {
        level0ParentId = String(currentCategory.parent_id || '')
      }

      if (uiLevel === '2') {
        const level1Parent = byId.get(String(currentCategory.parent_id || ''))
        level1ParentId = String(level1Parent?.id || '')
        level0ParentId = String(level1Parent?.parent_id || '')
      }

      setCategories(rows.filter((item) => String(item.id) !== String(currentCategory.id)))
      setForm({
        targetLevel: uiLevel,
        level0ParentId,
        level1ParentId,
        category_code: currentCategory.category_code || '',
        category_name: currentCategory.category_name || '',
        is_active: currentCategory.is_active ?? true,
      })
      setPageLoading(false)
    }

    if (categoryId) {
      loadData()
    }
  }, [categoryId])

  const level0Options = useMemo(
    () => categories.filter((item) => Number(item.level) === 1),
    [categories]
  )

  const level1Options = useMemo(
    () =>
      categories.filter(
        (item) =>
          Number(item.level) === 2 &&
          String(item.parent_id || '') === form.level0ParentId
      ),
    [categories, form.level0ParentId]
  )

  function handleChange(event) {
    const { name, value, type, checked } = event.target

    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: checked }))
      return
    }

    if (name === 'targetLevel') {
      setForm((prev) => ({
        ...prev,
        targetLevel: value,
        level0ParentId: '',
        level1ParentId: '',
      }))
      return
    }

    if (name === 'level0ParentId') {
      setForm((prev) => ({
        ...prev,
        level0ParentId: value,
        level1ParentId: '',
      }))
      return
    }

    if (name === 'category_code') {
      setForm((prev) => ({ ...prev, category_code: value.toUpperCase() }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value.toUpperCase() }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    let parentId = null
    let fullName = form.category_name.trim()
    let fullCode = form.category_code.trim()
    const dbLevel = getDbLevelFromUiLevel(form.targetLevel)

    if (form.targetLevel === '1') {
      const parent = categories.find((item) => String(item.id) === form.level0ParentId)
      if (!parent) {
        setError('Level 1 category requires a Level 0 parent.')
        return
      }
      parentId = parent.id
      fullName = `${parent.category_name} > ${form.category_name.trim()}`
      fullCode = `${parent.category_code}-${form.category_code.trim()}`
    }

    if (form.targetLevel === '2') {
      const parent = categories.find((item) => String(item.id) === form.level1ParentId)
      const grandParent = categories.find((item) => String(item.id) === String(parent?.parent_id || ''))

      if (!parent || !grandParent) {
        setError('Level 2 category requires valid Level 0 and Level 1 parents.')
        return
      }

      parentId = parent.id
      fullName = `${grandParent.category_name} > ${parent.category_name} > ${form.category_name.trim()}`
      fullCode = form.category_code.trim()
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const { error } = await supabase
      .from('categories')
      .update({
        category_code: form.category_code.trim() || null,
        category_name: form.category_name.trim() || null,
        parent_id: parentId,
        level: dbLevel,
        full_code: fullCode || null,
        full_name: fullName || null,
        is_active: form.is_active,
      })
      .eq('id', categoryId)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess('Category updated successfully.')
    setLoading(false)
    setTimeout(() => { router.push('/dashboard/categories'); router.refresh() }, 800)
  }

  if (pageLoading) return <p style={styles.loading}>Loading category data...</p>

  return (
    <div>
      <h1 style={styles.title}>Edit Category</h1>
      <p style={styles.subtitle}>Update Level 0, Level 1, or Level 2 category.</p>

      <form onSubmit={handleSubmit} style={styles.formCard}>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Target Level</label>
            <select name="targetLevel" value={form.targetLevel} onChange={handleChange} style={styles.select}>
              <option value="0">Level 0</option>
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
            </select>
          </div>

          {form.targetLevel !== '0' ? (
            <div style={styles.field}>
              <label style={styles.label}>Level 0 Parent</label>
              <select name="level0ParentId" value={form.level0ParentId} onChange={handleChange} style={styles.select} required>
                <option value="">Select Level 0</option>
                {level0Options.map((item) => (
                  <option key={item.id} value={item.id}>{item.category_name}</option>
                ))}
              </select>
            </div>
          ) : null}

          {form.targetLevel === '2' ? (
            <div style={styles.field}>
              <label style={styles.label}>Level 1 Parent</label>
              <select name="level1ParentId" value={form.level1ParentId} onChange={handleChange} style={styles.select} required>
                <option value="">Select Level 1</option>
                {level1Options.map((item) => (
                  <option key={item.id} value={item.id}>{item.category_name}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div style={styles.field}>
            <label style={styles.label}>Category Code</label>
            <input name="category_code" value={form.category_code} onChange={handleChange} style={styles.input} required />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Category Name</label>
            <input name="category_name" value={form.category_name} onChange={handleChange} style={styles.input} required />
          </div>
        </div>

        <div style={styles.helperBox}>
          Level 0 has no parent. Level 1 sits under Level 0. Level 2 sits under Level 1. Saving this form also updates `level`, `full_code`, and `full_name`.
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
          <button type="button" onClick={() => router.push('/dashboard/categories')} style={styles.secondaryButton}>Cancel</button>
          <button type="submit" disabled={loading} style={styles.primaryButton}>{loading ? 'Saving...' : 'Update Category'}</button>
        </div>
      </form>
    </div>
  )
}
