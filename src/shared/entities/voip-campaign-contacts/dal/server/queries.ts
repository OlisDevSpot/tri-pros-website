// Business queries for the voip-campaign-contacts entity.
// see ../../DOCS.md for business rules + the membership state model.
// All DAL conventions: see docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { SmsCadence } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { voipCampaignContacts } from '@/shared/db/schema/voip-campaign-contacts'
import { voipCampaigns } from '@/shared/db/schema/voip-campaigns'
import { gatedPhoneSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { isCampaignLeadSql, isDncSql, isEligibleSql, isEnrolledSql, isRemovedSql, leadStatusCaseSql } from '@/shared/entities/voip-campaign-contacts/lib/lead-campaign-status'
import { toDigits } from '@/shared/lib/phone'

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

export interface SmsCadenceContext {
  customerId: string
  unenrolledAt: string | null
  dialAttempts: number
  autoSmsSentCount: number
  lastAutoSmsAt: string | null
  // Customer fields for merge-field rendering + the SMS recipient.
  customerName: string
  customerPhone: string | null
  customerCity: string
  customerState: string
  customerZip: string
  interestedTradesRaw: string[]
  // Campaign cadence config (null when no campaign / unconfigured).
  smsCadence: SmsCadence | null
}

/**
 * One-shot read of everything the SMS-cadence orchestrator needs, keyed on the
 * CloudTalk contact id carried by a call.ended event. Returns null when no
 * participation row carries that CT contact id.
 */
export async function findSmsCadenceContextByCtContactId(
  ctContactId: string,
): Promise<DalReturn<SmsCadenceContext | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({
        customerId: voipCampaignContacts.customerId,
        unenrolledAt: voipCampaignContacts.unenrolledAt,
        dialAttempts: voipCampaignContacts.dialAttempts,
        autoSmsSentCount: voipCampaignContacts.autoSmsSentCount,
        lastAutoSmsAt: voipCampaignContacts.lastAutoSmsAt,
        customerName: customers.name,
        customerPhone: customers.phone,
        customerCity: customers.city,
        customerState: customers.state,
        customerZip: customers.zip,
        leadMetaJSON: customers.leadMetaJSON,
        smsCadence: voipCampaigns.smsCadence,
      })
      .from(voipCampaignContacts)
      .innerJoin(customers, eq(voipCampaignContacts.customerId, customers.id))
      .leftJoin(voipCampaigns, eq(voipCampaignContacts.voipCampaignId, voipCampaigns.id))
      .where(eq(voipCampaignContacts.cloudtalkContactId, ctContactId))
      .limit(1)

    if (!row) {
      return null
    }
    return {
      customerId: row.customerId,
      unenrolledAt: row.unenrolledAt,
      dialAttempts: row.dialAttempts,
      autoSmsSentCount: row.autoSmsSentCount,
      lastAutoSmsAt: row.lastAutoSmsAt,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      customerCity: row.customerCity,
      customerState: row.customerState ?? 'CA',
      customerZip: row.customerZip,
      interestedTradesRaw: row.leadMetaJSON?.interestedTradesRaw ?? [],
      smsCadence: row.smsCadence ?? null,
    }
  })
}

/**
 * Active-enrollment customer ids for a given lead source (anchored to the
 * customer's lead source, not the campaign's sourceSlug). Drives the per-source
 * "Unenroll all" admin action.
 */
export async function listActiveCustomerIdsBySource(
  sourceSlug: string,
): Promise<DalReturn<string[]>> {
  return dalDbOperation(async () => {
    const rows = (await db.execute(sql`
      SELECT customers.id AS "customerId"
      FROM customers
      JOIN lead_sources ls ON ls.id = customers.lead_source_id
      WHERE ls.slug = ${sourceSlug} AND ${isEnrolledSql()}
    `)).rows as { customerId: string }[]
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
 * Active enrolled leads for a lead source (anchored to the customer's lead
 * source, not the campaign's sourceSlug), joined to the customer name +
 * campaign name. Powers the Campaigns Control Center enrolled-leads list.
 * `name` is non-PII (no phone) — safe to surface.
 */
export async function listEnrolledLeadsBySource(
  sourceSlug: string,
): Promise<DalReturn<EnrolledLeadRow[]>> {
  return dalDbOperation(async () => {
    const rows = (await db.execute(sql`
      SELECT
        customers.id AS "customerId",
        customers.name AS name,
        vcc.enrolled_at AS "enrolledAt",
        vc.ct_campaign_name AS "campaignName"
      FROM customers
      JOIN lead_sources ls ON ls.id = customers.lead_source_id
      JOIN voip_campaign_contacts vcc ON vcc.customer_id = customers.id AND vcc.unenrolled_at IS NULL
      LEFT JOIN voip_campaigns vc ON vc.id = vcc.voip_campaign_id
      WHERE ls.slug = ${sourceSlug} AND ${isEnrolledSql()}
      ORDER BY vcc.enrolled_at DESC
    `)).rows as unknown as EnrolledLeadRow[]
    return rows
  })
}

export interface LeadStatusCounts {
  eligible: number
  enrolled: number
  removed: number
  dnc: number
}

/**
 * Per-source, per-status counts in ONE pass — the single source of truth for
 * every rollup badge. Keyed by lead_source_id (uuid). Uses the canonical status
 * CASE so the four numbers always partition that source's campaign-leads.
 */
export async function countLeadsByStatusPerSource(): Promise<DalReturn<Record<string, LeadStatusCounts>>> {
  return dalDbOperation(async () => {
    const rows = (await db.execute(sql`
      SELECT customers.lead_source_id AS "leadSourceId",
             ${leadStatusCaseSql()} AS status,
             COUNT(*)::int AS n
      FROM customers
      WHERE customers.lead_source_id IS NOT NULL AND ${isCampaignLeadSql()}
      GROUP BY customers.lead_source_id, status
    `)).rows as { leadSourceId: string, status: keyof LeadStatusCounts, n: number }[]

    const out: Record<string, LeadStatusCounts> = {}
    for (const row of rows) {
      const bucket = out[row.leadSourceId] ?? { eligible: 0, enrolled: 0, removed: 0, dnc: 0 }
      bucket[row.status] = row.n
      out[row.leadSourceId] = bucket
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
  ctx: ScopedContext,
  args: ListLeadsArgs,
): Promise<DalReturn<{ rows: CampaignLeadRow[], total: number }>> {
  return dalDbOperation(async () => {
    // Phone is gated at the DAL (customers DOCS#phone-visibility-threshold) so a
    // leaked query can't expose it. Today the only caller is superAdminProcedure
    // (isOmni → raw phone), but the gate makes a future scoped caller leak-proof.
    const isOmni = ctx.ability == null || ctx.ability.can('manage', 'all')

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
    // Super-admin-only surface, so raw-phone search is acceptable; if a scoped
    // caller is ever added, gate this ILIKE too (or it leaks phone existence).
    // Phone is stored canonical 10-digit — strip the term to digits so a
    // formatted/E.164 search still matches (see @/shared/lib/phone).
    const searchDigits = args.search ? toDigits(args.search) : ''
    const searchFilter = args.search
      ? sql`AND (customers.name ILIKE ${`%${args.search}%`} OR customers.phone ILIKE ${`%${searchDigits || args.search}%`})`
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
            ${gatedPhoneSql(isOmni)} AS phone,
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
