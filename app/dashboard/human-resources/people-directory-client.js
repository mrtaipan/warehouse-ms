'use client'

import { useMemo, useState } from 'react'
import { createEmployeeProfile, updateEmployeeProfile } from './actions'
import styles from '../arkline/arkline.module.css'

function toProperCase(value) {
  return String(value || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeGenderValue(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (['M', 'MALE', 'MAN'].includes(normalized)) return 'Male'
  if (['F', 'FEMALE', 'WOMAN'].includes(normalized)) return 'Female'
  return ''
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        d="M12 20h9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatFieldLabel(key) {
  const customLabels = {
    reimbursement_bank_name: 'Bank Name',
    reimbursement_account_name: 'Account Name',
    reimbursement_account_number: 'Account Number',
  }

  if (customLabels[key]) {
    return customLabels[key]
  }

  if (String(key || '').toLowerCase() === 'nik') {
    return 'KTP'
  }

  if (String(key || '').toLowerCase().includes('ktp')) {
    return 'KTP'
  }

  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getFieldType(field) {
  if (field === 'email') return 'email'
  if (field.includes('date')) return 'date'
  return 'text'
}

function buildEditableFields(people) {
  const excluded = new Set(['id', 'authenticated_id', 'role', 'is_qc_active', 'qc_active_date', 'created_at', 'updated_at'])
  const fallback = ['display_name', 'group', 'email', 'gender', 'reimbursement_bank_name', 'reimbursement_account_name', 'reimbursement_account_number']
  const discovered = new Set()

  for (const person of people) {
    Object.keys(person || {}).forEach((key) => {
      if (!excluded.has(key)) {
        discovered.add(key)
      }
    })
  }

  const fields = Array.from(discovered)
  if (!fields.length) {
    return fallback
  }

  return fields.sort((a, b) => {
    const order = [
      'display_name',
      'group',
      'email',
      'gender',
      'phone_number',
      'date_of_birth',
      'address',
      'reimbursement_bank_name',
      'reimbursement_account_name',
      'reimbursement_account_number',
    ]
    const aIndex = order.indexOf(a)
    const bIndex = order.indexOf(b)
    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    }
    return a.localeCompare(b)
  })
}

function buildGroupOptions(people) {
  const defaults = ['ARKLINE', 'MOB', 'OI', 'WAREHOUSE', 'HQ']
  const discovered = new Set()

  for (const person of people) {
    const value = String(person?.group || '').trim().toUpperCase()
    if (value) {
      discovered.add(value)
    }
  }

  defaults.forEach((value) => discovered.add(value))
  return Array.from(discovered).sort((a, b) => a.localeCompare(b))
}

function isKtpField(field) {
  const normalized = String(field || '').trim().toLowerCase()
  return normalized === 'nik' || normalized.includes('ktp')
}

export function PeopleDirectoryEyeIcon() {
  return <EyeIcon />
}

export default function PeopleDirectoryClient({
  people,
  isAdmin,
  canManage = false,
  showSummary = true,
  triggerClassName = '',
  triggerStyle = null,
  triggerLabel = '',
  openCreateOnTrigger = false,
}) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [openedFromCreateShortcut, setOpenedFromCreateShortcut] = useState(false)
  const [editorSuccess, setEditorSuccess] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const editableFields = useMemo(() => buildEditableFields(people), [people])
  const groupOptions = useMemo(() => buildGroupOptions(people), [people])

  const maleCount = people.filter((person) => normalizeGenderValue(person.gender || person.jenis_kelamin) === 'Male').length
  const femaleCount = people.filter((person) => normalizeGenderValue(person.gender || person.jenis_kelamin) === 'Female').length
  const editingPerson = people.find((person) => person.id === editingId) || null
  const filteredPeople = useMemo(() => {
    const keyword = String(search || '').trim().toLowerCase()
    if (!keyword) return people

    return people.filter((person) =>
      [
        person.id,
        person.display_name,
        person.email,
        normalizeGenderValue(person.gender || person.jenis_kelamin),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    )
  }, [people, search])

  function renderField(field, value, disabled = false) {
    const fieldType = getFieldType(field)
    const defaultValue = value == null ? '' : String(value)
    const isRequired = field === 'display_name' || field === 'group'

    if (field === 'gender' || field === 'jenis_kelamin') {
      return (
        <label key={field} className={styles.field}>
          <span className={styles.label}>{formatFieldLabel(field)}</span>
          <select
            className={`${styles.input} ${disabled ? styles.inputDisabled : ''}`.trim()}
            name={field}
            defaultValue={normalizeGenderValue(defaultValue)}
            disabled={disabled}
            required={isRequired}
          >
            <option value="" disabled>
              Select gender
            </option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </label>
      )
    }

    if (field === 'group') {
      return (
        <label key={field} className={styles.field}>
          <span className={styles.label}>{formatFieldLabel(field)}</span>
          <select
            className={`${styles.input} ${disabled ? styles.inputDisabled : ''}`.trim()}
            name={field}
            defaultValue={defaultValue ? defaultValue.toUpperCase() : ''}
            disabled={disabled}
            required={isRequired}
          >
            <option value="" disabled>
              Select group
            </option>
            {groupOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      )
    }

    return (
      <label key={field} className={styles.field}>
        <span className={styles.label}>{formatFieldLabel(field)}</span>
        <input
          className={`${styles.input} ${disabled ? styles.inputDisabled : ''}`.trim()}
          type={fieldType}
          name={field}
          defaultValue={defaultValue}
          disabled={disabled}
          readOnly={disabled}
          required={isRequired}
          inputMode={isKtpField(field) ? 'numeric' : undefined}
          pattern={isKtpField(field) ? '[0-9]*' : undefined}
          style={field === 'birthplace' || field === 'tempat_lahir' ? { textTransform: 'uppercase' } : undefined}
        />
      </label>
    )
  }

  function closeEditor(options = {}) {
    const { keepSuccess = false } = options
    setEditingId('')
    setFormError('')
    setSubmitting(false)
    if (!keepSuccess) {
      setEditorSuccess('')
    }
    if (openedFromCreateShortcut) {
      setOpen(false)
      setOpenedFromCreateShortcut(false)
    }
  }

  function handleTriggerClick() {
    setOpen(true)
    setOpenedFromCreateShortcut(openCreateOnTrigger)
    setEditingId(openCreateOnTrigger ? '__new__' : '')
    setEditorSuccess('')
    setFormError('')
    setSearch('')
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')

    try {
      const result = await createEmployeeProfile(new FormData(event.currentTarget))
      setEditorSuccess(result?.message || 'Person saved successfully.')
      closeEditor({ keepSuccess: true })
    } catch (error) {
      setFormError(error.message || 'Failed to save person.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')

    try {
      const result = await updateEmployeeProfile(new FormData(event.currentTarget))
      setEditorSuccess(result?.message || 'Person saved successfully.')
      closeEditor({ keepSuccess: true })
    } catch (error) {
      setFormError(error.message || 'Failed to save person.')
    } finally {
      setSubmitting(false)
    }
  }

  const editorModal =
    editingId === '__new__' ? (
      <div className={styles.modalOverlay} onClick={closeEditor}>
        <div
          className={styles.modalCard}
          onClick={(event) => event.stopPropagation()}
          style={{ width: 'min(96vw, 1180px)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}
        >
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>Add New Person</h3>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={closeEditor}>
              Cancel
            </button>
          </div>

          <div className={styles.directoryModalBody}>
            <form onSubmit={handleCreateSubmit} className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>People ID</span>
                <input
                  className={`${styles.input} ${styles.inputDisabled}`.trim()}
                  type="text"
                  value="Auto-generated from group + current month"
                  disabled
                  readOnly
                />
              </label>
              {editableFields.map((field) => renderField(field, ''))}
              {formError ? (
                <p className={styles.errorText} style={{ margin: 0 }}>
                  {formError}
                </p>
              ) : null}
              <div className={`${styles.buttonRow} ${styles.fullSpan}`.trim()}>
                <button type="submit" className={styles.primaryButton} disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Person'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    ) : editingPerson ? (
      <div className={styles.modalOverlay} onClick={closeEditor}>
        <div
          className={styles.modalCard}
          onClick={(event) => event.stopPropagation()}
          style={{ width: 'min(96vw, 1180px)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}
        >
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>Edit Person</h3>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={closeEditor}>
              Cancel
            </button>
          </div>

          <div className={styles.directoryModalBody}>
            <form onSubmit={handleUpdateSubmit} className={styles.formGrid}>
              <input type="hidden" name="profile_id" value={editingPerson.id} />
              <label className={styles.field}>
                <span className={styles.label}>Id</span>
                <input className={`${styles.input} ${styles.inputDisabled}`.trim()} type="text" value={editingPerson.id || ''} disabled readOnly />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Authenticated Id</span>
                <input
                  className={`${styles.input} ${styles.inputDisabled}`.trim()}
                  type="text"
                  value={editingPerson.authenticated_id || ''}
                  disabled
                  readOnly
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Role</span>
                <input className={`${styles.input} ${styles.inputDisabled}`.trim()} type="text" value={editingPerson.role || ''} disabled readOnly />
              </label>
              {editableFields.map((field) => renderField(field, editingPerson[field], field === 'email'))}
              {formError ? (
                <p className={styles.errorText} style={{ margin: 0 }}>
                  {formError}
                </p>
              ) : null}
              <div className={`${styles.buttonRow} ${styles.fullSpan}`.trim()}>
                <button type="submit" className={styles.primaryButton} disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    ) : null

  return (
    <>
      {showSummary ? (
        <div className={styles.materialFulfillmentSummaryRow}>
          <div className={styles.materialFulfillmentStat}>
            <span>Number of People</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <strong>{people.length}</strong>
              <button
                type="button"
                onClick={handleTriggerClick}
                aria-label="View people list"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '999px',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#111827',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <EyeIcon />
              </button>
            </div>
          </div>
          <div className={styles.materialFulfillmentStat}>
            <span>Male</span>
            <strong>{maleCount}</strong>
          </div>
          <div className={styles.materialFulfillmentStat}>
            <span>Female</span>
            <strong>{femaleCount}</strong>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleTriggerClick}
          aria-label="View people list"
          className={triggerClassName}
          style={
            triggerStyle || {
              width: '34px',
              height: '34px',
              borderRadius: '999px',
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#111827',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }
          }
        >
          {triggerLabel ? <span>{triggerLabel}</span> : <EyeIcon />}
        </button>
      )}

      {open && !editingId ? (
        <div className={styles.modalOverlay} onClick={() => setOpen(false)}>
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(96vw, 1520px)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}
          >
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>People Directory</h2>
                {editorSuccess ? (
                  <p className={styles.successText} style={{ margin: '6px 0 0' }}>
                    {editorSuccess}
                  </p>
                ) : null}
              </div>
              <div className={styles.buttonRow}>
                {canManage ? (
                  <button type="button" className={styles.primaryButton} onClick={() => setEditingId('__new__')}>
                    + Add New
                  </button>
                ) : null}
                <button type="button" className={styles.secondaryButton} onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            <div className={styles.directoryListWrap} style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', paddingRight: '4px' }}>
              <div style={{ marginBottom: '12px' }}>
                <input
                  className={styles.input}
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search people ID, name, email, or gender"
                />
              </div>

              <div
                className={styles.listHead}
                style={{ gridTemplateColumns: '150px minmax(0, 1.2fr) minmax(0, 1fr) 130px auto' }}
              >
                <span>ID</span>
                <span>Name</span>
                <span>Email</span>
                <span>Gender</span>
                <span>Action</span>
              </div>

              {filteredPeople.map((person) => (
                <div
                  key={person.id}
                  className={styles.listRow}
                  style={{ gridTemplateColumns: '150px minmax(0, 1.2fr) minmax(0, 1fr) 130px auto' }}
                >
                  <div>
                    <p className={styles.cellTitle}>{person.id || '-'}</p>
                  </div>
                  <div>
                    <p className={styles.cellTitle}>{toProperCase(person.display_name || person.email || 'Unnamed Profile')}</p>
                  </div>
                  <div>
                    <p className={styles.cellTitle}>{person.email || '-'}</p>
                  </div>
                  <div>
                    <p className={styles.cellTitle}>{normalizeGenderValue(person.gender || person.jenis_kelamin) || '-'}</p>
                  </div>
                  <div className={styles.buttonRow}>
                    {canManage ? (
                      <button type="button" className={styles.secondaryButton} onClick={() => setEditingId(person.id)}>
                        <EditIcon />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}

              {!filteredPeople.length ? (
                <div className={styles.emptyState} style={{ minHeight: '140px' }}>
                  No people match the current search.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {open && editingId ? editorModal : null}
    </>
  )
}
