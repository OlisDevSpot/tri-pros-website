import type { Twilio } from 'twilio'
import type { CallInstance, CallListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/call'
import type { IncomingPhoneNumberInstance, IncomingPhoneNumberListInstanceOptions } from 'twilio/lib/rest/api/v2010/account/incomingPhoneNumber'
import type { MessageInstance, MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message'

import type { MintVoiceAccessTokenInput } from './schemas/access-token'

import twilio, { RestException as TwilioRestException } from 'twilio'

import { ACCESS_TOKEN_TTL_SECONDS, INBOUND_VOICE_TTS_VOICE } from './constants'
import { getTwilioConfig } from './lib/config'

// ---------------------------------------------------------------------------
// twilioClient — the single, uniform entry point for every Twilio interaction.
//
// Pattern (matches `zohoSignClient` and every other provider in the codebase):
// ONE factory → ONE singleton → ALL methods hanging off it. Callers do:
//
//   import { twilioClient } from '@/shared/services/providers/twilio/client'
//   await twilioClient.placeOutboundCall({ ... })
//   const jwt = twilioClient.mintVoiceAccessToken({ identity })
//   const ok  = twilioClient.verifyWebhookSignature({ url, signature, params })
//
// Never `import { placeOutboundCall } from '...../lib/voice'`. The client is a
// "superset of the raw Twilio SDK" — it exposes the REST surface we use AND
// the local Twilio-ecosystem helpers (JWT mint, TwiML builders, webhook
// signature verification) under the same uniform import. One mental model,
// one tab-complete surface per provider. See `DOCS.md#superset-client`.
//
// The provider is still a leaf — these methods accept primitives + SDK option
// types and return primitives + SDK instance types. NO domain types, NO DB
// writes, NO business rules. Orchestration (compliance gate, DNC lookup,
// dev-override rewriting, STOP-keyword detection) lives in Slug C's
// `services/voip/*.service.ts`.
// ---------------------------------------------------------------------------

export interface PhoneLookupResult {
  valid: boolean
  lineType: string | null
  carrierName: string | null
  errorCode: number | null
}

interface BuildInboundVoiceTwimlInput {
  // Greeting spoken to the caller before any dial / queue / record action.
  // Omit for a raw bridge (or raw hangup, if dialTarget is also unset).
  greeting?: string
  // If set, bridges the caller to this E.164 number. If unset, hangs up
  // after the greeting (or immediately, if no greeting).
  dialTarget?: string
  // Caller-ID presented on the bridged outbound leg. Twilio's default is the
  // original `To` number; explicit override required when bridging from a
  // shared DID to keep the customer-facing CallerID stable.
  callerId?: string
  // Status callback URL Twilio will POST to on the dial child-call's status
  // changes. Forwarded as `action` on <Dial>.
  dialStatusCallbackUrl?: string
}

interface BuildDialTwimlInput {
  // E.164 destination — the agent's sticky DID or the transfer target.
  to: string
  // Caller-ID presented on the outbound leg.
  callerId: string
  // Optional status callback URL for the child-call leg.
  statusCallbackUrl?: string
  // Record-from-answer (no ringing tones). Default off; callers opt in.
  record?: boolean
}

interface BuildInboundMessagingTwimlInput {
  // Optional auto-reply body. Most inbound SMS handlers return empty TwiML
  // (the route still persists the message); STOP/UNSUB handlers set this
  // for confirmation.
  replyBody?: string
}

interface VerifyWebhookSignatureInput {
  // Full URL Twilio was configured to call, INCLUDING any query string.
  // Must match EXACTLY — a trailing slash mismatch or missing query string
  // fails validation. Reconstruct from request headers in the route handler.
  url: string
  // Value of the X-Twilio-Signature request header.
  signature: string
  // Form-urlencoded body parsed into a record. Twilio webhooks are
  // form-urlencoded by default; values are always strings.
  params: Record<string, string>
}

function createTwilioClient() {
  // Lazy SDK singleton — constructed on first call, never at module-load.
  // Module-load construction breaks edge-runtime static probes and test envs
  // where the env may be partially populated.
  let _sdk: Twilio | undefined
  function sdk(): Twilio {
    if (!_sdk) {
      const config = getTwilioConfig()
      _sdk = twilio(config.accountSid, config.authToken)
    }
    return _sdk
  }

  return {
    // -----------------------------------------------------------------------
    // REST — Voice
    // -----------------------------------------------------------------------

    /**
     * Place an outbound call. Caller supplies the SDK's option type unchanged
     * (the SDK is the source of truth for accepted params).
     *
     * NEVER call from a route handler directly — go through
     * `services/voip/voip-calls.service.ts#placeAgentCall` which runs the
     * compliance gate + DNC check first.
     */
    async placeOutboundCall(params: CallListInstanceCreateOptions): Promise<CallInstance> {
      return sdk().calls.create(params)
    },

    /** Fetch a call resource by SID. */
    async fetchCall(callSid: string): Promise<CallInstance> {
      return sdk().calls(callSid).fetch()
    },

    /**
     * Force a call to terminate. Used by the agent's "hang up" action when
     * the browser softphone's local disconnect didn't propagate (rare, but
     * possible under network partition).
     */
    async hangupCall(callSid: string): Promise<CallInstance> {
      return sdk().calls(callSid).update({ status: 'completed' })
    },

    // -----------------------------------------------------------------------
    // REST — Messaging
    // -----------------------------------------------------------------------

    /**
     * Send an SMS or MMS. Caller supplies the SDK's option type unchanged.
     *
     * NEVER call from a route handler directly — go through
     * `services/voip/voip-messages.service.ts#sendSms` which runs the
     * compliance gate, STOP-keyword guard, and 10DLC-vetting check first.
     */
    async sendMessage(params: MessageListInstanceCreateOptions): Promise<MessageInstance> {
      return sdk().messages.create(params)
    },

    /** Fetch a message resource by SID. */
    async fetchMessage(messageSid: string): Promise<MessageInstance> {
      return sdk().messages(messageSid).fetch()
    },

    /**
     * Lookup v2 with line-type-intelligence. Confirms a number is real/reachable
     * and resolves its line type + carrier. Paid (~$0.005/lookup). Throws on a
     * transport/API error — callers MUST treat a throw as "indeterminate" and
     * fail open (never block a lead on a Twilio outage). See the funnel phone gate.
     */
    async lookupPhoneNumber(e164: string): Promise<PhoneLookupResult> {
      const res = await sdk().lookups.v2.phoneNumbers(e164).fetch({ fields: 'line_type_intelligence' })
      return {
        valid: res.valid ?? false,
        lineType: res.lineTypeIntelligence?.type ?? null,
        carrierName: res.lineTypeIntelligence?.carrierName ?? null,
        errorCode: res.lineTypeIntelligence?.errorCode ?? null,
      }
    },

    // -----------------------------------------------------------------------
    // REST — Numbers (admin observability only in Phase 1)
    // -----------------------------------------------------------------------

    /**
     * List DIDs owned by the account. Used by the admin "Resync DIDs"
     * mutation to populate / reconcile `voip_dids`. Numbers are purchased
     * via the Twilio console, NOT programmatically.
     */
    async listIncomingPhoneNumbers(
      params?: IncomingPhoneNumberListInstanceOptions,
    ): Promise<IncomingPhoneNumberInstance[]> {
      // Branch the overload — the SDK's no-arg + params forms are distinct.
      if (params === undefined) {
        return sdk().incomingPhoneNumbers.list()
      }
      return sdk().incomingPhoneNumbers.list(params)
    },

    /** Fetch a single DID by SID. Used when reconciling drift for one number. */
    async fetchIncomingPhoneNumber(sid: string): Promise<IncomingPhoneNumberInstance> {
      return sdk().incomingPhoneNumbers(sid).fetch()
    },

    // -----------------------------------------------------------------------
    // JWT mint — browser softphone AccessToken
    // -----------------------------------------------------------------------

    /**
     * Mint an AccessToken JWT for the browser softphone. The Voice JS SDK
     * initializes its `Device` with this token; Twilio's edge validates the
     * signature against our API Key SID + Secret.
     *
     * IMPORTANT: signing uses TWILIO_API_KEY_SID + SECRET (NOT the account
     * auth token). The auth token signs REST + webhook validation; API Keys
     * sign JWTs. The grant gives the browser BOTH `incomingAllow` (so it can
     * receive inbound) and `outgoingApplicationSid` (so it can dial through
     * our configured TwiML App).
     */
    mintVoiceAccessToken(input: MintVoiceAccessTokenInput): string {
      const config = getTwilioConfig()
      const { AccessToken } = twilio.jwt
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

    // -----------------------------------------------------------------------
    // TwiML builders — fluent SDK builders, never hand-written XML
    // -----------------------------------------------------------------------

    /**
     * Build the TwiML returned to Twilio's edge when an inbound call hits
     * one of our DIDs (the URL configured on the IncomingPhoneNumber).
     * Returns a string ready to use as the body of a `text/xml` response.
     */
    buildInboundVoiceTwiml(input: BuildInboundVoiceTwimlInput): string {
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
    },

    /**
     * Build outbound-dial TwiML — used when the softphone-initiated outbound
     * call hits our TwiML App URL and we need to instruct Twilio to bridge
     * to the customer's number.
     */
    buildDialTwiml(input: BuildDialTwimlInput): string {
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
    },

    /**
     * Build the TwiML returned to Twilio when an inbound SMS hits one of
     * our DIDs. Most handlers return empty TwiML (route persists the message
     * separately); STOP/UNSUB handlers set `replyBody` for confirmation.
     */
    buildInboundMessagingTwiml(input: BuildInboundMessagingTwimlInput): string {
      const response = new twilio.twiml.MessagingResponse()

      if (input.replyBody) {
        response.message(input.replyBody)
      }

      return response.toString()
    },

    // -----------------------------------------------------------------------
    // Webhook signature verification
    // -----------------------------------------------------------------------

    /**
     * Validate an inbound webhook came from Twilio. Twilio signs every
     * webhook with HMAC-SHA1 over (url + sorted-form-params) using the
     * account's auth token. The SDK's `validateRequest` does the HMAC +
     * constant-time compare.
     *
     * Returns `false` on mismatch — route handlers should respond 403.
     */
    verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean {
      return twilio.validateRequest(
        getTwilioConfig().authToken,
        input.signature,
        input.url,
        input.params,
      )
    },
  }
}

export type TwilioClient = ReturnType<typeof createTwilioClient>

/**
 * The single Twilio entry point. Import this — and only this — to interact
 * with Twilio from any service. See file header comment + `DOCS.md`.
 */
export const twilioClient = createTwilioClient()

/**
 * Re-export of the SDK's RestException for `instanceof` checks. Callers do:
 *
 *   try { await twilioClient.placeOutboundCall(...) }
 *   catch (e) {
 *     if (e instanceof RestException) {
 *       // access e.code, e.status, e.message, e.moreInfo
 *     }
 *   }
 */
export { TwilioRestException as RestException }
