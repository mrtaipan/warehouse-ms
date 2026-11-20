import { createServerInboundReportPdf, loadInboundReportData } from './inbound-report-server.mjs'
import { inboundReportReady, parseGrnReportRequest } from './inbound-wa-report-rules.mjs'
import { sendGroupPdf, sendGroupText } from './inbound-whatsapp.mjs'

async function claimDelivery(client, payload) {
  const { data, error } = await client.from('inbound_wa_report_deliveries')
    .insert(payload).select('id').single()
  if (error?.code === '23505') return null
  if (error) throw new Error(error.message)
  return data.id
}

async function finishDelivery(client, id, patch) {
  const { error } = await client.from('inbound_wa_report_deliveries').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

async function sendReport(client, config, inboundId, useTemplate = false) {
  const report = await loadInboundReportData(client, inboundId)
  const pdf = await createServerInboundReportPdf(report)
  const waMessageId = await sendGroupPdf(config, { ...pdf, grnNumber: report.grnNumber, useTemplate })
  return { report, waMessageId }
}

export async function sendAutomaticInboundReport(client, config, inboundId, startAt = process.env.WA_REPORT_START_AT) {
  if (!startAt || !Number.isFinite(Date.parse(startAt))) return { status: 'disabled' }
  if (Date.now() < Date.parse(startAt)) return { status: 'before_start' }
  if (!config.reportTemplateName) return { status: 'template_not_configured' }
  const { data: inbound, error } = await client.from('inbound')
    .select('id, total_claimed_qty, total_received_qty')
    .eq('id', inboundId).single()
  if (error || !inbound) throw new Error(error?.message || 'GRN not found.')

  let intakeQty = 0
  for (let offset = 0; ; offset += 1000) {
    const { data, error: qtyError } = await client.from('inbound_unload')
      .select('qty').eq('inbound_id', inboundId).range(offset, offset + 999)
    if (qtyError) throw new Error(qtyError.message)
    intakeQty += (data || []).reduce((total, row) => total + Number(row.qty || 0), 0)
    if (!data || data.length < 1000) break
  }
  const state = inboundReportReady(inbound, intakeQty)
  if (!state.ready) return { status: 'not_ready', ...state }

  const deliveryId = await claimDelivery(client, {
    inbound_id: inboundId,
    group_id: config.groupId,
    source: 'auto',
    target_qty: state.targetQty,
    intake_qty: state.intakeQty,
  })
  if (!deliveryId) return { status: 'already_claimed', ...state }

  try {
    const { waMessageId } = await sendReport(client, config, inboundId, true)
    await finishDelivery(client, deliveryId, { status: 'sent', wa_message_id: waMessageId, sent_at: new Date().toISOString() })
    return { status: 'sent', waMessageId, ...state }
  } catch (sendError) {
    await finishDelivery(client, deliveryId, { status: 'failed', error_message: String(sendError.message || sendError).slice(0, 500) })
    throw sendError
  }
}

export async function respondToInboundReportRequest(client, config, message) {
  const grn = parseGrnReportRequest(message?.text?.body)
  if (!grn || message?.group_id !== config.groupId || !message?.id) return { status: 'ignored' }

  const deliveryId = await claimDelivery(client, {
    group_id: config.groupId,
    source: 'request',
    request_message_id: message.id,
  })
  if (!deliveryId) return { status: 'already_claimed' }

  try {
    const query = client.from('inbound').select('id, grn_number')
    const { data: matches, error } = await (grn.includes('-')
      ? query.eq('grn_number', grn).limit(2)
      : query.like('grn_number', `${grn}-%`).limit(5))
    if (error) throw new Error(error.message)

    let inboundId = null
    let reply = ''
    if (!matches?.length) reply = `GRN ${grn} tidak ditemukan.`
    else if (matches.length > 1) reply = `Ada beberapa GRN ${grn}. Mohon tulis nomor lengkap, misalnya: Laporan GRN ${matches[0].grn_number}`
    else inboundId = matches[0].id

    const waMessageId = inboundId
      ? (await sendReport(client, config, inboundId)).waMessageId
      : await sendGroupText(config, reply)
    await finishDelivery(client, deliveryId, {
      inbound_id: inboundId,
      status: 'sent',
      wa_message_id: waMessageId,
      sent_at: new Date().toISOString(),
    })
    return { status: 'sent', waMessageId }
  } catch (sendError) {
    await finishDelivery(client, deliveryId, { status: 'failed', error_message: String(sendError.message || sendError).slice(0, 500) })
    throw sendError
  }
}
