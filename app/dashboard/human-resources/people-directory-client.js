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
  const fallback = ['display_name', 'email', 'gender', 'reimbursement_bank_name', 'reimbursement_account_name', 'reimbursement_account_number']
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

export default function PeopleDirectoryClient({ people, isAdmin }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const editableFields = useMemo(() => buildEditableFields(people), [people])

  const maleCount = people.filter((person) => normalizeGenderValue(person.gender || person.jenis_kelamin) === 'Male').length
  const femaleCount = people.filter((person) => normalizeGenderValue(person.gender || person.jenis_kelamin) === 'Female').length
  const editingPerson = people.find((person) => person.id === editingId) || null

  function renderField(field, value, disabled = false) {
    const fieldType = getFieldType(field)
    const defaultValue = value == null ? '' : String(value)
    return (
      <label key={field} className={styles.field}>
        <span className={styles.label}>{formatFieldLabel(field)}</span>
        <input
          className={styles.input}
          type={fieldType}
          name={field}
          defaultValue={defaultValue}
          disabled={disabled}
          required={field === 'display_name'}
        />
      </label>
    )
  }

  return (
    <>
      <div className={styles.materialFulfillmentSummaryRow}>
        <div className={styles.materialFulfillmentStat}>
          <span>Number of People</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <strong>{people.length}</strong>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="View employee list"
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

      {open ? (
        <div className={styles.modalOverlay} onClick={() => setOpen(false)}>
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(100%, 1120px)' }}
          >
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>People Directory</h2>
              </div>
              <div className={styles.buttonRow}>
                {isAdmin ? (
                  <button type="button" className={styles.primaryButton} onClick={() => setEditingId('__new__')}>
                    + Add New
                  </button>
                ) : null}
                <button type="button" className={styles.secondaryButton} onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            <div className={styles.directoryListWrap}>
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

              {people.map((person) => (
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
                    {isAdmin ? (
                      <button type="button" className={styles.secondaryButton} onClick={() => setEditingId(person.id)}>
                        <EditIcon />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {editingId ? (
              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div className={styles.sectionHeader}>
                  <div>
                    <h3 className={styles.sectionTitle}>{editingId === '__new__' ? 'Add New Employee' : 'Edit Employee'}</h3>
                  </div>
                  <button type="button" className={styles.secondaryButton} onClick={() => setEditingId('')}>
                    Cancel
                  </button>
                </div>

                {editingId === '__new__' ? (
                  <form action={createEmployeeProfile} className={styles.formGrid}>
                    <label className={styles.field}>
                      <span className={styles.label}>Id</span>
                      <input className={styles.input} type="text" name="id" placeholder="Enter employee id" required />
                    </label>
                    {editableFields.map((field) => renderField(field, ''))}
                    <div className={`${styles.buttonRow} ${styles.fullSpan}`.trim()}>
                      <button type="submit" className={styles.primaryButton}>
                        Save Employee
                      </button>
                    </div>
                  </form>
                ) : editingPerson ? (
                  <form action={updateEmployeeProfile} className={styles.formGrid}>
                    <input type="hidden" name="profile_id" value={editingPerson.id} />
                    <label className={styles.field}>
                      <span className={styles.label}>Id</span>
                      <input className={styles.input} type="text" value={editingPerson.id || ''} disabled readOnly />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Authenticated Id</span>
                      <input
                        className={styles.input}
                        type="text"
                        value={editingPerson.authenticated_id || ''}
                        disabled
                        readOnly
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Role</span>
                      <input className={styles.input} type="text" value={editingPerson.role || ''} disabled readOnly />
                    </label>
                    {editableFields.map((field) => renderField(field, editingPerson[field]))}
                    <div className={`${styles.buttonRow} ${styles.fullSpan}`.trim()}>
                      <button type="submit" className={styles.primaryButton}>
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
