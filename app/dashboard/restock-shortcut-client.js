'use client'

import Link from 'next/link'
import { useState } from 'react'
import styles from './dashboard.module.css'

function RestockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
      <path d="m8 4.5 8.7 5" />
    </svg>
  )
}

export default function RestockShortcutButton({ actions = [] }) {
  const [isOpen, setIsOpen] = useState(false)
  const availableActions = actions.filter((action) => action?.href)

  if (!availableActions.length) {
    return null
  }

  if (availableActions.length === 1) {
    return (
      <Link
        href={availableActions[0].href}
        className={styles.heroProfileLink}
        aria-label={`Open ${availableActions[0].label}`}
        title="Restock"
      >
        <RestockIcon />
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        className={styles.heroProfileLink}
        onClick={() => setIsOpen(true)}
        aria-label="Open Restock"
        title="Restock"
      >
        <RestockIcon />
      </button>

      {isOpen ? (
        <div className={styles.restockModalOverlay} role="presentation" onClick={() => setIsOpen(false)}>
          <div
            className={styles.restockModalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="restock-shortcut-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.restockModalHeader}>
              <div>
                <p className={styles.restockModalEyebrow}>Restock</p>
                <h2 id="restock-shortcut-title">Choose Workbench</h2>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className={styles.restockModalClose}>
                Close
              </button>
            </div>

            <div className={styles.restockChoiceGrid}>
              {availableActions.map((action) => (
                <Link key={action.href} href={action.href} className={styles.restockChoiceCard}>
                  <strong>{action.label}</strong>
                  <span>{action.text}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
