'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL } from '@/utils/permissions'

export async function updateUserRole(formData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Only admin can update user access.')
  }

  const email = String(formData.get('email') || '').trim().toLowerCase()
  const role = String(formData.get('role') || '').trim()
  const displayName = String(formData.get('display_name') || '').trim()

  if (!email || !role) {
    throw new Error('Email and role are required.')
  }

  const payload = {
    role,
    display_name: displayName || email.split('@')[0],
  }

  const { error } = await supabase.from('dir_user_profiles').update(payload).eq('email', email)

  if (error) {
    throw new Error(error.message)
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

  const role = String(formData.get('role') || '').trim()
  const permissionCodes = formData
    .getAll('permission_code')
    .map((item) => String(item || '').trim())
    .filter(Boolean)

  if (!role) {
    throw new Error('Role is required.')
  }

  const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role', role)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  if (permissionCodes.length) {
    const { error: insertError } = await supabase.from('role_permissions').insert(
      permissionCodes.map((permissionCode) => ({
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
