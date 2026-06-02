import twilio from 'twilio'

import { INBOUND_VOICE_TTS_VOICE } from '../constants'

// Pure functions that build TwiML strings via Twilio's fluent VoiceResponse /
// MessagingResponse builders. No HTTP, no env reads, no domain knowledge —
// callers (the sync TwiML responder routes in Slug D) pass in the params and
// receive a string ready to return as the route body.

interface BuildInboundVoiceTwimlInput {
  // Greeting played to the caller before any dial / queue / record action.
  // Omit to skip the greeting (raw bridge).
  greeting?: string
  // If set, bridges the caller to this E.164 number. If omitted, hangs up
  // after the greeting (or immediately, if no greeting).
  dialTarget?: string
  // Caller-ID presented on the outbound leg. Twilio's default is the original
  // `To` number; explicit override required when bridging from a shared DID.
  callerId?: string
  // Status callback URL Twilio will POST to on the dial child-call's status
  // changes. Forwarded as the `action` on <Dial>. Optional — omit to skip.
  dialStatusCallbackUrl?: string
}

export function buildInboundVoiceTwiml(input: BuildInboundVoiceTwimlInput): string {
  const response = new twilio.twiml.VoiceResponse()

  if (input.greeting) {
    response.say({ voice: INBOUND_VOICE_TTS_VOICE }, input.greeting)
  }

  if (input.dialTarget) {
    const dialAttrs: { callerId?: string, action?: string } = {}
    if (input.callerId) {
      dialAttrs.callerId = input.callerId
    }
    if (input.dialStatusCallbackUrl) {
      dialAttrs.action = input.dialStatusCallbackUrl
    }
    response.dial(dialAttrs, input.dialTarget)
  }
  else {
    response.hangup()
  }

  return response.toString()
}

interface BuildDialTwimlInput {
  // E.164 destination — typically the agent's sticky DID or the transfer target.
  to: string
  // Caller-ID presented on the outbound leg.
  callerId: string
  // Optional status callback URL for the child-call leg.
  statusCallbackUrl?: string
  // Whether to record the call. Twilio's "record-from-answer" captures only the
  // bridged audio (no ringing tones). Default off; callers opt in explicitly.
  record?: boolean
}

export function buildDialTwiml(input: BuildDialTwimlInput): string {
  const response = new twilio.twiml.VoiceResponse()

  const dialAttrs: { callerId: string, action?: string, record?: 'record-from-answer' } = {
    callerId: input.callerId,
  }
  if (input.statusCallbackUrl) {
    dialAttrs.action = input.statusCallbackUrl
  }
  if (input.record) {
    dialAttrs.record = 'record-from-answer'
  }

  response.dial(dialAttrs, input.to)

  return response.toString()
}

interface BuildInboundMessagingTwimlInput {
  // Optional auto-reply body. Most inbound SMS handlers return an empty
  // <Response/> (record-only); STOP/UNSUB handlers return a confirmation.
  replyBody?: string
}

export function buildInboundMessagingTwiml(input: BuildInboundMessagingTwimlInput): string {
  const response = new twilio.twiml.MessagingResponse()

  if (input.replyBody) {
    response.message(input.replyBody)
  }

  return response.toString()
}
