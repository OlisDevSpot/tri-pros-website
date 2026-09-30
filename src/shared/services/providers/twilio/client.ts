import type { Twilio } from 'twilio'
import type { CallInstance, CallListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/call'
import type { IncomingPhoneNumberInstance, IncomingPhoneNumberListInstanceOptions } from 'twilio/lib/rest/api/v2010/account/incomingPhoneNumber'
import type { MessageInstance, MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message'

import type { MintVoiceAccessTokenInput } from './schemas/access-token'

import RestException from 'twilio/lib/base/RestException'
import AccessToken from 'twilio/lib/jwt/AccessToken'
import MessagingResponse from 'twilio/lib/twiml/MessagingResponse'
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse'
import { validateRequest } from 'twilio/lib/webhooks/webhooks'

import { lazyAsync } from '@/shared/config/lazy-async'

import { ACCESS_TOKEN_TTL_SECONDS, INBOUND_VOICE_TTS_VOICE } from './constants'
import { getTwilioConfig } from './lib/config'

// Leaf provider: primitives + SDK types in and out — no domain types, DB writes, or business rules (those live in services/voip/*).

export interface PhoneLookupResult {
  valid: boolean
  lineType: string | null
  carrierName: string | null
  errorCode: number | null
}

interface BuildInboundVoiceTwimlInput {
  greeting?: string
  dialTarget?: string
  // Twilio defaults the bridged leg's caller-ID to the original `To`; set it explicitly when bridging from a shared DID.
  callerId?: string
  dialStatusCallbackUrl?: string
}

interface BuildDialTwimlInput {
  to: string
  callerId: string
  statusCallbackUrl?: string
  record?: boolean
}

interface BuildInboundMessagingTwimlInput {
  replyBody?: string
}

interface VerifyWebhookSignatureInput {
  // Must match the URL Twilio was configured with EXACTLY, query string included — a trailing-slash or missing-query mismatch fails validation.
  url: string
  // Value of the X-Twilio-Signature request header.
  signature: string
  // Twilio webhooks are form-urlencoded; values are always strings.
  params: Record<string, string>
}

function createTwilioClient() {
  // The REST client is most of the SDK's weight, and a static import compiles
  // it on every cold start of every route that imports the app router, so it
  // loads on the first REST call. Construction stays lazy too: module-load
  // construction breaks edge-runtime static probes and test envs with a
  // partial env. The TwiML, JWT and webhook helpers come from twilio's own
  // small modules above, so they stay synchronous.
  const sdk = lazyAsync(async (): Promise<Twilio> => {
    const { default: twilio } = await import('twilio')
    const config = getTwilioConfig()
    return twilio(config.accountSid, config.authToken)
  })

  return {
    /** NEVER call from a route handler — go through `voip-calls.service` so the compliance gate + DNC check run first. */
    async placeOutboundCall(params: CallListInstanceCreateOptions): Promise<CallInstance> {
      return (await sdk()).calls.create(params)
    },

    async fetchCall(callSid: string): Promise<CallInstance> {
      return (await sdk()).calls(callSid).fetch()
    },

    /** Server-side hangup for when the softphone's local disconnect didn't propagate. */
    async hangupCall(callSid: string): Promise<CallInstance> {
      return (await sdk()).calls(callSid).update({ status: 'completed' })
    },

    /** NEVER call from a route handler — go through `voip-messages.service` so the compliance gate, STOP-keyword guard, and 10DLC check run first. */
    async sendMessage(params: MessageListInstanceCreateOptions): Promise<MessageInstance> {
      return (await sdk()).messages.create(params)
    },

    async fetchMessage(messageSid: string): Promise<MessageInstance> {
      return (await sdk()).messages(messageSid).fetch()
    },

    /** Paid (~$0.005/lookup). Throws on a transport/API error — callers MUST treat that as indeterminate and fail open (never block a lead on a Twilio outage). */
    async lookupPhoneNumber(e164: string): Promise<PhoneLookupResult> {
      const res = await (await sdk()).lookups.v2.phoneNumbers(e164).fetch({ fields: 'line_type_intelligence' })
      return {
        valid: res.valid ?? false,
        lineType: res.lineTypeIntelligence?.type ?? null,
        carrierName: res.lineTypeIntelligence?.carrierName ?? null,
        errorCode: res.lineTypeIntelligence?.errorCode ?? null,
      }
    },

    /** Numbers are purchased in the Twilio console, never programmatically. */
    async listIncomingPhoneNumbers(
      params?: IncomingPhoneNumberListInstanceOptions,
    ): Promise<IncomingPhoneNumberInstance[]> {
      const client = await sdk()
      // Branch the overload — the SDK's no-arg + params forms are distinct.
      if (params === undefined) {
        return client.incomingPhoneNumbers.list()
      }
      return client.incomingPhoneNumbers.list(params)
    },

    async fetchIncomingPhoneNumber(sid: string): Promise<IncomingPhoneNumberInstance> {
      return (await sdk()).incomingPhoneNumbers(sid).fetch()
    },

    /** Signed with the API Key SID + Secret, NOT the account auth token — Twilio uses API Keys for JWTs and the auth token for REST + webhook validation. */
    mintVoiceAccessToken(input: MintVoiceAccessTokenInput): string {
      const config = getTwilioConfig()
      const { VoiceGrant } = AccessToken

      const token = new AccessToken(
        config.accountSid,
        config.apiKeySid,
        config.apiKeySecret,
        {
          identity: input.identity,
          ttl: input.ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS,
        },
      )

      token.addGrant(new VoiceGrant({
        incomingAllow: true,
        outgoingApplicationSid: config.twimlAppSid,
        outgoingApplicationParams: input.outgoingApplicationParams,
      }))

      return token.toJwt()
    },

    buildInboundVoiceTwiml(input: BuildInboundVoiceTwimlInput): string {
      const response = new VoiceResponse()

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
    },

    buildDialTwiml(input: BuildDialTwimlInput): string {
      const response = new VoiceResponse()

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
    },

    buildInboundMessagingTwiml(input: BuildInboundMessagingTwimlInput): string {
      const response = new MessagingResponse()

      if (input.replyBody) {
        response.message(input.replyBody)
      }

      return response.toString()
    },

    /** Twilio signs webhooks with HMAC-SHA1 over url + sorted form params using the account auth token; `false` ⇒ respond 403. */
    verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean {
      return validateRequest(
        getTwilioConfig().authToken,
        input.signature,
        input.url,
        input.params,
      )
    },
  }
}

export type TwilioClient = ReturnType<typeof createTwilioClient>

export const twilioClient = createTwilioClient()

// The class twilio's REST client throws for legacy error bodies (the same
// module instance it requires internally), so callers keep `instanceof RestException`.
export { RestException }
