'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL } from '@/utils/permissions'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

async function getActorContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('You need to sign in again.')
  }

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL
  const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, '*')

  return {
    supabase,
    user,
    profile,
    isAdmin,
    isApprover: isAdmin || profile?.role === 'hrga_approver',
  }
}

function getBirthdayDateValue(profile = {}) {
  return profile?.date_of_birth || profile?.birthdate || profile?.birth_date || null
}

function getBirthdayWindow(value) {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let birthday = new Date(today.getFullYear(), parsed.getMonth(), parsed.getDate())
  let windowEnd = new Date(birthday)
  windowEnd.setDate(windowEnd.getDate() + 7)

  if (today < birthday) {
    const previousBirthday = new Date(today.getFullYear() - 1, parsed.getMonth(), parsed.getDate())
    const previousWindowEnd = new Date(previousBirthday)
    previousWindowEnd.setDate(previousWindowEnd.getDate() + 7)
    if (today <= previousWindowEnd) {
      birthday = previousBirthday
      windowEnd = previousWindowEnd
    }
  }

  return {
    birthday,
    windowEnd,
    isOpen: today >= birthday && today <= windowEnd,
  }
}

function formatDateOnly(value) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function refreshHrgaPages() {
  revalidatePath('/dashboard/human-resources')
  revalidatePath('/dashboard/myarklife')
}

export async function createEmployeeProfile(formData) {
  const { supabase, user } = await getActorContext()

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
  const { supabase, user } = await getActorContext()

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

export async function createAnnouncementBroadcast(formData) {
  const { supabase, user } = await getActorContext()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Only admin can add announcements.')
  }

  const title = String(formData.get('title') || '').trim()
  const message = String(formData.get('message') || '').trim()
  const startDate = String(formData.get('start_date') || '').trim()
  const endDate = String(formData.get('end_date') || '').trim()
  const isActive = String(formData.get('is_active') || '').trim() === 'true'

  if (!title || !message || !startDate || !endDate) {
    throw new Error('Title, message, start date, and end date are required.')
  }

  const { error } = await supabase.from('hrd_announcement').insert({
    title,
    message,
    start_date: startDate,
    end_date: endDate,
    is_active: isActive,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/human-resources')
  revalidatePath('/dashboard/human-resources/announcement-broadcast')
}

export async function updateAnnouncementBroadcast(formData) {
  const { supabase, user } = await getActorContext()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Only admin can update announcements.')
  }

  const announcementId = String(formData.get('announcement_id') || '').trim()
  const title = String(formData.get('title') || '').trim()
  const message = String(formData.get('message') || '').trim()
  const startDate = String(formData.get('start_date') || '').trim()
  const endDate = String(formData.get('end_date') || '').trim()
  const isActive = String(formData.get('is_active') || '').trim() === 'true'

  if (!announcementId || !title || !message || !startDate || !endDate) {
    throw new Error('Announcement id, title, message, start date, and end date are required.')
  }

  const { error } = await supabase
    .from('hrd_announcement')
    .update({
      title,
      message,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive,
    })
    .eq('id', announcementId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/human-resources')
  revalidatePath('/dashboard/human-resources/announcement-broadcast')
}

export async function deleteAnnouncementBroadcast(formData) {
  const { supabase, user } = await getActorContext()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Only admin can delete announcements.')
  }

  const announcementId = String(formData.get('announcement_id') || '').trim()
  if (!announcementId) {
    throw new Error('Announcement id is required.')
  }

  const { error } = await supabase.from('hrd_announcement').delete().eq('id', announcementId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/human-resources')
  revalidatePath('/dashboard/human-resources/announcement-broadcast')
}

export async function submitLeaveRequest(formData) {
  const { supabase, user, profile } = await getActorContext()

  const requestType = String(formData.get('request_type') || '').trim().toUpperCase()
  const startDate = String(formData.get('start_date') || '').trim()
  const endDate = String(formData.get('end_date') || '').trim()
  const reason = String(formData.get('reason') || '').trim()

  if (!['LEAVE', 'PERMIT'].includes(requestType) || !startDate || !endDate || !reason) {
    throw new Error('Request type, dates, and reason are required.')
  }

  const { error } = await supabase.from('hrd_leave_requests').insert({
    employee_authenticated_id: user.id,
    employee_name_snapshot:
      profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Team',
    employee_email_snapshot: String(user.email || '').toLowerCase(),
    request_type: requestType,
    start_date: startDate,
    end_date: endDate,
    reason,
    status: 'SUBMITTED',
  })

  if (error) {
    throw new Error(error.message)
  }

  refreshHrgaPages()
}

export async function submitBirthdayGiftRequest(formData) {
  const { supabase, user, profile } = await getActorContext()

  const requestDate = String(formData.get('request_date') || '').trim()
  const itemName = String(formData.get('item_name') || '').trim()
  const size = String(formData.get('size') || '').trim().toUpperCase()

  if (!requestDate) {
    throw new Error('Request date is required.')
  }

  if (!itemName) {
    throw new Error('Item name is required.')
  }

  const birthdayWindow = getBirthdayWindow(getBirthdayDateValue(profile))
  if (!birthdayWindow?.isOpen) {
    throw new Error('Birthday gift claim is only available from your birthday until H+7.')
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('hrd_birthday_gift_requests')
    .select('id')
    .eq('employee_authenticated_id', user.id)
    .gte('request_date', formatDateOnly(birthdayWindow.birthday))
    .lte('request_date', formatDateOnly(birthdayWindow.windowEnd))
    .limit(1)

  if (existingError) {
    throw new Error(existingError.message)
  }

  if ((existingRows || []).length) {
    throw new Error('Birthday gift can only be claimed once for this birthday period.')
  }

  const noteLines = [`Item Name: ${itemName}`]
  if (size) {
    noteLines.push(`Size: ${size}`)
  }

  const { error } = await supabase.from('hrd_birthday_gift_requests').insert({
    employee_authenticated_id: user.id,
    employee_name_snapshot:
      profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Team',
    employee_email_snapshot: String(user.email || '').toLowerCase(),
    request_date: requestDate,
    notes: noteLines.join('\n'),
    status: 'SUBMITTED',
  })

  if (error) {
    throw new Error(error.message)
  }

  refreshHrgaPages()
}

export async function approveLeaveRequest(formData) {
  const { supabase, user, isApprover } = await getActorContext()

  if (!isApprover) {
    throw new Error('Only HRGA approver can update leave requests.')
  }

  const requestId = String(formData.get('request_id') || '').trim()
  const nextStatus = String(formData.get('next_status') || '').trim().toUpperCase()

  if (!requestId || !['APPROVED', 'REJECTED'].includes(nextStatus)) {
    throw new Error('Valid request id and status are required.')
  }

  const { error } = await supabase
    .from('hrd_leave_requests')
    .update({
      status: nextStatus,
      approved_at: new Date().toISOString(),
      approved_by: String(user.email || '').toLowerCase(),
    })
    .eq('id', requestId)

  if (error) {
    throw new Error(error.message)
  }

  refreshHrgaPages()
}

export async function approveBirthdayGiftRequest(formData) {
  const { supabase, user, isApprover } = await getActorContext()

  if (!isApprover) {
    throw new Error('Only HRGA approver can update birthday gift requests.')
  }

  const requestId = String(formData.get('request_id') || '').trim()
  const nextStatus = String(formData.get('next_status') || '').trim().toUpperCase()

  if (!requestId || !['APPROVED', 'REJECTED'].includes(nextStatus)) {
    throw new Error('Valid request id and status are required.')
  }

  const { error } = await supabase
    .from('hrd_birthday_gift_requests')
    .update({
      status: nextStatus,
      approved_at: new Date().toISOString(),
      approved_by: String(user.email || '').toLowerCase(),
    })
    .eq('id', requestId)

  if (error) {
    throw new Error(error.message)
  }

  refreshHrgaPages()
}
