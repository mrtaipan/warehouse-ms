'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { ADMIN_EMAIL, OFFICIAL_ROLE_VALUES, expandImpliedPermissions, normalizeRole } from '@/utils/permissions'

function getTodayJakartaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export async function updateUserRole(formData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Only admin can update user access.')
  }

  const profileId = String(formData.get('profile_id') || '').trim()
  const role = normalizeRole(formData.get('role'))
  const displayName = String(formData.get('display_name') || '').trim()
  const hasQcActiveField = formData.has('is_qc_active')
  const isQcActive = formData.get('is_qc_active') === 'on'

  if (!profileId || !role || !OFFICIAL_ROLE_VALUES.includes(role)) {
    throw new Error('Profile id and role are required.')
  }

  const payload = {
    role,
    display_name: displayName || 'Employee',
  }

  if (hasQcActiveField) {
    payload.is_qc_active = isQcActive
    payload.qc_active_date = isQcActive ? getTodayJakartaDate() : null
  }

  const { data, error } = await supabase
    .from('dir_user_profiles')
    .update(payload)
    .eq('id', profileId)
    .select('id, role')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('User profile was not updated. Please check the dir_user_profiles update policy or profile id.')
  }

  revalidatePath('/dashboard/user-access')
  revalidatePath('/dashboard')
}

export async function updateRolePermissions(formData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Only admin can update role permissions.')
  }

  const role = normalizeRole(formData.get('role'))
  const permissionCodes = formData
    .getAll('permission_code')
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  const normalizedPermissionCodes = Array.from(expandImpliedPermissions(permissionCodes))

  if (!role || !OFFICIAL_ROLE_VALUES.includes(role)) {
    throw new Error('Role is required.')
  }

  const { error: deleteError } = await supabase.from('dir_user_roles').delete().eq('role', role)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  if (normalizedPermissionCodes.length) {
    const { error: insertError } = await supabase.from('dir_user_roles').insert(
      normalizedPermissionCodes.map((permissionCode) => ({
        role,
        permission_code: permissionCode,
      }))
    )

    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  revalidatePath('/dashboard/user-access')
  revalidatePath('/dashboard')
}

function resolveAppOrigin(headerStore) {
  const forwardedProto = headerStore.get('x-forwarded-proto')
  const forwardedHost = headerStore.get('x-forwarded-host')
  const origin = headerStore.get('origin')

  if (origin) return origin
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`
  if (forwardedHost) return `https://${forwardedHost}`
  return 'http://localhost:3000'
}

export async function sendUserInvite(formData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Only admin can send user invitations.')
  }

  const profileId = String(formData.get('profile_id') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const displayName = String(formData.get('display_name') || '').trim()

  if (!profileId || !email) {
    redirect('/dashboard/user-access?invite=missing')
  }

  const headerStore = await headers()
  const redirectTo = `${resolveAppOrigin(headerStore)}/accept-invite`

  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: displayName
        ? {
            display_name: displayName,
            full_name: displayName,
          }
        : undefined,
    })

    if (error) {
      redirect(`/dashboard/user-access?invite=error&message=${encodeURIComponent(error.message)}`)
    }

    const invitedUserId = String(data?.user?.id || '').trim()
    if (invitedUserId) {
      const { error: updateError } = await supabase
        .from('dir_user_profiles')
        .update({
          authenticated_id: invitedUserId,
          email,
          ...(displayName ? { display_name: displayName } : {}),
        })
        .eq('id', profileId)

      if (updateError) {
        redirect(`/dashboard/user-access?invite=error&message=${encodeURIComponent(updateError.message)}`)
      }
    }

    revalidatePath('/dashboard/user-access')
    revalidatePath('/dashboard')
    redirect('/dashboard/user-access?invite=sent')
  } catch (error) {
    if (String(error?.digest || '').startsWith('NEXT_REDIRECT')) {
      throw error
    }
    redirect(`/dashboard/user-access?invite=error&message=${encodeURIComponent(error?.message || 'Failed to send invite.')}`)
  }
}
