'use client'

import { useMemo, useState } from 'react'

import styles from '../arkline/arkline.module.css'
import ReimbursementClaimPage from '../reimbursement/reimbursement-claim-page'

function ReimbursementDetailModal({ onClose, initialGroupFilter = '', initialRequesterFilter = '' }) {
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
          initialGroupFilter={initialGroupFilter}
          initialRequesterFilter={initialRequesterFilter}
          tableView
        />
      </div>
    </div>
  )
}

export default function ReimbursementPanelClient() {
  const [openModal, setOpenModal] = useState(false)
  const [groupFilter, setGroupFilter] = useState('')
  const [requesterFilter, setRequesterFilter] = useState('')
  const [requesterOptions, setRequesterOptions] = useState([])
  const panelFilterStyle = useMemo(
    () => ({
      minHeight: '28px',
      minWidth: '140px',
      width: '160px',
      borderRadius: '999px',
      fontSize: '11px',
      padding: '0 28px 0 12px',
      backgroundPosition: 'right 10px center',
    }),
    []
  )

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
            <select className={styles.select} value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} style={panelFilterStyle}>
              <option value="">All groups</option>
              <option value="ARKLINE">ARKLINE</option>
              <option value="MOB">MOB</option>
              <option value="OI">OI</option>
              <option value="WAREHOUSE">WAREHOUSE</option>
              <option value="HQ">HQ</option>
            </select>
            <select
              className={styles.select}
              value={requesterFilter}
              onChange={(event) => setRequesterFilter(event.target.value)}
              style={{ minHeight: '28px', minWidth: '150px', width: '190px', borderRadius: '999px', fontSize: '11px', padding: '0 28px 0 12px', backgroundPosition: 'right 10px center' }}
            >
              <option value="">All requesters</option>
              {requesterOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
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
            initialGroupFilter={groupFilter}
            initialRequesterFilter={requesterFilter}
            onRequesterOptionsChange={setRequesterOptions}
          />
        </div>
      </div>

      {openModal ? (
        <ReimbursementDetailModal
          onClose={() => setOpenModal(false)}
          initialGroupFilter={groupFilter}
          initialRequesterFilter={requesterFilter}
        />
      ) : null}
    </>
  )
}
