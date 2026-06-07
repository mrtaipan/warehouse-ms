import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, ROLE_OPTIONS, getPermissionCatalog } from '@/utils/permissions'
import { sendUserInvite, updateRolePermissions, updateUserRole } from './actions'
import UserAccessClient from './user-access-client'

export default async function UserAccessPage({ searchParams }) {
  const resolvedSearchParams = await Promise.resolve(searchParams)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  const [{ data: profiles, error: profilesError }, { data: rolePermissions, error: rolePermissionsError }] = await Promise.all([
    supabase.from('dir_user_profiles').select('*').order('email', { ascending: true }),
    supabase.from('dir_user_roles').select('role, permission_code').order('role', { ascending: true }),
  ])

  if (profilesError || rolePermissionsError) {
    throw new Error(profilesError?.message || rolePermissionsError?.message || 'Failed to load user access.')
  }

  const rolePermissionMap = (rolePermissions || []).reduce((accumulator, item) => {
    if (!accumulator[item.role]) accumulator[item.role] = []
    accumulator[item.role].push(item.permission_code)
    return accumulator
  }, {})

  const inviteStatus = String(resolvedSearchParams?.invite || '').trim().toLowerCase()
  const actionStatus = String(resolvedSearchParams?.status || '').trim().toLowerCase()
  const inviteMessage = String(resolvedSearchParams?.message || '').trim()

  return (
    <UserAccessClient
      profiles={profiles || []}
      roleOptions={ROLE_OPTIONS}
      permissionCatalog={getPermissionCatalog()}
      rolePermissionMap={rolePermissionMap}
      inviteStatus={inviteStatus}
      actionStatus={actionStatus}
      inviteMessage={inviteMessage}
      updateUserRole={updateUserRole}
      updateRolePermissions={updateRolePermissions}
      sendUserInvite={sendUserInvite}
    />
  )
}
