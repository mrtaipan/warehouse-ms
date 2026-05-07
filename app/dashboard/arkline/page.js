import Link from 'next/link'
import styles from './arkline.module.css'

const cards = [
  {
    href: '/dashboard/arkline/directory',
    number: '01.',
    title: 'Product Directory',
    text: 'Manage Arkline products, create new SKU entries, and manage BOM in the same workspace.',
    short: 'Product setup and SKU master.',
    hoverImage: '/arkline-productdirectory-hover.PNG',
  },
  {
    href: '/dashboard/arkline/progress-overview',
    number: '02.',
    title: 'Progress Snapshot',
    text: 'Monitor Arkline workflow progress in one place across production, QC, finance, and delivery status.',
    short: 'Live status and overall visibility.',
    hoverImage: '/arkline-progressnapshot-hover.PNG',
  },
  {
    href: '/dashboard/arkline/production-planning',
    number: '03.',
    title: 'Production Planning',
    text: 'Prepare PO-based production scheduling, quantity allocation, and day-to-day production coordination so each batch has a clear execution plan.',
    short: 'Plan quantities and production flow.',
    hoverImage: '/arkline-productionplanning-hover.PNG',
  },
  {
    href: '/dashboard/arkline/material-fulfillment',
    number: '04.',
    title: 'Material Fulfillment',
    text: 'Use this space for upcoming material readiness, request tracking, and fulfillment visibility for Arkline jobs.',
    short: 'Track and post material requirement.',
    hoverImage: '/arkline-materialfulfillment-hover.PNG',
  },
]

export default function ArklinePage() {
  return (
    <div className={styles.page}>
      <section className={styles.overviewGrid}>
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`${styles.overviewCard} ${styles.overviewCardWithImage}`.trim()}
            style={{ '--overview-hover-image': `url("${card.hoverImage}")` }}
          >
            <span className={styles.overviewNumber}>{card.number}</span>
            <div className={styles.overviewCardContent}>
              <p className={styles.overviewCardKicker}>{card.short}</p>
              <h2 className={styles.overviewCardTitle}>{card.title}</h2>
              <p className={styles.overviewCardText}>{card.text}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
