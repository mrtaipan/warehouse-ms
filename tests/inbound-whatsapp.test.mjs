import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { sendGroupPdf, sendGroupText, verifyWhatsAppSignature, whatsAppReportConfig } from '../utils/inbound-whatsapp.mjs'

const config = {
  accessToken: 'test-token',
  phoneNumberId: '123456',
  groupId: 'test-group',
  appSecret: 'test-secret',
  verifyToken: 'test-verify',
  graphVersion: 'v27.0',
  reportTemplateName: 'inbound_report_group',
  reportTemplateLanguage: 'id',
}

test('webhook signature must match the raw body and app secret', () => {
  const body = '{"entry":[]}'
  const signature = `sha256=${createHmac('sha256', config.appSecret).update(body).digest('hex')}`
  assert.equal(verifyWhatsAppSignature(body, signature, config.appSecret), true)
  assert.equal(verifyWhatsAppSignature(`${body} `, signature, config.appSecret), false)
  assert.equal(verifyWhatsAppSignature(body, 'sha256=bad', config.appSecret), false)
})

test('WhatsApp reporting remains disabled until all server secrets and group ID are configured', () => {
  assert.throws(() => whatsAppReportConfig({ WA_ACCESS_TOKEN: 'token' }), /not configured/)
  assert.equal(whatsAppReportConfig({
    WA_ACCESS_TOKEN: config.accessToken,
    WA_PHONE_NUMBER_ID: config.phoneNumberId,
    WA_GROUP_ID: config.groupId,
    WA_APP_SECRET: config.appSecret,
    WA_WEBHOOK_VERIFY_TOKEN: config.verifyToken,
  }).groupId, config.groupId)
})

test('one group PDF uses media upload then one document message', async () => {
  const calls = []
  const fetchMock = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(calls.length === 1 ? { id: 'media-1' } : { messages: [{ id: 'wamid-1' }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }
  const messageId = await sendGroupPdf(config, {
    bytes: Buffer.from('%PDF-1.4\n'),
    filename: 'Inbound Report - #035-XI2026.pdf',
    grnNumber: '#035-XI2026',
  }, fetchMock)

  assert.equal(messageId, 'wamid-1')
  assert.equal(calls.length, 2)
  assert.match(calls[0].url, /\/media$/)
  assert.equal(calls[0].options.body.get('type'), 'application/pdf')
  const sent = JSON.parse(calls[1].options.body)
  assert.equal(sent.recipient_type, 'group')
  assert.equal(sent.to, 'test-group')
  assert.equal(sent.type, 'document')
  assert.equal(sent.document.id, 'media-1')
})

test('automatic group PDF uses one document-header template message', async () => {
  const calls = []
  const fetchMock = async (_url, options) => {
    calls.push(options)
    return new Response(JSON.stringify(calls.length === 1 ? { id: 'media-2' } : { messages: [{ id: 'wamid-2' }] }), { status: 200 })
  }
  await sendGroupPdf(config, {
    bytes: Buffer.from('%PDF-1.4\n'),
    filename: 'Inbound Report - #035-XI2026.pdf',
    grnNumber: '#035-XI2026',
    useTemplate: true,
  }, fetchMock)
  assert.equal(calls.length, 2)
  const sent = JSON.parse(calls[1].body)
  assert.equal(sent.recipient_type, 'group')
  assert.equal(sent.type, 'template')
  assert.equal(sent.template.name, 'inbound_report_group')
  assert.equal(sent.template.components[0].parameters[0].document.id, 'media-2')
  assert.equal(sent.template.components[1].parameters[0].text, '#035-XI2026')
})

test('ambiguous GRN replies stay in the configured group', async () => {
  let body
  await sendGroupText(config, 'Mohon tulis nomor lengkap.', async (_url, options) => {
    body = JSON.parse(options.body)
    return new Response(JSON.stringify({ messages: [{ id: 'wamid-2' }] }), { status: 200 })
  })
  assert.equal(body.recipient_type, 'group')
  assert.equal(body.to, 'test-group')
  assert.equal(body.text.body, 'Mohon tulis nomor lengkap.')
})
