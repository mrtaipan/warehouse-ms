'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import styles from '../../arkline.module.css'

const supabase = createClient()

const emptyDraft = {
  id: '',
  kategori_pengadaan: '',
  sku_induk: '',
  material_id: '',
  size_variant: '',
  color_variant: '',
  qty_per_1: '',
  waste_pct: '',
  is_active: true,
}

function normalizeProduct(row) {
  return {
    sku_induk: String(row?.sku_induk || '').trim().toUpperCase(),
    kategori_pengadaan: String(row?.kategori_pengadaan || '').trim().toUpperCase(),
    nama_produk: String(row?.nama_produk || '').trim().toUpperCase(),
    is_active: row?.is_active !== false,
  }
}

function normalizeMaterial(row) {
  return {
    id: String(row?.id || '').trim(),
    material_name: String(row?.material_name || '').trim().toUpperCase(),
    unit: String(row?.unit || 'PCS').trim().toUpperCase(),
    is_active: row?.is_active !== false,
  }
}

function normalizeBomLine(row, productsBySku, materialsById) {
  const skuInduk = String(row?.sku_induk || '').trim().toUpperCase()
  const product = productsBySku[skuInduk] || null
  const material = materialsById[String(row?.material_id || '').trim()] || null

  return {
    id: String(row?.id || '').trim(),
    kategori_pengadaan: String(row?.kategori_pengadaan || '').trim().toUpperCase(),
    sku_induk: skuInduk,
    material_id: String(row?.material_id || '').trim(),
    size_variant: String(row?.size_variant || '').trim().toUpperCase(),
    color_variant: String(row?.color_variant || '').trim().toUpperCase(),
    qty_per_1: Number(row?.qty_per_1 || 0),
    waste_pct: Number(row?.waste_pct || 0),
    is_active: row?.is_active !== false,
    product_name: product?.nama_produk || '',
    material_name: material?.material_name || '',
    material_unit: material?.unit || 'PCS',
  }
}

function formatNumber(value, digits = 4) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number.toFixed(digits).replace(/\.?0+$/, '') : '0'
}

export default function ArklineBomPage() {
  const [bomLines, setBomLines] = useState([])
  const [products, setProducts] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [procurementFilter, setProcurementFilter] = useState('')
  const [skuFilter, setSkuFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      const [
        { data: productRows, error: productError },
        { data: materialRows, error: materialError },
        { data: bomRows, error: bomError },
      ] = await Promise.all([
        supabase
          .from('arkline_dir_products')
          .select('sku_induk, kategori_pengadaan, nama_produk, is_active')
          .order('nama_produk', { ascending: true }),
        supabase
          .from('arkline_dir_materials')
          .select('id, material_name, unit, is_active')
          .order('material_name', { ascending: true }),
        supabase
          .from('arkline_dir_bom')
          .select('id, kategori_pengadaan, sku_induk, material_id, size_variant, color_variant, qty_per_1, waste_pct, is_active')
          .order('updated_at', { ascending: false }),
      ])

      if (productError || materialError || bomError) {
        setError(productError?.message || materialError?.message || bomError?.message || 'Failed to load BOM workspace.')
        setLoading(false)
        return
      }

      const normalizedProducts = (productRows || []).map(normalizeProduct)
      const normalizedMaterials = (materialRows || []).map(normalizeMaterial)
      const productsBySku = normalizedProducts.reduce((acc, item) => {
        acc[item.sku_induk] = item
        return acc
      }, {})
      const materialsById = normalizedMaterials.reduce((acc, item) => {
        acc[item.id] = item
        return acc
      }, {})

      setProducts(normalizedProducts)
      setMaterials(normalizedMaterials)
      setBomLines((bomRows || []).map((row) => normalizeBomLine(row, productsBySku, materialsById)))
      setLoading(false)
    }

    loadData()
  }, [])

  const activeProducts = useMemo(() => products.filter((item) => item.is_active), [products])
  const activeMaterials = useMemo(() => materials.filter((item) => item.is_active), [materials])

  const procurementOptions = useMemo(
    () => Array.from(new Set(activeProducts.map((item) => item.kategori_pengadaan).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [activeProducts]
  )

  const skuOptions = useMemo(
    () =>
      activeProducts
        .filter((item) => !procurementFilter || item.kategori_pengadaan === procurementFilter)
        .sort((a, b) => a.nama_produk.localeCompare(b.nama_produk, undefined, { numeric: true })),
    [activeProducts, procurementFilter]
  )

  const filteredBomLines = useMemo(() => {
    const keyword = search.trim().toUpperCase()

    return bomLines.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [
          item.product_name,
          item.sku_induk,
          item.kategori_pengadaan,
          item.material_name,
          item.size_variant,
          item.color_variant,
        ]
          .filter(Boolean)
          .join(' ')
          .includes(keyword)

      const matchesProcurement = !procurementFilter || item.kategori_pengadaan === procurementFilter
      const matchesSku = !skuFilter || item.sku_induk === skuFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.is_active) ||
        (statusFilter === 'inactive' && !item.is_active)

      return matchesKeyword && matchesProcurement && matchesSku && matchesStatus
    })
  }, [bomLines, procurementFilter, search, skuFilter, statusFilter])

  function openCreateModal() {
    setDraft(emptyDraft)
    setIsEditing(false)
    setShowModal(true)
    setError('')
    setSuccess('')
  }

  function openEditModal(line) {
    setDraft({
      id: line.id,
      kategori_pengadaan: line.kategori_pengadaan,
      sku_induk: line.sku_induk,
      material_id: line.material_id,
      size_variant: line.size_variant,
      color_variant: line.color_variant,
      qty_per_1: formatNumber(line.qty_per_1),
      waste_pct: formatNumber(line.waste_pct),
      is_active: line.is_active,
    })
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

    if (!draft.kategori_pengadaan || !draft.material_id || !draft.qty_per_1) {
      setError('Procurement category, material, and qty per 1 are required.')
      return
    }

    setSaving(true)

    const payload = {
      kategori_pengadaan: draft.kategori_pengadaan,
      sku_induk: draft.sku_induk || null,
      material_id: draft.material_id,
      size_variant: draft.size_variant || null,
      color_variant: draft.color_variant || null,
      qty_per_1: Number(draft.qty_per_1 || 0),
      waste_pct: Number(draft.waste_pct || 0),
      is_active: draft.is_active,
    }

    const query = isEditing
      ? supabase.from('arkline_dir_bom').update(payload).eq('id', draft.id)
      : supabase.from('arkline_dir_bom').insert(payload)

    const { data, error: saveError } = await query
      .select('id, kategori_pengadaan, sku_induk, material_id, size_variant, color_variant, qty_per_1, waste_pct, is_active')
      .single()

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    const productsBySku = activeProducts.reduce((acc, item) => {
      acc[item.sku_induk] = item
      return acc
    }, {})
    const materialsById = activeMaterials.reduce((acc, item) => {
      acc[item.id] = item
      return acc
    }, {})
    const normalized = normalizeBomLine(data, productsBySku, materialsById)

    setBomLines((prev) =>
      isEditing
        ? prev.map((item) => (item.id === normalized.id ? normalized : item))
        : [normalized, ...prev]
    )
    setSuccess(isEditing ? 'BOM line updated.' : 'BOM line created.')
    setSaving(false)
    closeModal()
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.sectionCard} ${styles.directoryCard}`.trim()}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.sectionTitle}>BOM</h1>
            <p className={styles.sectionSubtitle}>
              Maintain BOM lines by procurement category, optional SKU override, material, and variant rules.
            </p>
          </div>

          <div className={styles.buttonRow}>
            <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
              + New BOM Line
            </button>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.field}>
            <input
              className={styles.input}
              value={search}
              onChange={(event) => setSearch(event.target.value.toUpperCase())}
              placeholder="Search product, SKU, material, or variant"
            />
          </div>

          <div className={styles.field}>
            <select
              className={styles.select}
              value={procurementFilter}
              onChange={(event) => {
                setProcurementFilter(event.target.value)
                setSkuFilter('')
              }}
            >
              <option value="">All procurement</option>
              {procurementOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <select className={styles.select} value={skuFilter} onChange={(event) => setSkuFilter(event.target.value)}>
              <option value="">{procurementFilter ? 'All SKU in category' : 'All SKU override'}</option>
              {skuOptions.map((item) => (
                <option key={item.sku_induk} value={item.sku_induk}>
                  {item.nama_produk} ({item.sku_induk})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.buttonRow}>
            <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
              <option value="all">All status</option>
            </select>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => {
                setSearch('')
                setProcurementFilter('')
                setSkuFilter('')
                setStatusFilter('active')
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}
        {success ? <p className={styles.successText}>{success}</p> : null}

        {loading ? (
          <div className={styles.emptyState}>Loading BOM lines...</div>
        ) : !filteredBomLines.length ? (
          <div className={styles.emptyState}>No BOM line matches the current filters.</div>
        ) : (
          <div className={styles.listWrap}>
            <div
              className={styles.listHead}
              style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) 120px 110px 110px 90px auto' }}
            >
              <span>Product</span>
              <span>Material</span>
              <span>Size</span>
              <span>Color</span>
              <span>Qty / 1</span>
              <span>Waste %</span>
              <span>Action</span>
            </div>

            {filteredBomLines.map((item) => (
              <div
                key={item.id}
                className={styles.listRow}
                style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) 120px 110px 110px 90px auto' }}
              >
                <div>
                  <p className={styles.cellTitle}>{item.product_name || item.kategori_pengadaan}</p>
                  <p className={styles.cellMeta}>
                    {item.sku_induk ? `${item.sku_induk} · SKU override` : `${item.kategori_pengadaan} · Category default`}
                  </p>
                </div>
                <div>
                  <p className={styles.cellTitle}>{item.material_name || '-'}</p>
                  <p className={styles.cellMeta}>{item.material_unit || '-'}</p>
                </div>
                <div>{item.size_variant || 'ALL'}</div>
                <div>{item.color_variant || 'ALL'}</div>
                <div>{formatNumber(item.qty_per_1)}</div>
                <div>{formatNumber(item.waste_pct, 2)}</div>
                <div className={styles.buttonRow}>
                  <span className={`${styles.status} ${item.is_active ? styles.statusActive : styles.statusInactive}`.trim()}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button type="button" className={styles.secondaryButton} onClick={() => openEditModal(item)}>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showModal ? (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Arkline</p>
                <h2 className={styles.sectionTitle}>{isEditing ? 'Edit BOM Line' : 'New BOM Line'}</h2>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>
                Close
              </button>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Procurement Category</label>
                <select
                  className={styles.select}
                  value={draft.kategori_pengadaan}
                  onChange={(event) => setDraft((prev) => ({ ...prev, kategori_pengadaan: event.target.value, sku_induk: '' }))}
                >
                  <option value="">Choose procurement</option>
                  {procurementOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>SKU Override</label>
                <select
                  className={styles.select}
                  value={draft.sku_induk}
                  onChange={(event) => setDraft((prev) => ({ ...prev, sku_induk: event.target.value }))}
                >
                  <option value="">Category default (all SKU)</option>
                  {skuOptions.map((item) => (
                    <option key={item.sku_induk} value={item.sku_induk}>
                      {item.nama_produk} ({item.sku_induk})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Material</label>
                <select
                  className={styles.select}
                  value={draft.material_id}
                  onChange={(event) => setDraft((prev) => ({ ...prev, material_id: event.target.value }))}
                >
                  <option value="">Choose material</option>
                  {activeMaterials.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.material_name} ({item.unit})
                    </option>
                  ))}
                </select>
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
                <label className={styles.label}>Size Variant</label>
                <input
                  className={styles.input}
                  value={draft.size_variant}
                  onChange={(event) => setDraft((prev) => ({ ...prev, size_variant: event.target.value.toUpperCase() }))}
                  placeholder="ALL / S / M / L"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Color Variant</label>
                <input
                  className={styles.input}
                  value={draft.color_variant}
                  onChange={(event) => setDraft((prev) => ({ ...prev, color_variant: event.target.value.toUpperCase() }))}
                  placeholder="ALL / BLACK / WHITE"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Qty Per 1</label>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  className={styles.input}
                  value={draft.qty_per_1}
                  onChange={(event) => setDraft((prev) => ({ ...prev, qty_per_1: event.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Waste %</label>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  className={styles.input}
                  value={draft.waste_pct}
                  onChange={(event) => setDraft((prev) => ({ ...prev, waste_pct: event.target.value }))}
                />
              </div>
            </div>

            {error ? <p className={styles.errorText}>{error}</p> : null}

            <div className={styles.buttonRow}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : isEditing ? 'Update BOM Line' : 'Save BOM Line'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
