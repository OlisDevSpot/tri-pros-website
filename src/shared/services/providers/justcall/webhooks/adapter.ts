import type { CanonicalDialerEvent } from '@/shared/services/voip/dialer/types'

import { getJustcallConfig } from '../lib/config'
import { jcWebhookEventSchema, verifyJustcallSignature } from './events'

// Normalizes JustCall inbound webhooks → the app's canonical events, so the
// route handler and the reacting services (enrollment, cadence, compliance)
// never learn the provider changed. This is the ONLY place JustCall webhook
// shapes are read above the provider layer.
export const justcallWebhookAdapter = {
  /**
   * Verify the request is a genuine JustCall webhook via HMAC. The signed URL +
   * event type come from the request BODY (`webhook_url`, `type`) — JustCall
   * signs the URL it stored for the webhook, not the received request URL — and
   * only the timestamp comes from a header (`x-justcall-request-timestamp`).
   * Verified against developer.justcall.io/docs/dynamic-webhook-signatures.
   */
  verify(req: Request, rawBody: string): boolean {
    const { apiSecret } = getJustcallConfig()
    const signature = req.headers.get('x-justcall-signature') ?? ''
    const timestamp = req.headers.get('x-justcall-request-timestamp') ?? ''
    let webhookUrl = ''
    let eventType = ''
    try {
      const body = JSON.parse(rawBody) as { webhook_url?: unknown, type?: unknown }
      webhookUrl = typeof body.webhook_url === 'string' ? body.webhook_url : ''
      eventType = typeof body.type === 'string' ? body.type : ''
    }
    catch {
      return false
    }
    return verifyJustcallSignature({ secret: apiSecret, webhookUrl, eventType, timestamp, signature })
  },

  /**
   * Parse + normalize a raw JustCall body into a canonical event, or null when
   * the body is unrecognized or carries nothing actionable (e.g. a call update
   * with no disposition yet).
   */
  parse(rawBody: string): CanonicalDialerEvent | null {
    const result = jcWebhookEventSchema.safeParse(JSON.parse(rawBody))
    if (!result.success) {
      return null
    }
    const e = result.data
    switch (e.type) {
      case 'sd.call_completed':
        return {
          type: 'call.ended',
          callUuid: e.data.call_sid,
          providerContactId: e.data.contact_id,
          // JustCall spells directions "Incoming"/"Outgoing" (cf. the SMS sample's
          // "Incoming"); match the leading "in" case-insensitively.
          direction: (e.data.call_info?.direction ?? '').toLowerCase().startsWith('in') ? 'inbound' : 'outbound',
          // The dialed DID the contact saw → becomes the SMS `from`.
          fromNumberE164: e.data.sales_dialer_number,
        }
      case 'sd.call_updated': {
        const disposition = e.data.call_info?.disposition
        if (!disposition) {
          return null // no disposition yet → nothing to act on
        }
        return { type: 'call.disposition_set', callUuid: e.data.call_sid, providerContactId: e.data.contact_id, disposition }
      }
      case 'sms.received':
        return { type: 'sms.received', fromE164: e.data.contact_number, toE164: e.data.justcall_number, text: e.data.sms_info.body, providerContactId: e.data.contact_id }
    }
  },
}
