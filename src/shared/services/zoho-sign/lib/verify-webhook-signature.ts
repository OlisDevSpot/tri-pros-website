import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * HMAC-SHA256 verify per Zoho Sign's Developer Settings spec:
 * `crypto.createHmac('sha256', secret).update(rawBody).digest('base64')`
 *
 * Header: `X-ZS-WEBHOOK-SIGNATURE`. Returns false on any mismatch.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64')

  if (expected.length !== signatureHeader.length) {
    return false
  }

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signatureHeader, 'utf8'),
    )
  }
  catch {
    return false
  }
}
