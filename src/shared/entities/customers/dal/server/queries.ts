import type z from 'zod'
import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { PaginatedResult } from '@/shared/dal/lib/query/paginated-result'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { CustomerEnrichmentRow } from '@/shared/db/schema/customer-enrichment'
import type { CustomerLeadAttributionRow } from '@/shared/db/schema/customer-lead-attribution'
import type { CustomerProfileRow } from '@/shared/db/schema/customer-profiles'
import type { Customer } from '@/shared/db/schema/customers'
import type { ProfileKey } from '@/shared/entities/customers/schemas'

import { and, asc, eq, getTableColumns, isNotNull, isNull } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { fieldListInput } from '@/shared/dal/server/lib/query/field-list-input'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'
import { db } from '@/shared/db'
import { customerEnrichment } from '@/shared/db/schema/customer-enrichment'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customerProfiles } from '@/shared/db/schema/customer-profiles'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'
import { CUSTOMER_FIELD_SQL } from '@/shared/entities/customers/dal/server/customer-field-sql'
import { derivedPipelineSql, derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'
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

export const customerListInputSchema = fieldListInput(CUSTOMER_FIELDS, { pagination: true })
export type CustomerListInput = z.infer<typeof customerListInputSchema>

export interface CustomerListRow {
  id: string
  name: string
  email: string | null
  createdAt: string
  /** The derived five-bucket pipeline, not the stored three-bucket column. */
  pipeline: Pipeline
  leadSourceId: string | null
  leadSourceName: string | null
  leadSourceSlug: string | null
}

/** One customers list for every table: callers scope through `ctx.scope` and pin a source or segment through fixed filters. */
export async function listCustomers(ctx: ScopedContext, input: CustomerListInput): Promise<DalReturn<PaginatedResult<CustomerListRow>>> {
  return dalDbOperation(async () => {
    const where = and(
      ctx.scope ?? undefined,
      buildSearchWhere(input.search, [customers.name, customers.email]),
      CUSTOMER_FIELD_SQL.where(input.filters),
    )

    return paginate({
      query: () => db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          createdAt: customers.createdAt,
          pipeline: derivedPipelineSql(),
          leadSourceId: customers.leadSourceId,
          leadSourceName: leadSourcesTable.name,
          leadSourceSlug: leadSourcesTable.slug,
        })
        .from(customers)
        .leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))
        .where(where)
        .orderBy(...CUSTOMER_FIELD_SQL.orderBy(input.sort))
        .limit(input.pagination.limit)
        .offset(input.pagination.offset),
      count: () => db.$count(customers, where),
    })
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
