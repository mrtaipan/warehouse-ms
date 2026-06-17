import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import { getStorageFeatureAccess } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'

import WarehouseMapClient from './warehouse-map-client'

export default async function WarehouseMapPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, permissions, isAdmin } = await loadAccessContext(supabase, user, 'role')
  const access = getStorageFeatureAccess(role, permissions, isAdmin)

  if (!access.location) {
    redirect('/dashboard/storage')
  }

  return <WarehouseMapClient />
}
