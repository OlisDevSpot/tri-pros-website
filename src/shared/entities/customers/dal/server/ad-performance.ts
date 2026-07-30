// Paid-Meta ad-performance aggregations, keyed by adKey (utm_content).
// The ONLY home for these SQL rollups — domains/analytics/sources/local/* call
// THESE, never db (hard DAL rule, ADR-0002:157). SYSTEM-level omni reads: no ctx,
// not visibility-scoped (precedent: listEnrollableLeadsBySource in queries.ts).
import type { SQL } from 'drizzle-orm'
import type { DalReturn } from '@/shared/dal/server/types'
import { and, eq, gte, isNotNull, lte, sql } from 'drizzle-orm'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { isSignedCustomerSql } from '@/shared/entities/customers/lib/signed-customer-sql'

interface DateRangeInput {
  start: Date
  end: Date
}

export interface AdKeyLeads {
  adKey: string
  leads: number
}

export interface AdKeyAppointments {
  adKey: string
  appointments: number
}

export interface AdKeySigned {
  adKey: string
  signed: number
}

/**
 * Paid Meta AD click scope. utm_source=meta AND utm_medium=paid is emitted
 * SOLELY by scripts/meta/sync/ad-link.ts (buildUrlTags) — the one signal of a
 * paid ad click. Deliberately narrower than customers.leadSourceId='branded-meta-ads'
 * (which also counts organic funnel visitors with no attribution). Exported for
 * reuse by future Sales/Marketing DAL reads.
 */
export const brandedMetaPaidScope = and(
  eq(customerLeadAttribution.utmSource, 'meta'),
  eq(customerLeadAttribution.utmMedium, 'paid'),
)!

/**
 * Shared per-adKey cohort filter: paid-Meta scope + non-null adKey + lead-creation
 * date window (customers.createdAt). Extracted once so the three aggregations can
 * never drift apart. `extra` folds in a per-metric predicate (e.g. isSignedCustomerSql()).
 */
function paidMetaByAdKeyWhere(range: DateRangeInput, extra?: SQL): SQL {
  return and(
    brandedMetaPaidScope,
    isNotNull(customerLeadAttribution.utmContent),
    gte(customers.createdAt, range.start.toISOString()),
    lte(customers.createdAt, range.end.toISOString()),
    extra,
  )!
}

/** First-party lead count per adKey (paid-Meta attribution rows in range). */
export async function leadsByAdKey(range: DateRangeInput): Promise<DalReturn<AdKeyLeads[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        count: sql<number>`COUNT(${customerLeadAttribution.customerId})::int`,
      })
      .from(customerLeadAttribution)
      .innerJoin(customers, eq(customers.id, customerLeadAttribution.customerId))
      .where(paidMetaByAdKeyWhere(range))
      .groupBy(customerLeadAttribution.utmContent)
    return rows.map(r => ({ adKey: r.adKey as string, leads: r.count }))
  })
}

/** Appointments = distinct customers with ≥1 meeting, per adKey in range. */
export async function appointmentsByAdKey(range: DateRangeInput): Promise<DalReturn<AdKeyAppointments[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        count: sql<number>`COUNT(DISTINCT ${meetings.customerId})::int`,
      })
      .from(meetings)
      .innerJoin(customers, eq(customers.id, meetings.customerId))
      .innerJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
      .where(paidMetaByAdKeyWhere(range))
      .groupBy(customerLeadAttribution.utmContent)
    return rows.map(r => ({ adKey: r.adKey as string, appointments: r.count }))
  })
}

/** Signed customers (≥1 project) per adKey in range. */
export async function signedByAdKey(range: DateRangeInput): Promise<DalReturn<AdKeySigned[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        count: sql<number>`COUNT(DISTINCT ${customers.id})::int`,
      })
      .from(customers)
      .innerJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
      .where(paidMetaByAdKeyWhere(range, isSignedCustomerSql()))
      .groupBy(customerLeadAttribution.utmContent)
    return rows.map(r => ({ adKey: r.adKey as string, signed: r.count }))
  })
}
