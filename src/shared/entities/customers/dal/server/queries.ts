import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { CustomerEnrichmentRow } from '@/shared/db/schema/customer-enrichment'
import type { CustomerLeadAttributionRow } from '@/shared/db/schema/customer-lead-attribution'
import type { CustomerProfileRow } from '@/shared/db/schema/customer-profiles'
import type { Customer } from '@/shared/db/schema/customers'
import type { ProfileKey } from '@/shared/entities/customers/schemas'

import { and, asc, eq, getTableColumns, isNotNull, isNull } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customerEnrichment } from '@/shared/db/schema/customer-enrichment'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customerProfiles } from '@/shared/db/schema/customer-profiles'
import { customers } from '@/shared/db/schema/customers'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'
import { canSeeUngatedPhone, gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { profileCols } from '@/shared/entities/customers/lib/profile-select'
import { toNationalDigits } from '@/shared/lib/phone'

export type { Customer }

export type CustomerWithPhoneGate = Customer & { hasSentProposal: boolean }

// Composed read type for the flattened-spread leftJoin against
// `customer_profiles` (Addendum B, 2026-07-14). `| null` covers the ~82% of
// customers with no discovery data collected yet (lazy upsert — no child row).
// see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §10
export type CustomerWithProfile = CustomerWithPhoneGate & { [K in ProfileKey]: CustomerProfileRow[K] | null }

// Composed read type adding the 1:1 `customer_lead_attribution` child (NESTED,
// not flattened-spread like customer_profiles — attribution's generic column
// names like `kind`/`offer` would be ambiguous spread directly onto the
// customer) and the dynamic-key `customer_enrichment` rows. `attribution` is
// `null` for the pre-Wave-2 backfill gap / non-upserted rows (leftJoin miss);
// `enrichment` is `[]` when no funnel steps were captured.
export type CustomerFullView = CustomerWithProfile & {
  attribution: CustomerLeadAttributionRow | null
  enrichment: CustomerEnrichmentRow[]
}

// Phone-gating column selection. `canSeeUngatedPhone` tells us whether the
// caller is omni/leads-pool (sees real phone) or agent (sees gated null).
// When ability is null (SYSTEM_CONTEXT — jobs, webhooks), we ungate fully
// because SYSTEM-level callers never surface phone to a user.
// see ../../DOCS.md#phone-visibility-threshold
function customerSelectWithGate(ctx: ScopedContext) {
  const { phone: _phone, ...rest } = getTableColumns(customers)
  return {
    ...rest,
    phone: gatedPhoneSql(canSeeUngatedPhone(ctx.ability)),
    hasSentProposal: hasSentProposalSql(),
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/**
 * Phone-gated single-customer read, flattened-spread joined against
 * `customer_profiles` (1:1 child, Addendum B) — every profile-trio field
 * reads straight off the composed row — plus the NESTED `customer_lead_attribution`
 * child (leftJoin) and a second query for `customer_enrichment` rows (ordered
 * by `order` ascending — house batch-fetch idiom, no join). Scope applied via
 * ctx.scope (set by scopeMiddleware on the customers entity router, or by
 * buildUserContext for service/job callers).
 */
export async function getCustomer(
  ctx: ScopedContext,
  input: { id: string },
): Promise<DalReturn<CustomerFullView | undefined>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({
        ...customerSelectWithGate(ctx),
        ...profileCols(),
        attribution: getTableColumns(customerLeadAttribution),
      })
      .from(customers)
      .leftJoin(customerProfiles, eq(customerProfiles.customerId, customers.id))
      .leftJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
      .where(and(eq(customers.id, input.id), ctx.scope ?? undefined))

    if (!row) {
      return undefined
    }

    const attribution: CustomerLeadAttributionRow | null = row.attribution?.customerId
      ? row.attribution
      : null

    const enrichment = await db
      .select()
      .from(customerEnrichment)
      .where(eq(customerEnrichment.customerId, input.id))
      .orderBy(asc(customerEnrichment.order))

    return { ...row, attribution, enrichment } as CustomerFullView
  })
}

/**
 * Raw single-row read of the `customer_lead_attribution` 1:1 child. SYSTEM-level
 * (no phone-gating concern — attribution has no PII beyond what's already on
 * `customers`). Used wherever only the attribution snapshot is needed without
 * the full customer join (e.g. ads-reporting queries).
 */
export async function getCustomerAttribution(
  customerId: string,
): Promise<DalReturn<CustomerLeadAttributionRow | undefined>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(customerLeadAttribution)
      .where(eq(customerLeadAttribution.customerId, customerId))
    return row
  })
}

/**
 * Resolve a customer by exact phone (E.164). SYSTEM-level read — ungated,
 * returns the raw row (no phone-gating; callers are webhooks/jobs, never UI).
 * Phones can be shared across household members; returns the first match.
 * Used by the CloudTalk webhook to resolve an inbound STOP's customer.
 */
export async function findCustomerByPhone(phone: string): Promise<DalReturn<Customer | null>> {
  return dalDbOperation(async () => {
    // Normalize the lookup to the canonical storage shape (bare 10-digit) so an
    // E.164 / formatted input still matches — see @/shared/lib/phone.
    const national = toNationalDigits(phone)
    if (!national) {
      return null
    }
    const [row] = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, national))
      .limit(1)
    return row ?? null
  })
}

/**
 * Is this customer in the derived `leads` pipeline (pre-meeting: active, no
 * project, no meeting)? Used by the enrollment gate chain. SYSTEM-level read.
 */
export async function isCustomerInLeads(customerId: string): Promise<DalReturn<boolean>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, customerId), derivedPipelineWhere(['leads'])))
      .limit(1)
    return row !== undefined
  })
}

/**
 * Enrollment-eligible leads for a lead source (bulk "enroll all"): in the
 * `leads` pipeline, not DNC'd, with a phone. The per-customer "already
 * enrolled?" gate is applied downstream by the enroll op (idempotent skip).
 * SYSTEM-level read — returns raw rows (no phone-gating; job-only).
 */
export async function listEnrollableLeadsBySource(
  leadSourceId: string,
): Promise<DalReturn<Customer[]>> {
  return dalDbOperation(async () => {
    return db
      .select()
      .from(customers)
      .where(and(
        eq(customers.leadSourceId, leadSourceId),
        isNull(customers.dncOptedOutAt),
        isNotNull(customers.phone),
        derivedPipelineWhere(['leads']),
      ))
  })
}

/** Phone-gated list of all customers visible to ctx. */
export async function listCustomers(
  ctx: ScopedContext,
): Promise<DalReturn<CustomerWithPhoneGate[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select(customerSelectWithGate(ctx))
      .from(customers)
      .where(ctx.scope ?? undefined)
    return rows as CustomerWithPhoneGate[]
  })
}

// ── System-level upserts ──────────────────────────────────────────────────────
// Runs under SYSTEM_CONTEXT (funnel/webhook ingestion). Writes the customers
// table directly because it predates the entity-server pattern and is
// scheduled for migration to customerCrud.create in a follow-up.

interface HomeownerData {
  name: string
  email: string
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

export async function findOrCreateCustomerFromHomeowner(
  _ctx: ScopedContext,
  input: { data: HomeownerData },
): Promise<DalReturn<Customer>> {
  return dalDbOperation(async () => {
    const { data } = input
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, data.email))
      .limit(1)
    if (existing) {
      return existing
    }
    const [customer] = await db
      .insert(customers)
      .values({
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        address: data.address ?? null,
        city: data.city ?? '',
        state: data.state ?? null,
        zip: data.zip ?? '',
        syncedAt: new Date().toISOString(),
      })
      .returning()
    return customer
  })
}
