// Voip-calls business mutations — operations that don't fit through generic CRUD
// (idempotent upsert + provider-id keyed patches). Services call these — never
// reach for `db.insert/update` from a service layer.
//
// see ../../DOCS.md for invariants
// see docs/codebase-conventions/dal-conventions.md
// see memory/feedback-services-orchestrate-dal-implements.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipCall } from '@/shared/db/schema/voip-calls'

import { eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipCalls } from '@/shared/db/schema/voip-calls'

interface UpsertInboundCallInput {
  // Twilio CallSid — UNIQUE on voip_calls; drives ON CONFLICT idempotency.
  providerCallId: string
  voipDidId: string | null
  customerId: string | null
  remoteE164: string
  agentUserId?: string | null
}

/**
 * Idempotent upsert for inbound calls — keyed on the unique `provider_call_id`.
 * Webhook re-deliveries hit the conflict branch and re-assert the inbound
 * fields (safe: provider_call_id is immutable per Twilio).
 *
 * `updatedAt` auto-bumps on the conflict-update branch via the schema-helper's
 * `$onUpdate` callback — do NOT set it manually here.
 */
export async function upsertInboundCall(input: UpsertInboundCallInput): Promise<DalReturn<VoipCall>> {
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
        set: {
          voipDidId: input.voipDidId,
          customerId: input.customerId,
          remoteE164: input.remoteE164,
          agentUserId: input.agentUserId ?? null,
        },
      })
      .returning()

    return row!
  })
}

interface PatchCallStatusByProviderIdInput {
  providerCallId: string
  status: VoipCall['status']
  // Caller (the route handler that parses the Twilio webhook) already knows
  // which event fired and supplies the appropriate event timestamp(s). We
  // don't infer timestamps from status — too many edge cases (e.g., `failed`
  // can fire before `answered` ever did, in which case `answeredAt` MUST stay
  // null).
  answeredAt?: string
  endedAt?: string
  durationSeconds?: number
  recordingUrl?: string
  recordingDurationSeconds?: number
}

/**
 * Apply a webhook-driven status patch keyed by `provider_call_id`. No-op when
 * the row doesn't exist (webhook race vs. row-insertion is possible — recording
 * callback may fire faster than the REST-return patch from `placeOutboundCall`).
 * Returns rowsAffected so callers can detect the no-op case.
 *
 * Caller responsibilities:
 *   - Pass only event timestamps that actually happened (e.g., `answeredAt`
 *     only on the `answered` event, `endedAt` only on `completed`/`failed`/
 *     `no_answer`). The DAL doesn't infer — the webhook tells us.
 *   - Don't pass `updatedAt` — schema-helper $onUpdate handles it.
 */
export async function patchCallStatusByProviderId(
  input: PatchCallStatusByProviderIdInput,
): Promise<DalReturn<{ rowsAffected: number }>> {
  return dalDbOperation(async () => {
    const result = await db
      .update(voipCalls)
      .set({
        status: input.status,
        answeredAt: input.answeredAt,
        endedAt: input.endedAt,
        durationSeconds: input.durationSeconds,
        recordingUrl: input.recordingUrl,
        recordingDurationSeconds: input.recordingDurationSeconds,
      })
      .where(eq(voipCalls.providerCallId, input.providerCallId))
      .returning({ id: voipCalls.id })

    return { rowsAffected: result.length }
  })
}
