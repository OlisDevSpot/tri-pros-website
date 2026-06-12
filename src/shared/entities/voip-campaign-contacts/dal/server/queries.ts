// Business queries for the voip-campaign-contacts entity.
// see ../../DOCS.md for business rules + the membership state model.
// All DAL conventions: see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'

import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { voipCampaignContacts } from '@/shared/db/schema/voip-campaign-contacts'
import { voipCampaigns } from '@/shared/db/schema/voip-campaigns'
import { isCampaignLeadSql, isDncSql, isEligibleSql, isEnrolledSql, isRemovedSql, leadStatusCaseSql } from '@/shared/entities/voip-campaign-contacts/lib/lead-campaign-status'

export interface ActiveEnrollment {
  customerId: string
  cloudtalkContactId: string
  voipCampaignId: string | null
  // The membership tag to remove on unenroll — read from the linked campaign.
  // null when the customer's campaign FK is null/dangling (defensive).
  ctMembershipTag: string | null
}

/**
 * Resolve a customer's CURRENTLY-ACTIVE enrollment (row exists AND
 * `unenrolled_at IS NULL`), joined to its campaign so the caller has the
 * membership tag to `removeTags`. Returns null when there's no active row —
 * the unenroll op treats that as a no-op (idempotency).
 */
export async function findActiveEnrollment(
  customerId: string,
): Promise<DalReturn<ActiveEnrollment | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({
        customerId: voipCampaignContacts.customerId,
        cloudtalkContactId: voipCampaignContacts.cloudtalkContactId,
        voipCampaignId: voipCampaignContacts.voipCampaignId,
        ctMembershipTag: voipCampaigns.ctMembershipTag,
      })
      .from(voipCampaignContacts)
      .leftJoin(voipCampaigns, eq(voipCampaignContacts.voipCampaignId, voipCampaigns.id))
      .where(and(
        eq(voipCampaignContacts.customerId, customerId),
        isNull(voipCampaignContacts.unenrolledAt),
      ))
      .limit(1)

    return row ?? null
  })
}

/**
 * Map a CloudTalk contact id → our customer id (via the participation row).
 * Used by the webhook to resolve the customer a CT disposition refers to.
 * Returns null when no row carries that CT contact id.
 */
export async function findCustomerIdByCtContactId(
  cloudtalkContactId: string,
): Promise<DalReturn<{ customerId: string } | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({ customerId: voipCampaignContacts.customerId })
      .from(voipCampaignContacts)
      .where(eq(voipCampaignContacts.cloudtalkContactId, cloudtalkContactId))
      .limit(1)

    return row ?? null
  })
}

/**
 * Active-enrollment customer ids for a given lead source (via the bound
 * campaign). Drives the per-source "Unenroll all" admin action.
 */
export async function listActiveCustomerIdsBySource(
  sourceSlug: string,
): Promise<DalReturn<string[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({ customerId: voipCampaignContacts.customerId })
      .from(voipCampaignContacts)
      .innerJoin(voipCampaigns, eq(voipCampaignContacts.voipCampaignId, voipCampaigns.id))
      .where(and(
        isNull(voipCampaignContacts.unenrolledAt),
        eq(voipCampaigns.sourceSlug, sourceSlug),
      ))
    return rows.map(r => r.customerId)
  })
}

export interface EnrolledLeadRow {
  customerId: string
  name: string
  enrolledAt: string | null
  campaignName: string | null
}

/**
 * Active enrolled leads for a lead source (via the bound campaign), joined to
 * the customer name + campaign name. Powers the Campaigns Control Center
 * enrolled-leads list. `name` is non-PII (no phone) — safe to surface.
 */
export async function listEnrolledLeadsBySource(
  sourceSlug: string,
): Promise<DalReturn<EnrolledLeadRow[]>> {
  return dalDbOperation(async () => {
    return db
      .select({
        customerId: voipCampaignContacts.customerId,
        name: customers.name,
        enrolledAt: voipCampaignContacts.enrolledAt,
        campaignName: voipCampaigns.ctCampaignName,
      })
      .from(voipCampaignContacts)
      .innerJoin(voipCampaigns, eq(voipCampaignContacts.voipCampaignId, voipCampaigns.id))
      .innerJoin(customers, eq(voipCampaignContacts.customerId, customers.id))
      .where(and(
        isNull(voipCampaignContacts.unenrolledAt),
        eq(voipCampaigns.sourceSlug, sourceSlug),
      ))
      .orderBy(desc(voipCampaignContacts.enrolledAt))
  })
}

/**
 * Count active enrollments grouped by the bound campaign's lead source.
 * Drives the per-source enrolled-count badges in the ring-1 admin UI.
 * Only counts rows whose campaign is bound to a source (source_slug NOT NULL).
 */
export async function countActiveEnrollmentsBySource(): Promise<DalReturn<Record<string, number>>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        sourceSlug: voipCampaigns.sourceSlug,
        n: count(),
      })
      .from(voipCampaignContacts)
      .innerJoin(voipCampaigns, eq(voipCampaignContacts.voipCampaignId, voipCampaigns.id))
      .where(isNull(voipCampaignContacts.unenrolledAt))
      .groupBy(voipCampaigns.sourceSlug)

    const out: Record<string, number> = {}
    for (const row of rows) {
      if (row.sourceSlug) {
        out[row.sourceSlug] = row.n
      }
    }
    return out
  })
}

// ── Unified leads list (Campaigns Control Center) ─────────────────────────────

export type LeadStatus = 'eligible' | 'enrolled' | 'removed' | 'dnc'

export interface CampaignLeadRow {
  customerId: string
  name: string
  status: LeadStatus
  campaignId: string | null
  campaignName: string | null
  enrolledAt: string | null
  leadSourceId: string | null
  // ── Enrichment (Q4) ──
  phone: string | null
  leadSourceName: string | null
  dialAttempts: number
  createdAt: string | null
  unenrollReason: string | null
  lastSyncError: string | null
}

export interface ListLeadsArgs {
  status: LeadStatus | 'all'
  sourceSlug?: string
  campaignId?: string
  search?: string
  limit: number
  offset: number
}

/**
 * Unified paginated query powering the Leads tab in the Campaigns Control Center.
 * Returns one status bucket at a time (eligible | enrolled | removed | dnc).
 *
 * - enrolled: active participation rows (unenrolledAt IS NULL), joined to campaign.
 * - removed:  unenrolled rows with reason = 'removed' (neutral pull, re-enrollable).
 * - eligible: customers in the `leads` pipeline, not DNC'd, with a phone + leadSourceId,
 *             with NO active participation row. Canonical gate reused verbatim.
 * - dnc:      customers with dncOptedOutAt IS NOT NULL.
 *
 * see ../../DOCS.md and docs/plans/voip-campaigns/EPIC.md
 */
export async function listLeadsPaginated(
  args: ListLeadsArgs,
): Promise<DalReturn<{ rows: CampaignLeadRow[], total: number }>> {
  return dalDbOperation(async () => {
    const statusPredicate
      = args.status === 'all'
        ? isCampaignLeadSql()
        : args.status === 'enrolled'
          ? isEnrolledSql()
          : args.status === 'dnc'
            ? isDncSql()
            : args.status === 'removed'
              ? isRemovedSql()
              : isEligibleSql()

    const sourceFilter = args.sourceSlug
      ? sql`AND ls.slug = ${args.sourceSlug}`
      : sql``
    const campaignFilter = args.campaignId
      ? sql`AND part.voip_campaign_id = ${args.campaignId}`
      : sql``
    const searchFilter = args.search
      ? sql`AND (customers.name ILIKE ${`%${args.search}%`} OR customers.phone ILIKE ${`%${args.search}%`})`
      : sql``

    // `customers` is UNALIASED on purpose — the status predicates embed
    // derivedPipelineWhere's literal "customers"."…" refs, which an alias hides.
    // `part` LATERAL provides the display fields (campaign, attempts, etc.) for
    // the customer's most-relevant participation row.
    const fromAndWhere = sql`
      FROM customers
      LEFT JOIN lead_sources ls ON ls.id = customers.lead_source_id
      LEFT JOIN LATERAL (
        SELECT vcc.voip_campaign_id, vcc.enrolled_at, vcc.unenrolled_at,
               vcc.unenroll_reason, vcc.dial_attempts, vcc.last_sync_error
        FROM voip_campaign_contacts vcc
        WHERE vcc.customer_id = customers.id
        ORDER BY (vcc.unenrolled_at IS NULL) DESC, vcc.enrolled_at DESC NULLS LAST
        LIMIT 1
      ) part ON TRUE
      LEFT JOIN voip_campaigns vc ON vc.id = part.voip_campaign_id
      WHERE customers.lead_source_id IS NOT NULL AND ${statusPredicate}
      ${sourceFilter}
      ${campaignFilter}
      ${searchFilter}
    `

    return paginate({
      query: async () => {
        const result = await db.execute(sql`
          SELECT
            customers.id AS "customerId",
            customers.name AS name,
            ${leadStatusCaseSql()} AS status,
            part.voip_campaign_id AS "campaignId",
            vc.ct_campaign_name AS "campaignName",
            part.enrolled_at AS "enrolledAt",
            customers.lead_source_id AS "leadSourceId",
            customers.phone AS phone,
            ls.name AS "leadSourceName",
            COALESCE(part.dial_attempts, 0) AS "dialAttempts",
            customers.created_at AS "createdAt",
            part.unenroll_reason AS "unenrollReason",
            part.last_sync_error AS "lastSyncError"
          ${fromAndWhere}
          ORDER BY customers.created_at DESC
          LIMIT ${args.limit} OFFSET ${args.offset}
        `)
        return result.rows as unknown as CampaignLeadRow[]
      },
      count: async () => {
        const result = await db.execute(sql`SELECT COUNT(*)::int AS n ${fromAndWhere}`)
        return (result.rows[0] as { n: number } | undefined)?.n ?? 0
      },
    })
  })
}
