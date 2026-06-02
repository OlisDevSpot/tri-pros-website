// Voip-dids business mutations — assignment lifecycle (assignment / promotion /
// unassignment) and provider-reconciliation.
//
// see ../../DOCS.md for invariants (one primary per agent, partial unique index)
// see docs/codebase-conventions/dal-conventions.md
// see memory/feedback-services-orchestrate-dal-implements.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { VoipDid } from '@/shared/db/schema/voip-dids'
import type { IncomingPhoneNumberInstance } from '@/shared/services/providers/twilio/types'

import { and, eq, ne } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipDids } from '@/shared/db/schema/voip-dids'

interface AssignToUserInput {
  didId: string
  userId: string
}

/**
 * Assign a DID to a user. First DID assigned to an agent auto-becomes primary;
 * subsequent ones default to non-primary. Transactional to avoid a race where
 * two parallel assignments both think they're the first.
 */
export async function assignToUser(input: AssignToUserInput): Promise<DalReturn<VoipDid>> {
  return dalDbOperation(async () => {
    return db.transaction(async (tx) => {
      const [existingPrimary] = await tx
        .select({ id: voipDids.id })
        .from(voipDids)
        .where(and(
          eq(voipDids.assignedUserId, input.userId),
          eq(voipDids.isPrimary, true),
        ))
        .limit(1)

      const shouldBecomePrimary = !existingPrimary

      const [row] = await tx
        .update(voipDids)
        .set({
          assignedUserId: input.userId,
          isPrimary: shouldBecomePrimary,
        })
        .where(eq(voipDids.id, input.didId))
        .returning()

      if (!row) {
        throw new Error('voip-dids.assignToUser: DID not found')
      }
      return row
    })
  })
}

interface PromoteToPrimaryInput {
  didId: string
}

/**
 * Promote a DID to primary for its owning agent. Demotes all other primaries
 * for that agent in the same transaction (the partial unique index enforces
 * the invariant at the DB level; the transaction window keeps the period of
 * "two true" down to zero microseconds).
 */
export async function promoteToPrimary(input: PromoteToPrimaryInput): Promise<DalReturn<VoipDid>> {
  return dalDbOperation(async () => {
    return db.transaction(async (tx) => {
      const [target] = await tx
        .select({ assignedUserId: voipDids.assignedUserId })
        .from(voipDids)
        .where(eq(voipDids.id, input.didId))
        .limit(1)

      if (!target) {
        throw new Error('voip-dids.promoteToPrimary: DID not found')
      }
      if (!target.assignedUserId) {
        throw new Error('voip-dids.promoteToPrimary: cannot promote unassigned DID')
      }

      // Demote all other primaries for this user.
      await tx
        .update(voipDids)
        .set({ isPrimary: false })
        .where(and(
          eq(voipDids.assignedUserId, target.assignedUserId),
          ne(voipDids.id, input.didId),
          eq(voipDids.isPrimary, true),
        ))

      // Promote the target.
      const [row] = await tx
        .update(voipDids)
        .set({ isPrimary: true })
        .where(eq(voipDids.id, input.didId))
        .returning()

      if (!row) {
        throw new Error('voip-dids.promoteToPrimary: DID disappeared mid-transaction')
      }
      return row
    })
  })
}

interface UnassignInput {
  didId: string
}

/**
 * Unassign a DID — clears `assigned_user_id` and `is_primary` together.
 * The DID becomes shared / inbound-only. Existing call + message history
 * rows keep their FK pointer.
 */
export async function unassign(input: UnassignInput): Promise<DalReturn<VoipDid>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .update(voipDids)
      .set({ assignedUserId: null, isPrimary: false })
      .where(eq(voipDids.id, input.didId))
      .returning()

    if (!row) {
      throw new Error('voip-dids.unassign: DID not found')
    }
    return row
  })
}

interface ReconcileWithProviderInput {
  // Live numbers fetched from Twilio. Service supplies these — the DAL just
  // diffs against the local table, so this remains provider-agnostic at the
  // DAL boundary (no Twilio import beyond the type-only IncomingPhoneNumberInstance).
  liveNumbers: IncomingPhoneNumberInstance[]
  // When true, deactivate local rows that aren't in `liveNumbers`. Set false
  // for single-SID reconcile mode (caller passed one live number, doesn't
  // want everything else flagged inactive).
  enableDeactivationSweep: boolean
}

interface ReconcileWithProviderResult {
  updated: number
  created: number
  deactivated: number
}

/**
 * Reconcile local voip_dids rows against a list of live provider numbers.
 *
 *   - Live + local matches: patch drifted fields (e164, cnamDisplayName).
 *   - Live without local match: create unassigned row.
 *   - Local without live match: deactivate (`is_active=FALSE`); never delete
 *     (historical FKs from voip_calls / voip_messages need to resolve).
 *
 * `enableDeactivationSweep=false` for single-SID reconciliation.
 */
export async function reconcileWithProvider(
  input: ReconcileWithProviderInput,
): Promise<DalReturn<ReconcileWithProviderResult>> {
  return dalDbOperation(async () => {
    const liveSids = new Set(input.liveNumbers.map(n => n.sid))
    const localRows = await db.select().from(voipDids)
    const localBySid = new Map(localRows.map(r => [r.providerDidId, r]))

    let updated = 0
    let created = 0

    for (const live of input.liveNumbers) {
      const localRow = localBySid.get(live.sid)
      if (localRow) {
        const driftedE164 = localRow.e164 !== live.phoneNumber
        const driftedCnam = (localRow.cnamDisplayName ?? '') !== (live.friendlyName ?? '')
        if (driftedE164 || driftedCnam) {
          await db
            .update(voipDids)
            .set({
              e164: live.phoneNumber,
              cnamDisplayName: live.friendlyName,
              isActive: true,
            })
            .where(eq(voipDids.id, localRow.id))
          updated++
        }
      }
      else {
        await db
          .insert(voipDids)
          .values({
            e164: live.phoneNumber,
            providerDidId: live.sid,
            cnamDisplayName: live.friendlyName,
            isActive: true,
            isPrimary: false,
          })
        created++
      }
    }

    let deactivated = 0
    if (input.enableDeactivationSweep) {
      for (const local of localRows) {
        if (!liveSids.has(local.providerDidId) && local.isActive) {
          await db
            .update(voipDids)
            .set({ isActive: false })
            .where(eq(voipDids.id, local.id))
          deactivated++
        }
      }
    }

    return { updated, created, deactivated }
  })
}
