import type { VoipUnenrollReason } from '@/shared/constants/enums/voip'
import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipCampaignContact } from '@/shared/db/schema/voip-campaign-contacts'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipCampaignContacts } from '@/shared/db/schema/voip-campaign-contacts'

interface UpsertEnrolledInput {
  customerId: string
  providerContactId: string
  voipCampaignId: string
  attributeHash: string
}

/** `updatedAt` auto-bumps via `$onUpdate` — do not set it. */
export async function upsertEnrolled(
  input: UpsertEnrolledInput,
): Promise<DalReturn<VoipCampaignContact>> {
  return dalDbOperation(async () => {
    const now = new Date().toISOString()
    const [row] = await db
      .insert(voipCampaignContacts)
      .values({
        customerId: input.customerId,
        providerContactId: input.providerContactId,
        voipCampaignId: input.voipCampaignId,
        enrolledAt: now,
        unenrolledAt: null,
        unenrollReason: null,
        dialAttempts: 0,
        attributeHash: input.attributeHash,
        lastSyncedAt: now,
        lastSyncError: null,
      })
      .onConflictDoUpdate({
        target: voipCampaignContacts.customerId,
        set: {
          providerContactId: input.providerContactId,
          voipCampaignId: input.voipCampaignId,
          enrolledAt: now,
          unenrolledAt: null,
          unenrollReason: null,
          dialAttempts: 0,
          attributeHash: input.attributeHash,
          lastSyncedAt: now,
          lastSyncError: null,
        },
      })
      .returning()

    return row!
  })
}

/** Patches rather than deletes: the row + provider_contact_id persist so re-enroll reuses the same provider contact. */
export async function markUnenrolled(
  customerId: string,
  reason: VoipUnenrollReason,
): Promise<DalReturn<{ rowsAffected: number }>> {
  return dalDbOperation(async () => {
    const now = new Date().toISOString()
    const result = await db
      .update(voipCampaignContacts)
      .set({ unenrolledAt: now, unenrollReason: reason })
      .where(and(
        eq(voipCampaignContacts.customerId, customerId),
        isNull(voipCampaignContacts.unenrolledAt),
      ))
      .returning({ customerId: voipCampaignContacts.customerId })

    return { rowsAffected: result.length }
  })
}

/** Call only after dialerProvider.switchCampaign has moved the provider-side membership. */
export async function repointCampaign(
  input: { customerId: string, toCampaignId: string },
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db
      .update(voipCampaignContacts)
      .set({ voipCampaignId: input.toCampaignId })
      .where(and(
        eq(voipCampaignContacts.customerId, input.customerId),
        isNull(voipCampaignContacts.unenrolledAt),
      ))
  })
}

/** No-op for a never-enrolled customer (no row to attach the error to) — the caller logs as well. */
export async function recordSyncError(
  customerId: string,
  error: string,
): Promise<DalReturn<{ rowsAffected: number }>> {
  return dalDbOperation(async () => {
    const result = await db
      .update(voipCampaignContacts)
      .set({ lastSyncError: error, lastSyncedAt: new Date().toISOString() })
      .where(eq(voipCampaignContacts.customerId, customerId))
      .returning({ customerId: voipCampaignContacts.customerId })

    return { rowsAffected: result.length }
  })
}

/** The dedup IS the increment — one atomic conditional UPDATE; null means a redelivery of an already-counted call_uuid. */
export async function claimAndIncrementDialAttempt(
  customerId: string,
  callUuid: string,
): Promise<DalReturn<{ dialAttempts: number } | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .update(voipCampaignContacts)
      .set({
        dialAttempts: sql`${voipCampaignContacts.dialAttempts} + 1`,
        lastCallUuid: callUuid,
      })
      .where(and(
        eq(voipCampaignContacts.customerId, customerId),
        sql`${voipCampaignContacts.lastCallUuid} IS DISTINCT FROM ${callUuid}`,
      ))
      .returning({ dialAttempts: voipCampaignContacts.dialAttempts })

    return row ? { dialAttempts: row.dialAttempts } : null
  })
}

/** Call only after dialerProvider.sendSms succeeds; the stamp drives the ≤1/day gate. */
export async function recordAutoSmsSent(customerId: string): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db
      .update(voipCampaignContacts)
      .set({
        autoSmsSentCount: sql`${voipCampaignContacts.autoSmsSentCount} + 1`,
        lastAutoSmsAt: new Date().toISOString(),
      })
      .where(eq(voipCampaignContacts.customerId, customerId))
  })
}
