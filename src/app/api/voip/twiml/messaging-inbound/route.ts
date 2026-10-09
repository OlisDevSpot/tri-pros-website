import env from '@/shared/config/server-env'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { meetingService } from '@/shared/modules/meetings/service'
import { twilioClient } from '@/shared/services/providers/twilio/client'
import { messagingInboundWebhookSchema } from '@/shared/services/providers/twilio/schemas/messaging'

const PATH = '/api/voip/twiml/messaging-inbound'

/**
 * A text arrived on one of our numbers. Twilio waits for TwiML; the answer is always empty, because the
 * confirmation reply is sent as its own message so it is recorded and gets status callbacks.
 */
export async function POST(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URLSearchParams(await request.text()))
  const signature = request.headers.get('x-twilio-signature')
  if (!signature || !twilioClient.verifyWebhookSignature({ url: `${env.VOIP_WEBHOOK_BASE_URL}${PATH}`, signature, params })) {
    return new Response('Invalid signature', { status: 401 })
  }

  const parsed = messagingInboundWebhookSchema.safeParse(params)
  if (!parsed.success) {
    console.warn('[twilio inbound] malformed payload', parsed.error.flatten())
    return new Response('Malformed payload', { status: 400 })
  }

  try {
    await meetingService.business.handleHomeownerReply(SYSTEM_CONTEXT, {
      providerMessageId: parsed.data.MessageSid,
      from: parsed.data.From,
      to: parsed.data.To,
      body: parsed.data.Body,
      optOutType: parsed.data.OptOutType ?? null,
    })
  }
  catch (error) {
    console.error('[twilio inbound] handler failed', error)
  }

  return new Response(twilioClient.buildInboundMessagingTwiml({}), {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}
