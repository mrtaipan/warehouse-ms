import { ADMIN_EMAIL, expandImpliedPermissions, resolveRole } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

export async function loadAccessContext(supabase, user, profileSelect = 'role') {
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile, error: profileError } = await getProfileByAuthenticatedUser(supabase, user, profileSelect)

  if (profileError) {
    return {
      profile: null,
      role: resolveRole('', isAdmin),
      isAdmin,
      permissions: [],
      permissionSet: new Set(),
      profileError,
      permissionsError: null,
    }
  }

  const role = resolveRole(profile?.role, isAdmin)
  const { data: rolePermissions, error: permissionsError } = await supabase
    .from('dir_user_roles')
    .select('permission_code')
    .eq('role', role)

  const permissions = (rolePermissions || []).map((item) => item.permission_code)
  const permissionSet = expandImpliedPermissions(permissions)

  return {
    profile,
    role,
    isAdmin,
    permissions,
    permissionSet,
    profileError: null,
    permissionsError: permissionsError || null,
  }
}
