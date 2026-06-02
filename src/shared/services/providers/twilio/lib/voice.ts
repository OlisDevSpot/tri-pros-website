import type { CallInstance, CallListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/call'

import { twilioClient } from '../client'

// Thin typed wrappers over `client.calls.*`. Provider functions accept the
// SDK's own option interfaces unchanged — the SDK is the source of truth for
// what Twilio accepts. Domain orchestration (compliance gate, DNC lookup,
// recording-retention policy) lives in Slug C's voip-calls.service.ts, not
// here.

// Place an outbound call. The caller controls the TwiML behavior via either
// `applicationSid` (delegate to the configured TwiML App) or `url` (one-off
// TwiML endpoint). Standard outbound-dial pattern from a service:
//
//   placeOutboundCall({
//     from: agentDid.e164,
//     to: customer.phone,
//     applicationSid: serverEnv.TWILIO_TWIML_APP_SID,
//     statusCallback: `${VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`,
//     statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
//   })
//
// NEVER call this from a route handler directly — go through
// `services/voip/voip-calls.service.ts#placeAgentCall` which runs the
// compliance gate first.
export async function placeOutboundCall(
  params: CallListInstanceCreateOptions,
): Promise<CallInstance> {
  return twilioClient().calls.create(params)
}

// Fetch a call resource by SID. Used by the inbound-call routing endpoint
// (Slug D) to look up call metadata mid-flow, and by the admin observability
// surface to refresh stale state.
export async function fetchCall(callSid: string): Promise<CallInstance> {
  return twilioClient().calls(callSid).fetch()
}

// Force a call to terminate. Used by the agent-side "hang up" action when the
// browser softphone's local disconnect didn't propagate (rare, but possible
// under network partition).
export async function hangupCall(callSid: string): Promise<CallInstance> {
  return twilioClient().calls(callSid).update({ status: 'completed' })
}
