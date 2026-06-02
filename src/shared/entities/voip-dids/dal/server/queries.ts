// Business queries for the voip-dids entity. Custom lookups beyond CRUD.
// see ../../DOCS.md for business rules + the sticky-DID invariant.
// All DAL conventions: see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipDid } from '@/shared/db/schema/voip-dids'

import { and, eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipDids } from '@/shared/db/schema/voip-dids'

/**
 * Resolve the outbound DID an agent should call from. Each agent has at most
 * one DID with `is_primary = TRUE` (enforced by partial unique index). If the
 * primary DID is inactive — or the agent has no primary — returns `null`;
 * the service layer surfaces this as a precondition failure rather than a
 * silent fallback to a shared DID (would mis-attribute calls).
 */
export async function getStickyDidForUser(userId: string): Promise<DalReturn<VoipDid | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(voipDids)
      .where(and(
        eq(voipDids.assignedUserId, userId),
        eq(voipDids.isPrimary, true),
        eq(voipDids.isActive, true),
      ))
      .limit(1)

    return row ?? null
  })
}

/**
 * Resolve a DID by its E.164 number. Used by inbound webhook handlers to
 * map the `To` field on an inbound call/SMS to the owning Tri Pros DID.
 * Returns `null` when no row matches — service layer decides whether to
 * persist with `voipDidId=NULL` (unknown DID) or 404.
 */
export async function getDidByE164(e164: string): Promise<DalReturn<VoipDid | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(voipDids)
      .where(eq(voipDids.e164, e164))
      .limit(1)

    return row ?? null
  })
}

/**
 * Resolve a DID by its provider-side ID (Twilio Phone SID today). Used by
 * webhook handlers when the inbound payload carries the SID but not the E.164
 * (rare — Twilio sends both — but kept for symmetry with admin observability).
 */
export async function getDidByProviderId(providerDidId: string): Promise<DalReturn<VoipDid | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(voipDids)
      .where(eq(voipDids.providerDidId, providerDidId))
      .limit(1)

    return row ?? null
  })
}
