// Business queries for the voip-campaign-contacts entity.
// see ../../DOCS.md for business rules + the membership state model.
// All DAL conventions: see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'

import { and, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { voipCampaignContacts } from '@/shared/db/schema/voip-campaign-contacts'
import { voipCampaigns } from '@/shared/db/schema/voip-campaigns'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'

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
}

export interface ListLeadsArgs {
  status: LeadStatus
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
    const searchWhere = buildSearchWhere(args.search, [customers.name, customers.phone])

    if (args.status === 'enrolled') {
      const baseWhere = and(
        isNull(voipCampaignContacts.unenrolledAt),
        args.sourceSlug ? eq(voipCampaigns.sourceSlug, args.sourceSlug) : undefined,
        args.campaignId ? eq(voipCampaignContacts.voipCampaignId, args.campaignId) : undefined,
        searchWhere,
      )

      return paginate({
        query: () => db
          .select({
            customerId: voipCampaignContacts.customerId,
            name: customers.name,
            status: sql<LeadStatus>`'enrolled'`,
            campaignId: voipCampaignContacts.voipCampaignId,
            campaignName: voipCampaigns.ctCampaignName,
            enrolledAt: voipCampaignContacts.enrolledAt,
            leadSourceId: customers.leadSourceId,
          })
          .from(voipCampaignContacts)
          .innerJoin(voipCampaigns, eq(voipCampaignContacts.voipCampaignId, voipCampaigns.id))
          .innerJoin(customers, eq(voipCampaignContacts.customerId, customers.id))
          .where(baseWhere)
          .orderBy(desc(voipCampaignContacts.enrolledAt))
          .limit(args.limit)
          .offset(args.offset),
        count: async () => {
          const [row] = await db
            .select({ n: count() })
            .from(voipCampaignContacts)
            .innerJoin(voipCampaigns, eq(voipCampaignContacts.voipCampaignId, voipCampaigns.id))
            .innerJoin(customers, eq(voipCampaignContacts.customerId, customers.id))
            .where(baseWhere)
          return row?.n ?? 0
        },
      })
    }

    if (args.status === 'removed') {
      const baseWhere = and(
        isNotNull(voipCampaignContacts.unenrolledAt),
        eq(voipCampaignContacts.unenrollReason, 'removed'),
        args.sourceSlug ? eq(voipCampaigns.sourceSlug, args.sourceSlug) : undefined,
        args.campaignId ? eq(voipCampaignContacts.voipCampaignId, args.campaignId) : undefined,
        searchWhere,
      )

      return paginate({
        query: () => db
          .select({
            customerId: voipCampaignContacts.customerId,
            name: customers.name,
            status: sql<LeadStatus>`'removed'`,
            campaignId: voipCampaignContacts.voipCampaignId,
            campaignName: voipCampaigns.ctCampaignName,
            enrolledAt: voipCampaignContacts.enrolledAt,
            leadSourceId: customers.leadSourceId,
          })
          .from(voipCampaignContacts)
          .innerJoin(voipCampaigns, eq(voipCampaignContacts.voipCampaignId, voipCampaigns.id))
          .innerJoin(customers, eq(voipCampaignContacts.customerId, customers.id))
          .where(baseWhere)
          .orderBy(desc(voipCampaignContacts.unenrolledAt))
          .limit(args.limit)
          .offset(args.offset),
        count: async () => {
          const [row] = await db
            .select({ n: count() })
            .from(voipCampaignContacts)
            .innerJoin(voipCampaigns, eq(voipCampaignContacts.voipCampaignId, voipCampaigns.id))
            .innerJoin(customers, eq(voipCampaignContacts.customerId, customers.id))
            .where(baseWhere)
          return row?.n ?? 0
        },
      })
    }

    if (args.status === 'eligible') {
      // Canonical eligibility gate: leads pipeline + not DNC'd + has phone + has leadSourceId
      // + NOT currently enrolled in any active participation row.
      const NOT_ENROLLED = sql`NOT EXISTS (
        SELECT 1 FROM voip_campaign_contacts vcc
        WHERE vcc.customer_id = ${customers.id}
        AND vcc.unenrolled_at IS NULL
      )`
      const baseWhere = and(
        derivedPipelineWhere(['leads']),
        isNull(customers.dncOptedOutAt),
        isNotNull(customers.phone),
        isNotNull(customers.leadSourceId),
        NOT_ENROLLED,
        args.sourceSlug
          ? sql`EXISTS (
              SELECT 1 FROM lead_sources ls
              WHERE ls.id = ${customers.leadSourceId}
              AND ls.slug = ${args.sourceSlug}
            )`
          : undefined,
        searchWhere,
      )

      return paginate({
        query: () => db
          .select({
            customerId: customers.id,
            name: customers.name,
            status: sql<LeadStatus>`'eligible'`,
            campaignId: sql<null>`NULL`,
            campaignName: sql<null>`NULL`,
            enrolledAt: sql<null>`NULL`,
            leadSourceId: customers.leadSourceId,
          })
          .from(customers)
          .where(baseWhere)
          .orderBy(desc(customers.createdAt))
          .limit(args.limit)
          .offset(args.offset),
        count: () => db.$count(customers, baseWhere),
      })
    }

    // dnc branch — respects the sourceSlug filter (DNC'd customers retain their
    // leadSourceId); campaignId has no meaning here (DNC'd leads aren't enrolled).
    const baseWhere = and(
      isNotNull(customers.dncOptedOutAt),
      args.sourceSlug
        ? sql`EXISTS (
            SELECT 1 FROM lead_sources ls
            WHERE ls.id = ${customers.leadSourceId}
            AND ls.slug = ${args.sourceSlug}
          )`
        : undefined,
      searchWhere,
    )

    return paginate({
      query: () => db
        .select({
          customerId: customers.id,
          name: customers.name,
          status: sql<LeadStatus>`'dnc'`,
          campaignId: sql<null>`NULL`,
          campaignName: sql<null>`NULL`,
          enrolledAt: sql<null>`NULL`,
          leadSourceId: customers.leadSourceId,
        })
        .from(customers)
        .where(baseWhere)
        .orderBy(desc(customers.dncOptedOutAt))
        .limit(args.limit)
        .offset(args.offset),
      count: () => db.$count(customers, baseWhere),
    })
  })
}
