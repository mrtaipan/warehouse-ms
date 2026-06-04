'use client'

import Link from 'next/link'

import styles from './arkline.module.css'
import useArklineAccess from './use-arkline-access'

const cards = [
  {
    href: '/dashboard/arkline/directory',
    number: '01.',
    title: 'Directory',
    text: 'Manage Arkline products, materials, and BOM in the same workspace.',
    short: 'Product, material, and BOM master.',
    hoverImage: '/arkline-productdirectory-hover.PNG',
    accessKey: 'directory',
  },
  {
    href: '/dashboard/arkline/progress-overview',
    number: '02.',
    title: 'Progress Snapshot',
    text: 'Monitor Arkline workflow progress in one place across production, QC, finance, and delivery status.',
    short: 'Live status and overall visibility.',
    hoverImage: '/arkline-progressnapshot-hover.PNG',
    accessKey: 'progressOverview',
  },
  {
    href: '/dashboard/arkline/production-planning',
    number: '03.',
    title: 'Production Planning',
    text: 'Prepare PO-based production scheduling, quantity allocation, and day-to-day production coordination so each batch has a clear execution plan.',
    short: 'Plan quantities and production flow.',
    hoverImage: '/arkline-productionplanning-hover.PNG',
    accessKey: 'productionPlanning',
  },
  {
    href: '/dashboard/arkline/financial-management',
    number: '04.',
    title: 'Financial Management',
    text: 'Follow payment progress, cost visibility, and finance-side control for each garment PO in the Arkline workflow.',
    short: 'Track finance status and settlement.',
    hoverImage: '/arkline-materialfulfillment-hover.PNG',
    accessKey: 'financialManagement',
  },
]

export default function ArklinePage() {
  const { access, loading } = useArklineAccess()

  return (
    <div className={styles.page}>
      <section className={styles.overviewGrid}>
        {cards.map((card) => {
          const enabled = Boolean(access[card.accessKey])
          const className = `${styles.overviewCard} ${styles.overviewCardWithImage} ${!loading && !enabled ? styles.overviewCardDisabled : ''}`.trim()
          const style = { '--overview-hover-image': `url("${card.hoverImage}")` }

          return !loading && enabled ? (
            <Link key={card.href} href={card.href} className={className} style={style}>
              <span className={styles.overviewNumber}>{card.number}</span>
              <div className={styles.overviewCardContent}>
                <p className={styles.overviewCardKicker}>{card.short}</p>
                <h2 className={styles.overviewCardTitle}>{card.title}</h2>
                <p className={styles.overviewCardText}>{card.text}</p>
              </div>
            </Link>
          ) : (
            <div key={card.href} className={className} style={style} aria-disabled={!loading && !enabled ? 'true' : undefined}>
              <span className={styles.overviewNumber}>{card.number}</span>
              <div className={styles.overviewCardContent}>
                <p className={styles.overviewCardKicker}>{card.short}</p>
                <h2 className={styles.overviewCardTitle}>{card.title}</h2>
                <p className={styles.overviewCardText}>{card.text}</p>
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
