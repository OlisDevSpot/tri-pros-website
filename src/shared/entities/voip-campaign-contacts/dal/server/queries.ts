import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { SmsCadence } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { db } from '@/shared/db'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customers } from '@/shared/db/schema/customers'
import { voipCampaignContacts } from '@/shared/db/schema/voip-campaign-contacts'
import { voipCampaigns } from '@/shared/db/schema/voip-campaigns'
import { canSeeUngatedPhone, gatedPhoneSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { isCampaignLeadSql, isDncSql, isEligibleSql, isEnrolledSql, isRemovedSql, leadStatusCaseSql } from '@/shared/entities/voip-campaign-contacts/lib/lead-campaign-status'
import { toDigits } from '@/shared/lib/phone'

export interface ActiveEnrollment {
  customerId: string
  providerContactId: string
  voipCampaignId: string | null
  // null when the campaign FK is null or dangling.
  providerCampaignId: string | null
}

export async function findActiveEnrollment(
  customerId: string,
): Promise<DalReturn<ActiveEnrollment | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({
        customerId: voipCampaignContacts.customerId,
        providerContactId: voipCampaignContacts.providerContactId,
        voipCampaignId: voipCampaignContacts.voipCampaignId,
        providerCampaignId: voipCampaigns.providerCampaignId,
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

export async function findCustomerIdByProviderContactId(
  providerContactId: string,
): Promise<DalReturn<{ customerId: string } | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({ customerId: voipCampaignContacts.customerId })
      .from(voipCampaignContacts)
      .where(eq(voipCampaignContacts.providerContactId, providerContactId))
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
  customerName: string
  customerPhone: string | null
  customerCity: string
  customerState: string
  customerZip: string
  interestedTradesRaw: string[]
  // null when no campaign or unconfigured.
  smsCadence: SmsCadence | null
}

export async function findSmsCadenceContextByProviderContactId(
  providerContactId: string,
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
        captureJSON: customerLeadAttribution.captureJSON,
        smsCadence: voipCampaigns.smsCadence,
      })
      .from(voipCampaignContacts)
      .innerJoin(customers, eq(voipCampaignContacts.customerId, customers.id))
      .leftJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
      .leftJoin(voipCampaigns, eq(voipCampaignContacts.voipCampaignId, voipCampaigns.id))
      .where(eq(voipCampaignContacts.providerContactId, providerContactId))
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
      interestedTradesRaw: row.captureJSON?.interestedTradesRaw ?? [],
      smsCadence: row.smsCadence ?? null,
    }
  })
}

/** Anchored to the customer's lead source, not the campaign's sourceSlug. */
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

/** Anchored to the customer's lead source, not the campaign's sourceSlug. Returns no phone, so safe to surface. */
export async function listEnrolledLeadsBySource(
  sourceSlug: string,
): Promise<DalReturn<EnrolledLeadRow[]>> {
  return dalDbOperation(async () => {
    const rows = (await db.execute(sql`
      SELECT
        customers.id AS "customerId",
        customers.name AS name,
        vcc.enrolled_at AS "enrolledAt",
        vc.provider_campaign_name AS "campaignName"
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

/** Keyed by lead_source_id. The canonical status CASE guarantees the four counts partition the source's campaign leads. */
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

export type LeadStatus = 'eligible' | 'enrolled' | 'removed' | 'dnc'

export interface CampaignLeadRow {
  customerId: string
  name: string
  status: LeadStatus
  campaignId: string | null
  campaignName: string | null
  enrolledAt: string | null
  leadSourceId: string | null
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

export async function listLeadsPaginated(
  ctx: ScopedContext,
  args: ListLeadsArgs,
): Promise<DalReturn<{ rows: CampaignLeadRow[], total: number }>> {
  return dalDbOperation(async () => {
    // Phone is gated here, not at the router, so a future scoped caller is leak-proof by construction.
    const canSeeUngated = canSeeUngatedPhone(ctx.actor.ability)

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
    // Raw-phone search is acceptable only because callers are super-admin; a scoped caller would need this ILIKE gated too.
    // Phone is stored as bare 10 digits, so the term is stripped to digits for formatted/E.164 input to match.
    const searchDigits = args.search ? toDigits(args.search) : ''
    const searchFilter = args.search
      ? sql`AND (customers.name ILIKE ${`%${args.search}%`} OR customers.phone ILIKE ${`%${searchDigits || args.search}%`})`
      : sql``

    // `customers` is UNALIASED on purpose — the status predicates embed literal "customers"."…" refs that an alias would hide.
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
            vc.provider_campaign_name AS "campaignName",
            part.enrolled_at AS "enrolledAt",
            customers.lead_source_id AS "leadSourceId",
            ${gatedPhoneSql(canSeeUngated)} AS phone,
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
