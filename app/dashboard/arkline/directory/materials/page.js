'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import styles from '../../arkline.module.css'
import useArklineAccess from '../../use-arkline-access'

const supabase = createClient()

const emptyDraft = {
  id: '',
  material_name: '',
  unit: 'PCS',
  is_active: true,
}

function normalizeMaterial(row) {
  return {
    id: String(row?.id || '').trim(),
    material_name: String(row?.material_name || '').trim().toUpperCase(),
    unit: String(row?.unit || 'PCS').trim().toUpperCase(),
    is_active: row?.is_active !== false,
  }
}

export default function ArklineMaterialDirectoryPage() {
  const { access } = useArklineAccess()
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('list')
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadMaterials() {
      setLoading(true)
      setError('')

      const { data, error: fetchError } = await supabase
        .from('arkline_dir_materials')
        .select('id, material_name, unit, is_active')
        .order('material_name', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setMaterials((data || []).map(normalizeMaterial))
      setLoading(false)
    }

    loadMaterials()
  }, [])

  const filteredMaterials = useMemo(() => {
    const keyword = search.trim().toUpperCase()

    return materials.filter((item) => {
      const matchesKeyword = !keyword || [item.material_name, item.unit].filter(Boolean).join(' ').includes(keyword)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.is_active) ||
        (statusFilter === 'inactive' && !item.is_active)

      return matchesKeyword && matchesStatus
    })
  }, [materials, search, statusFilter])

  function openCreateModal() {
    if (!access.directoryCreate) return
    setDraft(emptyDraft)
    setIsEditing(false)
    setShowModal(true)
    setError('')
    setSuccess('')
  }

  function openEditModal(material) {
    if (!access.directoryCreate) return
    setDraft(material)
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

    if (!draft.material_name.trim()) {
      setError('Material name is required.')
      return
    }

    setSaving(true)

    if (isEditing) {
      const { data, error: updateError } = await supabase
        .from('arkline_dir_materials')
        .update({
          material_name: draft.material_name,
          unit: draft.unit || 'PCS',
          is_active: draft.is_active,
        })
        .eq('id', draft.id)
        .select('id, material_name, unit, is_active')
        .single()

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      setMaterials((prev) =>
        prev
          .map((item) => (item.id === draft.id ? normalizeMaterial(data) : item))
          .sort((a, b) => a.material_name.localeCompare(b.material_name, undefined, { numeric: true }))
      )
      setSuccess('Arkline material updated.')
      setSaving(false)
      closeModal()
      return
    }

    const { data, error: insertError } = await supabase
      .from('arkline_dir_materials')
      .insert({
        material_name: draft.material_name,
        unit: draft.unit || 'PCS',
        is_active: draft.is_active,
      })
      .select('id, material_name, unit, is_active')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setMaterials((prev) =>
      [...prev, normalizeMaterial(data)].sort((a, b) => a.material_name.localeCompare(b.material_name, undefined, { numeric: true }))
    )
    setSuccess('New Arkline material created.')
    setSaving(false)
    closeModal()
  }

  return (
    <div className={styles.page}>
      <section className={styles.directorySection}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.sectionTitle}>Material Directory</h1>
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
            <button type="button" className={styles.primaryButton} onClick={openCreateModal} disabled={!access.directoryCreate}>
              + New Material
            </button>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.field}>
            <input
              className={styles.input}
              value={search}
              onChange={(event) => setSearch(event.target.value.toUpperCase())}
              placeholder="Search material or unit"
            />
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
          <div className={styles.emptyState}>Loading Arkline materials...</div>
        ) : !filteredMaterials.length ? (
          <div className={styles.emptyState}>No Arkline material matches the current filters.</div>
        ) : viewMode === 'list' ? (
          <div className={`${styles.listWrap} ${styles.directoryListWrap}`.trim()}>
            <div className={`${styles.listHead} ${styles.directoryListHead}`.trim()}>
              <span>Material</span>
              <span>Unit</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {filteredMaterials.map((item) => (
              <div key={item.id} className={`${styles.listRow} ${styles.directoryListRow}`.trim()}>
                <div>
                  <p className={styles.cellTitle}>{item.material_name}</p>
                  <p className={styles.cellMeta}>{item.is_active ? 'Active material' : 'Inactive material'}</p>
                </div>
                <div>{item.unit || '-'}</div>
                <div>{item.is_active ? 'Active' : 'Inactive'}</div>
                <div className={`${styles.buttonRow} ${styles.directoryActionCell}`.trim()}>
                  <span
                    className={`${styles.statusDot} ${item.is_active ? styles.statusDotActive : styles.statusDotInactive}`.trim()}
                    title={item.is_active ? 'Active' : 'Inactive'}
                    aria-label={item.is_active ? 'Active' : 'Inactive'}
                  />
                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${styles.directoryEditButton}`.trim()}
                    onClick={() => openEditModal(item)}
                    disabled={!access.directoryCreate}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`${styles.cardWrap} ${styles.directoryCardWrap}`.trim()}>
            {filteredMaterials.map((item) => (
              <div key={item.id} className={`${styles.productCard} ${styles.directoryProductCard}`.trim()}>
                <div className={styles.productTop}>
                  <div>
                    <p className={styles.productSku}>{item.unit || 'NO UNIT'}</p>
                    <h2 className={styles.cellTitle}>{item.material_name}</h2>
                  </div>
                  <span
                    className={`${styles.statusDot} ${item.is_active ? styles.statusDotActive : styles.statusDotInactive}`.trim()}
                    title={item.is_active ? 'Active' : 'Inactive'}
                    aria-label={item.is_active ? 'Active' : 'Inactive'}
                  />
                </div>

                <p className={styles.featureText}>
                  <strong>Unit:</strong> {item.unit || '-'}
                </p>

                <div className={styles.buttonRow}>
                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${styles.directoryEditButton}`.trim()}
                    onClick={() => openEditModal(item)}
                    disabled={!access.directoryCreate}
                  >
                    Edit Material
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
              <h2 className={styles.sectionTitle}>{isEditing ? 'Edit Arkline Material' : 'Create New Material'}</h2>
              <p className={styles.sectionSubtitle}>
                {isEditing
                  ? 'Update material name, unit, and active status.'
                  : 'Create a new material entry for the Arkline material directory.'}
              </p>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Material Name</label>
                <input
                  className={styles.input}
                  value={draft.material_name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, material_name: event.target.value.toUpperCase() }))}
                  placeholder="MATERIAL NAME"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Unit</label>
                <input
                  className={styles.input}
                  value={draft.unit}
                  onChange={(event) => setDraft((prev) => ({ ...prev, unit: event.target.value.toUpperCase() }))}
                  placeholder="PCS"
                />
              </div>

              <div className={styles.fieldCheckbox}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(event) => setDraft((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <span>Active material</span>
                </label>
              </div>
            </div>

            {error ? <p className={styles.errorText}>{error}</p> : null}

            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostButton} onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving...' : isEditing ? 'Update Material' : 'Save Material'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
