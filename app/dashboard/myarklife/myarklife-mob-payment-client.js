'use client'

import { useState } from 'react'

import MobGroupPaymentClient from '../payments/mob-group-payment-client'
import styles from './myarklife.module.css'

export default function MyArklifeMobPaymentClient() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" className={styles.actionPillButton} onClick={() => setOpen(true)}>
        + Payment
      </button>

      {open ? (
        <div className={styles.modalOverlay} onClick={() => setOpen(false)}>
          <div className={styles.modalWideCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.claimTitleBlock}>
                <h2 className={styles.reimbursementListTitle}>MOB Group Payment Request</h2>
              </div>
              <button type="button" className={styles.cancelDangerButton} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
            <div className={styles.modalBody}>
              <MobGroupPaymentClient
                mode="self"
                showHeader
                allowCreate
                hideHeaderCopy
                embedded
                createLabel="Add New"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
