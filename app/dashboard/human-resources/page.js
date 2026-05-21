import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import styles from '../arkline/arkline.module.css'
import PeopleDirectoryClient from './people-directory-client'

export default async function HumanResourcesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')

  if (!isAdmin && !profile) {
    redirect('/dashboard')
  }

  const { data: peopleRows } = await supabase.from('dir_user_profiles').select('*').order('id', { ascending: true })

  return (
    <div className={styles.directoryTabsPage}>
      <section className={styles.directoryTabsPanel}>
        <div className={styles.directorySection}>
          <div className={styles.sectionHeader}>
            <div>
              <h1 className={styles.sectionTitle}>People Directory</h1>
            </div>
          </div>

          <PeopleDirectoryClient people={peopleRows || []} isAdmin={isAdmin} />
        </div>
      </section>
    </div>
  )
}
