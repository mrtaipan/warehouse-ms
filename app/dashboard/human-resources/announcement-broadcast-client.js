'use client'

import { useMemo, useState } from 'react'
import {
  createAnnouncementBroadcast,
  deleteAnnouncementBroadcast,
  updateAnnouncementBroadcast,
} from './actions'
import styles from '../arkline/arkline.module.css'

function formatDateLabel(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function buildDefaultDates() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AnnouncementBroadcastClient({ announcements = [], tableReady = true }) {
  const [editingId, setEditingId] = useState('')

  const activeCount = announcements.filter((item) => item.is_active).length
  const inactiveCount = announcements.length - activeCount
  const todayDate = buildDefaultDates()
  const editingAnnouncement = useMemo(
    () => announcements.find((item) => String(item.id) === editingId) || null,
    [announcements, editingId]
  )

  return (
    <div className={styles.directorySection}>
      {!tableReady ? (
        <div className={styles.materialFulfillmentNote}>
          Table `hrd_announcement` is not available yet. Create it first, then this tab will start working.
        </div>
      ) : null}

      <div className={styles.materialFulfillmentSummaryRow}>
        <div className={styles.materialFulfillmentStat}>
          <span>Total Broadcasts</span>
          <strong>{announcements.length}</strong>
        </div>
        <div className={styles.materialFulfillmentStat}>
          <span>Active</span>
          <strong>{activeCount}</strong>
        </div>
        <div className={styles.materialFulfillmentStat}>
          <span>Inactive</span>
          <strong>{inactiveCount}</strong>
        </div>
        <div className={styles.materialFulfillmentStat}>
          <span>Live on Dashboard</span>
          <strong>{activeCount}</strong>
        </div>
      </div>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Announcement</h2>
          </div>
          <div className={styles.buttonRow}>
            <button type="button" className={styles.primaryButton} onClick={() => setEditingId('__new__')} disabled={!tableReady}>
              + New Broadcast
            </button>
          </div>
        </div>

        <div className={styles.directoryListWrap}>
          <div className={styles.listHead} style={{ gridTemplateColumns: 'minmax(0, 1.2fr) 140px 140px 120px auto' }}>
            <span>Title</span>
            <span>Start Date</span>
            <span>End Date</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {announcements.length ? (
            announcements.map((item) => (
              <div
                key={item.id}
                className={styles.listRow}
                style={{ gridTemplateColumns: 'minmax(0, 1.2fr) 140px 140px 120px auto' }}
              >
                <div>
                  <p className={styles.cellTitle}>{item.title || 'Untitled Broadcast'}</p>
                  <p className={styles.cellMeta}>{item.message || '-'}</p>
                </div>
                <div>
                  <p className={styles.cellTitle}>{formatDateLabel(item.start_date)}</p>
                </div>
                <div>
                  <p className={styles.cellTitle}>{formatDateLabel(item.end_date)}</p>
                </div>
                <div>
                  <span className={`${styles.status} ${item.is_active ? styles.statusActive : styles.statusInactive}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className={styles.buttonRow}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setEditingId(String(item.id))}>
                    Edit
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>No broadcasts yet.</div>
          )}
        </div>
      </section>

      {editingId ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>{editingId === '__new__' ? 'Add New Announcement' : 'Edit Announcement'}</h2>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={() => setEditingId('')}>
              Cancel
            </button>
          </div>

          {editingId === '__new__' ? (
            <form action={createAnnouncementBroadcast} className={styles.formGrid}>
              <label className={`${styles.field} ${styles.fullSpan}`.trim()}>
                <span className={styles.label}>Title</span>
                <input className={styles.input} type="text" name="title" placeholder="Enter broadcast title" required />
              </label>
              <label className={`${styles.field} ${styles.fullSpan}`.trim()}>
                <span className={styles.label}>Message</span>
                <textarea className={styles.textarea} name="message" placeholder="Write the message for dashboard..." required />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Start Date</span>
                <input className={styles.input} type="date" name="start_date" defaultValue={todayDate} required />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>End Date</span>
                <input className={styles.input} type="date" name="end_date" defaultValue={todayDate} required />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Status</span>
                <select className={styles.select} name="is_active" defaultValue="true">
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
              <div className={`${styles.buttonRow} ${styles.fullSpan}`.trim()}>
                <button type="submit" className={styles.primaryButton} disabled={!tableReady}>
                  Save Announcement
                </button>
              </div>
            </form>
          ) : editingAnnouncement ? (
            <form action={updateAnnouncementBroadcast} className={styles.formGrid}>
              <input type="hidden" name="announcement_id" value={editingAnnouncement.id} />
              <label className={`${styles.field} ${styles.fullSpan}`.trim()}>
                <span className={styles.label}>Title</span>
                <input className={styles.input} type="text" name="title" defaultValue={editingAnnouncement.title || ''} required />
              </label>
              <label className={`${styles.field} ${styles.fullSpan}`.trim()}>
                <span className={styles.label}>Message</span>
                <textarea
                  className={styles.textarea}
                  name="message"
                  defaultValue={editingAnnouncement.message || ''}
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Start Date</span>
                <input
                  className={styles.input}
                  type="date"
                  name="start_date"
                  defaultValue={editingAnnouncement.start_date || ''}
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>End Date</span>
                <input className={styles.input} type="date" name="end_date" defaultValue={editingAnnouncement.end_date || ''} required />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Status</span>
                <select className={styles.select} name="is_active" defaultValue={editingAnnouncement.is_active ? 'true' : 'false'}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
              <div className={`${styles.buttonRow} ${styles.fullSpan}`.trim()}>
                <button type="submit" className={styles.primaryButton}>
                  Save Changes
                </button>
              </div>
            </form>
          ) : null}

          {editingAnnouncement ? (
            <form action={deleteAnnouncementBroadcast}>
              <input type="hidden" name="announcement_id" value={editingAnnouncement.id} />
              <button type="submit" className={styles.dangerButton}>
                Delete Announcement
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
