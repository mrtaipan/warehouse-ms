import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { loadAccessContext } from '@/utils/access-control'
import { hasPermission } from '@/utils/permissions'
import { sendAutomaticInboundReport } from '@/utils/inbound-wa-report-service.mjs'
import { whatsAppReportConfig } from '@/utils/inbound-whatsapp.mjs'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  const access = await loadAccessContext(supabase, user, 'role')
  if (access.profileError || access.permissionsError || !hasPermission(access.permissions, 'inbound.unload.add', access.isAdmin)) {
    return NextResponse.json({ error: 'This account cannot post Intake.' }, { status: 403 })
  }

  const { inboundId } = await request.json().catch(() => ({}))
  if (!Number.isSafeInteger(inboundId) || inboundId <= 0) {
    return NextResponse.json({ error: 'Invalid GRN.' }, { status: 400 })
  }
  let config
  try {
    config = whatsAppReportConfig()
  } catch {
    return NextResponse.json({ status: 'not_configured' }, { status: 503 })
  }
  if (!process.env.WA_REPORT_START_AT || !Number.isFinite(Date.parse(process.env.WA_REPORT_START_AT))) {
    return NextResponse.json({ status: 'not_activated' }, { status: 503 })
  }
  if (!config.reportTemplateName) {
    return NextResponse.json({ status: 'template_not_configured' }, { status: 503 })
  }

  after(async () => {
    try {
      await sendAutomaticInboundReport(createAdminClient(), config, inboundId)
    } catch (error) {
      console.error('Automatic Inbound WA report failed:', error)
    }
  })
  return NextResponse.json({ status: 'queued' }, { status: 202 })
}
