import type { MessageInstance, MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message'

import { twilioClient } from '../client'

// Thin typed wrappers over `client.messages.*`. Same pattern as voice.ts —
// the SDK's option interfaces are the source of truth; Slug C's
// voip-messages.service.ts owns the compliance gate, thread bookkeeping,
// and 10DLC-vetting refusal.

// Send an SMS or MMS. Caller picks `from` (one of our DIDs) + `to` (E.164)
// + `body`. Standard send pattern:
//
//   sendMessage({
//     from: agentDid.e164,
//     to: customer.phone,
//     body: 'Hi from Tri Pros — your appointment is confirmed.',
//     statusCallback: `${VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`,
//   })
//
// NEVER call this from a route handler directly — go through
// `services/voip/voip-messages.service.ts#sendSms` which runs the compliance
// gate, STOP-keyword guard, and 10DLC-vetting check first.
export async function sendMessage(
  params: MessageListInstanceCreateOptions,
): Promise<MessageInstance> {
  return twilioClient().messages.create(params)
}

// Fetch a message resource by SID. Used by the admin surface to refresh stale
// delivery state and by the messaging-status webhook handler to cross-check
// what Twilio thinks the message status is.
export async function fetchMessage(messageSid: string): Promise<MessageInstance> {
  return twilioClient().messages(messageSid).fetch()
}
