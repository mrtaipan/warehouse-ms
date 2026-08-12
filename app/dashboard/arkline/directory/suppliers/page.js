'use client'

import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'
import styles from '../../arkline.module.css'
import useArklineAccess from '../../use-arkline-access'

const supabase = createClient()
const ARKLINE_GROUP = 'ARKLINE'

const emptySupplierDraft = {
  id: '',
  supplier_code: '',
  supplier_name: '',
  contact_person: '',
  phone: '',
  address: '',
  notes: '',
  is_active: true,
  materialIds: [],
}

const emptyMaterialDraft = {
  material_name: '',
  unit: 'PCS',
}

function normalizeSupplier(row) {
  return {
    id: String(row?.id || '').trim(),
    supplier_code: String(row?.supplier_code || '').trim().toUpperCase(),
    supplier_name: String(row?.supplier_name || '').trim().toUpperCase(),
    group: String(row?.group || '').trim().toUpperCase(),
    contact_person: String(row?.contact_person || '').trim().toUpperCase(),
    phone: String(row?.phone || '').trim(),
    address: String(row?.address || '').trim().toUpperCase(),
    notes: String(row?.notes || '').trim(),
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

function normalizeSupplierMaterial(row) {
  return {
    id: String(row?.id || '').trim(),
    supplier_id: String(row?.supplier_id || '').trim(),
    material_id: String(row?.material_id || '').trim(),
    is_active: row?.is_active !== false,
  }
}

function sortByName(left, right, key) {
  return String(left?.[key] || '').localeCompare(String(right?.[key] || ''), undefined, { numeric: true })
}

function getSupplierMaterialIds(materialLinks, supplierId) {
  const normalizedSupplierId = String(supplierId || '').trim()
  return (materialLinks || [])
    .filter((item) => item.supplier_id === normalizedSupplierId && item.is_active)
    .map((item) => item.material_id)
}

function getSupplierMaterialNames(materialsById, materialIds) {
  return (materialIds || [])
    .map((id) => materialsById.get(String(id || '').trim())?.material_name)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

async function generateSupplierCode() {
  const { data, error } = await supabase
    .from('dir_suppliers')
    .select('supplier_code')
    .order('supplier_code', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  const lastCode = String(data?.[0]?.supplier_code || '').trim().toUpperCase()
  const match = lastCode.match(/^SUPP-(\d+)$/)
  const nextNumber = match ? Number(match[1]) + 1 : 1
  return `SUPP-${String(nextNumber).padStart(3, '0')}`
}

export default function ArklineSupplierDirectoryPage() {
  const { access } = useArklineAccess()
  const canViewSupplier = access.directorySuppliers || access.directory
  const canCreateSupplier = access.directorySuppliersCreate || access.directoryCreate
  const canEditSupplier = access.directorySuppliersEdit || access.directoryCreate
  const canCreateMaterial = access.directoryMaterialsCreate || canCreateSupplier
  const [suppliers, setSuppliers] = useState([])
  const [materials, setMaterials] = useState([])
  const [materialLinks, setMaterialLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)
  const [materialSaving, setMaterialSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(emptySupplierDraft)
  const [materialSearch, setMaterialSearch] = useState('')
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false)
  const [showMaterialCreator, setShowMaterialCreator] = useState(false)
  const [materialDraft, setMaterialDraft] = useState(emptyMaterialDraft)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadDirectoryData() {
    setLoading(true)
    setError('')

    const [
      { data: supplierRows, error: supplierError },
      { data: materialRows, error: materialError },
      { data: linkRows, error: linkError },
    ] = await Promise.all([
      supabase
        .from('dir_suppliers')
        .select('id, supplier_code, supplier_name, group, contact_person, phone, address, notes, is_active')
        .ilike('group', ARKLINE_GROUP)
        .order('supplier_name', { ascending: true }),
      supabase
        .from('arkline_dir_materials')
        .select('id, material_name, unit, is_active')
        .order('material_name', { ascending: true }),
      supabase
        .from('arkline_supplier_materials')
        .select('id, supplier_id, material_id, is_active'),
    ])

    if (supplierError || materialError || linkError) {
      setError(
        linkError
          ? `${linkError.message}. Pastikan SQL supabase/arkline_supplier_materials.sql sudah dijalankan.`
          : supplierError?.message || materialError?.message || 'Failed to load Arkline supplier directory.'
      )
      setLoading(false)
      return
    }

    setSuppliers((supplierRows || []).map(normalizeSupplier).sort((left, right) => sortByName(left, right, 'supplier_name')))
    setMaterials((materialRows || []).map(normalizeMaterial).sort((left, right) => sortByName(left, right, 'material_name')))
    setMaterialLinks((linkRows || []).map(normalizeSupplierMaterial))
    setLoading(false)
  }

  useEffect(() => {
    void loadDirectoryData()
  }, [])

  const materialsById = useMemo(() => new Map(materials.map((item) => [item.id, item])), [materials])

  const filteredMaterialsForPicker = useMemo(() => {
    const keyword = materialSearch.trim().toUpperCase()
    return materials.filter((item) => {
      if (!item.is_active) return false
      if ((draft.materialIds || []).includes(item.id)) return false
      return !keyword || [item.material_name, item.unit].join(' ').includes(keyword)
    })
  }, [draft.materialIds, materialSearch, materials])

  const exactMaterialMatch = useMemo(
    () =>
      materials.find(
        (item) =>
          item.is_active &&
          !(draft.materialIds || []).includes(item.id) &&
          item.material_name === materialSearch.trim().toUpperCase()
      ) || null,
    [draft.materialIds, materialSearch, materials]
  )

  const selectedDraftMaterials = useMemo(
    () =>
      (draft.materialIds || [])
        .map((id) => materialsById.get(String(id || '').trim()))
        .filter(Boolean)
        .sort((left, right) => sortByName(left, right, 'material_name')),
    [draft.materialIds, materialsById]
  )

  const filteredSuppliers = useMemo(() => {
    const keyword = search.trim().toUpperCase()

    return suppliers.filter((supplier) => {
      const materialIds = getSupplierMaterialIds(materialLinks, supplier.id)
      const materialNames = getSupplierMaterialNames(materialsById, materialIds)
      const matchesKeyword =
        !keyword ||
        [
          supplier.supplier_code,
          supplier.supplier_name,
          supplier.contact_person,
          supplier.phone,
          supplier.address,
          supplier.notes,
          ...materialNames,
        ]
          .filter(Boolean)
          .join(' ')
          .includes(keyword)
      const matchesMaterial = !materialFilter || materialIds.includes(materialFilter)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && supplier.is_active) ||
        (statusFilter === 'inactive' && !supplier.is_active)

      return matchesKeyword && matchesMaterial && matchesStatus
    })
  }, [materialFilter, materialLinks, materialsById, search, statusFilter, suppliers])

  async function openCreateModal() {
    if (!canCreateSupplier) return
    setIsEditing(false)
    setShowModal(true)
    setShowMaterialCreator(false)
    setMaterialSearch('')
    setSelectedMaterialId('')
    setShowMaterialDropdown(false)
    setMaterialDraft(emptyMaterialDraft)
    setError('')
    setSuccess('')
    setCodeLoading(true)
    setDraft(emptySupplierDraft)

    try {
      const nextCode = await generateSupplierCode()
      setDraft((prev) => ({ ...prev, supplier_code: nextCode }))
    } catch (codeError) {
      setError(codeError.message || 'Failed to generate supplier code.')
    } finally {
      setCodeLoading(false)
    }
  }

  function openEditModal(supplier) {
    if (!canEditSupplier) return
    setIsEditing(true)
    setShowModal(true)
    setShowMaterialCreator(false)
    setMaterialSearch('')
    setSelectedMaterialId('')
    setShowMaterialDropdown(false)
    setMaterialDraft(emptyMaterialDraft)
    setError('')
    setSuccess('')
    setDraft({
      id: supplier.id,
      supplier_code: supplier.supplier_code,
      supplier_name: supplier.supplier_name,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      address: supplier.address,
      notes: supplier.notes,
      is_active: supplier.is_active,
      materialIds: getSupplierMaterialIds(materialLinks, supplier.id),
    })
  }

  function closeModal() {
    if (saving || materialSaving) return
    setShowModal(false)
    setIsEditing(false)
    setDraft(emptySupplierDraft)
    setMaterialSearch('')
    setSelectedMaterialId('')
    setShowMaterialDropdown(false)
    setShowMaterialCreator(false)
    setMaterialDraft(emptyMaterialDraft)
  }

  function updateDraft(name, value) {
    let nextValue = value
    if (name === 'phone') {
      nextValue = value.replace(/\D/g, '')
    } else if (!['notes'].includes(name)) {
      nextValue = value.toUpperCase()
    }

    setDraft((prev) => ({ ...prev, [name]: nextValue }))
  }

  function addSelectedMaterialToList() {
    const materialId = selectedMaterialId || exactMaterialMatch?.id || ''
    if (!materialId) return

    setDraft((prev) => ({
      ...prev,
      materialIds: Array.from(new Set([...(prev.materialIds || []), materialId])),
    }))
    setMaterialSearch('')
    setSelectedMaterialId('')
    setShowMaterialDropdown(false)
  }

  function removeMaterialFromList(materialId) {
    setDraft((prev) => ({
      ...prev,
      materialIds: (prev.materialIds || []).filter((id) => id !== materialId),
    }))
  }

  async function saveSupplierMaterialLinks(supplierId) {
    const normalizedSupplierId = String(supplierId || '').trim()
    const numericSupplierId = Number(normalizedSupplierId)
    const selectedMaterialIds = Array.from(new Set(draft.materialIds || []))
    const existingLinks = materialLinks.filter((item) => item.supplier_id === normalizedSupplierId)
    const selectedSet = new Set(selectedMaterialIds)
    const inactiveMaterialIds = existingLinks
      .filter((item) => item.is_active && !selectedSet.has(item.material_id))
      .map((item) => item.material_id)

    if (selectedMaterialIds.length) {
      const { error: upsertError } = await supabase.from('arkline_supplier_materials').upsert(
        selectedMaterialIds.map((materialId) => ({
          supplier_id: numericSupplierId,
          material_id: materialId,
          is_active: true,
        })),
        { onConflict: 'supplier_id,material_id' }
      )

      if (upsertError) {
        throw new Error(upsertError.message)
      }
    }

    if (inactiveMaterialIds.length) {
      const { error: updateError } = await supabase
        .from('arkline_supplier_materials')
        .update({ is_active: false })
        .eq('supplier_id', numericSupplierId)
        .in('material_id', inactiveMaterialIds)

      if (updateError) {
        throw new Error(updateError.message)
      }
    }
  }

  async function handleSaveSupplier() {
    setError('')
    setSuccess('')

    if (isEditing && !canEditSupplier) {
      setError('You do not have permission to edit Arkline suppliers.')
      return
    }

    if (!isEditing && !canCreateSupplier) {
      setError('You do not have permission to create Arkline suppliers.')
      return
    }

    if (!draft.supplier_code.trim() || !draft.supplier_name.trim()) {
      setError('Supplier code and supplier name are required.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        supplier_name: draft.supplier_name.trim() || null,
        group: ARKLINE_GROUP,
        contact_person: draft.contact_person.trim() || null,
        phone: draft.phone.trim() || null,
        address: draft.address.trim() || null,
        notes: draft.notes.trim() || null,
        is_active: draft.is_active,
      }

      let savedSupplier = null
      if (isEditing) {
        const { data, error: updateError } = await supabase
          .from('dir_suppliers')
          .update(payload)
          .eq('id', draft.id)
          .select('id, supplier_code, supplier_name, group, contact_person, phone, address, notes, is_active')
          .single()

        if (updateError) throw new Error(updateError.message)
        savedSupplier = normalizeSupplier(data)
      } else {
        const { data, error: insertError } = await supabase
          .from('dir_suppliers')
          .insert({
            ...payload,
            supplier_code: draft.supplier_code,
          })
          .select('id, supplier_code, supplier_name, group, contact_person, phone, address, notes, is_active')
          .single()

        if (insertError) throw new Error(insertError.message)
        savedSupplier = normalizeSupplier(data)
      }

      await saveSupplierMaterialLinks(savedSupplier.id)
      await loadDirectoryData()
      setSuccess(isEditing ? 'Arkline supplier updated.' : 'Arkline supplier created.')
      setShowModal(false)
      setIsEditing(false)
      setDraft(emptySupplierDraft)
      setMaterialSearch('')
      setSelectedMaterialId('')
      setShowMaterialDropdown(false)
      setShowMaterialCreator(false)
      setMaterialDraft(emptyMaterialDraft)
    } catch (saveError) {
      setError(saveError.message || 'Failed to save Arkline supplier.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateMaterial() {
    setError('')

    if (!canCreateMaterial) {
      setError('You do not have permission to create Arkline materials.')
      return
    }

    if (!materialDraft.material_name.trim()) {
      setError('Material name is required.')
      return
    }

    setMaterialSaving(true)
    try {
      const { data, error: insertError } = await supabase
        .from('arkline_dir_materials')
        .insert({
          material_name: materialDraft.material_name.trim().toUpperCase(),
          unit: materialDraft.unit.trim().toUpperCase() || 'PCS',
          is_active: true,
        })
        .select('id, material_name, unit, is_active')
        .single()

      if (insertError) throw new Error(insertError.message)

      const normalizedMaterial = normalizeMaterial(data)
      setMaterials((prev) => [...prev, normalizedMaterial].sort((left, right) => sortByName(left, right, 'material_name')))
      setDraft((prev) => ({
        ...prev,
        materialIds: Array.from(new Set([...(prev.materialIds || []), normalizedMaterial.id])),
      }))
      setMaterialDraft(emptyMaterialDraft)
      setMaterialSearch('')
      setSelectedMaterialId('')
      setShowMaterialDropdown(false)
      setShowMaterialCreator(false)
    } catch (materialError) {
      setError(materialError.message || 'Failed to create material.')
    } finally {
      setMaterialSaving(false)
    }
  }

  if (!canViewSupplier) {
    return <div className={styles.emptyState}>Your account does not have Arkline supplier directory access yet.</div>
  }

  return (
    <div className={styles.page}>
      <section className={styles.directorySection}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Arkline</p>
            <h1 className={styles.sectionTitle}>Supplier Directory</h1>
          </div>

          <button type="button" className={styles.primaryButton} onClick={() => void openCreateModal()} disabled={!canCreateSupplier}>
            + New Supplier
          </button>
        </div>

        <div className={`${styles.toolbar} ${styles.supplierToolbar}`.trim()}>
          <div className={styles.field}>
            <input
              className={styles.input}
              value={search}
              onChange={(event) => setSearch(event.target.value.toUpperCase())}
              placeholder="Search supplier, contact, phone, or material"
            />
          </div>

          <div className={styles.field}>
            <select className={styles.select} value={materialFilter} onChange={(event) => setMaterialFilter(event.target.value)}>
              <option value="">All materials</option>
              {materials
                .filter((item) => item.is_active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.material_name}
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
                setMaterialFilter('')
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
          <div className={styles.emptyState}>Loading Arkline suppliers...</div>
        ) : !filteredSuppliers.length ? (
          <div className={styles.emptyState}>No Arkline supplier matches the current filters.</div>
        ) : (
          <div className={`${styles.listWrap} ${styles.directoryListWrap}`.trim()}>
            <div className={`${styles.listHead} ${styles.directoryListHead} ${styles.supplierListHead}`.trim()}>
              <span>Supplier</span>
              <span>Contact</span>
              <span>Materials</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {filteredSuppliers.map((supplier) => {
              const materialIds = getSupplierMaterialIds(materialLinks, supplier.id)
              const materialNames = getSupplierMaterialNames(materialsById, materialIds)
              return (
                <div key={supplier.id} className={`${styles.listRow} ${styles.directoryListRow} ${styles.supplierListRow}`.trim()}>
                  <div>
                    <p className={styles.cellTitle}>{supplier.supplier_name || '-'}</p>
                    <p className={styles.cellMeta}>{supplier.supplier_code || 'NO CODE'} / ARKLINE</p>
                  </div>
                  <div>
                    <p className={styles.cellTitle}>{supplier.contact_person || '-'}</p>
                    <p className={styles.cellMeta}>{supplier.phone || '-'}</p>
                  </div>
                  <div className={styles.supplierMaterialChips}>
                    {materialNames.length ? (
                      materialNames.slice(0, 5).map((name) => (
                        <span key={name} className={styles.supplierMaterialChip}>
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className={styles.cellMeta}>No material linked</span>
                    )}
                    {materialNames.length > 5 ? <span className={styles.supplierMaterialChip}>+{materialNames.length - 5} more</span> : null}
                  </div>
                  <div>
                    <span className={`${styles.status} ${supplier.is_active ? styles.statusActive : styles.statusInactive}`.trim()}>
                      {supplier.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className={`${styles.buttonRow} ${styles.directoryActionCell}`.trim()}>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.directoryEditButton}`.trim()}
                      onClick={() => openEditModal(supplier)}
                      disabled={!canEditSupplier}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {showModal ? (
        <div className={`${styles.modalOverlay} ${styles.supplierModalOverlay}`.trim()}>
          <div className={`${styles.modalCard} ${styles.supplierModalCard}`.trim()}>
            <div className={`${styles.reimbursementModalHeader} ${styles.supplierModalHeader}`.trim()}>
              <div>
                <h2 className={styles.sectionTitle}>{isEditing ? 'Edit Arkline Supplier' : 'Create Arkline Supplier'}</h2>
              </div>
              <div className={`${styles.buttonRow} ${styles.supplierModalActions}`.trim()}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleSaveSupplier()}
                  disabled={saving || codeLoading || materialSaving || (isEditing ? !canEditSupplier : !canCreateSupplier)}
                >
                  {saving ? 'Saving...' : isEditing ? 'Update Supplier' : 'Save Supplier'}
                </button>
                <button
                  type="button"
                  className={styles.supplierModalCloseButton}
                  onClick={closeModal}
                  disabled={saving || materialSaving}
                  aria-label="Cancel supplier edit"
                  title="Cancel"
                >
                  X
                </button>
              </div>
            </div>

            {error ? <p className={styles.errorText}>{error}</p> : null}

            <div className={styles.supplierModalBody}>
              <div className={styles.supplierModalColumns}>
                <div className={styles.supplierFormPanel}>
                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <div className={styles.supplierCodeLabelRow}>
                        <label className={styles.label}>Supplier Code</label>
                        <span
                          className={`${styles.supplierStatusPill} ${
                            draft.is_active ? styles.supplierStatusPillActive : styles.supplierStatusPillInactive
                          }`.trim()}
                        >
                          {draft.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <input className={`${styles.input} ${styles.inputDisabled}`.trim()} value={codeLoading ? 'GENERATING...' : draft.supplier_code} readOnly />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Supplier Name</label>
                      <input
                        className={styles.input}
                        value={draft.supplier_name}
                        onChange={(event) => updateDraft('supplier_name', event.target.value)}
                        placeholder="SUPPLIER NAME"
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Contact Person</label>
                      <input
                        className={styles.input}
                        value={draft.contact_person}
                        onChange={(event) => updateDraft('contact_person', event.target.value)}
                        placeholder="CONTACT PERSON"
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Phone</label>
                      <input
                        className={styles.input}
                        value={draft.phone}
                        onChange={(event) => updateDraft('phone', event.target.value)}
                        inputMode="numeric"
                        placeholder="NUMBERS ONLY"
                      />
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

                    <div className={`${styles.field} ${styles.fullSpan}`}>
                      <label className={styles.label}>Address</label>
                      <textarea
                        className={styles.textarea}
                        value={draft.address}
                        onChange={(event) => updateDraft('address', event.target.value)}
                        placeholder="ADDRESS"
                      />
                    </div>

                    <div className={`${styles.field} ${styles.fullSpan}`}>
                      <label className={styles.label}>Notes</label>
                      <textarea
                        className={styles.textarea}
                        value={draft.notes}
                        onChange={(event) => updateDraft('notes', event.target.value)}
                        placeholder="Notes"
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.supplierMaterialPanel}>
                  <div className={styles.supplierMaterialHeader}>
                    <h3 className={styles.reimbursementDraftTitle}>Material Association</h3>
                    <button
                      type="button"
                      className={styles.supplierCreateMaterialIconButton}
                      onClick={() => setShowMaterialCreator((current) => !current)}
                      disabled={!canCreateMaterial}
                      aria-label="Create new material"
                      title="Create new material"
                    >
                      +
                    </button>
                  </div>

                  {showMaterialCreator ? (
                    <div className={styles.inlineCreateCard}>
                      <div className={styles.formRowThree}>
                        <div className={styles.field}>
                          <label className={styles.label}>Material Name</label>
                          <input
                            className={styles.input}
                            value={materialDraft.material_name}
                            onChange={(event) => setMaterialDraft((prev) => ({ ...prev, material_name: event.target.value.toUpperCase() }))}
                            placeholder="MATERIAL NAME"
                          />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Unit</label>
                          <input
                            className={styles.input}
                            value={materialDraft.unit}
                            onChange={(event) => setMaterialDraft((prev) => ({ ...prev, unit: event.target.value.toUpperCase() }))}
                            placeholder="PCS"
                          />
                        </div>
                        <div className={`${styles.buttonRow} ${styles.inlineCreateActions}`.trim()}>
                          <button type="button" className={styles.primaryButton} onClick={() => void handleCreateMaterial()} disabled={materialSaving}>
                            {materialSaving ? 'Saving...' : 'Save Material'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.supplierMaterialPicker}>
                    <div className={styles.supplierMaterialTypeahead}>
                      <input
                        className={styles.input}
                        value={materialSearch}
                        onFocus={() => setShowMaterialDropdown(true)}
                        onClick={() => setShowMaterialDropdown(true)}
                        onChange={(event) => {
                          setMaterialSearch(event.target.value.toUpperCase())
                          setSelectedMaterialId('')
                          setShowMaterialDropdown(true)
                        }}
                        placeholder="Type material name"
                      />
                      {showMaterialDropdown ? (
                        <div className={styles.supplierMaterialDropdown}>
                          {filteredMaterialsForPicker.length ? (
                            filteredMaterialsForPicker.slice(0, 8).map((material) => (
                              <button
                                key={material.id}
                                type="button"
                                className={styles.supplierMaterialDropdownItem}
                                onClick={() => {
                                  setSelectedMaterialId(material.id)
                                  setMaterialSearch(material.material_name)
                                  setShowMaterialDropdown(false)
                                }}
                              >
                                <strong>{material.material_name}</strong>
                                <span>{material.unit || 'PCS'}</span>
                              </button>
                            ))
                          ) : (
                            <div className={styles.supplierMaterialDropdownEmpty}>No material found.</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={addSelectedMaterialToList}
                      disabled={!selectedMaterialId && !exactMaterialMatch}
                    >
                      Add to List
                    </button>
                  </div>

                  <div className={styles.supplierSelectedMaterialList}>
                    {selectedDraftMaterials.length ? (
                      selectedDraftMaterials.map((material) => (
                        <div key={material.id} className={styles.supplierSelectedMaterialRow}>
                          <div>
                            <strong>{material.material_name}</strong>
                            <span>{material.unit || 'PCS'}</span>
                          </div>
                          <button type="button" onClick={() => removeMaterialFromList(material.id)} aria-label={`Remove ${material.material_name} from association list`}>
                            x
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className={styles.supplierSelectedMaterialEmpty}>No associated material yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
