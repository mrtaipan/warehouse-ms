'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import styles from '../arkline.module.css'
import useArklineAccess from '../use-arkline-access'
import ProcurementGroups from './procurement-groups'
import groupStyles from './procurement-groups.module.css'

const supabase = createClient()

const emptyDraft = {
  sku_induk: '',
  kategori_pengadaan: '',
  kategori_produk: '',
  nama_produk: '',
  is_active: true,
}

function normalizeProduct(row) {
  return {
    sku_induk: String(row?.sku_induk || '').trim().toUpperCase(),
    category_id: row?.category_id == null ? '' : String(row.category_id),
    kategori_pengadaan: String(row?.kategori_pengadaan || '').trim().toUpperCase(),
    kategori_produk: String(row?.kategori_produk || '').trim().toUpperCase(),
    nama_produk: String(row?.nama_produk || '').trim().toUpperCase(),
    is_active: row?.is_active !== false,
  }
}

function getCategoryPath(categoryId, categories) {
  const byId = new Map(categories.map((category) => [String(category.id), category]))
  const item = byId.get(String(categoryId))
  if (!item) return { rootId: '', subId: '', itemId: '' }
  if (Number(item.level) === 2) return { rootId: String(item.parent_id || ''), subId: String(item.id), itemId: '' }
  const sub = byId.get(String(item.parent_id))
  return { rootId: String(sub?.parent_id || ''), subId: String(sub?.id || ''), itemId: String(item.id) }
}

function nextArklineSku(fullCode, products) {
  if (!fullCode || fullCode.length !== 5) return ''
  const prefix = `ARK${fullCode.toUpperCase()}`
  const maxSequence = products.reduce((max, product) => {
    const sku = String(product.sku_induk || '').toUpperCase()
    if (!sku.startsWith(prefix) || !/^\d{3}$/.test(sku.slice(prefix.length))) return max
    return Math.max(max, Number(sku.slice(prefix.length)))
  }, 0)
  return maxSequence >= 999 ? '' : `${prefix}${String(maxSequence + 1).padStart(3, '0')}`
}

export default function ArklineDirectoryPage() {
  const { access } = useArklineAccess()
  const canCreateSku = access.directoryProductsCreate
  const canEditProduct = access.directoryProductsEdit
  const [products, setProducts] = useState([])
  const [categoryTree, setCategoryTree] = useState([])
  const [procurementCategories, setProcurementCategories] = useState([])
  const [rootId, setRootId] = useState('')
  const [subId, setSubId] = useState('')
  const [itemId, setItemId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('list')
  const [showModal, setShowModal] = useState(false)
  const [showProcurementModal, setShowProcurementModal] = useState(false)
  const [procurementDraft, setProcurementDraft] = useState({ rootId: '', subId: '', itemId: '', name: '' })
  const [procurementError, setProcurementError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadProducts() {
      setLoading(true)
      setError('')

      const [productsResponse, categoryResponse, procurementCategoriesResponse] = await Promise.all([
        supabase.from('arkline_dir_products').select('sku_induk, category_id, kategori_pengadaan, kategori_produk, nama_produk, is_active').order('nama_produk', { ascending: true }),
        supabase.from('dir_categories').select('id, parent_id, level, category_name, full_code, full_name, is_active').order('full_code', { ascending: true }),
        supabase.from('arkline_dir_procurement_categories').select('id, category_id, category_name, is_active').order('category_name', { ascending: true }),
      ])

      const fetchError = productsResponse.error || categoryResponse.error || procurementCategoriesResponse.error
      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setProducts((productsResponse.data || []).map(normalizeProduct))
      setCategoryTree(categoryResponse.data || [])
      setProcurementCategories(procurementCategoriesResponse.data || [])
      setLoading(false)
    }

    loadProducts()
  }, [])

  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((item) => item.kategori_produk).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    [products]
  )

  const rootCategories = categoryTree.filter((item) => Number(item.level) === 1 && item.is_active !== false)
  const subCategories = categoryTree.filter((item) => Number(item.level) === 2 && String(item.parent_id) === rootId && (item.is_active !== false || isEditing))
  const itemCategories = categoryTree.filter((item) => Number(item.level) === 3 && String(item.parent_id) === subId && (item.is_active !== false || isEditing))
  const terminalCategory = itemCategories.length
    ? categoryTree.find((item) => String(item.id) === itemId)
    : subCategories.find((item) => String(item.id) === subId && String(item.full_code || '').length === 5)
  const procurementCategoryChoices = procurementCategories.filter(
    (item) => String(item.category_id) === String(terminalCategory?.id || '') &&
      (item.is_active || (isEditing && item.category_name === draft.kategori_pengadaan))
  )
  const previewSku = isEditing ? draft.sku_induk : nextArklineSku(String(terminalCategory?.full_code || ''), products)
  const procurementSubs = categoryTree.filter((item) => Number(item.level) === 2 && String(item.parent_id) === procurementDraft.rootId && item.is_active !== false)
  const procurementItems = categoryTree.filter((item) => Number(item.level) === 3 && String(item.parent_id) === procurementDraft.subId && item.is_active !== false)
  const procurementTerminalId = procurementItems.length ? procurementDraft.itemId : procurementDraft.subId

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toUpperCase()

    return products.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [item.sku_induk, item.nama_produk, item.kategori_produk, item.kategori_pengadaan]
          .filter(Boolean)
          .join(' ')
          .includes(keyword)

      const matchesCategory = !categoryFilter || item.kategori_produk === categoryFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.is_active) ||
        (statusFilter === 'inactive' && !item.is_active)

      return matchesKeyword && matchesCategory && matchesStatus
    })
  }, [categoryFilter, products, search, statusFilter])

  function openCreateModal() {
    if (!canCreateSku) return
    setDraft(emptyDraft)
    setRootId('')
    setSubId('')
    setItemId('')
    setIsEditing(false)
    setShowModal(true)
    setError('')
    setSuccess('')
  }

  function openEditModal(product) {
    if (!canEditProduct) return
    setDraft(product)
    const path = getCategoryPath(product.category_id, categoryTree)
    setRootId(path.rootId)
    setSubId(path.subId)
    setItemId(path.itemId)
    setIsEditing(true)
    setShowModal(true)
    setError('')
    setSuccess('')
  }

  function closeModal() {
    setShowModal(false)
    setDraft(emptyDraft)
    setIsEditing(false)
  }

  async function handleAddProcurement(event) {
    event.preventDefault()
    setProcurementError('')
    if (!canCreateSku) return

    const categoryId = Number(procurementTerminalId)
    const category = categoryTree.find((item) => Number(item.id) === categoryId && String(item.full_code || '').length === 5)
    const name = procurementDraft.name.trim().replace(/\s+/g, ' ').toUpperCase()
    if (!category || !name) {
      setProcurementError('Choose category, subcategory, item type, and enter the procurement category name.')
      return
    }
    if (procurementCategories.some((item) => item.category_name === name)) {
      setProcurementError('This procurement category already exists.')
      return
    }

    setSaving(true)
    const { data, error: insertError } = await supabase
      .from('arkline_dir_procurement_categories')
      .insert({ category_id: categoryId, category_name: name })
      .select('id, category_id, category_name, is_active')
      .single()
    setSaving(false)

    if (insertError) {
      setProcurementError(insertError.message)
      return
    }

    setProcurementCategories((previous) => [...previous, data].sort((a, b) => a.category_name.localeCompare(b.category_name)))
    setShowProcurementModal(false)
    setProcurementDraft({ rootId: '', subId: '', itemId: '', name: '' })
    setSuccess(`${name} added.`)
  }

  async function handleSave() {
    setError('')
    setSuccess('')

    if (isEditing && !canEditProduct) {
      setError('You do not have permission to edit Arkline products.')
      return
    }

    if (!isEditing && !canCreateSku) {
      setError('You do not have permission to create a new Arkline SKU.')
      return
    }

    if (!previewSku || !draft.nama_produk.trim()) {
      setError('Choose a valid category path and enter a product name. SKU sequences are limited to 999 per type.')
      return
    }

    if (!terminalCategory || !draft.kategori_pengadaan) {
      setError('Category and Procurement Category are required.')
      return
    }

    if (!procurementCategoryChoices.some((item) => item.category_name === draft.kategori_pengadaan)) {
      setError('Choose categories from the directory lists.')
      return
    }

    if (String(terminalCategory.full_code).toUpperCase() !== previewSku.slice(3, 8)) {
      setError('The category code does not match the SKU.')
      return
    }

    setSaving(true)

    if (isEditing) {
      const { data, error: updateError } = await supabase
        .from('arkline_dir_products')
        .update({
          category_id: Number(terminalCategory.id),
          kategori_pengadaan: draft.kategori_pengadaan || null,
          kategori_produk: draft.kategori_produk || null,
          nama_produk: draft.nama_produk,
          is_active: draft.is_active,
        })
        .eq('sku_induk', draft.sku_induk)
        .select('sku_induk, category_id, kategori_pengadaan, kategori_produk, nama_produk, is_active')
        .single()

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      setProducts((prev) =>
        prev
          .map((item) => (item.sku_induk === draft.sku_induk ? normalizeProduct(data) : item))
          .sort((a, b) => a.nama_produk.localeCompare(b.nama_produk, undefined, { numeric: true }))
      )
      setSuccess('Arkline product updated.')
      setSaving(false)
      closeModal()
      return
    }

    const existingCategoryName = products.find((product) => product.category_id === String(terminalCategory.id))?.kategori_produk
    const categoryName = existingCategoryName || String(terminalCategory.category_name).toUpperCase()
    const { data, error: insertError } = await supabase
      .from('arkline_dir_products')
      .insert({
        category_id: Number(terminalCategory.id),
        kategori_pengadaan: draft.kategori_pengadaan || null,
        kategori_produk: categoryName,
        nama_produk: draft.nama_produk,
        is_active: draft.is_active,
      })
      .select('sku_induk, category_id, kategori_pengadaan, kategori_produk, nama_produk, is_active')
      .single()

    if (insertError) {
      setError(insertError.code === '23505' ? 'This SKU was just used. Refresh the directory and try again.' : insertError.message)
      setSaving(false)
      return
    }

    setProducts((prev) =>
      [...prev, normalizeProduct(data)].sort((a, b) => a.nama_produk.localeCompare(b.nama_produk, undefined, { numeric: true }))
    )
    setSuccess('New Arkline SKU created.')
    setSaving(false)
    closeModal()
  }

  return (
    <div className={styles.page}>
      <section className={styles.directorySection}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.sectionTitle}>Product Directory</h1>
            <p className={styles.sectionHeaderNote}>
              {loading ? 'Loading SKU count...' : `${products.length.toLocaleString('en-US')} SKUs in total`}
            </p>
          </div>

          <div className={styles.buttonRow}>
            <div className={styles.viewToggle}>
              <button
                type="button"
                className={`${styles.toggleButton} ${viewMode === 'list' ? styles.toggleButtonActive : ''}`.trim()}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
              <button
                type="button"
                className={`${styles.toggleButton} ${viewMode === 'procurement' ? styles.toggleButtonActive : ''}`.trim()}
                onClick={() => setViewMode('procurement')}
              >
                Categories
              </button>
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => { setProcurementDraft({ rootId: '', subId: '', itemId: '', name: '' }); setProcurementError(''); setShowProcurementModal(true) }}
              disabled={!canCreateSku}
            >
              + New Procurement Category
            </button>
            <button type="button" className={styles.primaryButton} onClick={openCreateModal} disabled={!canCreateSku}>
              + New SKU
            </button>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.field}>
            <input
              className={styles.input}
              value={search}
              onChange={(event) => setSearch(event.target.value.toUpperCase())}
              placeholder="Search SKU, product, or category"
            />
          </div>

          <div className={styles.field}>
            <select className={styles.select} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All status</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>

          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => {
                setSearch('')
                setCategoryFilter('')
                setStatusFilter('all')
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}
        {success ? <p className={styles.successText}>{success}</p> : null}

        {loading ? (
          <div className={styles.emptyState}>Loading Arkline directory...</div>
        ) : viewMode === 'procurement' ? (
          <ProcurementGroups
            products={filteredProducts}
            allProducts={products}
            procurementCategories={procurementCategories}
            categoryTree={categoryTree}
            filtering={Boolean(search || categoryFilter || statusFilter !== 'all')}
            onEdit={openEditModal}
            canEdit={canEditProduct}
          />
        ) : !filteredProducts.length ? (
          <div className={styles.emptyState}>No Arkline product matches the current filters.</div>
        ) : (
          <div className={groupStyles.tableWrap}>
            <table className={`${groupStyles.table} ${groupStyles.listTable}`.trim()}>
              <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Procurement</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {filteredProducts.map((item) => (
                  <tr key={item.sku_induk} className={groupStyles.productRow}>
                    <td><strong>{item.nama_produk}</strong></td>
                    <td className={groupStyles.sku}>{item.sku_induk || '-'}</td>
                    <td>{item.kategori_produk || '-'}</td>
                    <td>{item.kategori_pengadaan || '-'}</td>
                    <td><span className={item.is_active ? styles.statusActive : styles.statusInactive}>{item.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td><button type="button" className={styles.secondaryButton} onClick={() => openEditModal(item)} disabled={!canEditProduct}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div>
              <h2 className={styles.sectionTitle}>{isEditing ? 'Edit Arkline Product' : 'Create New SKU'}</h2>
              <p className={styles.sectionSubtitle}>
                {isEditing
                  ? 'The SKU category path is locked because it forms part of the SKU. Procurement and product details can still be updated.'
                  : 'Choose a category path to generate the next Arkline SKU.'}
              </p>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>SKU Induk</label>
                <div className={styles.mutedValue}>{previewSku || 'Choose an item type'}</div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Status</label>
                <select
                  className={styles.select}
                  value={draft.is_active ? 'active' : 'inactive'}
                  onChange={(event) => setDraft((prev) => ({ ...prev, is_active: event.target.value === 'active' }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Category</label>
                <select
                  className={`${styles.select} ${isEditing ? styles.inputDisabled : ''}`.trim()}
                  value={rootId}
                  disabled={isEditing}
                  onChange={(event) => { setRootId(event.target.value); setSubId(''); setItemId(''); setDraft((previous) => ({ ...previous, kategori_pengadaan: '' })) }}
                >
                  <option value="">Select category</option>
                  {rootCategories.map((item) => <option key={item.id} value={item.id}>{item.category_name}</option>)}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Subcategory</label>
                <select
                  className={`${styles.select} ${!rootId || isEditing ? styles.inputDisabled : ''}`.trim()}
                  value={subId}
                  disabled={!rootId || isEditing}
                  onChange={(event) => { setSubId(event.target.value); setItemId(''); setDraft((previous) => ({ ...previous, kategori_pengadaan: '' })) }}
                >
                  <option value="">Select subcategory</option>
                  {subCategories.map((item) => <option key={item.id} value={item.id}>{item.category_name}</option>)}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Item Type</label>
                <select
                  className={`${styles.select} ${!subId || !itemCategories.length || isEditing ? styles.inputDisabled : ''}`.trim()}
                  value={itemCategories.length ? itemId : subId}
                  disabled={!subId || !itemCategories.length || isEditing}
                  onChange={(event) => { setItemId(event.target.value); setDraft((previous) => ({ ...previous, kategori_pengadaan: '' })) }}
                >
                  <option value="">{itemCategories.length ? 'Select item type' : subId ? 'Same as subcategory' : 'Select subcategory first'}</option>
                  {itemCategories.length
                    ? itemCategories.map((item) => <option key={item.id} value={item.id}>{item.category_name}</option>)
                    : subCategories.filter((item) => String(item.id) === subId && String(item.full_code || '').length === 5)
                        .map((item) => <option key={item.id} value={item.id}>{item.category_name}</option>)}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Procurement Category</label>
                <select
                  className={`${styles.select} ${!terminalCategory ? styles.inputDisabled : ''}`.trim()}
                  value={draft.kategori_pengadaan}
                  disabled={!terminalCategory}
                  onChange={(event) => setDraft((prev) => ({ ...prev, kategori_pengadaan: event.target.value }))}
                >
                  <option value="">Select procurement category</option>
                  {procurementCategoryChoices.map((item) => <option key={item.category_name} value={item.category_name}>{item.category_name}</option>)}
                </select>
              </div>

              <div className={`${styles.field} ${styles.fullSpan}`}>
                <label className={styles.label}>Nama Produk</label>
                <input
                  className={styles.input}
                  value={draft.nama_produk}
                  onChange={(event) => setDraft((prev) => ({ ...prev, nama_produk: event.target.value.toUpperCase() }))}
                  placeholder="NAMA PRODUK"
                />
              </div>
            </div>

            {error ? <p className={styles.errorText}>{error}</p> : null}

            <div className={styles.buttonRow}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSave}
                disabled={saving || (isEditing ? !canEditProduct : !canCreateSku)}
              >
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create SKU'}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={closeModal} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showProcurementModal ? (
        <div className={styles.modalOverlay}>
          <form className={styles.modalCard} onSubmit={handleAddProcurement}>
            <div>
              <h2 className={styles.sectionTitle}>New Procurement Category</h2>
              <p className={styles.sectionSubtitle}>Choose the category path, then name its procurement group.</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="procurement-root-id">Category</label>
              <select
                id="procurement-root-id"
                className={styles.select}
                value={procurementDraft.rootId}
                onChange={(event) => setProcurementDraft((previous) => ({ ...previous, rootId: event.target.value, subId: '', itemId: '' }))}
                required
              >
                <option value="">Select category</option>
                {rootCategories.map((item) => <option key={item.id} value={item.id}>{item.category_name}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="procurement-sub-id">Subcategory</label>
              <select id="procurement-sub-id" className={`${styles.select} ${!procurementDraft.rootId ? styles.inputDisabled : ''}`.trim()}
                value={procurementDraft.subId} disabled={!procurementDraft.rootId} required
                onChange={(event) => setProcurementDraft((previous) => ({ ...previous, subId: event.target.value, itemId: '' }))}>
                <option value="">Select subcategory</option>
                {procurementSubs.map((item) => <option key={item.id} value={item.id}>{item.category_name}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="procurement-item-id">Item Type</label>
              <select id="procurement-item-id" className={`${styles.select} ${!procurementDraft.subId || !procurementItems.length ? styles.inputDisabled : ''}`.trim()}
                value={procurementItems.length ? procurementDraft.itemId : procurementDraft.subId}
                disabled={!procurementDraft.subId || !procurementItems.length} required={procurementItems.length > 0}
                onChange={(event) => setProcurementDraft((previous) => ({ ...previous, itemId: event.target.value }))}>
                <option value="">{procurementItems.length ? 'Select item type' : procurementDraft.subId ? 'Same as subcategory' : 'Select subcategory first'}</option>
                {procurementItems.length
                  ? procurementItems.map((item) => <option key={item.id} value={item.id}>{item.category_name}</option>)
                  : procurementSubs.filter((item) => String(item.id) === procurementDraft.subId && String(item.full_code || '').length === 5)
                      .map((item) => <option key={item.id} value={item.id}>{item.category_name}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="procurement-category-name">Procurement Category</label>
              <input
                id="procurement-category-name"
                className={styles.input}
                value={procurementDraft.name}
                onChange={(event) => setProcurementDraft((previous) => ({ ...previous, name: event.target.value.toUpperCase() }))}
                placeholder="E.G. GENTLE POLO SS"
                required
                maxLength={100}
              />
            </div>

            {procurementError ? <p className={styles.errorText} role="alert">{procurementError}</p> : null}
            <div className={styles.buttonRow}>
              <button type="submit" className={styles.primaryButton} disabled={saving}> {saving ? 'Saving...' : 'Add Procurement Category'}</button>
              <button type="button" className={styles.secondaryButton} onClick={() => setShowProcurementModal(false)} disabled={saving}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
