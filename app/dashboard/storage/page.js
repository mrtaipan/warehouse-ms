import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, getStorageFeatureAccess } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'
import StorageOverviewClient from './storage-overview-client'

const workspaceCards = [
  {
    key: 'search',
    href: '/dashboard/storage/search',
    number: '01.',
    kicker: 'Find stock and rack placement fast.',
    title: 'Search Storage',
    text: 'Search stored items by product name and jump straight to the rack or pallet where each record is currently placed.',
  },
  {
    key: 'registry',
    href: '/dashboard/storage/registry',
    number: '02.',
    kicker: 'Post inbound stock into exact slots.',
    title: 'Registry Storage',
    text: 'Register products into the correct warehouse slot, capture size and quantity, and keep recent storage input visible in one place.',
  },
  {
    key: 'location',
    href: '/dashboard/storage/overview',
    number: '03.',
    kicker: 'Review stored stock by physical area.',
    title: 'Storage Location',
    text: 'Monitor stored inventory by pallet or shelving location, filter the live list, and handle take or edit actions from the main storage table.',
  },
  {
    key: 'restockInstruction',
    href: '/restock-request',
    number: '04.',
    kicker: 'Create and work restock flow.',
    title: 'Restock Instruction',
    text: 'Open the restock request flow for submission or continue into picker handling when the active role needs to process incoming replenishment instructions.',
  },
]

export default async function StoragePage() {
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

  const cards = workspaceCards.filter((item) => {
    if (item.key === 'search') return access.search
    if (item.key === 'registry') return access.registry
    if (item.key === 'location') return access.overview
    if (item.key === 'restockInstruction') return access.restockSubmit || access.restockPicker
    return false
  })

  return (
    <StorageOverviewClient
      cards={cards}
      canRestockSubmit={access.restockSubmit}
      canRestockPicker={access.restockPicker}
    />
  )
}
