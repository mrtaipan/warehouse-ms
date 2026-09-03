'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import BarcodeScanner from './barcode-scanner'
import DeliveryOrder from './delivery-order'
import DeliverySummary from './delivery-summary'
import ManualWaybill from './manual-waybill'
import ResolutionCenter from './resolution-center'
import styles from './delivery-report.module.css'

const modules = [
  {
    id: 'summary',
    icon: '📊',
    title: 'Delivery Summary',
    description: 'An overview comparing delivery targets, barcode scans, and packing scans.',
    tag: 'Summary',
    tone: 'blue',
  },
  {
    id: 'delivery-order',
    icon: '📋',
    title: 'Delivery Order',
    description: 'Admins enter daily shipment targets used as the scan benchmark.',
    tag: 'Admin Input',
    tone: 'purple',
  },
  {
    id: 'barcode',
    icon: '🔍',
    title: 'Barcode Scanner',
    description: 'Scan barcodes to validate packing and delivery.',
    tag: 'Scanner',
    tone: 'amber',
  },
  {
    id: 'resolution',
    icon: '🛠️',
    title: 'Resolution Center',
    description: 'Process returned items and resolve problematic orders.',
    tag: 'Issue Handling',
    tone: 'rose',
  },
  {
    id: 'waybill',
    icon: '📄',
    title: 'Manual Waybill',
    description: 'Create manual waybills to generate barcodes.',
    tag: 'Resi Manual',
    tone: 'teal',
  },
]

function Home() {
  return (
    <div className={styles.homeWrap}>
      <div className={styles.homeShell}>
        <div className={styles.homeBackRow}>
          <Link href="/dashboard" className={styles.dashboardBackButton}>
            ← Back to Dashboard
          </Link>
        </div>
        <header className={styles.homeHero}>
          <span className={styles.eyebrow}>Delivery Report System</span>
          <h1>Delivery Report</h1>
          <p>Choose the module you want to use.</p>
        </header>

        <div className={styles.moduleBoard}>
          <div className={styles.moduleGrid}>
            {modules.map((module) => (
              <Link
                key={module.id}
                href={`/dashboard/delivery-report?module=${module.id}`}
                className={styles.moduleCard}
              >
                <span className={`${styles.moduleIcon} ${styles[module.tone]}`} aria-hidden="true">
                  {module.icon}
                </span>
                <span className={styles.moduleCardCopy}>
                  <strong>{module.title}</strong>
                  <span>{module.description}</span>
                </span>
                <span className={`${styles.moduleTag} ${styles[`${module.tone}Tag`]}`}>{module.tag}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ModuleHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className={styles.moduleHeader}>
      <div>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h1 className={!eyebrow ? styles.standaloneModuleTitle : undefined}>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className={styles.moduleHeaderActions}>
        {actions}
        <Link href="/dashboard/delivery-report" className={styles.backButton}>
          ← Back to Home
        </Link>
      </div>
    </header>
  )
}

export function LoadingState({ label = 'Loading data...' }) {
  return <div className={styles.loadingState}>{label}</div>
}

export function EmptyState({ label = 'Belum ada data' }) {
  return <div className={styles.emptyState}>{label}</div>
}

export function StatusMessage({ status }) {
  if (!status?.message) return null
  return (
    <div className={`${styles.statusMessage} ${styles[status.type || 'info']}`} role="status">
      {status.message}
    </div>
  )
}

export function Modal({ open, title, description, children, actions, onClose }) {
  if (!open) return null
  return (
    <div className={styles.modalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section className={styles.modalCard} role="dialog" aria-modal="true" aria-label={title}>
        {onClose ? (
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="Close modal">
            ×
          </button>
        ) : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {children}
        {actions ? <div className={styles.modalActions}>{actions}</div> : null}
      </section>
    </div>
  )
}

export default function DeliveryReportClient() {
  const searchParams = useSearchParams()
  const moduleId = searchParams.get('module')
  const isKnownModule = modules.some((module) => module.id === moduleId)
  const showHome = !moduleId || !isKnownModule

  return (
    <div
      className={`${styles.deliveryApp} ${moduleId === 'summary' ? styles.summaryApp : ''} ${moduleId === 'delivery-order' ? styles.orderApp : ''} ${moduleId === 'barcode' ? styles.scannerApp : ''} ${moduleId === 'resolution' ? styles.resolutionApp : ''} ${moduleId === 'waybill' ? styles.waybillApp : ''} ${showHome ? styles.homeApp : ''}`}
      data-delivery-report
      data-delivery-home={showHome ? '' : undefined}
      data-delivery-summary={moduleId === 'summary' ? '' : undefined}
      data-delivery-order={moduleId === 'delivery-order' ? '' : undefined}
      data-delivery-scanner={moduleId === 'barcode' ? '' : undefined}
      data-delivery-resolution={moduleId === 'resolution' ? '' : undefined}
    >
      {showHome ? <Home /> : null}
      {moduleId === 'summary' ? <DeliverySummary /> : null}
      {moduleId === 'delivery-order' ? <DeliveryOrder /> : null}
      {moduleId === 'barcode' ? <BarcodeScanner /> : null}
      {moduleId === 'resolution' ? <ResolutionCenter /> : null}
      {moduleId === 'waybill' ? <ManualWaybill /> : null}
    </div>
  )
}
