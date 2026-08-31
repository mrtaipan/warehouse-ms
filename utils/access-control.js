import { ADMIN_EMAIL, expandImpliedPermissions, resolveRole } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

const ACCESS_CONTEXT_CACHE_TTL_MS = 60 * 1000
const accessContextCache = new Map()

function getAccessCacheKey(user, profileSelect) {
  return [
    user?.id || '',
    String(user?.email || '').trim().toLowerCase(),
    profileSelect,
  ].join('::')
}

function cloneAccessContext(context) {
  return {
    ...context,
    permissions: [...(context.permissions || [])],
    permissionSet: new Set(context.permissionSet || []),
  }
}

export async function loadAccessContext(supabase, user, profileSelect = 'role') {
  const cacheKey = getAccessCacheKey(user, profileSelect)
  const cached = accessContextCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cloneAccessContext(cached.value)
  }

  const emailAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile, error: profileError } = await getProfileByAuthenticatedUser(supabase, user, profileSelect)

  if (profileError) {
    const fallbackContext = {
      profile: null,
      role: resolveRole('', emailAdmin),
      isAdmin: emailAdmin,
      permissions: [],
      permissionSet: new Set(),
      profileError,
      permissionsError: null,
    }

    return fallbackContext
  }

  const role = resolveRole(profile?.role, emailAdmin)
  const isAdmin = emailAdmin || role === 'admin'
  const { data: rolePermissions, error: permissionsError } = isAdmin
    ? { data: [], error: null }
    : await supabase
        .from('dir_user_roles')
        .select('permission_code')
        .eq('role', role)

  const permissions = (rolePermissions || []).map((item) => item.permission_code)
  const permissionSet = expandImpliedPermissions(permissions)

  const context = {
    profile,
    role,
    isAdmin,
    permissions,
    permissionSet,
    profileError: null,
    permissionsError: permissionsError || null,
  }

  accessContextCache.set(cacheKey, {
    value: cloneAccessContext(context),
    expiresAt: Date.now() + ACCESS_CONTEXT_CACHE_TTL_MS,
  })

  return context
}
