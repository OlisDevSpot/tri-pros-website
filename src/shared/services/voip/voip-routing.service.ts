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

interface MintSoftphoneTokenInput {
  // The identity claim is namespaced by env so one Twilio account can host prod and dev.
  userId: string
  ttlSeconds?: number
}

interface MintSoftphoneTokenResult {
  jwt: string
  identity: string
  // Echoed so the browser can schedule a refresh before Twilio's `tokenWillExpire` fires.
  ttlSeconds: number
}

interface ResolveInboundDialInput {
  // The E.164 number the customer dialed — webhook's `To` field.
  toE164: string
}

interface ResolveInboundDialResult {
  // Null ⇒ the responder hangs up rather than leak that the DID is unrecognized via an open bridge.
  voipDid: {
    id: string
    e164: string
    assignedUserId: string | null
    label: string | null
  } | null
}

interface BuildInboundVoiceResponseInput {
  agentIdentity: string | null
  // Always the inbound DID's own E.164 — Twilio's <Dial> callerId semantics.
  callerId: string
  greeting?: string
}

interface BuildOutboundDialResponseInput {
  toE164: string
  callerId: string
  // Default true — agent-calls retention policy.
  record?: boolean
}

function buildAgentIdentity(userId: string): string {
  return `${ACCESS_TOKEN_IDENTITY_PREFIX}_agent_${userId}`
}

function createVoipRoutingService() {
  return {
    /** The caller must authenticate the user first — `userId` is trusted here. */
    mintSoftphoneToken: (input: MintSoftphoneTokenInput): MintSoftphoneTokenResult => {
      const identity = buildAgentIdentity(input.userId)
      const ttlSeconds = input.ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS

      const jwt = twilioClient.mintVoiceAccessToken({
        identity,
        ttlSeconds,
        outgoingApplicationParams: {
          // Surfaces as `Params.userId` in the outbound TwiML responder so the browser never claims its own id.
          userId: input.userId,
        },
      })

      return { jwt, identity, ttlSeconds }
    },

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

    buildInboundVoiceResponse: (input: BuildInboundVoiceResponseInput): string => {
      if (input.agentIdentity) {
        // `client:<identity>` makes Twilio ring the registered browser Device.
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

    /** The caller applies the dev-override BEFORE this — `toE164` is the final dial target. */
    buildOutboundDialResponse: (input: BuildOutboundDialResponseInput): string => {
      return twilioClient.buildDialTwiml({
        to: input.toE164,
        callerId: input.callerId,
        statusCallbackUrl: `${env.VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`,
        record: input.record ?? true,
      })
    },

    buildInboundMessagingResponse: (input: { replyBody?: string }): string => {
      return twilioClient.buildInboundMessagingTwiml({ replyBody: input.replyBody })
    },

    /** No env check here — server-env refuses to boot with VOIP_DEV_OVERRIDE_NUMBER set in production. */
    applyDevOverride: (e164: string): string => {
      return VOIP_DEV_OVERRIDE_NUMBER ?? e164
    },

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

/** Webhook signature verification is deliberately NOT here — route handlers call `twilioClient.verifyWebhookSignature` at the boundary. */
export const voipRoutingService = createVoipRoutingService()
