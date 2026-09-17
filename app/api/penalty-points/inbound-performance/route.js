import { NextResponse } from 'next/server'
import { loadAccessContext } from '@/utils/access-control'
import { hasAnyPermission } from '@/utils/permissions'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

const AUTO_SOURCE_PREFIX = '[AUTO:INBOUND_PERFORMANCE]'

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

function getPenaltyPointsByErrorQty(errorQty) {
  return Number(errorQty || 0) > 1 ? 2 : 1
}

function buildPenaltyReason({ grnNumber, picName, criteria, errorQty, points }) {
  return `${AUTO_SOURCE_PREFIX} ${grnNumber || 'NO-GRN'} | ${picName} | ${criteria}: ${errorQty} pcs error = ${points} poin`
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
    hasAnyPermission(access.permissions, ['inbound.unload.view', 'inbound.unload.edit'], access.isAdmin)

  if (!canSyncPenalty) {
    return NextResponse.json({ error: 'This account cannot sync inbound penalty points.' }, { status: 403 })
  }

  const payload = await request.json().catch(() => ({}))
  const grnNumber = cleanText(payload.grnNumber)
  const penaltyDate = cleanText(payload.penaltyDate) || new Date().toISOString().slice(0, 10)
  const rows = Array.isArray(payload.rows) ? payload.rows : []
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
  const penaltyRows = []
  const skipped = []

  rows.forEach((row) => {
    const picName = cleanText(row.picName)
    if (!picName || picName === 'Unknown') return

    const profile = findProfileForPic(profileLookup, picName)
    if (!profile) {
      skipped.push(picName)
      return
    }

    const modelErrorQty = Number(row.modelErrorQty || 0)
    const qtyError = Math.abs(Number(row.variance || 0))

    if (modelErrorQty > 0) {
      const modelPenaltyPoints = getPenaltyPointsByErrorQty(modelErrorQty)
      penaltyRows.push({
        employee_profile_id: profile.id,
        penalty_date: penaltyDate,
        points: modelPenaltyPoints,
        reason: buildPenaltyReason({
          grnNumber,
          picName,
          criteria: 'Inbound salah model',
          errorQty: modelErrorQty,
          points: modelPenaltyPoints,
        }),
      })
    }

    if (qtyError > 0) {
      const qtyPenaltyPoints = getPenaltyPointsByErrorQty(qtyError)
      penaltyRows.push({
        employee_profile_id: profile.id,
        penalty_date: penaltyDate,
        points: qtyPenaltyPoints,
        reason: buildPenaltyReason({
          grnNumber,
          picName,
          criteria: 'Inbound salah qty',
          errorQty: qtyError,
          points: qtyPenaltyPoints,
        }),
      })
    }
  })

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
