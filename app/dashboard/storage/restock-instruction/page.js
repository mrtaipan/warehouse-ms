import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, getStorageFeatureAccess } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

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

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')
  const role = isAdmin ? 'admin' : profile?.role || 'storage_staff'
  const { data: rolePermissions } = await supabase
    .from('dir_user_roles')
    .select('permission_code')
    .eq('role', role)
  const permissions = (rolePermissions || []).map((item) => item.permission_code)
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
