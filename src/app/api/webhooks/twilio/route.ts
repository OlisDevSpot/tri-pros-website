import env from '@/shared/config/server-env'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { twilioClient } from '@/shared/services/providers/twilio/client'
import { messagingStatusCallbackSchema } from '@/shared/services/providers/twilio/schemas/messaging'
import { voipMessagesService } from '@/shared/services/voip/voip-messages.service'

const PATH = '/api/webhooks/twilio'

/**
 * Twilio's async callbacks. Messaging status today; voice and recording status will share
 * the endpoint and branch on their own discriminants. Twilio signs the exact public URL plus
 * the form fields, so the URL is rebuilt from VOIP_WEBHOOK_BASE_URL, never from the request.
 */
export async function POST(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URLSearchParams(await request.text()))
  const signature = request.headers.get('x-twilio-signature')
  if (!signature || !twilioClient.verifyWebhookSignature({ url: `${env.VOIP_WEBHOOK_BASE_URL}${PATH}`, signature, params })) {
    return new Response('Invalid signature', { status: 401 })
  }

  if (!('MessageStatus' in params)) {
    return new Response('OK', { status: 200 })
  }

  const parsed = messagingStatusCallbackSchema.safeParse(params)
  if (!parsed.success) {
    console.warn('[twilio webhook] malformed status callback', parsed.error.flatten())
    return new Response('Malformed payload', { status: 400 })
  }

  try {
    const applied = await voipMessagesService.applyStatusCallback(SYSTEM_CONTEXT, {
      providerMessageId: parsed.data.MessageSid,
      twilioStatus: parsed.data.MessageStatus,
      errorCode: parsed.data.ErrorCode,
      at: new Date().toISOString(),
    })
    if (!applied.success) {
      console.error('[twilio webhook] status callback failed', applied.error)
    }
  }
  catch (error) {
    // Twilio retries on a non-2xx; a handler fault must not turn one callback into a storm.
    console.error('[twilio webhook] status callback failed', error)
  }

  return new Response('OK', { status: 200 })
}
