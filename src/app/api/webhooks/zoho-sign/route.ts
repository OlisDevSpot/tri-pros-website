// Zoho webhook payload quirks & HMAC notes: docs/zoho-sign/webhook-notes.md
import env from '@/shared/config/server-env'
import { syncZohoSignStatusJob } from '@/shared/services/upstash/jobs/sync-zoho-sign-status'
import { WEBHOOK_SIGNATURE_HEADER } from '@/shared/services/zoho-sign/constants'
import { verifyWebhookSignature } from '@/shared/services/zoho-sign/lib/verify-webhook-signature'
import { webhookPayloadSchema } from '@/shared/services/zoho-sign/types'

/**
 * Zoho Sign webhook receiver.
 *
 * HMAC verification: Zoho signs payloads with `X-ZS-WEBHOOK-SIGNATURE`
 * (HMAC-SHA256, base64) when configured. The header may be absent during
 * local dev (ngrok); in production, a missing header is rejected.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const signatureHeader = request.headers.get(WEBHOOK_SIGNATURE_HEADER)
  const secret = env.ZOHO_SIGN_WEBHOOK_SECRET

  if (signatureHeader && secret) {
    if (!verifyWebhookSignature(rawBody, signatureHeader, secret)) {
      return new Response('Invalid signature', { status: 401 })
    }
  }
  else if (!signatureHeader) {
    if (env.NODE_ENV === 'production') {
      console.error('[zoho-sign webhook] missing signature header in production')
      return new Response('Missing signature', { status: 401 })
    }
    console.warn('[zoho-sign webhook] no signature header — accepting (dev only)')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  }
  catch {
    return new Response('Malformed JSON', { status: 400 })
  }

  const result = webhookPayloadSchema.safeParse(parsed)
  if (!result.success) {
    console.warn('[zoho-sign webhook] payload failed schema validation', result.error.flatten())
    return new Response('OK', { status: 200 })
  }

  const { requests, notifications } = result.data

  await syncZohoSignStatusJob.dispatch({
    signingRequestId: requests.request_id,
    operationType: notifications.operation_type,
    performedAt: new Date(notifications.performed_at).toISOString(),
  })

  return new Response('OK', { status: 200 })
}
