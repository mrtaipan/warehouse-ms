import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { canAccessPeopleManagement } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'
import MyArklifeClient from './myarklife-client'
import styles from './myarklife.module.css'

function getQueryData(result) {
  if (result.error?.code === '42P01') {
    return { rows: [], missing: true }
  }

  return { rows: result.data || [], missing: false }
}

function filterActiveLeaveRows(rows) {
  const today = new Date()
  const todayValue = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  return (rows || []).filter((item) => {
    const endDate = new Date(item?.end_date || item?.start_date || '')
    if (Number.isNaN(endDate.getTime())) return false
    const endValue = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime()
    return endValue >= todayValue
  })
}

function sortRowsByRecent(rows) {
  return [...(rows || [])].sort((left, right) => {
    const leftValue = new Date(left?.submitted_at || left?.created_at || 0).getTime()
    const rightValue = new Date(right?.submitted_at || right?.created_at || 0).getTime()
    return rightValue - leftValue
  })
}

export default async function MyArklifePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { profile, permissions, isAdmin } = await loadAccessContext(supabase, user, '*')
  const [leaveResult, giftResult, publicHolidayResult] = await Promise.all([
    supabase
      .from('hrga_leave_requests')
      .select('*')
      .eq('employee_authenticated_id', user.id)
      .order('submitted_at', { ascending: false }),
    supabase
      .from('hrga_birthday_gift')
      .select('*')
      .eq('employee_authenticated_id', user.id),
    supabase.from('hrga_public_holidays').select('*').order('holiday_date', { ascending: true }),
  ])

  const { rows: leaveRowsRaw, missing: leaveMissing } = getQueryData(leaveResult)
  const { rows: giftRowsRaw, missing: giftMissing } = getQueryData(giftResult)
  const { rows: publicHolidayRows } = getQueryData(publicHolidayResult)
  const leaveRows = filterActiveLeaveRows(leaveRowsRaw).slice(0, 2)
  const giftRows = sortRowsByRecent(giftRowsRaw)

  return (
    <div className={styles.page}>
      <MyArklifeClient
        profile={{ ...(profile || {}), email: user.email || profile?.email || '' }}
        leaveRows={leaveRows}
        giftRows={giftRows}
        publicHolidayRows={publicHolidayRows}
        leaveMissing={leaveMissing}
        giftMissing={giftMissing}
        canOpenPeopleManagement={canAccessPeopleManagement(permissions, isAdmin)}
      />
    </div>
  )
}
