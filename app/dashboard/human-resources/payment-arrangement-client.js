'use client'

import { useState } from 'react'

import styles from '../arkline/arkline.module.css'
import ArklineFinancialManagementPage from '../arkline/financial-management/page'
import MobGroupPaymentClient from '../payments/mob-group-payment-client'

export default function PaymentArrangementClient({ triggerClassName, triggerStyle, canViewArkline = false }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState(canViewArkline ? 'ARKLINE' : 'MOB')

  return (
    <>
      <button
        type="button"
        className={triggerClassName || styles.secondaryButton}
        style={triggerStyle}
        onClick={() => {
          setSource(canViewArkline ? 'ARKLINE' : 'MOB')
          setOpen(true)
        }}
      >
        Payment Arrangement
      </button>

      {open ? (
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
          onClick={() => setOpen(false)}
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
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Payment Arrangement</h2>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '999px', background: '#f8fafc' }}>
                  <button
                    type="button"
                    className={source === 'MOB' ? styles.primaryButton : styles.secondaryButton}
                    style={{ minHeight: '30px', borderRadius: '999px', padding: '0 14px' }}
                    onClick={() => setSource('MOB')}
                  >
                    MOB
                  </button>
                  {canViewArkline ? (
                    <button
                      type="button"
                      className={source === 'ARKLINE' ? styles.primaryButton : styles.secondaryButton}
                      style={{ minHeight: '30px', borderRadius: '999px', padding: '0 14px' }}
                      onClick={() => setSource('ARKLINE')}
                    >
                      Arkline
                    </button>
                  ) : null}
                </div>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            {source === 'ARKLINE' && canViewArkline ? (
              <ArklineFinancialManagementPage embedded showHeader={false} hrgaView allowCreateOverride={false} />
            ) : (
              <MobGroupPaymentClient embedded mode="hrga" showHeader={false} allowCreate={false} />
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
