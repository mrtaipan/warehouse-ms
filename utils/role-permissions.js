import { expandImpliedPermissions } from '@/utils/permissions'

const ROLE_PERMISSION_CACHE_TTL_MS = 2 * 60 * 1000
const rolePermissionCache = new Map()
const permissionRoleCache = new Map()

function normalizeRoleKey(role) {
  return String(role || '').trim().toLowerCase()
}

function cloneCodes(codes = []) {
  return [...codes]
}

function readRolePermissionCache(roleKey) {
  const cached = rolePermissionCache.get(roleKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cloneCodes(cached.value)
  }

  return null
}

function writeRolePermissionCache(roleKey, codes) {
  rolePermissionCache.set(roleKey, {
    value: cloneCodes(codes),
    expiresAt: Date.now() + ROLE_PERMISSION_CACHE_TTL_MS,
  })
}

export function clearRolePermissionCache(role = '') {
  const roleKey = normalizeRoleKey(role)

  if (roleKey) {
    rolePermissionCache.delete(roleKey)
    permissionRoleCache.clear()
    return
  }

  rolePermissionCache.clear()
  permissionRoleCache.clear()
}

export async function getRolePermissionCodes(supabase, role, options = {}) {
  const roleKey = normalizeRoleKey(role)
  const includeImplied = Boolean(options.includeImplied)
  const force = Boolean(options.force)

  if (!supabase || !roleKey || roleKey === 'admin') {
    return { data: [], error: null }
  }

  let permissionCodes = !force ? readRolePermissionCache(roleKey) : null

  if (!permissionCodes) {
    const { data, error } = await supabase
      .from('dir_user_roles')
      .select('permission_code')
      .eq('role', roleKey)

    if (error) {
      return { data: [], error }
    }

    permissionCodes = (data || []).map((item) => item.permission_code).filter(Boolean)
    writeRolePermissionCache(roleKey, permissionCodes)
  }

  return {
    data: includeImplied ? Array.from(expandImpliedPermissions(permissionCodes)) : cloneCodes(permissionCodes),
    error: null,
  }
}

export async function getRolePermissionRows(supabase, role, options = {}) {
  const { data, error } = await getRolePermissionCodes(supabase, role, options)

  return {
    data: (data || []).map((permissionCode) => ({ permission_code: permissionCode })),
    error,
  }
}

export async function getRolesForPermissionCode(supabase, permissionCode, options = {}) {
  const codeKey = String(permissionCode || '').trim()
  const force = Boolean(options.force)

  if (!supabase || !codeKey) {
    return { data: [], error: null }
  }

  const cached = !force ? permissionRoleCache.get(codeKey) : null

  if (cached && cached.expiresAt > Date.now()) {
    return {
      data: cached.value.map((item) => ({ ...item })),
      error: null,
    }
  }

  const { data, error } = await supabase
    .from('dir_user_roles')
    .select('role, permission_code')
    .eq('permission_code', codeKey)

  if (error) {
    return { data: [], error }
  }

  const rows = (data || []).map((item) => ({ ...item }))
  permissionRoleCache.set(codeKey, {
    value: rows,
    expiresAt: Date.now() + ROLE_PERMISSION_CACHE_TTL_MS,
  })

  return { data: rows.map((item) => ({ ...item })), error: null }
}
