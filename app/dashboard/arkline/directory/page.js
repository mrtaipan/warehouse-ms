'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import styles from '../arkline.module.css'

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
    kategori_pengadaan: String(row?.kategori_pengadaan || '').trim().toUpperCase(),
    kategori_produk: String(row?.kategori_produk || '').trim().toUpperCase(),
    nama_produk: String(row?.nama_produk || '').trim().toUpperCase(),
    is_active: row?.is_active !== false,
  }
}

export default function ArklineDirectoryPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('list')
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadProducts() {
      setLoading(true)
      setError('')

      const { data, error: fetchError } = await supabase
        .from('arkline_dir_products')
        .select('sku_induk, kategori_pengadaan, kategori_produk, nama_produk, is_active')
        .order('nama_produk', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setProducts((data || []).map(normalizeProduct))
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
    setDraft(emptyDraft)
    setIsEditing(false)
    setShowModal(true)
    setError('')
    setSuccess('')
  }

  function openEditModal(product) {
    setDraft(product)
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

  async function handleSave() {
    setError('')
    setSuccess('')

    if (!draft.sku_induk.trim() || !draft.nama_produk.trim()) {
      setError('SKU and product name are required.')
      return
    }

    setSaving(true)

    if (isEditing) {
      const { data, error: updateError } = await supabase
        .from('arkline_dir_products')
        .update({
          kategori_pengadaan: draft.kategori_pengadaan || null,
          kategori_produk: draft.kategori_produk || null,
          nama_produk: draft.nama_produk,
          is_active: draft.is_active,
        })
        .eq('sku_induk', draft.sku_induk)
        .select('sku_induk, kategori_pengadaan, kategori_produk, nama_produk, is_active')
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

    const { data, error: insertError } = await supabase
      .from('arkline_dir_products')
      .insert({
        sku_induk: draft.sku_induk,
        kategori_pengadaan: draft.kategori_pengadaan || null,
        kategori_produk: draft.kategori_produk || null,
        nama_produk: draft.nama_produk,
        is_active: draft.is_active,
      })
      .select('sku_induk, kategori_pengadaan, kategori_produk, nama_produk, is_active')
      .single()

    if (insertError) {
      setError(insertError.message)
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
                className={`${styles.toggleButton} ${viewMode === 'card' ? styles.toggleButtonActive : ''}`.trim()}
                onClick={() => setViewMode('card')}
              >
                Cards
              </button>
            </div>
            <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
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
        ) : !filteredProducts.length ? (
          <div className={styles.emptyState}>No Arkline product matches the current filters.</div>
        ) : viewMode === 'list' ? (
          <div className={`${styles.listWrap} ${styles.directoryListWrap}`.trim()}>
            <div className={`${styles.listHead} ${styles.directoryListHead}`.trim()}>
              <span>Product</span>
              <span>SKU</span>
              <span>Category</span>
              <span>Procurement</span>
              <span>Action</span>
            </div>

            {filteredProducts.map((item) => (
              <div key={item.sku_induk} className={`${styles.listRow} ${styles.directoryListRow}`.trim()}>
                <div>
                  <p className={styles.cellTitle}>{item.nama_produk}</p>
                  <p className={styles.cellMeta}>{item.is_active ? 'Active product' : 'Inactive product'}</p>
                </div>
                <div>{item.sku_induk || '-'}</div>
                <div>{item.kategori_produk || '-'}</div>
                <div>{item.kategori_pengadaan || '-'}</div>
                <div className={`${styles.buttonRow} ${styles.directoryActionCell}`.trim()}>
                  <span
                    className={`${styles.statusDot} ${item.is_active ? styles.statusDotActive : styles.statusDotInactive}`.trim()}
                    title={item.is_active ? 'Active' : 'Inactive'}
                    aria-label={item.is_active ? 'Active' : 'Inactive'}
                  />
                  <button type="button" className={`${styles.secondaryButton} ${styles.directoryEditButton}`.trim()} onClick={() => openEditModal(item)}>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`${styles.cardWrap} ${styles.directoryCardWrap}`.trim()}>
            {filteredProducts.map((item) => (
              <div key={item.sku_induk} className={`${styles.productCard} ${styles.directoryProductCard}`.trim()}>
                <div className={styles.productTop}>
                  <div>
                    <p className={styles.productSku}>{item.sku_induk || 'NO SKU'}</p>
                    <h2 className={styles.cellTitle}>{item.nama_produk}</h2>
                  </div>
                  <span
                    className={`${styles.statusDot} ${item.is_active ? styles.statusDotActive : styles.statusDotInactive}`.trim()}
                    title={item.is_active ? 'Active' : 'Inactive'}
                    aria-label={item.is_active ? 'Active' : 'Inactive'}
                  />
                </div>

                <p className={styles.featureText}>
                  <strong>Category:</strong> {item.kategori_produk || '-'}
                </p>
                <p className={styles.featureText}>
                  <strong>Procurement:</strong> {item.kategori_pengadaan || '-'}
                </p>

                <div className={styles.buttonRow}>
                  <button type="button" className={`${styles.secondaryButton} ${styles.directoryEditButton}`.trim()} onClick={() => openEditModal(item)}>
                    Edit Product
                  </button>
                </div>
              </div>
            ))}
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
                  ? 'SKU stays locked. You can update category, procurement type, product name, and active status.'
                  : 'Create a new Arkline SKU and fill in the basic directory fields.'}
              </p>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>SKU Induk</label>
                {isEditing ? (
                  <div className={styles.mutedValue}>{draft.sku_induk}</div>
                ) : (
                  <input
                    className={styles.input}
                    value={draft.sku_induk}
                    onChange={(event) => setDraft((prev) => ({ ...prev, sku_induk: event.target.value.toUpperCase() }))}
                    placeholder="SKU INDUK"
                  />
                )}
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
                <label className={styles.label}>Kategori Produk</label>
                <input
                  className={styles.input}
                  value={draft.kategori_produk}
                  onChange={(event) => setDraft((prev) => ({ ...prev, kategori_produk: event.target.value.toUpperCase() }))}
                  placeholder="KATEGORI PRODUK"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Kategori Pengadaan</label>
                <input
                  className={styles.input}
                  value={draft.kategori_pengadaan}
                  onChange={(event) => setDraft((prev) => ({ ...prev, kategori_pengadaan: event.target.value.toUpperCase() }))}
                  placeholder="KATEGORI PENGADAAN"
                />
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
              <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create SKU'}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={closeModal} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
