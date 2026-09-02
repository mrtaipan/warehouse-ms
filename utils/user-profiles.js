export function normalizeProfileEmail(value) {
  return String(value || '').trim().toLowerCase()
}

const USER_PROFILE_CACHE_TTL_MS = 60 * 1000
const userProfileCache = new Map()

function getProfileCacheKey(user, select) {
  return [
    user?.id || '',
    normalizeProfileEmail(user?.email),
    String(select || '*'),
  ].join('::')
}

function cloneProfileResult(result) {
  return {
    data: result?.data && typeof result.data === 'object' ? { ...result.data } : result?.data || null,
    error: result?.error || null,
  }
}

function readProfileCache(cacheKey) {
  const cached = userProfileCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cloneProfileResult(cached.value)
  }

  return null
}

function writeProfileCache(cacheKey, result) {
  if (result?.error) {
    return result
  }

  userProfileCache.set(cacheKey, {
    value: cloneProfileResult(result),
    expiresAt: Date.now() + USER_PROFILE_CACHE_TTL_MS,
  })

  return result
}

export function clearUserProfileCache() {
  userProfileCache.clear()
}

export async function getProfileByAuthenticatedUser(supabase, user, select = '*') {
  if (!supabase || !user) {
    return { data: null, error: null }
  }

  const cacheKey = getProfileCacheKey(user, select)
  const cached = readProfileCache(cacheKey)

  if (cached) {
    return cached
  }

  if (user.id) {
    const authMatch = await supabase
      .from('dir_user_profiles')
      .select(select)
      .eq('authenticated_id', user.id)
      .maybeSingle()

    if (authMatch.error) {
      const errorText = `${authMatch.error.code || ''} ${authMatch.error.message || ''} ${authMatch.error.details || ''}`.toLowerCase()
      if (!errorText.includes('authenticated_id')) {
        return authMatch
      }
    }

    if (authMatch.data) {
      return writeProfileCache(cacheKey, authMatch)
    }
  }

  const normalizedEmail = normalizeProfileEmail(user.email)
  if (!normalizedEmail) {
    return { data: null, error: null }
  }

  const emailMatch = await supabase
    .from('dir_user_profiles')
    .select(select)
    .ilike('email', normalizedEmail)
    .maybeSingle()

  return writeProfileCache(cacheKey, emailMatch)
}
