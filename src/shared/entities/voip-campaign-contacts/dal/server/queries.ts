// Business queries for the voip-campaign-contacts entity.
// see ../../DOCS.md for business rules + the membership state model.
// All DAL conventions: see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'

import { and, count, desc, eq, isNull } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { voipCampaignContacts } from '@/shared/db/schema/voip-campaign-contacts'
import { voipCampaigns } from '@/shared/db/schema/voip-campaigns'

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
