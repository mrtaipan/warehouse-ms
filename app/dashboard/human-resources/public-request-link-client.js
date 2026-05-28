'use client'

import { useState, useTransition } from 'react'

import styles from '../arkline/arkline.module.css'
import { createPublicRequestLink } from './actions'

export default function PublicRequestLinkClient({ canCreate, peopleOptions = [] }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [personSearch, setPersonSearch] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState('')

  if (!canCreate) {
    return null
  }

  function resetModalState() {
    setOpen(false)
    setError('')
    setGeneratedLink('')
    setPersonSearch('')
    setSelectedPersonId('')
  }

  function handleSubmit(formData) {
    setError('')
    startTransition(async () => {
      try {
        const result = await createPublicRequestLink(formData)
        setGeneratedLink(result?.linkPath || '')
      } catch (submitError) {
        setError(submitError?.message || 'Failed to create request link.')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        className={styles.secondaryButton}
        style={{ minHeight: '28px', borderRadius: '999px', fontSize: '11px' }}
        onClick={() => {
          setError('')
          setGeneratedLink('')
          setPersonSearch('')
          setSelectedPersonId('')
          setOpen(true)
        }}
      >
        Create Request
      </button>

      {open ? (
        <div className={styles.modalOverlay} onClick={resetModalState}>
          <div className={styles.modalCard} style={{ width: 'min(92vw, 620px)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }} onClick={(event) => event.stopPropagation()}>
            <div className={styles.sectionHeader}>
              <div>
                <h3 className={styles.sectionTitle}>Create Link</h3>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={resetModalState}>
                Close
              </button>
            </div>

            <form action={handleSubmit} className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Request Type</span>
                <select className={styles.select} name="request_type" required defaultValue="LEAVE">
                  <option value="LEAVE">Leave Request</option>
                  <option value="BIRTHDAY">Birthday Request</option>
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>To</span>
                <input
                  className={styles.input}
                  type="text"
                  list="hrga-public-request-people"
                  value={personSearch}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value
                    setPersonSearch(nextValue)
                    const matchedPerson = peopleOptions.find((person) => person.label === nextValue)
                    setSelectedPersonId(matchedPerson?.id || '')
                  }}
                  placeholder="Type to filter person"
                  required
                />
                <datalist id="hrga-public-request-people">
                  {peopleOptions.map((person) => (
                    <option key={person.id} value={person.label} />
                  ))}
                </datalist>
                <input type="hidden" name="employee_profile_id" value={selectedPersonId} />
              </label>

              {generatedLink ? (
                <div className={`${styles.field} ${styles.fullSpan}`.trim()}>
                  <span className={styles.label}>Generated Link</span>
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      background: '#f8fafc',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <code style={{ fontSize: '12px', color: '#0f172a', wordBreak: 'break-all' }}>{generatedLink}</code>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(window.location.origin + generatedLink)
                          } catch {}
                        }}
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className={`${styles.materialFulfillmentNote} ${styles.fullSpan}`.trim()} style={{ color: '#b91c1c' }}>
                  {error}
                </p>
              ) : null}

              <div className={`${styles.buttonRow} ${styles.fullSpan}`.trim()}>
                <button type="submit" className={styles.primaryButton} disabled={pending}>
                  {pending ? 'Creating...' : 'Create Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
