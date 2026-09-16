import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, getRoleLockedGroup, resolveRole } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

import DeliveryReportClient from './delivery-report-client'

export const metadata = {
  title: 'Delivery Report | Warehouse Management System',
}

export default async function DeliveryReportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isAdmin = String(user.email || '').trim().toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')
  const role = resolveRole(profile?.role, isAdmin)

  return <DeliveryReportClient lockedGroup={getRoleLockedGroup(role)} />
}
