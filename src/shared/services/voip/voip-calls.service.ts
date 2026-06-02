import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { VoipCall } from '@/shared/db/schema/voip-calls'
import type { CallInstance, CallListInstanceCreateOptions } from '@/shared/services/providers/twilio/types'

import env from '@/shared/config/server-env'
import { dalError, dalSuccess, SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { voipCallCrud } from '@/shared/entities/voip-calls/dal/server/crud'
import { patchCallStatusByProviderId, upsertInboundCall } from '@/shared/entities/voip-calls/dal/server/mutations'
import { getStickyDidForUser } from '@/shared/entities/voip-dids/dal/server/queries'
import { RestException, twilioClient } from '@/shared/services/providers/twilio/client'
import { VOIP_DEV_OVERRIDE_NUMBER } from '@/shared/services/providers/twilio/constants'
import { complianceService } from '@/shared/services/voip/compliance.service'

// ---------------------------------------------------------------------------
// voipCallsService — orchestrates outbound + inbound call flows.
//
// THIS FILE IS PURE ORCHESTRATION. Composes:
//   - complianceService (DNC + kill-switch gate)
//   - voip-dids queries (sticky DID lookup)
//   - voip-calls CRUD + mutations (persistence)
//   - twilioClient (Twilio REST)
//
// No raw db calls. No raw SQL. No manual `updatedAt`. If you find yourself
// reaching for `db.insert/update`, that logic belongs in
// `entities/voip-calls/dal/server/mutations.ts` (or queries.ts).
//
// see memory/feedback-services-orchestrate-dal-implements.md
// see docs/codebase-conventions/service-architecture.md
// ---------------------------------------------------------------------------

// Twilio status-callback events we subscribe to. Surfaces enough lifecycle
// granularity for the agent UI without flooding the webhook.
const STATUS_CALLBACK_EVENTS = ['initiated', 'ringing', 'answered', 'completed'] as const

const STATUS_CALLBACK_URL = `${env.VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`

interface PlaceAgentCallInput {
  customerId: string
  remoteE164: string
  agentUserId: string
}

interface PlaceAgentCallResult {
  callId: string
  providerCallId: string | null
  status: VoipCall['status']
  skipReason: string | null
}

interface RecordInboundCallInput {
  providerCallId: string
  voipDidId: string | null
  customerId: string | null
  remoteE164: string
  agentUserId?: string | null
}

interface ApplyStatusCallbackInput {
  providerCallId: string
  status: VoipCall['status']
  // Event timestamps come from the webhook caller — they know which event fired.
  // The service does not infer timestamps from status (see DAL for rationale).
  answeredAt?: string
  endedAt?: string
  durationSeconds?: number
  recordingUrl?: string
  recordingDurationSeconds?: number
}

function buildTwilioCallParams(input: {
  fromE164: string
  toE164: string
}): CallListInstanceCreateOptions {
  return {
    from: input.fromE164,
    to: input.toE164,
    applicationSid: env.TWILIO_TWIML_APP_SID,
    statusCallback: STATUS_CALLBACK_URL,
    statusCallbackEvent: [...STATUS_CALLBACK_EVENTS],
    statusCallbackMethod: 'POST',
    record: true,
    recordingStatusCallback: STATUS_CALLBACK_URL,
  }
}

function describeTwilioError(e: unknown): string {
  if (e instanceof RestException) {
    return `twilio:${e.code ?? e.status ?? 'unknown'}`
  }
  return 'twilio:unknown'
}

function createVoipCallsService() {
  return {
    /**
     * Place an outbound call from an agent to a customer.
     *
     *  1. Compliance gate (DNC + kill-switch via `complianceService`).
     *  2. Resolve agent's sticky DID.
     *  3. Apply dev-override (Twilio leg only — row persists intent).
     *  4. Persist row with `status='queued'`.
     *  5. Fire Twilio. On RestException, patch to `status='failed'`.
     *  6. Patch row with returned CallSid.
     */
    placeAgentCall: async (
      ctx: ScopedContext,
      input: PlaceAgentCallInput,
    ): Promise<DalReturn<PlaceAgentCallResult>> => {
      // 1. Compliance gate.
      const allowed = await complianceService.canOutboundTo(input.remoteE164)
      if (!allowed) {
        const skipReason = 'dnc'
        const inserted = await voipCallCrud.create(ctx, {
          customerId: input.customerId,
          remoteE164: input.remoteE164,
          direction: 'outbound',
          status: 'skipped_compliance',
          skipReason,
          agentUserId: input.agentUserId,
        })
        if (!inserted.success) {
          return inserted
        }
        return dalSuccess({
          callId: inserted.data.id,
          providerCallId: null,
          status: 'skipped_compliance' as const,
          skipReason,
        })
      }

      // 2. Sticky DID — precondition for outbound.
      const didResult = await getStickyDidForUser(input.agentUserId)
      if (!didResult.success) {
        return didResult
      }
      if (!didResult.data) {
        return dalError({
          type: 'precondition-failed',
          reason: 'agent has no active primary DID — assign one via the admin panel',
        })
      }
      const stickyDid = didResult.data

      // 3. Dev-override rewrite (Twilio leg only).
      const dialTarget = VOIP_DEV_OVERRIDE_NUMBER ?? input.remoteE164

      // 4. Persist BEFORE Twilio — network failure mid-REST stays recoverable.
      const created = await voipCallCrud.create(ctx, {
        customerId: input.customerId,
        voipDidId: stickyDid.id,
        remoteE164: input.remoteE164,
        direction: 'outbound',
        status: 'queued',
        agentUserId: input.agentUserId,
      })
      if (!created.success) {
        return created
      }
      const callRow = created.data

      // 5. Fire Twilio.
      let twilioCall: CallInstance
      try {
        twilioCall = await twilioClient.placeOutboundCall(
          buildTwilioCallParams({ fromE164: stickyDid.e164, toE164: dialTarget }),
        )
      }
      catch (e) {
        const errorCode = describeTwilioError(e)
        const patched = await voipCallCrud.update(ctx, {
          id: callRow.id,
          data: { status: 'failed', skipReason: errorCode },
        })
        if (!patched.success) {
          return patched
        }
        return dalSuccess({
          callId: callRow.id,
          providerCallId: null,
          status: 'failed' as const,
          skipReason: errorCode,
        })
      }

      // 6. Patch with returned CallSid.
      const patched = await voipCallCrud.update(ctx, {
        id: callRow.id,
        data: { providerCallId: twilioCall.sid },
      })
      if (!patched.success) {
        return patched
      }
      return dalSuccess({
        callId: callRow.id,
        providerCallId: twilioCall.sid,
        status: 'queued' as const,
        skipReason: null,
      })
    },

    /**
     * Idempotent upsert for inbound calls. Routes through the DAL mutation
     * (which owns the ON CONFLICT clause).
     */
    recordInboundCall: (
      _ctx: ScopedContext,
      input: RecordInboundCallInput,
    ): Promise<DalReturn<VoipCall>> => {
      return upsertInboundCall(input)
    },

    /**
     * Apply a webhook-driven status patch. Routes through the DAL mutation.
     */
    applyStatusCallback: (
      _ctx: ScopedContext,
      input: ApplyStatusCallbackInput,
    ): Promise<DalReturn<{ rowsAffected: number }>> => {
      return patchCallStatusByProviderId(input)
    },

    getCallById: (
      ctx: ScopedContext,
      callId: string,
    ): Promise<DalReturn<VoipCall | undefined>> => {
      return voipCallCrud.getById(ctx, { id: callId })
    },

    getCallByIdSystem: (callId: string): Promise<DalReturn<VoipCall | undefined>> => {
      return voipCallCrud.getById(SYSTEM_CONTEXT, { id: callId })
    },
  }
}

export const voipCallsService = createVoipCallsService()
