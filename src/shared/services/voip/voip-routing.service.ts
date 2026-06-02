import type { DalReturn } from '@/shared/dal/server/types'

import env from '@/shared/config/server-env'
import { dalError, dalSuccess } from '@/shared/dal/server/types'
import { getDidByE164 } from '@/shared/entities/voip-dids/dal/server/queries'
import { twilioClient } from '@/shared/services/providers/twilio/client'
import {
  ACCESS_TOKEN_IDENTITY_PREFIX,
  ACCESS_TOKEN_TTL_SECONDS,
  VOIP_DEV_OVERRIDE_NUMBER,
} from '@/shared/services/providers/twilio/constants'

// ---------------------------------------------------------------------------
// voipRoutingService — synchronous mid-flow surfaces Twilio's edge calls into:
//
//   /api/voip/softphone/access-token   (browser softphone bootstrap)
//   /api/voip/twiml/voice-inbound      (inbound DID dialed by a customer)
//   /api/voip/twiml/voice-outbound     (browser softphone dialing out)
//   /api/voip/twiml/messaging-inbound  (inbound SMS to a DID)
//
// The actual route handlers live in Slug D — they call this service to:
//   1. Mint AccessToken JWTs (`mintSoftphoneToken`)
//   2. Resolve which agent's DID was dialed inbound (`resolveInboundDial`)
//   3. Build TwiML response strings (`buildInboundVoice*`, `buildOutboundDial`)
//
// Routes that ALSO need webhook signature verification call
// `twilioClient.verifyWebhookSignature` directly at the route boundary
// (one-line concern; no value in re-wrapping).
//
// see src/shared/services/providers/twilio/client.ts (the action surface)
// see docs/codebase-conventions/webhook-routes.md (sync vs async split)
// ---------------------------------------------------------------------------

interface MintSoftphoneTokenInput {
  // The agent's better-auth user id. Identity claim is namespaced by env
  // (`prod` / `dev`) to disambiguate when a single Twilio account hosts both.
  userId: string
  // Optional TTL override (seconds). Defaults to `ACCESS_TOKEN_TTL_SECONDS`
  // (1h). Voice JS SDK fires `tokenWillExpire` ~30s before; UI re-fetches.
  ttlSeconds?: number
}

interface MintSoftphoneTokenResult {
  // The signed JWT. Pass to Voice JS SDK's `Device` constructor.
  jwt: string
  // The identity claim used (namespaced form). Browser uses it as the
  // softphone client name in Twilio's edge for inbound routing.
  identity: string
  // Wall-clock seconds until expiry. Echo to the browser so it can schedule
  // a refresh BEFORE Twilio's `tokenWillExpire` fires (defense in depth).
  ttlSeconds: number
}

interface ResolveInboundDialInput {
  // The E.164 number the customer dialed — webhook's `To` field.
  toE164: string
}

interface ResolveInboundDialResult {
  // The owning DID row. If null, the inbound TwiML responder hangs up (we
  // don't recognize the DID and don't want to leak that fact to callers via
  // an open bridge).
  voipDid: {
    id: string
    e164: string
    assignedUserId: string | null
    label: string | null
  } | null
}

interface BuildInboundVoiceResponseInput {
  // The assigned agent's identity (namespaced), if there is one. Used to
  // wire `<Dial><Client identity="..."/></Dial>` so Twilio's edge rings the
  // agent's browser softphone Device. Null ⇒ play greeting + hangup.
  agentIdentity: string | null
  // Caller-ID for the bridged leg. Always the inbound DID's own E.164 so
  // the agent's softphone shows "incoming call from <customer>" with our
  // DID as the local context — matches Twilio's <Dial> caller_id semantics.
  callerId: string
  // Optional greeting played before the dial. Default: no greeting.
  greeting?: string
}

interface BuildOutboundDialResponseInput {
  // The target E.164 the softphone wants to reach (already dev-override
  // rewritten by the route handler that calls this).
  toE164: string
  // Caller-ID presented on the customer side — the agent's sticky DID E.164.
  callerId: string
  // Whether to record. Default true for outbound voice (matches our agent-
  // calls retention policy).
  record?: boolean
}

function buildAgentIdentity(userId: string): string {
  return `${ACCESS_TOKEN_IDENTITY_PREFIX}_agent_${userId}`
}

function createVoipRoutingService() {
  return {
    /**
     * Mint the softphone JWT the browser uses to initialize its Twilio Voice
     * Device. The route handler should authenticate the user first (via the
     * normal session middleware) and pass the resolved userId.
     */
    mintSoftphoneToken: (input: MintSoftphoneTokenInput): MintSoftphoneTokenResult => {
      const identity = buildAgentIdentity(input.userId)
      const ttlSeconds = input.ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS

      const jwt = twilioClient.mintVoiceAccessToken({
        identity,
        ttlSeconds,
        outgoingApplicationParams: {
          // Forwarded into the outbound TwiML responder as `Params.userId`.
          // The responder uses this to look up the agent's sticky DID for
          // the `from` leg without trusting the browser to claim its own id.
          userId: input.userId,
        },
      })

      return { jwt, identity, ttlSeconds }
    },

    /**
     * Resolve which Tri Pros DID an inbound call/SMS was placed to. The
     * webhook handler reads the payload's `To`, calls this, then branches:
     *   - Known DID with assigned agent ⇒ build dial-to-client TwiML
     *   - Known DID without agent       ⇒ greeting + voicemail (Phase 2+)
     *   - Unknown DID                   ⇒ hang up
     */
    resolveInboundDial: async (
      input: ResolveInboundDialInput,
    ): Promise<DalReturn<ResolveInboundDialResult>> => {
      const didResult = await getDidByE164(input.toE164)
      if (!didResult.success) {
        return didResult
      }
      if (!didResult.data) {
        return dalSuccess({ voipDid: null })
      }
      const did = didResult.data
      return dalSuccess({
        voipDid: {
          id: did.id,
          e164: did.e164,
          assignedUserId: did.assignedUserId,
          label: did.label,
        },
      })
    },

    /**
     * Build the TwiML returned for an inbound voice call. When an agent
     * identity is provided, ring their softphone via `<Client>`; otherwise
     * greet + hangup (Phase 1 simplification; voicemail is Phase 2+).
     *
     * The actual TwiML XML is built by `twilioClient.buildInboundVoiceTwiml`.
     * This service supplies the policy: who to ring, what greeting to play.
     */
    buildInboundVoiceResponse: (input: BuildInboundVoiceResponseInput): string => {
      if (input.agentIdentity) {
        // Ring the agent's browser softphone. `<Dial><Client>...</Client></Dial>`
        // — Twilio resolves the identity to the registered Device on their
        // edge. `client:agent_${userId}` is the canonical form.
        return twilioClient.buildInboundVoiceTwiml({
          greeting: input.greeting,
          dialTarget: `client:${input.agentIdentity}`,
          callerId: input.callerId,
          dialStatusCallbackUrl: `${env.VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`,
        })
      }
      return twilioClient.buildInboundVoiceTwiml({
        greeting: input.greeting ?? 'Thanks for calling Tri Pros. Please leave us a message after the tone, or try us again later.',
      })
    },

    /**
     * Build the TwiML returned when the agent's BROWSER SOFTPHONE initiates
     * an outbound call. Twilio's edge hits our outbound TwiML App URL with
     * the softphone's `to` + `From` (CallerID); we instruct it to bridge.
     *
     * The route handler is responsible for dev-override rewriting BEFORE
     * calling this — the routing service receives a final dial target.
     */
    buildOutboundDialResponse: (input: BuildOutboundDialResponseInput): string => {
      return twilioClient.buildDialTwiml({
        to: input.toE164,
        callerId: input.callerId,
        statusCallbackUrl: `${env.VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`,
        record: input.record ?? true,
      })
    },

    /**
     * Build the TwiML returned for an inbound SMS. Phase 1 returns empty
     * TwiML (the route handler persists the message + handles STOP routing
     * separately); callers MAY set `replyBody` when sending a STOP/UNSUB
     * confirmation back to the sender.
     */
    buildInboundMessagingResponse: (input: { replyBody?: string }): string => {
      return twilioClient.buildInboundMessagingTwiml({ replyBody: input.replyBody })
    },

    /**
     * Apply the dev-override at the routing boundary. Centralized here so
     * route handlers + the outbound TwiML responder share one source of
     * truth instead of each re-reading the env var. Returns the original
     * E.164 in production (where the override is gated off in server-env).
     */
    applyDevOverride: (e164: string): string => {
      return VOIP_DEV_OVERRIDE_NUMBER ?? e164
    },

    /**
     * Refuse outbound when the routing layer's hard preconditions aren't
     * met. Currently: prod + no 10DLC = no SMS, prod + no Trust Profile = no
     * voice. Returns null when all preconditions hold; otherwise a DalError
     * the caller can convert to a 412 Precondition Failed.
     */
    checkOutboundReadiness: (channel: 'voice' | 'sms'): DalReturn<null> => {
      if (env.NODE_ENV !== 'production') {
        return dalSuccess(null)
      }
      if (channel === 'sms' && !env.TWILIO_10DLC_CAMPAIGN_SID) {
        return dalError({
          type: 'precondition-failed',
          reason: '10DLC campaign approval pending — outbound SMS disabled',
        })
      }
      if (channel === 'voice' && !env.TWILIO_TRUST_PROFILE_SID) {
        return dalError({
          type: 'precondition-failed',
          reason: 'Trust Hub vetting pending — outbound voice disabled',
        })
      }
      return dalSuccess(null)
    },
  }
}

/**
 * Single-instance voipRoutingService — used by the synchronous TwiML
 * responders + softphone access-token route (Slug D). Webhook signature
 * verification is intentionally NOT here — route handlers call
 * `twilioClient.verifyWebhookSignature` at the boundary directly.
 */
export const voipRoutingService = createVoipRoutingService()
