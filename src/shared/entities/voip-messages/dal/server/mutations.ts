// Voip-messages business mutations — operations that don't fit through generic
// CRUD (idempotent upsert + status patches keyed by provider id).
//
// see ../../DOCS.md for invariants (composite thread key, STOP-routing path)
// see docs/codebase-conventions/dal-conventions.md
// see memory/feedback-services-orchestrate-dal-implements.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipMessage } from '@/shared/db/schema/voip-messages'

import { eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipMessages } from '@/shared/db/schema/voip-messages'

interface UpsertInboundMessageInput {
  providerMessageId: string
  voipDidId: string | null
  customerId: string | null
  remoteE164: string
  body: string
}

/**
 * Idempotent upsert for inbound messages — keyed on the unique
 * `provider_message_id`. Webhook re-deliveries hit the conflict branch and
 * re-assert the inbound fields. `updatedAt` auto-bumps via $onUpdate.
 */
export async function upsertInboundMessage(input: UpsertInboundMessageInput): Promise<DalReturn<VoipMessage>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .insert(voipMessages)
      .values({
        providerMessageId: input.providerMessageId,
        voipDidId: input.voipDidId,
        customerId: input.customerId,
        remoteE164: input.remoteE164,
        body: input.body,
        direction: 'inbound',
        status: 'received',
      })
      .onConflictDoUpdate({
        target: voipMessages.providerMessageId,
        set: {
          voipDidId: input.voipDidId,
          customerId: input.customerId,
          remoteE164: input.remoteE164,
          body: input.body,
        },
      })
      .returning()

    return row!
  })
}

interface PatchMessageStatusByProviderIdInput {
  providerMessageId: string
  status: VoipMessage['status']
  // Caller supplies event timestamps explicitly (see voip-calls/mutations.ts
  // patchCallStatusByProviderId for the rationale).
  deliveredAt?: string
  failedAt?: string
  failureReason?: string
}

/**
 * Apply a delivery-status callback to an outbound message row. No-op when the
 * row isn't found yet (race with our own REST-return patch — eventually
 * consistent). Returns rowsAffected so callers can detect the no-op case.
 */
export async function patchMessageStatusByProviderId(
  input: PatchMessageStatusByProviderIdInput,
): Promise<DalReturn<{ rowsAffected: number }>> {
  return dalDbOperation(async () => {
    const result = await db
      .update(voipMessages)
      .set({
        status: input.status,
        deliveredAt: input.deliveredAt,
        failedAt: input.failedAt,
        failureReason: input.failureReason,
      })
      .where(eq(voipMessages.providerMessageId, input.providerMessageId))
      .returning({ id: voipMessages.id })

    return { rowsAffected: result.length }
  })
}
