import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyWhatsAppSignature(body, header, appSecret) {
  if (!appSecret || !/^sha256=[a-f0-9]{64}$/i.test(header || '')) return false
  const expected = createHmac('sha256', appSecret).update(body).digest()
  const actual = Buffer.from(header.slice(7), 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function whatsAppReportConfig(env = process.env) {
  const config = {
    accessToken: env.WA_ACCESS_TOKEN,
    phoneNumberId: env.WA_PHONE_NUMBER_ID,
    groupId: env.WA_GROUP_ID,
    appSecret: env.WA_APP_SECRET,
    verifyToken: env.WA_WEBHOOK_VERIFY_TOKEN,
    graphVersion: env.WA_GRAPH_API_VERSION || 'v27.0',
    reportTemplateName: env.WA_REPORT_TEMPLATE_NAME,
    reportTemplateLanguage: env.WA_REPORT_TEMPLATE_LANGUAGE || 'id',
  }
  if (!config.accessToken || !config.phoneNumberId || !config.groupId || !config.appSecret || !config.verifyToken) {
    throw new Error('WhatsApp group reporting is not configured.')
  }
  if (!/^v\d+\.\d+$/.test(config.graphVersion) || !/^\d+$/.test(config.phoneNumberId)) {
    throw new Error('WhatsApp API version or phone number ID is invalid.')
  }
  return config
}

async function graphRequest(config, endpoint, body, fetchImpl = fetch) {
  const response = await fetchImpl(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      ...(!(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body instanceof FormData ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`WhatsApp API error ${response.status}: ${String(result?.error?.message || 'Unknown error').slice(0, 250)}`)
  return result
}

export async function sendGroupText(config, message, fetchImpl = fetch) {
  const result = await graphRequest(config, 'messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'group',
    to: config.groupId,
    type: 'text',
    text: { body: message },
  }, fetchImpl)
  return result.messages?.[0]?.id || ''
}

export async function sendGroupPdf(config, { bytes, filename, grnNumber, useTemplate = false }, fetchImpl = fetch) {
  if (useTemplate && !config.reportTemplateName) {
    throw new Error('WhatsApp document template is not configured.')
  }
  const media = new FormData()
  media.set('messaging_product', 'whatsapp')
  media.set('type', 'application/pdf')
  media.set('file', new Blob([bytes], { type: 'application/pdf' }), filename)
  const upload = await graphRequest(config, 'media', media, fetchImpl)
  if (!upload.id) throw new Error('WhatsApp did not return a media ID.')

  const message = {
    messaging_product: 'whatsapp',
    recipient_type: 'group',
    to: config.groupId,
    ...(useTemplate ? {
      type: 'template',
      template: {
        name: config.reportTemplateName,
        language: { code: config.reportTemplateLanguage },
        components: [
          { type: 'header', parameters: [{ type: 'document', document: { id: upload.id, filename } }] },
          { type: 'body', parameters: [{ type: 'text', text: grnNumber }] },
        ],
      },
    } : {
      type: 'document',
      document: {
        id: upload.id,
        filename,
        caption: `Inbound Report ${grnNumber}`,
      },
    }),
  }
  const result = await graphRequest(config, 'messages', message, fetchImpl)
  if (!result.messages?.[0]?.id) throw new Error('WhatsApp did not return a message ID.')
  return result.messages[0].id
}
