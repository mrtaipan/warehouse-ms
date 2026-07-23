import { redirect } from 'next/navigation'

import { loadAccessContext } from '@/utils/access-control'
import { getStorageFeatureAccess } from '@/utils/permissions'
import { createClient } from '@/utils/supabase/server'

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

  if (access.restockPicker && !access.restockSubmit) {
    redirect('/take-requests')
  }

  if (access.restockSubmit && !access.restockPicker) {
    redirect('/restock-request')
  }

  if (access.restockPicker) {
    redirect('/take-requests')
  }

  if (access.restockSubmit) {
    redirect('/restock-request')
  }

  redirect('/dashboard/storage/overview')
}
