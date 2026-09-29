import env from '@/shared/config/server-env'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { twilioClient } from '@/shared/services/providers/twilio/client'
import { messagingStatusCallbackSchema } from '@/shared/services/providers/twilio/webhooks/messaging'
import { voipMessagesService } from '@/shared/services/voip/voip-messages.service'

// One route for every Twilio async status callback (webhook-routes.md Rule 1). Only the
// messaging branch is wired; voice/recording callbacks ack 200 and log until their
// services land. Twilio retries non-2xx aggressively, so handler errors still return 200.

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData()
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]))

  const { pathname, search } = new URL(req.url)
  const signedUrl = `${env.VOIP_WEBHOOK_BASE_URL ?? ''}${pathname}${search}`
  const signature = req.headers.get('x-twilio-signature') ?? ''
  if (!env.VOIP_WEBHOOK_BASE_URL || !twilioClient.verifyWebhookSignature({ url: signedUrl, signature, params })) {
    return new Response('unauthorized', { status: 401 })
  }

  if (!('MessageSid' in params)) {
    console.warn('[webhooks/twilio] non-messaging callback ignored', { keys: Object.keys(params) })
    return Response.json({ ok: true })
  }

  const parsed = messagingStatusCallbackSchema.safeParse(params)
  if (!parsed.success) {
    return new Response('bad request', { status: 400 })
  }
  const payload = parsed.data

  try {
    const now = new Date().toISOString()
    switch (payload.MessageStatus) {
      case 'delivered':
        await voipMessagesService.applyStatusCallback(SYSTEM_CONTEXT, {
          providerMessageId: payload.MessageSid,
          status: 'delivered',
          deliveredAt: now,
        })
        break
      case 'undelivered':
      case 'failed':
        await voipMessagesService.applyStatusCallback(SYSTEM_CONTEXT, {
          providerMessageId: payload.MessageSid,
          status: payload.MessageStatus,
          failedAt: now,
          failureReason: payload.ErrorCode ? `twilio:${payload.ErrorCode}` : 'twilio:unknown',
        })
        break
      default:
        // queued / sending / sent are transient; the REST return already recorded `sent`.
        break
    }
  }
  catch (err) {
    console.error('[webhooks/twilio] handler failed', { messageSid: payload.MessageSid, err })
  }

  return Response.json({ ok: true })
}
