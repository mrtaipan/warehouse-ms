import { NextResponse } from 'next/server'
import { loadAccessContext } from '@/utils/access-control'
import { hasAnyPermission } from '@/utils/permissions'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

const AUTO_QC_GAP_PREFIX = '[AUTO:QC_ALLOCATED_LOCKED_GAP]'
const AUTO_QC_ADJUSTMENT_PREFIX = '[AUTO:QC_CONFIRM_ADJUSTMENT]'

function cleanText(value) {
  return String(value || '').trim()
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, ' ')
}

function getFirstName(value) {
  return cleanText(value).split(/\s+/)[0] || ''
}

function buildProfileLookup(profiles = []) {
  const lookup = new Map()

  profiles.forEach((profile) => {
    const names = [
      profile.display_name,
      profile.email,
      profile.email?.split('@')[0],
      getFirstName(profile.display_name),
    ]
      .map(normalizeKey)
      .filter(Boolean)

    names.forEach((name) => {
      if (!lookup.has(name)) {
        lookup.set(name, [])
      }
      lookup.get(name).push(profile)
    })
  })

  return lookup
}

function findProfileForPic(profileLookup, picName) {
  const exactMatches = profileLookup.get(normalizeKey(picName)) || []
  if (exactMatches.length === 1) return exactMatches[0]

  const firstNameMatches = profileLookup.get(normalizeKey(getFirstName(picName))) || []
  if (firstNameMatches.length === 1) return firstNameMatches[0]

  return null
}

function getPenaltyDate(payload) {
  return cleanText(payload.penaltyDate) || new Date().toISOString().slice(0, 10)
}

function getGapPoints(gapQty) {
  return Number(gapQty || 0) > 1 ? 2 : 1
}

function uniq(values = []) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)))
}

function buildGapRows(payload, profileLookup) {
  const picName = cleanText(payload.picName || payload.assignedTo)
  const profile = findProfileForPic(profileLookup, picName)
  const gapQty = Math.abs(Number(payload.lockedQty || 0) - Number(payload.allocatedQty || 0))

  if (!profile || gapQty <= 0) {
    return { rows: [], skipped: picName && !profile ? [picName] : [] }
  }

  const points = getGapPoints(gapQty)
  const taskRef = cleanText(payload.taskRef || `${payload.taskTable || 'qc_items'}:${payload.taskId || 'NO-ID'}`)
  const grnNumber = cleanText(payload.grnNumber) || 'NO-GRN'
  const modelName = cleanText(payload.modelName) || 'UNKNOWN MODEL'
  const reason = `${AUTO_QC_GAP_PREFIX} ${taskRef} | ${grnNumber} | ${picName} | ${modelName} | allocated ${Number(payload.allocatedQty || 0)} vs locked ${Number(payload.lockedQty || 0)} | gap ${gapQty} pcs = ${points} poin`

  return {
    rows: [
      {
        employee_profile_id: profile.id,
        penalty_date: getPenaltyDate(payload),
        points,
        reason,
      },
    ],
    skipped: [],
  }
}

function buildAdjustmentRows(payload, profileLookup) {
  const picNames = uniq(payload.picNames)
  const adjustmentRef = cleanText(payload.adjustmentRef || payload.adjustmentId || 'NO-ID')
  const adjustmentType = cleanText(payload.adjustmentType || 'ADJUSTMENT').toUpperCase()
  const grnNumber = cleanText(payload.grnNumber) || 'NO-GRN'
  const modelName = cleanText(payload.modelName) || 'UNKNOWN MODEL'
  const qty = Number(payload.qty || 0)
  const reasonLabel =
    adjustmentType === 'SHORTAGE' || adjustmentType === 'SURPLUS'
      ? `QC ${adjustmentType.toLowerCase()} adjustment`
      : `QC rejection grade adjustment ${adjustmentType}`
  const rows = []
  const skipped = []

  picNames.forEach((picName) => {
    const profile = findProfileForPic(profileLookup, picName)
    if (!profile) {
      skipped.push(picName)
      return
    }

    rows.push({
      employee_profile_id: profile.id,
      penalty_date: getPenaltyDate(payload),
      points: 1,
      reason: `${AUTO_QC_ADJUSTMENT_PREFIX} ${adjustmentRef} | ${grnNumber} | ${picName} | ${modelName} | ${reasonLabel}: ${qty} pcs = 1 poin`,
    })
  })

  return { rows, skipped }
}

export async function POST(request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const access = await loadAccessContext(supabase, user, 'id, email, display_name, role')
  const canSyncPenalty =
    access.isAdmin ||
    hasAnyPermission(access.permissions, ['qc.grading_task.view', 'qc.confirmation.view', 'qc.confirmation.edit'], access.isAdmin)

  if (!canSyncPenalty) {
    return NextResponse.json({ error: 'This account cannot sync QC penalty points.' }, { status: 403 })
  }

  const payload = await request.json().catch(() => ({}))
  const admin = createAdminClient()

  const { data: profiles, error: profileError } = await admin
    .from('dir_user_profiles')
    .select('id, display_name, email, role, group, resign_date')
    .eq('group', 'WAREHOUSE')
    .neq('role', 'warehouse_leader')
    .is('resign_date', null)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const profileLookup = buildProfileLookup(profiles || [])
  const eventType = cleanText(payload.eventType).toUpperCase()
  const result =
    eventType === 'QC_ALLOCATED_LOCKED_GAP'
      ? buildGapRows(payload, profileLookup)
      : buildAdjustmentRows(payload, profileLookup)
  const penaltyRows = result.rows
  const skipped = result.skipped

  if (!penaltyRows.length) {
    return NextResponse.json({ inserted: 0, skipped: Array.from(new Set(skipped)) })
  }

  const reasons = penaltyRows.map((row) => row.reason)
  const { data: existingRows, error: existingError } = await admin
    .from('hrga_penalty_points')
    .select('reason')
    .in('reason', reasons)

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  const existingReasons = new Set((existingRows || []).map((row) => row.reason))
  const rowsToInsert = penaltyRows.filter((row) => !existingReasons.has(row.reason))

  if (!rowsToInsert.length) {
    return NextResponse.json({ inserted: 0, skipped: Array.from(new Set(skipped)) })
  }

  const { error: insertError } = await admin.from('hrga_penalty_points').insert(rowsToInsert)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    inserted: rowsToInsert.length,
    skipped: Array.from(new Set(skipped)),
  })
}
