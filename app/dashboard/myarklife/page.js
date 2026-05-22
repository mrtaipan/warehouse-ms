import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, canAccessPeopleManagement } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import MyArklifeClient from './myarklife-client'
import styles from './myarklife.module.css'

function getQueryData(result) {
  if (result.error?.code === '42P01') {
    return { rows: [], missing: true }
  }

  return { rows: result.data || [], missing: false }
}

export default async function MyArklifePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, '*')
  const role = isAdmin ? 'admin' : profile?.role || 'storage_staff'
  const [leaveResult, giftResult] = await Promise.all([
    supabase
      .from('hrd_leave_requests')
      .select('*')
      .eq('employee_authenticated_id', user.id)
      .order('submitted_at', { ascending: false }),
    supabase
      .from('hrd_birthday_gift_requests')
      .select('*')
      .eq('employee_authenticated_id', user.id)
      .order('submitted_at', { ascending: false }),
  ])

  const { rows: leaveRows, missing: leaveMissing } = getQueryData(leaveResult)
  const { rows: giftRows, missing: giftMissing } = getQueryData(giftResult)

  return (
    <div className={styles.page}>
      <MyArklifeClient
        profile={{ ...(profile || {}), email: user.email || profile?.email || '' }}
        leaveRows={leaveRows}
        giftRows={giftRows}
        leaveMissing={leaveMissing}
        giftMissing={giftMissing}
        canOpenPeopleManagement={canAccessPeopleManagement(role, isAdmin)}
      />
    </div>
  )
}
