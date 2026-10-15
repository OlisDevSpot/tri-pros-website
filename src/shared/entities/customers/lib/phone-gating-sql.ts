import { sql } from 'drizzle-orm'
import { customers } from '@/shared/db/schema/customers'

/**
 * SQL helpers for phone-number gating. Server-only.
 * Rule: agents see phone once a proposal is sent OR later (sent | approved).
 * Omni/leads-pool/trusted callers see it ungated (see `canSeeUngatedPhone` in `phone-access.ts`).
 *
 * Agent-facing queries that expose `customers.phone` MUST swap the column for
 * `gatedPhoneSql(canSeeUngatedPhone(ctx.actor.ability))` and include
 * `hasSentProposalSql(ability.can('read', 'Proposal'))` so the client can distinguish "locked" from "empty"
 * in the unlock-notice render.
 * Server-side raw-phone consumers (GCal push, proposal delivery, email jobs)
 * reference `customers.phone` directly — those paths never reach agent eyes.
 *
 * Subquery references outer customer as literal `"customers"."id"` (not
 * `${customers.id}` interpolation), because drizzle's unaliased emission
 * becomes just `"id"` inside the subquery — ambiguous with `p.id` / `m.id`.
 * Table-safe since every consumer selects FROM `customers`.
 */

// Threshold (not equality): once a proposal reaches `sent`, it stays unlocked
// even after it transitions to `approved`. `declined` and `draft` don't count.
const EXISTS_SENT_PROPOSAL = sql`EXISTS (
  SELECT 1 FROM proposals p
  JOIN meetings m ON m.id = p.meeting_id
  WHERE m.customer_id = "customers"."id" AND p.status IN ('sent', 'approved')
)`

// Whether a proposal went out is proposal state: a caller who reads no proposals is told none did.
export function hasSentProposalSql(readsProposals: boolean) {
  return readsProposals ? sql<boolean>`${EXISTS_SENT_PROPOSAL}` : sql<boolean>`false`
}

export function gatedPhoneSql(canSeeUngated: boolean) {
  if (canSeeUngated) {
    return sql<string | null>`${customers.phone}`
  }
  return sql<string | null>`CASE WHEN ${EXISTS_SENT_PROPOSAL} THEN ${customers.phone} ELSE NULL END`
}
