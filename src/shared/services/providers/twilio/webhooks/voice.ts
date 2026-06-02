import { z } from 'zod'

import { e164Schema, twilioSidSchema } from '../schemas/primitives'

// Inbound voice webhook payloads. Twilio POSTs these as form-urlencoded;
// every value arrives as a string. We Zod-coerce the few numeric fields
// (Duration, RecordingDuration) to numbers at the seam.
//
// Reference: https://www.twilio.com/docs/voice/twiml#callstatus-values
//
// Only the fields we actually consume in Phase 1 are modeled. Twilio sends
// many additional fields (CalledCity, CallerCity, etc.); we ignore them.

// CallStatus values Twilio emits on the StatusCallback. There's also "queued"
// at request time, but it doesn't appear on the callback.
export const voiceCallStatusSchema = z.enum([
  'initiated',
  'ringing',
  'in-progress',
  'completed',
  'busy',
  'failed',
  'no-answer',
  'canceled',
])
export type VoiceCallStatus = z.infer<typeof voiceCallStatusSchema>

// Voice webhook hit when Twilio asks "what should I do with this inbound call?"
// — i.e., the URL configured on the IncomingPhoneNumber. Twilio expects us
// to return TwiML.
export const voiceInboundWebhookSchema = z.object({
  CallSid: twilioSidSchema,
  AccountSid: twilioSidSchema,
  From: e164Schema,
  To: e164Schema,
  Direction: z.literal('inbound'),
  CallStatus: voiceCallStatusSchema.optional(),
})
export type VoiceInboundWebhookPayload = z.infer<typeof voiceInboundWebhookSchema>

// Status callback. Fires throughout the call lifecycle for every status the
// originating request opted into via `statusCallbackEvent`.
export const voiceStatusCallbackSchema = z.object({
  CallSid: twilioSidSchema,
  AccountSid: twilioSidSchema,
  From: e164Schema,
  To: e164Schema,
  CallStatus: voiceCallStatusSchema,
  Direction: z.enum(['inbound', 'outbound-api', 'outbound-dial']),
  // Twilio sends Duration as a string of seconds, present on the final
  // `completed` callback.
  Duration: z.coerce.number().int().nonnegative().optional(),
  CallDuration: z.coerce.number().int().nonnegative().optional(),
  // Recording fields only present when the call was recorded AND the
  // recording fired its completion callback.
  RecordingSid: twilioSidSchema.optional(),
  RecordingUrl: z.url().optional(),
  RecordingDuration: z.coerce.number().int().nonnegative().optional(),
})
export type VoiceStatusCallbackPayload = z.infer<typeof voiceStatusCallbackSchema>

// Dial action callback — fires on the child-call leg when <Dial action=...>
// is set in the TwiML. Twilio appends a different field set than the call-status
// callback, notably `DialCallStatus` + `DialCallDuration`.
export const voiceDialActionSchema = z.object({
  CallSid: twilioSidSchema,
  AccountSid: twilioSidSchema,
  From: e164Schema,
  To: e164Schema,
  // Status of the bridged (dialed) leg, NOT the original call.
  DialCallStatus: voiceCallStatusSchema,
  DialCallSid: twilioSidSchema.optional(),
  DialCallDuration: z.coerce.number().int().nonnegative().optional(),
})
export type VoiceDialActionPayload = z.infer<typeof voiceDialActionSchema>
