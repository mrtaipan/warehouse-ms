import { after } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { respondToInboundReportRequest } from '@/utils/inbound-wa-report-service.mjs'
import { verifyWhatsAppSignature, whatsAppReportConfig } from '@/utils/inbound-whatsapp.mjs'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request) {
  const token = process.env.WA_WEBHOOK_VERIFY_TOKEN
  const params = new URL(request.url).searchParams
  if (!token || params.get('hub.mode') !== 'subscribe' || params.get('hub.verify_token') !== token) {
    return new Response('Forbidden', { status: 403 })
  }
  return new Response(params.get('hub.challenge') || '', { status: 200 })
}

export async function POST(request) {
  let config
  try {
    config = whatsAppReportConfig()
  } catch {
    return new Response('WhatsApp is not configured', { status: 503 })
  }
  const body = await request.text()
  if (!verifyWhatsAppSignature(body, request.headers.get('x-hub-signature-256'), config.appSecret)) {
    return new Response('Invalid signature', { status: 401 })
  }
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const allowedSenders = new Set(String(process.env.WA_REPORT_ALLOWED_SENDER_IDS || '')
    .split(',').map((value) => value.trim()).filter(Boolean))
  const messages = (payload.entry || []).flatMap((entry) => entry.changes || [])
    .flatMap((change) => change.value?.messages || [])
    .filter((message) => message.type === 'text' && message.group_id === config.groupId &&
      allowedSenders.has(String(message.from_user_id || message.from || '')))

  if (process.env.WA_REPORT_LOG_UNKNOWN_SENDERS === 'true') {
    const unknownSenders = (payload.entry || []).flatMap((entry) => entry.changes || [])
      .flatMap((change) => change.value?.messages || [])
      .filter((message) => message.type === 'text' && message.group_id === config.groupId &&
        !allowedSenders.has(String(message.from_user_id || message.from || '')))
    for (const message of unknownSenders) {
      console.info('Inbound WA group sender ID:', String(message.from_user_id || message.from || ''))
    }
  }

  if (messages.length) {
    after(async () => {
      const admin = createAdminClient()
      for (const message of messages) {
        try {
          await respondToInboundReportRequest(admin, config, message)
        } catch (error) {
          console.error('Inbound WA report request failed:', error)
        }
      }
    })
  }
  return new Response('OK', { status: 200 })
}
