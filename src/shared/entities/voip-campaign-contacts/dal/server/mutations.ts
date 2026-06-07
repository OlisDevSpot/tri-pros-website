// voip-campaign-contacts business mutations — enrollment membership writes that
// don't fit generic CRUD (idempotent enroll upsert + idempotent unenroll patch).
// The enrollment service calls these; never reach for `db.insert/update` from a
// service layer.
//
// State model (see ../../DOCS.md):
//   - Enrolled now = row exists AND unenrolled_at IS NULL.
//   - Re-enroll reuses the same row + cloudtalk_contact_id (clears unenrolled_at
//     + reason, resets dial_attempts, sets a fresh enrolled_at + campaign).
//
// see docs/codebase-conventions/dal-conventions.md
// see memory/feedback-services-orchestrate-dal-implements.md

import type { VoipUnenrollReason } from '@/shared/constants/enums/voip'
import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipCampaignContact } from '@/shared/db/schema/voip-campaign-contacts'

import { and, eq, isNull } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipCampaignContacts } from '@/shared/db/schema/voip-campaign-contacts'

interface UpsertEnrolledInput {
  customerId: string
  cloudtalkContactId: string
  voipCampaignId: string
  attributeHash: string
}

/**
 * Idempotent enroll upsert keyed on the PK `customer_id`. Insert path = first
 * enroll; conflict path = re-enroll (clears the prior unenroll, resets the dial
 * counter, points at the possibly-new campaign). Sets `enrolled_at = now`,
 * `unenrolled_at = NULL`, `unenroll_reason = NULL`.
 *
 * `updatedAt` auto-bumps via the schema-helper `$onUpdate` — do not set it.
 */
export async function upsertEnrolled(
  input: UpsertEnrolledInput,
): Promise<DalReturn<VoipCampaignContact>> {
  return dalDbOperation(async () => {
    const now = new Date().toISOString()
    const [row] = await db
      .insert(voipCampaignContacts)
      .values({
        customerId: input.customerId,
        cloudtalkContactId: input.cloudtalkContactId,
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
          cloudtalkContactId: input.cloudtalkContactId,
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

/**
 * Idempotent unenroll patch — sets `unenrolled_at = now` + `unenroll_reason`
 * ONLY on a currently-active row (`unenrolled_at IS NULL`). Returns
 * `rowsAffected` so the caller can detect the no-op case (already unenrolled,
 * or never enrolled). The row + cloudtalk_contact_id persist for re-enroll.
 */
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

/**
 * Atomically re-point an active enrollment to a different campaign. Updates
 * ONLY the `voip_campaign_id` FK on the currently-active row
 * (`unenrolled_at IS NULL`). Caller must have already swapped the membership
 * tags on CloudTalk (removeTags old → addTags new) before calling this.
 * Returns `void`; the service detects the no-op case upstream.
 *
 * `updatedAt` auto-bumps via the schema-helper `$onUpdate` — do not set it.
 */
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

/**
 * Record a per-customer sync error (used by the bulk enroll-all job when a
 * single customer's CT push fails). No-op when the row doesn't exist yet —
 * a never-enrolled customer has nowhere to attach the error, so the caller
 * also logs. Returns `rowsAffected`.
 */
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
