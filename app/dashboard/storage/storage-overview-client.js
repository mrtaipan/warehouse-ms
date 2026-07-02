'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import styles from './storage.module.css'

function RestockInstructionModal({ open, onClose, canSubmit, canPick }) {
  if (!open) {
    return null
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.dialog} onClick={(event) => event.stopPropagation()}>
        <div style={modalStyles.header}>
          <div>
            <p style={modalStyles.eyebrow}>Storage Flow</p>
            <h2 style={modalStyles.title}>Restock Instruction</h2>
          </div>
          <button type="button" onClick={onClose} style={modalStyles.closeButton} aria-label="Close modal">
            ×
          </button>
        </div>

        <p style={modalStyles.text}>Pilih mau masuk ke jalur submit request atau picker handling.</p>

        <div style={modalStyles.actions}>
          {canSubmit ? (
            <Link href="/restock-request" style={modalStyles.primaryLink} onClick={onClose}>
              Restock Submit
            </Link>
          ) : (
            <button type="button" style={modalStyles.disabledButton} disabled>
              Restock Submit
            </button>
          )}

          {canPick ? (
            <Link href="/take-requests" style={modalStyles.secondaryLink} onClick={onClose}>
              Restock Picker
            </Link>
          ) : (
            <button type="button" style={modalStyles.disabledButton} disabled>
              Restock Picker
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StorageOverviewClient({ cards, canRestockSubmit, canRestockPicker }) {
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false)

  const displayCards = useMemo(
    () =>
      cards.map((card) => ({
        ...card,
        isRestockInstruction: card.key === 'restockInstruction',
      })),
    [cards]
  )

  return (
    <>
      <section className={styles.overviewGrid}>
        {displayCards.map((card) =>
          card.isRestockInstruction ? (
            <button
              key={card.key}
              type="button"
              className={`${styles.overviewCard} ${styles.overviewButtonCard}`.trim()}
              onClick={() => setIsRestockModalOpen(true)}
            >
              <span className={styles.overviewNumber}>{card.number}</span>
              <div className={styles.overviewCardContent}>
                <p className={styles.overviewCardKicker}>{card.kicker}</p>
                <h2 className={styles.overviewCardTitle}>{card.title}</h2>
                <p className={styles.overviewCardText}>{card.text}</p>
              </div>
            </button>
          ) : (
            <Link key={card.key} href={card.href} className={styles.overviewCard}>
              <span className={styles.overviewNumber}>{card.number}</span>
              <div className={styles.overviewCardContent}>
                <p className={styles.overviewCardKicker}>{card.kicker}</p>
                <h2 className={styles.overviewCardTitle}>{card.title}</h2>
                <p className={styles.overviewCardText}>{card.text}</p>
              </div>
            </Link>
          )
        )}
      </section>

      <RestockInstructionModal
        open={isRestockModalOpen}
        onClose={() => setIsRestockModalOpen(false)}
        canSubmit={canRestockSubmit}
        canPick={canRestockPicker}
      />
    </>
  )
}

const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.42)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 120,
  },
  dialog: {
    width: '100%',
    maxWidth: '460px',
    borderRadius: '28px',
    border: '1px solid rgba(226, 232, 240, 0.96)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.97) 100%)',
    boxShadow: '0 28px 80px rgba(15, 23, 42, 0.22)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  eyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  title: {
    margin: '8px 0 0',
    fontSize: '28px',
    lineHeight: 1,
    letterSpacing: '-0.04em',
    color: '#0f172a',
  },
  closeButton: {
    width: '40px',
    height: '40px',
    borderRadius: '999px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: '24px',
    lineHeight: 1,
    cursor: 'pointer',
  },
  text: {
    margin: 0,
    color: '#64748b',
    fontSize: '14px',
    lineHeight: 1.7,
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  primaryLink: {
    minHeight: '52px',
    borderRadius: '18px',
    background: '#0f172a',
    color: '#ffffff',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 700,
    padding: '0 16px',
  },
  secondaryLink: {
    minHeight: '52px',
    borderRadius: '18px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 700,
    padding: '0 16px',
  },
  disabledButton: {
    minHeight: '52px',
    borderRadius: '18px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'not-allowed',
    opacity: 0.9,
  },
}
