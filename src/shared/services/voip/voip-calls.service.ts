import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { VoipCall } from '@/shared/db/schema/voip-calls'
import type { CallInstance, CallListInstanceCreateOptions } from '@/shared/services/providers/twilio/types'

import { eq, sql } from 'drizzle-orm'

import env from '@/shared/config/server-env'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { dalError, dalSuccess, SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { voipCalls } from '@/shared/db/schema/voip-calls'
import { voipCallCrud } from '@/shared/entities/voip-calls/dal/server/crud'
import { getStickyDidForUser } from '@/shared/entities/voip-dids/dal/server/queries'
import { complianceService } from '@/shared/services/compliance.service'
import { RestException, twilioClient } from '@/shared/services/providers/twilio/client'
import { VOIP_DEV_OVERRIDE_NUMBER } from '@/shared/services/providers/twilio/constants'

// ---------------------------------------------------------------------------
// voipCallsService — orchestrates server-initiated outbound voice + inbound
// call lifecycle persistence + status-callback patches.
//
// see docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS (2026-05-30)
// see src/shared/entities/voip-calls/DOCS.md (invariants)
// see src/shared/services/providers/twilio/DOCS.md (caller rules)
//
// Three-tier discipline (per docs/codebase-conventions/service-architecture.md):
// - Depends on the twilio provider (via the single `twilioClient`).
// - Depends on compliance.service (DNC + kill-switch gate).
// - Depends on the voip-calls + voip-dids DAL.
// - Direct `db` writes are limited to the idempotent ON CONFLICT upsert on
//   provider_call_id, which createCrudDal's slot signatures don't cover.
// - This service does NOT depend on tRPC, route handlers, or any UI surface.
// ---------------------------------------------------------------------------

// Twilio status-callback events we subscribe to. Surfaces enough lifecycle
// granularity for the agent UI ("ringing", "answered", "completed") without
// flooding our webhook on every micro-state.
const STATUS_CALLBACK_EVENTS = ['initiated', 'ringing', 'answered', 'completed'] as const

// Webhook URL Twilio POSTs status callbacks to. The route handler in Slug D
// verifies the signature via `twilioClient.verifyWebhookSignature` before
// dispatching to `applyStatusCallback`.
const STATUS_CALLBACK_URL = `${env.VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`

interface PlaceAgentCallInput {
  // Customer the agent intends to reach. Captured on the row for audit; the
  // customer's `phone` is NOT used as the dial target (could have changed
  // since the agent loaded the UI). Caller explicitly passes `remoteE164`.
  customerId: string
  // E.164 phone the agent is dialing. Used both for the compliance gate AND
  // the Twilio dial leg (modulo dev-override). Persisted on the row.
  remoteE164: string
  // The agent placing the call. Used to resolve their sticky DID for the
  // `from` leg + to attribute the row.
  agentUserId: string
}

interface PlaceAgentCallResult {
  // Internal voip_calls row id (UUID).
  callId: string
  // Twilio's call SID once the REST call returns. Null when the call was
  // skipped (compliance/precondition) — row still exists for audit.
  providerCallId: string | null
  // 'queued' on success, 'skipped_compliance' when the gate blocked, 'failed'
  // when Twilio rejected the request (e.g., 10DLC issue, geographic block).
  status: VoipCall['status']
  // Present when status='skipped_compliance' — surfaces the gate decision to
  // the UI so the agent sees "Skipped: DNC" rather than a silent failure.
  skipReason: string | null
}

interface RecordInboundCallInput {
  // Twilio's CallSid from the inbound webhook payload.
  providerCallId: string
  // Our DID the call came in on (resolved from webhook's `To` field via
  // `getDidByE164`). NULL when the DID isn't in our table — happens during
  // bootstrap before the resync mutation has been run.
  voipDidId: string | null
  // Customer that owns the calling number. Resolved by the caller via a
  // phone-prefix match; NULL when this is an unknown caller (no customer row).
  customerId: string | null
  // The caller's E.164 (webhook's `From`).
  remoteE164: string
  // Agent who picks up — populated only when the call is bridged to a known
  // agent via the inbound TwiML responder; NULL when the call hits voicemail
  // or a shared queue.
  agentUserId?: string | null
}

interface ApplyStatusCallbackInput {
  // Twilio's CallSid — used to find the existing row idempotently.
  providerCallId: string
  // The lifecycle status from the webhook (mapped from Twilio's enum to ours
  // by the caller; see `webhooks/voice.ts` schemas).
  status: VoipCall['status']
  // Present on `completed` callbacks. Caller coerces from string seconds.
  durationSeconds?: number
  // Recording metadata, present only on the recording-status callback (not
  // the regular status callback). Caller branches on event type and passes
  // only the fields populated.
  recordingUrl?: string
  recordingDurationSeconds?: number
}

function createVoipCallsService() {
  return {
    /**
     * Place an outbound call from an agent to a customer. The full path:
     *
     *  1. Compliance gate via `complianceService.canOutboundTo(remoteE164)`.
     *     False ⇒ insert row with `status='skipped_compliance'`, return.
     *     The row exists for audit even though no Twilio call fires.
     *  2. Resolve agent's sticky DID. None ⇒ `precondition-failed` (caller
     *     UI should refuse to render the call button without a primary DID).
     *  3. Dev-override rewrite — if `VOIP_DEV_OVERRIDE_NUMBER` is set, the
     *     Twilio dial leg goes there but the row's `remoteE164` keeps the
     *     intended customer number (audit fidelity).
     *  4. Insert row with `status='queued'`, get our internal id.
     *  5. Fire `twilioClient.placeOutboundCall` via the configured TwiML App.
     *  6. Update the row with the returned CallSid. On `RestException`,
     *     update to `status='failed'` with the error code in `skipReason`.
     *
     * Returns a DalReturn so callers can `if (!result.success)` uniformly.
     * Internal state-coupling errors (DID lookup, compliance read) bubble
     * through as `db-error` / `precondition-failed`; Twilio REST failures
     * yield a successful return with `status='failed'` (the call attempt
     * happened — it just didn't connect — and the row reflects that).
     */
    placeAgentCall: async (
      ctx: ScopedContext,
      input: PlaceAgentCallInput,
    ): Promise<DalReturn<PlaceAgentCallResult>> => {
      // 1. Compliance gate. The phone the AGENT is dialing — not the customer
      // row's current phone — drives the check (audit invariant: the immutable
      // phone we attempted to reach is what we report on).
      const allowed = await complianceService.canOutboundTo(input.remoteE164)

      if (!allowed) {
        const skipReason = 'dnc'
        const insertResult = await voipCallCrud.create(ctx, {
          customerId: input.customerId,
          remoteE164: input.remoteE164,
          direction: 'outbound',
          status: 'skipped_compliance',
          skipReason,
          agentUserId: input.agentUserId,
        })

        if (!insertResult.success) {
          return insertResult
        }

        return dalSuccess({
          callId: insertResult.data.id,
          providerCallId: null,
          status: 'skipped_compliance' as const,
          skipReason,
        })
      }

      // 2. Resolve sticky DID. Precondition for outbound — every agent must
      // have a primary DID assigned (Slug F's softphone bootstrap also reads
      // this; consistency is intentional).
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

      // 3. Dev-override rewrite. Production gate in server-env.ts ensures
      // this is empty in prod; in dev/preview we redirect to the single
      // safe test number. ALWAYS persist the intended remote on the row.
      const dialTarget = VOIP_DEV_OVERRIDE_NUMBER ?? input.remoteE164

      // 4. Insert row with status='queued'. We persist BEFORE the Twilio
      // round-trip so a network failure mid-REST leaves a recoverable trail.
      const createResult = await voipCallCrud.create(ctx, {
        customerId: input.customerId,
        voipDidId: stickyDid.id,
        remoteE164: input.remoteE164,
        direction: 'outbound',
        status: 'queued',
        agentUserId: input.agentUserId,
      })

      if (!createResult.success) {
        return createResult
      }

      const callRow = createResult.data

      // 5. Fire Twilio. We delegate TwiML behavior to the configured app —
      // when Twilio answers, it hits our outbound TwiML App URL (Slug D) and
      // we return TwiML to bridge to `dialTarget`.
      const twilioParams: CallListInstanceCreateOptions = {
        from: stickyDid.e164,
        to: dialTarget,
        applicationSid: env.TWILIO_TWIML_APP_SID,
        statusCallback: STATUS_CALLBACK_URL,
        statusCallbackEvent: [...STATUS_CALLBACK_EVENTS],
        statusCallbackMethod: 'POST',
        record: true,
        recordingStatusCallback: STATUS_CALLBACK_URL,
      }

      let twilioCall: CallInstance
      try {
        twilioCall = await twilioClient.placeOutboundCall(twilioParams)
      }
      catch (e) {
        // Twilio REST failure — patch the row's status to 'failed' with the
        // error code in skip_reason for visibility. We still return success
        // here because the operation completed (the call attempt happened —
        // it just didn't connect — and the row reflects that).
        const errorCode = e instanceof RestException
          ? `twilio:${e.code ?? e.status ?? 'unknown'}`
          : 'twilio:unknown'

        const updateResult = await voipCallCrud.update(ctx, {
          id: callRow.id,
          data: {
            status: 'failed',
            skipReason: errorCode,
          },
        })

        if (!updateResult.success) {
          return updateResult
        }

        return dalSuccess({
          callId: callRow.id,
          providerCallId: null,
          status: 'failed' as const,
          skipReason: errorCode,
        })
      }

      // 6. Patch the row with the returned Twilio CallSid. The webhook
      // handler folds subsequent status callbacks via `applyStatusCallback`,
      // keyed on this provider_call_id.
      const patchResult = await voipCallCrud.update(ctx, {
        id: callRow.id,
        data: {
          providerCallId: twilioCall.sid,
        },
      })

      if (!patchResult.success) {
        return patchResult
      }

      return dalSuccess({
        callId: callRow.id,
        providerCallId: twilioCall.sid,
        status: 'queued' as const,
        skipReason: null,
      })
    },

    /**
     * Idempotent upsert for inbound calls. Called by the inbound webhook
     * handler (Slug D) when a customer dials one of our DIDs. The webhook
     * may fire BEFORE the inbound TwiML responder returns — both surfaces
     * land here, keyed by the unique `provider_call_id`.
     *
     * Uses raw SQL upsert because `createCrudDal`'s default `create` doesn't
     * support ON CONFLICT semantics. This is a deliberate db-level escape
     * hatch (justified by the unique-key idempotency requirement).
     */
    recordInboundCall: async (
      _ctx: ScopedContext,
      input: RecordInboundCallInput,
    ): Promise<DalReturn<VoipCall>> => {
      return dalDbOperation(async () => {
        const [row] = await db
          .insert(voipCalls)
          .values({
            providerCallId: input.providerCallId,
            voipDidId: input.voipDidId,
            customerId: input.customerId,
            remoteE164: input.remoteE164,
            direction: 'inbound',
            status: 'ringing',
            agentUserId: input.agentUserId ?? null,
          })
          .onConflictDoUpdate({
            target: voipCalls.providerCallId,
            // Re-asserting the inbound fields is safe: provider_call_id is
            // immutable per Twilio, so a re-deliver of the same webhook is
            // a no-op patch.
            set: {
              voipDidId: input.voipDidId,
              customerId: input.customerId,
              remoteE164: input.remoteE164,
              agentUserId: input.agentUserId ?? null,
              updatedAt: sql`NOW()`,
            },
          })
          .returning()

        return row!
      })
    },

    /**
     * Apply a status callback (from the regular call-status webhook OR the
     * recording-status webhook) to an existing voip_calls row. Keyed by
     * `provider_call_id` for idempotency — Twilio retries on non-2xx.
     *
     * No-op when the row doesn't exist: webhook race vs. row-insertion is
     * possible (e.g., recording callback fires faster than our REST-return
     * patch). The caller (route handler) treats no-op as 200 OK so Twilio
     * stops retrying; the eventual `placeOutboundCall` REST patch will
     * fill in the row, and subsequent callbacks will land.
     */
    applyStatusCallback: async (
      _ctx: ScopedContext,
      input: ApplyStatusCallbackInput,
    ): Promise<DalReturn<{ rowsAffected: number }>> => {
      return dalDbOperation(async () => {
        const updates: Partial<typeof voipCalls.$inferInsert> = {
          status: input.status,
        }

        if (input.status === 'answered') {
          updates.answeredAt = sql`NOW()` as unknown as string
        }
        if (input.status === 'completed' || input.status === 'failed' || input.status === 'no_answer') {
          updates.endedAt = sql`NOW()` as unknown as string
        }
        if (input.durationSeconds !== undefined) {
          updates.durationSeconds = input.durationSeconds
        }
        if (input.recordingUrl !== undefined) {
          updates.recordingUrl = input.recordingUrl
        }
        if (input.recordingDurationSeconds !== undefined) {
          updates.recordingDurationSeconds = input.recordingDurationSeconds
        }

        const result = await db
          .update(voipCalls)
          .set({
            ...updates,
            updatedAt: sql`NOW()`,
          })
          .where(eq(voipCalls.providerCallId, input.providerCallId))
          .returning({ id: voipCalls.id })

        return { rowsAffected: result.length }
      })
    },

    /**
     * Convenience: fetch a single call by id with full visibility scoping.
     * Wraps `voipCallCrud.getById` so callers in route handlers / RSC don't
     * need to import the crud module directly.
     */
    getCallById: async (
      ctx: ScopedContext,
      callId: string,
    ): Promise<DalReturn<VoipCall | undefined>> => {
      return voipCallCrud.getById(ctx, { id: callId })
    },

    /**
     * System-context fetch — bypasses CASL scope, used by the webhook handler
     * to find a row by id when no user session is attached. Caller MUST be
     * a trusted system surface (webhook with verified signature).
     */
    getCallByIdSystem: async (callId: string): Promise<DalReturn<VoipCall | undefined>> => {
      return voipCallCrud.getById(SYSTEM_CONTEXT, { id: callId })
    },
  }
}

/**
 * Single-instance voipCallsService. Import this — and only this — to invoke
 * outbound calls or persist inbound-call lifecycle from a route handler /
 * tRPC procedure / job handler.
 *
 * Per the service-architecture convention, NEVER import `twilioClient`
 * directly from a route handler — go through this service so the compliance
 * gate + DID resolution + dev-override rewrite happen first.
 */
export const voipCallsService = createVoipCallsService()
