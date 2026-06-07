import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import { getStorageFeatureAccess } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'

import overviewStyles from '../../arkline/arkline.module.css'
import styles from '../storage.module.css'

const actions = [
  {
    key: 'submit',
    href: '/restock-request',
    number: '01.',
    kicker: 'Request replenishment from storage.',
    title: 'Restock Submit',
    text: 'Create a new replenishment request when an item is empty or needs to be pulled for the next movement.',
  },
  {
    key: 'picker',
    href: '/take-requests',
    number: '02.',
    kicker: 'Work the active replenishment queue.',
    title: 'Restock Picker',
    text: 'Open the picking queue, choose the actual source location, and complete each replenishment request.',
  },
]

export default async function StorageRestockInstructionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, permissions, isAdmin } = await loadAccessContext(supabase, user, 'role')
  const access = getStorageFeatureAccess(role, permissions, isAdmin)

  const cards = actions.map((item) => {
    const isEnabled = item.key === 'submit' ? access.restockSubmit : access.restockPicker
    return {
      ...item,
      isEnabled,
    }
  })

  return (
    <div className={styles.page}>
      <section className={overviewStyles.overviewGrid}>
        {cards.map((card) =>
          card.isEnabled ? (
            <Link key={card.key} href={card.href} className={overviewStyles.overviewCard}>
              <span className={overviewStyles.overviewNumber}>{card.number}</span>
              <div className={overviewStyles.overviewCardContent}>
                <p className={overviewStyles.overviewCardKicker}>{card.kicker}</p>
                <h2 className={overviewStyles.overviewCardTitle}>{card.title}</h2>
                <p className={overviewStyles.overviewCardText}>{card.text}</p>
              </div>
            </Link>
          ) : (
            <div
              key={card.key}
              className={`${overviewStyles.overviewCard} ${styles.overviewDisabledCard}`.trim()}
              aria-disabled="true"
            >
              <span className={overviewStyles.overviewNumber}>{card.number}</span>
              <div className={overviewStyles.overviewCardContent}>
                <p className={overviewStyles.overviewCardKicker}>{card.kicker}</p>
                <h2 className={overviewStyles.overviewCardTitle}>{card.title}</h2>
                <p className={overviewStyles.overviewCardText}>{card.text}</p>
              </div>
            </div>
          )
        )}
      </section>
    </div>
  )
}
