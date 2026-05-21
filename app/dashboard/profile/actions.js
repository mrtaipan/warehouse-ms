'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

export async function updateOwnProfile(formData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('You must be signed in to update your profile.')
  }

  const displayName = String(formData.get('display_name') || '').trim()
  const reimbursementBankName = String(formData.get('reimbursement_bank_name') || '').trim()
  const reimbursementAccountName = String(formData.get('reimbursement_account_name') || '').trim()
  const reimbursementAccountNumber = String(formData.get('reimbursement_account_number') || '').trim()

  if (!displayName) {
    throw new Error('Display name is required.')
  }

  const { data: profile, error: profileError } = await getProfileByAuthenticatedUser(supabase, user, 'id')

  if (profileError) {
    throw new Error(profileError.message)
  }

  if (!profile?.id) {
    throw new Error('User profile not found.')
  }

  const { error } = await supabase
    .from('dir_user_profiles')
    .update({
      display_name: displayName,
      reimbursement_bank_name: reimbursementBankName || null,
      reimbursement_account_name: reimbursementAccountName || null,
      reimbursement_account_number: reimbursementAccountNumber || null,
    })
    .eq('id', profile.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
}
