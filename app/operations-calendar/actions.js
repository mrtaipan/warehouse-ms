'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { loadAccessContext } from '@/utils/access-control'

const DIVISION_KEYS = new Set(['inbound', 'qc', 'packing', 'storage'])

const ROLE_DIVISION_MAP = {
  inbound_coordinator: 'inbound',
  inbound_staff: 'inbound',
  qc_coordinator: 'qc',
  qc_staff: 'qc',
  qc_inspector: 'qc',
  packing_coordinator: 'packing',
  packing_staff: 'packing',
  storage_coordinator: 'storage',
  storage_staff: 'storage',
  warehouse_leader: 'storage',
  admin: 'storage',
}

const TARGET_MANAGER_ROLES = new Set([
  'admin',
  'leader',
  'warehouse_leader',
])

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeDate(value) {
  const text = normalizeText(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function getRedirectPath(formData, status, message) {
  const month = normalizeText(formData.get('month'))
  const view = normalizeText(formData.get('view')) || 'timeline'
  const params = new URLSearchParams()

  if (/^\d{4}-\d{2}$/.test(month)) params.set('month', month)
  if (view) params.set('view', view)
  params.set('status', status)
  params.set('message', message)

  return `/operations-calendar?${params.toString()}`
}

function getRoleDivision(role) {
  return ROLE_DIVISION_MAP[String(role || '').trim()] || ''
}

function assertTargetAccess(role, isAdmin) {
  if (isAdmin || TARGET_MANAGER_ROLES.has(role)) return
  redirect('/operations-calendar?status=error&message=Only%20admin%20or%20leader%20roles%20can%20add%20targets.')
}

function assertManualAccess(role, isAdmin) {
  const division = getRoleDivision(isAdmin ? 'admin' : role)
  if (division) return division
  redirect('/operations-calendar?status=error&message=This%20role%20does%20not%20have%20an%20operations%20division.')
}

function normalizeBrand(value) {
  const text = normalizeText(value)
  return text && text.toUpperCase() !== 'ALL' ? text : null
}

export async function createOperationsCalendarTarget(formData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, isAdmin, profile } = await loadAccessContext(supabase, user, 'role, display_name')
  assertTargetAccess(role, isAdmin)

  const targetDate = normalizeDate(formData.get('target_date'))
  const divisionKey = normalizeText(formData.get('division_key'))
  const grnNumber = normalizeText(formData.get('grn_number'))
  const brandName = normalizeBrand(formData.get('brand_name'))

  if (!targetDate || !DIVISION_KEYS.has(divisionKey) || !grnNumber) {
    redirect(getRedirectPath(formData, 'error', 'Target date, division, and GRN are required.'))
  }

  const { error } = await supabase.from('operations_calendar_targets').insert([{
    target_date: targetDate,
    division_key: divisionKey,
    grn_number: grnNumber,
    brand_name: brandName,
    created_by: user.email || profile?.display_name || null,
    updated_by: user.email || profile?.display_name || null,
  }])

  if (error) {
    redirect(getRedirectPath(formData, 'error', error.message || 'Failed to save target.'))
  }

  revalidatePath('/operations-calendar')
  redirect(getRedirectPath(formData, 'saved', 'Target added.'))
}

export async function updateOperationsCalendarTarget(formData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, isAdmin, profile } = await loadAccessContext(supabase, user, 'role, display_name')
  assertTargetAccess(role, isAdmin)

  const targetId = normalizeText(formData.get('target_id'))
  const targetDate = normalizeDate(formData.get('target_date'))
  const divisionKey = normalizeText(formData.get('division_key'))
  const grnNumber = normalizeText(formData.get('grn_number'))
  const brandName = normalizeBrand(formData.get('brand_name'))

  if (!targetId || !targetDate || !DIVISION_KEYS.has(divisionKey) || !grnNumber) {
    redirect(getRedirectPath(formData, 'error', 'Target date, division, and GRN are required.'))
  }

  const { error } = await supabase
    .from('operations_calendar_targets')
    .update({
      target_date: targetDate,
      division_key: divisionKey,
      grn_number: grnNumber,
      brand_name: brandName,
      updated_by: user.email || profile?.display_name || null,
    })
    .eq('id', targetId)

  if (error) {
    redirect(getRedirectPath(formData, 'error', error.message || 'Failed to update target.'))
  }

  revalidatePath('/operations-calendar')
  redirect(getRedirectPath(formData, 'saved', 'Target updated.'))
}

export async function createOperationsCalendarManualReport(formData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, isAdmin, profile } = await loadAccessContext(supabase, user, 'role, display_name')
  const divisionKey = assertManualAccess(role, isAdmin)
  const reportDate = normalizeDate(formData.get('report_date'))
  const title = normalizeText(formData.get('title'))
  const description = normalizeText(formData.get('description'))
  const createdBy = user.email || profile?.display_name || null

  if (!reportDate || !title) {
    redirect(getRedirectPath(formData, 'error', 'Report date and title are required.'))
  }

  const { error } = await supabase.from('operations_calendar_manual_reports').insert([{
    report_date: reportDate,
    division_key: divisionKey,
    title,
    description: description || null,
    pic_name: profile?.display_name || user.email || null,
    created_by: createdBy,
    updated_by: createdBy,
  }])

  if (error) {
    redirect(getRedirectPath(formData, 'error', error.message || 'Failed to save manual report.'))
  }

  revalidatePath('/operations-calendar')
  redirect(getRedirectPath(formData, 'saved', 'Manual report added.'))
}

export async function updateOperationsCalendarManualReport(formData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { role, isAdmin, profile } = await loadAccessContext(supabase, user, 'role, display_name')
  const divisionKey = assertManualAccess(role, isAdmin)
  const reportId = normalizeText(formData.get('manual_report_id'))
  const reportDate = normalizeDate(formData.get('report_date'))
  const title = normalizeText(formData.get('title'))
  const description = normalizeText(formData.get('description'))

  if (!reportId || !reportDate || !title) {
    redirect(getRedirectPath(formData, 'error', 'Report date and title are required.'))
  }

  let query = supabase
    .from('operations_calendar_manual_reports')
    .update({
      report_date: reportDate,
      title,
      description: description || null,
      updated_by: user.email || profile?.display_name || null,
    })
    .eq('id', reportId)

  if (!isAdmin) {
    query = query.eq('division_key', divisionKey)
  }

  const { error } = await query

  if (error) {
    redirect(getRedirectPath(formData, 'error', error.message || 'Failed to update manual report.'))
  }

  revalidatePath('/operations-calendar')
  redirect(getRedirectPath(formData, 'saved', 'Manual report updated.'))
}
