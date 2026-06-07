'use server'

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createHrgaRequestLinkPayload, verifyHrgaRequestLinkPayload } from '@/utils/hrga-request-link'
import { ADMIN_EMAIL, canAccessPeopleManagement } from '@/utils/permissions'
import { loadAccessContext } from '@/utils/access-control'

async function getActorContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('You need to sign in again.')
  }

  const { profile, permissions, isAdmin } = await loadAccessContext(supabase, user, '*')

  return {
    supabase,
    user,
    profile,
    isAdmin,
    isApprover: canAccessPeopleManagement(permissions, isAdmin),
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

export async function createPublicHoliday(formData) {
  const { supabase, user } = await getActorContext()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Only admin can add public holidays.')
  }

  const holidayDate = String(formData.get('holiday_date') || '').trim()
  const holidayName = String(formData.get('holiday_name') || '').trim()
  const notes = String(formData.get('notes') || '').trim()

  if (!holidayDate || !holidayName) {
    throw new Error('Holiday date and holiday name are required.')
  }

  const { error } = await supabase.from('hrga_public_holidays').insert({
    holiday_date: holidayDate,
    holiday_name: holidayName,
    notes: notes || null,
  })

  if (error) {
    throw new Error(error.message)
  }

  refreshHrgaPages()
}

export async function createPublicRequestLink(formData) {
  const { supabase, user, isApprover } = await getActorContext()

  if (!isApprover) {
    throw new Error('Only HRGA can create public request links.')
  }

  const requestType = String(formData.get('request_type') || '').trim().toUpperCase()
  const employeeProfileId = String(formData.get('employee_profile_id') || '').trim()

  if (!['LEAVE', 'BIRTHDAY'].includes(requestType)) {
    throw new Error('Request type is required.')
  }

  if (!employeeProfileId) {
    throw new Error('Target person is required.')
  }

  const { data: targetProfile, error: profileError } = await supabase
    .from('dir_user_profiles')
    .select('id, authenticated_id, display_name, email')
    .eq('id', employeeProfileId)
    .maybeSingle()

  if (profileError) {
    throw new Error(profileError.message)
  }

  if (!targetProfile?.id) {
    throw new Error('Selected person was not found.')
  }

  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30
  const payload = {
    type: requestType,
    profile_id: targetProfile.id,
    authenticated_id: targetProfile.authenticated_id || null,
    display_name: targetProfile.display_name || targetProfile.email || 'Team',
    email: targetProfile.email || null,
    exp: expiresAt,
  }
  const { encoded, signature } = createHrgaRequestLinkPayload(payload)
  const searchParams = new URLSearchParams({
    payload: encoded,
    sig: signature,
  })

  return {
    linkPath: `/people-request?${searchParams.toString()}`,
  }
}

export async function submitPublicRequest(formData) {
  const payloadValue = String(formData.get('payload') || '').trim()
  const signature = String(formData.get('sig') || '').trim()
  const decoded = verifyHrgaRequestLinkPayload(payloadValue, signature)

  if (!decoded) {
    throw new Error('Invalid request link.')
  }
  const requestType = String(decoded.type || '').trim().toUpperCase()
  if (!['LEAVE', 'BIRTHDAY'].includes(requestType)) {
    throw new Error('Invalid request type.')
  }

  const client = await createClient()
  const { data, error } = await client.rpc('submit_signed_hrga_request', {
    p_payload: payloadValue,
    p_signature: signature,
    p_start_date: String(formData.get('start_date') || '').trim() || null,
    p_end_date: String(formData.get('end_date') || '').trim() || null,
    p_reason: String(formData.get('reason') || '').trim() || null,
    p_request_date: String(formData.get('request_date') || '').trim() || null,
    p_item_name: String(formData.get('item_name') || '').trim() || null,
    p_size: String(formData.get('size') || '').trim().toUpperCase() || null,
  })

  if (error) {
    throw new Error(error.message)
  }

  refreshHrgaPages()
  return data || { success: true }
}

function normalizeEmployeeProfileField(key, value) {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) {
    return null
  }

  const normalizedKey = String(key || '').trim().toLowerCase()

  if (normalizedKey === 'email') {
    return normalizedValue.toLowerCase()
  }

  if (normalizedKey === 'gender' || normalizedKey === 'jenis_kelamin') {
    const upperValue = normalizedValue.toUpperCase()
    if (upperValue === 'MALE' || upperValue === 'M') return 'Male'
    if (upperValue === 'FEMALE' || upperValue === 'F') return 'Female'
    return normalizedValue
  }

  if (normalizedKey === 'birthplace' || normalizedKey === 'tempat_lahir') {
    return normalizedValue.toUpperCase()
  }

  if (normalizedKey.includes('ktp') || normalizedKey === 'nik') {
    const digitsOnly = normalizedValue.replace(/\D+/g, '')
    return digitsOnly || null
  }

  return normalizedValue
}

function resolveEmployeeIdPrefix(groupValue) {
  const normalizedGroup = String(groupValue || '').trim().toUpperCase()
  if (!normalizedGroup) {
    throw new Error('Group is required to generate Employee ID.')
  }

  return normalizedGroup === 'ARKLINE' ? '21' : '13'
}

async function generateEmployeeProfileId(supabase, groupValue) {
  const prefix = resolveEmployeeIdPrefix(groupValue)
  const now = new Date()
  const yearMonth = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`
  const baseId = `${prefix}${yearMonth}`

  const { data, error } = await supabase
    .from('dir_user_profiles')
    .select('id')
    .ilike('id', `${baseId}%`)
    .order('id', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  const lastId = String(data?.[0]?.id || '')
  const lastSequence = lastId.startsWith(baseId) ? Number.parseInt(lastId.slice(baseId.length), 10) || 0 : 0
  const nextSequence = lastSequence + 1

  if (nextSequence > 999) {
    throw new Error(`Employee ID sequence for ${baseId} is full.`)
  }

  return `${baseId}${String(nextSequence).padStart(3, '0')}`
}

export async function createEmployeeProfile(formData) {
  const { supabase, user } = await getActorContext()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Only admin can add employee profiles.')
  }

  const displayName = String(formData.get('display_name') || '').trim()
  const groupValue = String(formData.get('group') || '').trim()

  if (!displayName || !groupValue) {
    throw new Error('Display name and group are required.')
  }

  const profileId = await generateEmployeeProfileId(supabase, groupValue)

  const blockedFields = new Set(['authenticated_id', 'role', 'is_qc_active', 'qc_active_date', 'created_at', 'updated_at'])
  const payload = { id: profileId, authenticated_id: null, role: 'guest', is_qc_active: false, qc_active_date: null }

  for (const [key, value] of formData.entries()) {
    if (blockedFields.has(key) || key === 'id') continue
    payload[key] = normalizeEmployeeProfileField(key, value)
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
    'email',
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
    payload[key] = normalizeEmployeeProfileField(key, value)
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

  const requestType = 'LEAVE'
  const startDate = String(formData.get('start_date') || '').trim()
  const endDate = String(formData.get('end_date') || '').trim()
  const reason = String(formData.get('reason') || '').trim()
  const today = new Date().toISOString().slice(0, 10)

  if (!startDate || !endDate || !reason) {
    throw new Error('Dates and reason are required.')
  }

  if (startDate < today || endDate < today) {
    throw new Error('Leave request date cannot be earlier than today.')
  }

  if (endDate < startDate) {
    throw new Error('End date cannot be earlier than start date.')
  }

  const { error } = await supabase.from('hrga_leave_requests').insert({
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
    .from('hrga_birthday_gift')
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

  const { error } = await supabase.from('hrga_birthday_gift').insert({
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
    .from('hrga_leave_requests')
    .update({
      status: nextStatus,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
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
    .from('hrga_birthday_gift')
    .update({
      status: nextStatus,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq('id', requestId)

  if (error) {
    throw new Error(error.message)
  }

  refreshHrgaPages()
}
