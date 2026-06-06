import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

import styles from './layout.module.css'

export default async function MobileArklineLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className={styles.shell}>
      <div className={styles.viewport}>
        <div className={styles.content}>{children}</div>
      </div>
    </main>
  )
}
