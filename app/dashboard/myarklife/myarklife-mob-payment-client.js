'use client'

import { useState } from 'react'

import ArklineFinancialManagementPage from '../arkline/financial-management/page'
import MobGroupPaymentClient from '../payments/mob-group-payment-client'
import styles from './myarklife.module.css'

function isHeadquarterGroup(value = '') {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized === 'HQ' || normalized.includes('HEAD')
}

export default function MyArklifeMobPaymentClient({ profile }) {
  const [open, setOpen] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState(null)

  const hqUser = isHeadquarterGroup(profile?.group)

  function openPaymentModal() {
    setPaymentTarget(hqUser ? null : 'MOB')
    setOpen(true)
  }

  function closePaymentModal() {
    setOpen(false)
    setPaymentTarget(null)
  }

  const modalTitle =
    paymentTarget === 'ARKLINE'
      ? 'Arkline Payment Request'
      : paymentTarget === 'MOB'
        ? 'MOB Group Payment Request'
        : 'Payment Request'

  return (
    <>
      <button type="button" className={styles.actionPillButton} onClick={openPaymentModal}>
        + Payment
      </button>

      {open ? (
        <div className={styles.modalOverlay} onClick={closePaymentModal}>
          <div className={styles.modalWideCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.claimTitleBlock}>
                <h2 className={styles.reimbursementListTitle}>{modalTitle}</h2>
              </div>
              <div className={styles.paymentModalActions}>
                {hqUser && paymentTarget ? (
                  <button type="button" className={styles.cancelButton} onClick={() => setPaymentTarget(null)}>
                    Back
                  </button>
                ) : null}
                <button type="button" className={styles.cancelDangerButton} onClick={closePaymentModal}>
                  Cancel
                </button>
              </div>
            </div>
            <div className={styles.modalBody}>
              {!paymentTarget ? (
                <div className={styles.paymentTargetGrid}>
                  <button type="button" className={styles.paymentTargetCard} onClick={() => setPaymentTarget('MOB')}>
                    <span>MOB</span>
                    <strong>MOB Group Payment</strong>
                  </button>
                  <button type="button" className={styles.paymentTargetCard} onClick={() => setPaymentTarget('ARKLINE')}>
                    <span>Arkline</span>
                    <strong>Arkline Payment</strong>
                  </button>
                </div>
              ) : paymentTarget === 'ARKLINE' ? (
                <ArklineFinancialManagementPage
                  embedded
                  showHeader={false}
                  allowCreateOverride
                  selfService
                  hidePaymentBasisSelector
                />
              ) : (
                <MobGroupPaymentClient
                  mode="self"
                  showHeader
                  allowCreate
                  hideHeaderCopy
                  embedded
                  createLabel="Add New"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
