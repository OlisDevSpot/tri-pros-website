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

// `| null`: the profile child row is lazily upserted, so most customers have none yet.
export type CustomerWithProfile = CustomerWithPhoneGate & { [K in ProfileKey]: CustomerProfileRow[K] | null }

// `attribution` is nested, not spread: its generic column names (`kind`, `offer`) would be ambiguous on the customer.
export type CustomerFullView = CustomerWithProfile & {
  attribution: CustomerLeadAttributionRow | null
  enrichment: CustomerEnrichmentRow[]
}

// A null ability (SYSTEM_CONTEXT) is ungated: system callers never surface the phone to a user.
function customerSelectWithGate(ctx: ScopedContext) {
  const { phone: _phone, ...rest } = getTableColumns(customers)
  return {
    ...rest,
    phone: gatedPhoneSql(canSeeUngatedPhone(ctx.ability)),
    hasSentProposal: hasSentProposalSql(),
  }
}

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

/** Ungated: attribution carries no PII beyond what is already on `customers`. */
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

/** Ungated (webhook/job callers, never UI). Phones can be shared across a household — first match wins. */
export async function findCustomerByPhone(phone: string): Promise<DalReturn<Customer | null>> {
  return dalDbOperation(async () => {
    // Phone is stored as bare 10 digits, so E.164/formatted input is normalized first.
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

/** Ungated (job-only). The "already enrolled?" gate is applied downstream by the enroll op. */
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

// TODO: migrate to customerCrud.create — writes `customers` directly because it predates the entity-server pattern.
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
