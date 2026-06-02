import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { VoipDid } from '@/shared/db/schema/voip-dids'

import { and, eq, ne } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { dalError, dalSuccess, SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { voipDids } from '@/shared/db/schema/voip-dids'
import { voipDidCrud } from '@/shared/entities/voip-dids/dal/server/crud'
import { getDidByE164, getDidByProviderId, getStickyDidForUser } from '@/shared/entities/voip-dids/dal/server/queries'
import { twilioClient } from '@/shared/services/providers/twilio/client'

// ---------------------------------------------------------------------------
// voipDidsService — manages the agent-to-DID assignment lifecycle and the
// admin "resync from Twilio" mutation.
//
// Invariants enforced here (NOT at the DAL level — DAL is generic CRUD):
//   - At most one DID per agent has `is_primary = TRUE`. The partial unique
//     index on `voip_dids(assigned_user_id) WHERE is_primary = TRUE` would
//     also enforce this, but a transactional flip keeps the window where
//     two rows are simultaneously TRUE down to zero ms.
//   - First DID assigned to an agent auto-becomes primary. Subsequent DIDs
//     default to FALSE; admin must explicitly call `markPrimary` to switch.
//   - Unassignment clears both `assigned_user_id` AND `is_primary` together.
//
// see src/shared/entities/voip-dids/DOCS.md (1:N cardinality rationale)
// see docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS (2026-05-30)
// ---------------------------------------------------------------------------

interface AssignDidInput {
  // DID being assigned (internal voip_dids.id).
  didId: string
  // The agent receiving the DID. The first assignment auto-becomes primary;
  // subsequent assignments default to non-primary.
  userId: string
}

interface MarkPrimaryInput {
  // The DID to mark primary. Must already be assigned to a user (no-op
  // otherwise). All OTHER DIDs assigned to the same user are demoted to
  // is_primary=FALSE in the same transaction.
  didId: string
}

interface UnassignDidInput {
  // The DID being unassigned. Both `assigned_user_id` and `is_primary`
  // clear together; the DID becomes shared / inbound-only.
  didId: string
}

interface ResyncFromTwilioInput {
  // Optional: limit the resync to a specific provider DID SID. Useful when
  // troubleshooting a single number; omit for a full account sweep.
  providerDidId?: string
}

interface ResyncFromTwilioResult {
  // Provider DIDs that already had a matching row — `cnamDisplayName` /
  // `e164` were patched if they drifted from Twilio.
  updated: number
  // Provider DIDs that had no local row — created with `assigned_user_id=NULL`
  // (admin must explicitly assign them via the UI).
  created: number
  // Provider DIDs that exist locally but were NOT in Twilio's response.
  // These are flagged inactive (`is_active=FALSE`) rather than deleted —
  // historical voip_calls / voip_messages keep their FK pointing at them.
  deactivated: number
}

function createVoipDidsService() {
  return {
    /**
     * Assign a DID to an agent. If the agent has NO existing assigned DIDs,
     * the new one auto-becomes primary. Otherwise it lands as non-primary;
     * admin uses `markPrimary` to flip explicitly.
     */
    assignDidToUser: async (
      ctx: ScopedContext,
      input: AssignDidInput,
    ): Promise<DalReturn<VoipDid>> => {
      return dalDbOperation(async () => {
        return db.transaction(async (tx) => {
          // Check if user has any existing primary DID. If not, this becomes
          // their primary. (Cheap; partial unique index guarantees at most 1.)
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
            throw new Error('voip-dids.assignDidToUser: DID not found')
          }
          return row
        })
      })
    },

    /**
     * Mark a DID primary for its owning agent. Transactional flip — demotes
     * all OTHER assigned DIDs for the same user in the same statement.
     */
    markPrimary: async (
      ctx: ScopedContext,
      input: MarkPrimaryInput,
    ): Promise<DalReturn<VoipDid>> => {
      return dalDbOperation(async () => {
        return db.transaction(async (tx) => {
          // Resolve the assigned user from the DID first.
          const [target] = await tx
            .select({ assignedUserId: voipDids.assignedUserId })
            .from(voipDids)
            .where(eq(voipDids.id, input.didId))
            .limit(1)

          if (!target) {
            throw new Error('voip-dids.markPrimary: DID not found')
          }
          if (!target.assignedUserId) {
            throw new Error('voip-dids.markPrimary: cannot promote unassigned DID')
          }

          // Demote all other primaries for this user in one statement.
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
            throw new Error('voip-dids.markPrimary: DID disappeared mid-transaction')
          }
          return row
        })
      })
    },

    /**
     * Unassign a DID — clears `assigned_user_id` AND `is_primary` together.
     * The DID becomes shared (inbound-only via shared queue + no outbound
     * owner). Existing call / message history rows keep their FK pointer.
     */
    unassignDid: async (
      ctx: ScopedContext,
      input: UnassignDidInput,
    ): Promise<DalReturn<VoipDid>> => {
      return dalDbOperation(async () => {
        const [row] = await db
          .update(voipDids)
          .set({ assignedUserId: null, isPrimary: false })
          .where(eq(voipDids.id, input.didId))
          .returning()

        if (!row) {
          throw new Error('voip-dids.unassignDid: DID not found')
        }
        return row
      })
    },

    /**
     * Admin "Resync DIDs from Twilio" mutation. Reads the live Twilio account
     * via `twilioClient.listIncomingPhoneNumbers`, reconciles against our
     * voip_dids table, and reports counts.
     *
     * Numbers are PURCHASED via the Twilio console, never programmatically.
     * This is read-only-from-Twilio + write-to-our-DB sync.
     */
    resyncFromTwilio: async (
      _ctx: ScopedContext,
      input: ResyncFromTwilioInput = {},
    ): Promise<DalReturn<ResyncFromTwilioResult>> => {
      return dalDbOperation(async () => {
        // 1. Fetch live numbers from Twilio. Single number mode for targeted
        // reconciliation, otherwise full account sweep.
        const liveNumbers = input.providerDidId
          ? [await twilioClient.fetchIncomingPhoneNumber(input.providerDidId)]
          : await twilioClient.listIncomingPhoneNumbers()

        // 2. Load matching local rows in one go.
        const liveSids = new Set(liveNumbers.map(n => n.sid))
        const localRows = await db
          .select()
          .from(voipDids)

        const localBySid = new Map(localRows.map(r => [r.providerDidId, r]))

        let updated = 0
        let created = 0

        for (const live of liveNumbers) {
          const localRow = localBySid.get(live.sid)
          if (localRow) {
            // Patch drifted fields. CNAM display name is the most-likely
            // drift target (admin renames in Twilio console).
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
            // New DID Twilio knows about; create unassigned.
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

        // 3. Deactivate local rows missing from Twilio (e.g., released
        // numbers). We don't delete — historical FKs need to resolve.
        // Skip this step when input.providerDidId was set (single-number
        // mode shouldn't deactivate everything else).
        let deactivated = 0
        if (!input.providerDidId) {
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
    },

    // -----------------------------------------------------------------------
    // Read-side passthrough — services + route handlers call these instead of
    // importing the DAL queries directly, keeping the service layer the
    // canonical surface for voip-dids reads from outside the entity dir.
    // -----------------------------------------------------------------------

    getStickyDidForUser: (userId: string): Promise<DalReturn<VoipDid | null>> => {
      return getStickyDidForUser(userId)
    },

    getDidByE164: (e164: string): Promise<DalReturn<VoipDid | null>> => {
      return getDidByE164(e164)
    },

    getDidByProviderId: (providerDidId: string): Promise<DalReturn<VoipDid | null>> => {
      return getDidByProviderId(providerDidId)
    },

    /**
     * System-scope fetch — bypasses CASL. For webhook handlers that resolve
     * a DID without an attached user session.
     */
    getDidByIdSystem: async (didId: string): Promise<DalReturn<VoipDid | undefined>> => {
      return voipDidCrud.getById(SYSTEM_CONTEXT, { id: didId })
    },

    /**
     * Refuse outbound when the agent has no primary DID. Convenience wrapper
     * for routes that just need a yes/no — `placeAgentCall` and `sendSms`
     * already do this internally; this surfaces the same gate for UI use
     * ("Show call button?" / "Show SMS compose?").
     */
    canAgentOutbound: async (userId: string): Promise<DalReturn<boolean>> => {
      const result = await getStickyDidForUser(userId)
      if (!result.success) {
        return result
      }
      return dalSuccess(result.data !== null)
    },

    /**
     * Refuse outbound capability checks that need the DID details too —
     * routes that render "call as +1...XYZ" want the actual e164.
     */
    requireStickyDid: async (userId: string): Promise<DalReturn<VoipDid>> => {
      const result = await getStickyDidForUser(userId)
      if (!result.success) {
        return result
      }
      if (!result.data) {
        return dalError({
          type: 'precondition-failed',
          reason: 'agent has no active primary DID',
        })
      }
      return dalSuccess(result.data)
    },
  }
}

/**
 * Single-instance voipDidsService — manages the DID assignment lifecycle and
 * Twilio-account reconciliation. Outbound services (calls, messages) read
 * the sticky DID through this surface; admin UI (Phase 2+) mutates through it.
 */
export const voipDidsService = createVoipDidsService()
