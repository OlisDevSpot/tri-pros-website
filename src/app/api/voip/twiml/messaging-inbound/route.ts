import env from '@/shared/config/server-env'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { getDidByE164 } from '@/shared/entities/voip-dids/dal/server/queries'
import { twilioClient } from '@/shared/services/providers/twilio/client'
import { messagingInboundWebhookSchema } from '@/shared/services/providers/twilio/webhooks/messaging'
import { notifyLastInteractingAgentJob } from '@/shared/services/providers/upstash/jobs/notify-last-interacting-agent'
import { resolveCustomerByPhone } from '@/shared/services/voip/campaigns/lib/resolve-customer'
import { complianceService } from '@/shared/services/voip/compliance.service'
import { meetingRemindersService } from '@/shared/services/voip/meeting-reminders.service'
import { isOptOutKeyword, voipMessagesService } from '@/shared/services/voip/voip-messages.service'

// Sync request-response (Twilio waits for TwiML), so it lives outside /webhooks/.
// Configure on the Messaging Service: Integration → "Send a webhook" → this URL, POST.
//
// Twilio signs the URL it was configured with, and Vercel rewrites request.url behind
// its proxy, so the signature is checked against VOIP_WEBHOOK_BASE_URL + path instead.

function twiml(xml: string): Response {
  return new Response(xml, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData()
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]))

  const { pathname, search } = new URL(req.url)
  const signedUrl = `${env.VOIP_WEBHOOK_BASE_URL ?? ''}${pathname}${search}`
  const signature = req.headers.get('x-twilio-signature') ?? ''
  if (!env.VOIP_WEBHOOK_BASE_URL || !twilioClient.verifyWebhookSignature({ url: signedUrl, signature, params })) {
    return new Response('unauthorized', { status: 401 })
  }

  const parsed = messagingInboundWebhookSchema.safeParse(params)
  if (!parsed.success) {
    return new Response('bad request', { status: 400 })
  }
  const payload = parsed.data

  try {
    const customer = await resolveCustomerByPhone(payload.From)
    const did = await getDidByE164(payload.To)

    await voipMessagesService.recordInboundMessage(SYSTEM_CONTEXT, {
      providerMessageId: payload.MessageSid,
      voipDidId: did.success ? did.data?.id ?? null : null,
      customerId: customer?.id ?? null,
      remoteE164: payload.From,
      body: payload.Body,
    })

    // The Messaging Service already blocks future sends carrier-side; the DNC row is our own record.
    if (isOptOutKeyword(payload.Body)) {
      if (customer) {
        await complianceService.addToDnc({ customerId: customer.id, reason: 'stop_keyword', addedByUserId: null })
      }
      return twiml(twilioClient.buildInboundMessagingTwiml({}))
    }

    const reply = await meetingRemindersService.handleInboundReply({ fromE164: payload.From, body: payload.Body })
    const outcome = reply.success ? reply.data : null

    // Anything that is not a clean "C" gets a human: reschedules and free text alike.
    if (!outcome || outcome.intent !== 'confirm') {
      void notifyLastInteractingAgentJob.dispatch({ customerPhoneE164: payload.From, body: payload.Body })
    }

    return twiml(twilioClient.buildInboundMessagingTwiml({ replyBody: outcome?.replyBody ?? undefined }))
  }
  catch (err) {
    console.error('[twiml/messaging-inbound] handler failed', { messageSid: payload.MessageSid, err })
    return twiml(twilioClient.buildInboundMessagingTwiml({}))
  }
}
