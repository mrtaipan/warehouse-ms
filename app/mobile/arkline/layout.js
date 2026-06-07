import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { canAccessPath } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'

import styles from './layout.module.css'

export default async function MobileArklineLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, permissions, isAdmin } = await loadAccessContext(supabase, user, 'role')

  if (!canAccessPath('/mobile/arkline/live-reporting', role, permissions, isAdmin)) {
    redirect('/dashboard')
  }

  return (
    <main className={styles.shell}>
      <div className={styles.viewport}>
        <div className={styles.content}>{children}</div>
      </div>
    </main>
  )
}
