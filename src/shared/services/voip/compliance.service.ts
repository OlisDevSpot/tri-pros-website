import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { toNationalDigits } from '@/shared/lib/phone'

// Compliance service — owner of the shared canonical DNC registry decorating
// the `customers` row. Both voip-in-house (Twilio) and voip-campaigns (CloudTalk)
// gate outbound through `canOutboundTo` and INSERT through `addToDnc`.
//
// see docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS (2026-05-30)
// see docs/plans/voip/INTEGRATION-SEAM.md §5 (DNC propagation)
// see CONTEXT.md (DNC section)

export type DncReason
  = | 'customer_request' // live ask on a call
    | 'stop_keyword' // SMS STOP/UNSUB (Twilio or CloudTalk)
    | 'admin' // admin clicks "Add to DNC" in UI
    | 'ftc' // FTC DNC list scrub (Phase 2+ cron)

export interface AddToDncInput {
  customerId: string
  reason: DncReason
  addedByUserId?: string | null
}

export interface RemoveFromDncInput {
  customerId: string
}

function createComplianceService() {
  return {
    /**
     * Predicate: is it safe to outbound to this E.164 phone number?
     *
     * Returns false if ANY customer row with this phone has `dncOptedOutAt` set.
     * Customers can share phones (rare but possible — household members) so
     * one DNC-flagged row protects the number entirely.
     *
     * Phase 1 only checks the local customers table. FTC DNC scrub (Phase 2+)
     * will pre-populate `dncOptedOutAt` for matching customers via the
     * ftcScrubBatch cron, so this single predicate stays the contact gate.
     */
    canOutboundTo: async (phoneE164: string): Promise<boolean> => {
      // customers.phone is stored canonical 10-digit — normalize the lookup so
      // an E.164 input still matches a DNC'd row (see @/shared/lib/phone).
      const national = toNationalDigits(phoneE164)
      if (!national) {
        return true // unparseable number can't match any customer row → no DNC block
      }
      const [row] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.phone, national), isNotNull(customers.dncOptedOutAt)))
        .limit(1)

      return row === undefined
    },

    /**
     * Mark a customer as opted-out. Idempotent — re-calling on an already-DNC'd
     * customer is a no-op (we don't overwrite the original opt-out timestamp).
     *
     * Cross-system propagation to CloudTalk (push contact to CT do-not-call list)
     * is voip-campaigns Phase 1 work — wired via INTEGRATION-SEAM.md §5.
     */
    addToDnc: async (input: AddToDncInput): Promise<void> => {
      await db
        .update(customers)
        .set({
          dncOptedOutAt: sql`NOW()`,
          dncReason: input.reason,
          dncAddedByUserId: input.addedByUserId ?? null,
        })
        .where(and(eq(customers.id, input.customerId), isNull(customers.dncOptedOutAt)))
    },

    /**
     * Admin-only: clear DNC status. Use sparingly — only when a customer
     * explicitly opts back in (typically via written request).
     */
    removeFromDnc: async (input: RemoveFromDncInput): Promise<void> => {
      await db
        .update(customers)
        .set({
          dncOptedOutAt: null,
          dncReason: null,
          dncAddedByUserId: null,
        })
        .where(eq(customers.id, input.customerId))
    },

    /**
     * Phase 2+ cron — fetch FTC DNC list and mark matching customers.
     * Stub for now; real implementation lands when the FTC SAN is issued and
     * the scrub provider is wired (see docs/plans/voip-in-house/phase-1-mvp.md
     * Task 14 — gated, not blocking Phase 1).
     */
    ftcScrubBatch: async (): Promise<{ scrubbedCount: number }> => {
      throw new Error('compliance.ftcScrubBatch: not yet implemented (Phase 2+, gated on FTC SAN issuance)')
    },
  }
}

export const complianceService = createComplianceService()
