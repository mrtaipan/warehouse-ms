'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL } from '@/utils/permissions'

export async function createEmployeeProfile(formData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Only admin can add employee profiles.')
  }

  const profileId = String(formData.get('id') || '').trim()
  const displayName = String(formData.get('display_name') || '').trim()

  if (!profileId || !displayName) {
    throw new Error('Id and display name are required.')
  }

  const blockedFields = new Set(['authenticated_id', 'role', 'is_qc_active', 'qc_active_date', 'created_at', 'updated_at'])
  const payload = { id: profileId, authenticated_id: null, role: 'storage_staff', is_qc_active: false, qc_active_date: null }

  for (const [key, value] of formData.entries()) {
    if (blockedFields.has(key) || key === 'id') continue
    const normalizedValue = String(value || '').trim()
    payload[key] = normalizedValue ? (key === 'email' ? normalizedValue.toLowerCase() : normalizedValue) : null
  }

  const { error } = await supabase.from('dir_user_profiles').insert(payload)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/human-resources')
  revalidatePath('/dashboard/user-access')
}

export async function updateEmployeeProfile(formData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Only admin can update employee profiles.')
  }

  const profileId = String(formData.get('profile_id') || '').trim()
  if (!profileId) {
    throw new Error('Profile id is required.')
  }

  const blockedFields = new Set([
    'profile_id',
    'id',
    'authenticated_id',
    'role',
    'is_qc_active',
    'qc_active_date',
    'created_at',
    'updated_at',
  ])
  const payload = {}

  for (const [key, value] of formData.entries()) {
    if (blockedFields.has(key)) continue
    const normalizedValue = String(value || '').trim()
    payload[key] = normalizedValue ? (key === 'email' ? normalizedValue.toLowerCase() : normalizedValue) : null
  }

  const { error } = await supabase.from('dir_user_profiles').update(payload).eq('id', profileId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/human-resources')
  revalidatePath('/dashboard/user-access')
}
