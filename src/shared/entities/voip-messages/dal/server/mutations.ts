// Voip-messages business mutations — operations that don't fit through generic
// CRUD (idempotent upsert + status patches keyed by provider id).
//
// see memory/feedback-services-orchestrate-dal-implements.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipMessage } from '@/shared/db/schema/voip-messages'

import { and, eq, getTableColumns, lt, sql } from 'drizzle-orm'

import { VOIP_MESSAGE_STATUS_RANK } from '@/shared/constants/enums/voip'
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
 * `inserted` is false for a re-delivery, so callers can run their side effects once.
 */
export async function upsertInboundMessage(input: UpsertInboundMessageInput): Promise<DalReturn<VoipMessage & { inserted: boolean }>> {
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
      // xmax is zero only on a row this statement inserted; an updated one carries the updater's transaction id.
      .returning({ ...getTableColumns(voipMessages), inserted: sql<boolean>`(xmax = 0)` })

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

// The row's current rank, from the same table the service ranks the incoming status with.
const currentStatusRank = sql.join([
  sql`CASE ${voipMessages.status}::text`,
  ...Object.entries(VOIP_MESSAGE_STATUS_RANK).map(([status, rank]) => sql`WHEN ${status} THEN ${sql.raw(String(rank))}`),
  sql`ELSE 0 END`,
], sql` `)

/**
 * Apply a delivery-status callback to an outbound message row. No-op when the
 * row isn't found yet (race with our own REST-return patch — eventually
 * consistent) and when the row already holds a later state: a callback never
 * moves a message backwards. Returns rowsAffected so callers can detect both.
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
      .where(and(
        eq(voipMessages.providerMessageId, input.providerMessageId),
        lt(currentStatusRank, VOIP_MESSAGE_STATUS_RANK[input.status]),
      ))
      .returning({ id: voipMessages.id })

    return { rowsAffected: result.length }
  })
}
