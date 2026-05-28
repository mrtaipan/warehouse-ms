import { createHmac, timingSafeEqual } from 'node:crypto'

function getLinkSecret() {
  return process.env.HRGA_REQUEST_LINK_SECRET || ''
}

function encodePayload(value) {
  return Buffer.from(value, 'utf8').toString('hex')
}

function decodePayload(value) {
  return Buffer.from(String(value || ''), 'hex').toString('utf8')
}

function signValue(value) {
  const secret = getLinkSecret()
  if (!secret) {
    throw new Error('HRGA request link secret is not configured.')
  }

  return createHmac('sha256', secret).update(value).digest('hex')
}

export function createHrgaRequestLinkPayload(payload) {
  const serialized = JSON.stringify(payload)
  const encoded = encodePayload(serialized)
  const signature = signValue(encoded)
  return { encoded, signature }
}

export function verifyHrgaRequestLinkPayload(encoded, signature) {
  try {
    if (!encoded || !signature) return null

    const expected = signValue(encoded)
    const left = Buffer.from(String(signature))
    const right = Buffer.from(String(expected))

    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return null
    }

    const decoded = JSON.parse(decodePayload(encoded))
    const expiresAt = Number(decoded?.exp || 0)

    if (!expiresAt || Date.now() > expiresAt) {
      return null
    }

    return decoded
  } catch {
    return null
  }
}
