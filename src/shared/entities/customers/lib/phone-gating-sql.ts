import { sql } from 'drizzle-orm'
import { customers } from '@/shared/db/schema/customers'

/**
 * SQL helpers for phone-number gating. Server-only: do not import in client code.
 *
 * Rule enforced here: agents only see a customer's phone once at least one
 * proposal linked to that customer has been sent. Super-admins see it always.
 *
 * Every agent-facing query that exposes `customers.phone` MUST swap the
 * column reference for `gatedPhoneSql(isSuperAdmin)` and include
 * `hasSentProposalSql()` as a `hasSentProposal` field so the client can
 * distinguish "locked" from "empty" when rendering the unlock notice.
 *
 * Consumers that legitimately need the raw phone server-side (GCal push,
 * proposal delivery, email jobs) continue to reference `customers.phone`
 * directly — those paths never reach agent eyes.
 *
 * Implementation note: the correlated subquery references the outer customer
 * as the literal `"customers"."id"` (not `${customers.id}` interpolation),
 * because drizzle's unaliased emission of the outer column becomes just
 * `"id"` inside the subquery — ambiguous with `p.id` / `m.id`. The literal
 * is table-safe since every consumer selects FROM `customers`.
 */

const EXISTS_SENT_PROPOSAL = sql`EXISTS (
  SELECT 1 FROM proposals p
  JOIN meetings m ON m.id = p.meeting_id
  WHERE m.customer_id = "customers"."id" AND p.status = 'sent'
)`

export function hasSentProposalSql() {
  return sql<boolean>`${EXISTS_SENT_PROPOSAL}`
}

export function gatedPhoneSql(isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    return sql<string | null>`${customers.phone}`
  }
  return sql<string | null>`CASE WHEN ${EXISTS_SENT_PROPOSAL} THEN ${customers.phone} ELSE NULL END`
}
