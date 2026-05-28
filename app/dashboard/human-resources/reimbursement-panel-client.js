'use client'

import { useState } from 'react'

import styles from '../arkline/arkline.module.css'
import ReimbursementClaimPage from '../reimbursement/reimbursement-claim-page'

function ReimbursementDetailModal({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(15, 23, 42, 0.28)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(96vw, 1560px)',
          maxHeight: '92vh',
          overflow: 'auto',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>All Reimbursement Claims</h2>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>

        <ReimbursementClaimPage
          title="Reimbursement Claims"
          showSummary
          showSummaryBreakdown={false}
          showSummaryMonthFilter={false}
          allowBatchCreation={false}
          allowHrgaApproverView
          showHeader={false}
          showToolbar
          compactToolbar
          showAccountInfo={false}
        />
      </div>
    </div>
  )
}

export default function ReimbursementPanelClient() {
  const [openModal, setOpenModal] = useState(false)

  return (
    <>
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '18px', lineHeight: 1.1, fontWeight: 700, color: '#0f172a' }}>Reimbursement Claims</h2>
            <button type="button" className={styles.secondaryButton} style={{ minHeight: '28px', borderRadius: '999px', fontSize: '11px' }} onClick={() => setOpenModal(true)}>
              View Detail
            </button>
          </div>
        </div>

        <div style={{ padding: '14px' }}>
          <ReimbursementClaimPage
            title="Reimbursement Claims"
            showSummary={false}
            allowBatchCreation={false}
            allowHrgaApproverView
            showHeader={false}
            showToolbar={false}
            showAccountInfo={false}
          />
        </div>
      </div>

      {openModal ? <ReimbursementDetailModal onClose={() => setOpenModal(false)} /> : null}
    </>
  )
}
