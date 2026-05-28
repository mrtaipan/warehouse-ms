'use client'

import { useState } from 'react'

import styles from '../arkline/arkline.module.css'
import { createPublicHoliday } from './actions'

export default function PublicHolidayClient({ isAdmin, triggerClassName, triggerStyle, triggerLabel = '+ Public Holiday' }) {
  const [open, setOpen] = useState(false)

  if (!isAdmin) {
    return null
  }

  return (
    <>
      <button type="button" className={triggerClassName || styles.secondaryButton} style={triggerStyle} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>

      {open ? (
        <div className={styles.modalOverlay} onClick={() => setOpen(false)}>
          <div className={styles.modalCard} style={{ width: 'min(92vw, 560px)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }} onClick={(event) => event.stopPropagation()}>
            <div className={styles.sectionHeader}>
              <div>
                <h3 className={styles.sectionTitle}>Add Public Holiday</h3>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>

            <form action={createPublicHoliday} className={styles.formGrid} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <label className={styles.field}>
                <span className={styles.label}>Holiday Date</span>
                <input className={styles.input} type="date" name="holiday_date" required />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Holiday Name</span>
                <input className={styles.input} type="text" name="holiday_name" placeholder="e.g. Independence Day" required />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Notes</span>
                <textarea className={styles.textarea} name="notes" rows={3} placeholder="Optional note" />
              </label>

              <div className={styles.buttonRow}>
                <button type="submit" className={styles.primaryButton}>
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
