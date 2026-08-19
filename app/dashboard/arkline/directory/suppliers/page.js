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
  supplier_level: 'GARMENT',
  is_active: true,
}

function normalizeSupplier(row) {
  return {
    id: String(row?.id || '').trim(),
    supplier_code: String(row?.supplier_code || '').trim().toUpperCase(),
    supplier_name: String(row?.supplier_name || '').trim().toUpperCase(),
    group: String(row?.group || '').trim().toUpperCase(),
    supplier_level: String(row?.supplier_level || '').trim().toUpperCase(),
    contact_person: String(row?.contact_person || '').trim().toUpperCase(),
    phone: String(row?.phone || '').trim(),
    address: String(row?.address || '').trim().toUpperCase(),
    notes: String(row?.notes || '').trim(),
    is_active: row?.is_active !== false,
  }
}

function sortByName(left, right, key) {
  return String(left?.[key] || '').localeCompare(String(right?.[key] || ''), undefined, { numeric: true })
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
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(emptySupplierDraft)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadDirectoryData() {
    setLoading(true)
    setError('')

    const { data: supplierRows, error: supplierError } = await supabase
      .from('dir_suppliers')
      .select('id, supplier_code, supplier_name, group, supplier_level, contact_person, phone, address, notes, is_active')
      .ilike('group', ARKLINE_GROUP)
      .order('supplier_name', { ascending: true })

    if (supplierError) {
      setError(supplierError.message || 'Failed to load Arkline supplier directory.')
      setLoading(false)
      return
    }

    setSuppliers((supplierRows || []).map(normalizeSupplier).sort((left, right) => sortByName(left, right, 'supplier_name')))
    setLoading(false)
  }

  useEffect(() => {
    void loadDirectoryData()
  }, [])

  const filteredSuppliers = useMemo(() => {
    const keyword = search.trim().toUpperCase()

    return suppliers.filter((supplier) => {
      const matchesKeyword =
        !keyword ||
        [
          supplier.supplier_code,
          supplier.supplier_name,
          supplier.contact_person,
          supplier.phone,
          supplier.address,
          supplier.notes,
          supplier.supplier_level,
        ]
          .filter(Boolean)
          .join(' ')
          .includes(keyword)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && supplier.is_active) ||
        (statusFilter === 'inactive' && !supplier.is_active)

      return matchesKeyword && matchesStatus
    })
  }, [search, statusFilter, suppliers])

  async function openCreateModal() {
    if (!canCreateSupplier) return
    setIsEditing(false)
    setShowModal(true)
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
      supplier_level: supplier.supplier_level || 'GARMENT',
      is_active: supplier.is_active,
    })
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
    setIsEditing(false)
    setDraft(emptySupplierDraft)
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
        supplier_level: draft.supplier_level || 'GARMENT',
        is_active: draft.is_active,
      }

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('dir_suppliers')
          .update(payload)
          .eq('id', draft.id)

        if (updateError) throw new Error(updateError.message)
      } else {
        const { error: insertError } = await supabase
          .from('dir_suppliers')
          .insert({
            ...payload,
            supplier_code: draft.supplier_code,
          })

        if (insertError) throw new Error(insertError.message)
      }

      await loadDirectoryData()
      setSuccess(isEditing ? 'Arkline supplier updated.' : 'Arkline supplier created.')
      setShowModal(false)
      setIsEditing(false)
      setDraft(emptySupplierDraft)
    } catch (saveError) {
      setError(saveError.message || 'Failed to save Arkline supplier.')
    } finally {
      setSaving(false)
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
              placeholder="Search supplier, contact, phone, address, or notes"
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
          <div className={styles.emptyState}>Loading Arkline suppliers...</div>
        ) : !filteredSuppliers.length ? (
          <div className={styles.emptyState}>No Arkline supplier matches the current filters.</div>
        ) : (
          <div className={`${styles.listWrap} ${styles.directoryListWrap}`.trim()}>
            <div className={`${styles.listHead} ${styles.directoryListHead} ${styles.supplierListHead}`.trim()}>
              <span>Supplier</span>
              <span>Contact</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className={`${styles.listRow} ${styles.directoryListRow} ${styles.supplierListRow}`.trim()}>
                <div>
                  <p className={styles.cellTitle}>{supplier.supplier_name || '-'}</p>
                  <p className={styles.cellMeta}>{supplier.supplier_code || 'NO CODE'} / ARKLINE / {supplier.supplier_level || 'NO LEVEL'}</p>
                </div>
                <div>
                  <p className={styles.cellTitle}>{supplier.contact_person || '-'}</p>
                  <p className={styles.cellMeta}>{supplier.phone || '-'}</p>
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
            ))}
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
                  disabled={saving || codeLoading || (isEditing ? !canEditSupplier : !canCreateSupplier)}
                >
                  {saving ? 'Saving...' : isEditing ? 'Update Supplier' : 'Save Supplier'}
                </button>
                <button
                  type="button"
                  className={styles.supplierModalCloseButton}
                  onClick={closeModal}
                  disabled={saving}
                  aria-label="Cancel supplier edit"
                  title="Cancel"
                >
                  X
                </button>
              </div>
            </div>

            {error ? <p className={styles.errorText}>{error}</p> : null}

            <div className={styles.supplierModalBody}>
              <div className={styles.supplierModalSingleColumn}>
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

                    <div className={styles.field}>
                      <label className={styles.label}>Supplier Level</label>
                      <select
                        className={styles.select}
                        value={draft.supplier_level}
                        onChange={(event) => updateDraft('supplier_level', event.target.value)}
                      >
                        <option value="GARMENT">Garment</option>
                        <option value="MATERIAL">Material</option>
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
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
