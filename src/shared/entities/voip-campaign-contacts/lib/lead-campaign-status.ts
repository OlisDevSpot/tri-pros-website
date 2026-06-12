import { sql } from 'drizzle-orm'

import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'

// ── Canonical campaign-lead status (single source of truth) ─────────────────
// A customer's relationship to CloudTalk campaigns resolves to exactly ONE
// status. Priority: enrolled > dnc > removed > eligible. Every count, list, and
// filter MUST derive from these fragments — never hand-copy a WHERE clause.
//
// All fragments reference an UNALIASED `customers` table. The query that embeds
// them must use `FROM customers` (not `FROM customers c`) — `derivedPipelineWhere`
// emits literal `"customers"."…"` refs that an alias would hide.

function enrolledExistsSql() {
  return sql`EXISTS (
    SELECT 1 FROM voip_campaign_contacts vcc
    WHERE vcc.customer_id = "customers"."id" AND vcc.unenrolled_at IS NULL
  )`
}

function removedRowExistsSql() {
  return sql`EXISTS (
    SELECT 1 FROM voip_campaign_contacts vcc
    WHERE vcc.customer_id = "customers"."id"
      AND vcc.unenrolled_at IS NOT NULL AND vcc.unenroll_reason = 'removed'
  )`
}

/** Active participation row exists. */
export function isEnrolledSql() {
  return enrolledExistsSql()
}

/** DNC and not currently enrolled (enrolled wins by priority). */
export function isDncSql() {
  return sql`("customers"."dnc_opted_out_at" IS NOT NULL AND NOT ${enrolledExistsSql()})`
}

/** Has a 'removed' row, not enrolled, not DNC (those win by priority). */
export function isRemovedSql() {
  return sql`(${removedRowExistsSql()}
    AND NOT ${enrolledExistsSql()}
    AND "customers"."dnc_opted_out_at" IS NULL)`
}

/**
 * A fresh, actionable lead: in the leads pipeline, has phone + lead source, and
 * has NOT been acted upon (not enrolled, not removed) and is not DNC. This is
 * the canonical enrollment pool — it subtracts enrolled (the bug this fixes).
 */
export function isEligibleSql() {
  return sql`(${derivedPipelineWhere(['leads'])}
    AND "customers"."phone" IS NOT NULL
    AND "customers"."lead_source_id" IS NOT NULL
    AND "customers"."dnc_opted_out_at" IS NULL
    AND NOT ${enrolledExistsSql()}
    AND NOT ${removedRowExistsSql()})`
}

/** Union: any customer with a campaign-relevant status (the 'all' view). */
export function isCampaignLeadSql() {
  return sql`(${isEnrolledSql()} OR ${isDncSql()} OR ${isRemovedSql()} OR ${isEligibleSql()})`
}

/** Single derived status label. Mirrors the priority order above. */
export function leadStatusCaseSql() {
  return sql`CASE
    WHEN ${isEnrolledSql()} THEN 'enrolled'
    WHEN ${isDncSql()} THEN 'dnc'
    WHEN ${isRemovedSql()} THEN 'removed'
    ELSE 'eligible'
  END`
}
