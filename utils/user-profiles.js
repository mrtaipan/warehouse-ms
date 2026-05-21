export function normalizeProfileEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export async function getProfileByAuthenticatedUser(supabase, user, select = '*') {
  if (!supabase || !user) {
    return { data: null, error: null }
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
      return authMatch
    }
  }

  const normalizedEmail = normalizeProfileEmail(user.email)
  if (!normalizedEmail) {
    return { data: null, error: null }
  }

  return supabase
    .from('dir_user_profiles')
    .select(select)
    .eq('email', normalizedEmail)
    .maybeSingle()
}
