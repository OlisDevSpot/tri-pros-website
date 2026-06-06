import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Customer } from '@/shared/db/schema/customers'
import type { Contact } from '@/shared/services/providers/notion/lib/contacts/schema'

import { and, count, eq, getTableColumns, isNotNull, isNull } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'
import { gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { queryNotionDatabase } from '@/shared/services/providers/notion/dal/query-notion-database'
import { pageToContact } from '@/shared/services/providers/notion/lib/contacts/adapter'

export type { Customer }

export type CustomerWithPhoneGate = Customer & { hasSentProposal: boolean }

// Phone-gating column selection. The `ability` on ctx tells us whether the
// caller is super-admin (sees real phone) or agent (sees gated null). When
// ability is null (SYSTEM_CONTEXT — jobs, webhooks), we ungate fully because
// SYSTEM-level callers never surface phone to a user.
// see ../../DOCS.md#phone-visibility-threshold
function customerSelectWithGate(ctx: ScopedContext) {
  const isOmni = ctx.ability == null || ctx.ability.can('manage', 'all')
  const { phone: _phone, ...rest } = getTableColumns(customers)
  return {
    ...rest,
    phone: gatedPhoneSql(isOmni),
    hasSentProposal: hasSentProposalSql(),
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/**
 * Phone-gated single-customer read. Scope applied via ctx.scope (set by
 * scopeMiddleware on the customers entity router, or by buildUserContext
 * for service/job callers).
 */
export async function getCustomer(
  ctx: ScopedContext,
  input: { id: string },
): Promise<DalReturn<CustomerWithPhoneGate | undefined>> {
  return dalDbOperation(async () => {
    const [customer] = await db
      .select(customerSelectWithGate(ctx))
      .from(customers)
      .where(and(eq(customers.id, input.id), ctx.scope ?? undefined))
    return customer as CustomerWithPhoneGate | undefined
  })
}

/**
 * Resolve a customer by exact phone (E.164). SYSTEM-level read — ungated,
 * returns the raw row (no phone-gating; callers are webhooks/jobs, never UI).
 * Phones can be shared across household members; returns the first match.
 * Used by the CloudTalk webhook to resolve an inbound STOP's customer.
 */
export async function findCustomerByPhone(phoneE164: string): Promise<DalReturn<Customer | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, phoneE164))
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

/**
 * Count enrollment-eligible leads grouped by lead source id (leads pipeline,
 * not DNC'd, has phone). Powers the Campaigns Control Center "eligible" badge.
 * Does NOT subtract already-enrolled customers — that "active enrollment" gate
 * is per-customer and lives in the enroll op; this is the upper-bound pool.
 */
export async function countEligibleLeadsBySource(): Promise<DalReturn<Record<string, number>>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({ leadSourceId: customers.leadSourceId, n: count() })
      .from(customers)
      .where(and(
        isNotNull(customers.leadSourceId),
        isNull(customers.dncOptedOutAt),
        isNotNull(customers.phone),
        derivedPipelineWhere(['leads']),
      ))
      .groupBy(customers.leadSourceId)

    const out: Record<string, number> = {}
    for (const row of rows) {
      if (row.leadSourceId) {
        out[row.leadSourceId] = row.n
      }
    }
    return out
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
// These run under SYSTEM_CONTEXT (Notion sync, webhook ingestion). They write
// the customers table directly because they predate the entity-server pattern
// and are scheduled for migration to customerCrud.create in a follow-up. For
// now, signature-standardize them.

export async function upsertCustomerFromNotion(
  _ctx: ScopedContext,
  input: { contact: Contact },
): Promise<DalReturn<Customer>> {
  return dalDbOperation(async () => {
    const { contact } = input
    const now = new Date().toISOString()
    const [customer] = await db
      .insert(customers)
      .values({
        notionContactId: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        address: contact.address,
        city: contact.city,
        state: contact.state,
        zip: contact.zip,
        syncedAt: now,
      })
      .onConflictDoUpdate({
        target: customers.notionContactId,
        set: {
          name: contact.name,
          phone: contact.phone ?? null,
          email: contact.email ?? null,
          address: contact.address ?? null,
          city: contact.city ?? '',
          state: contact.state ?? null,
          zip: contact.zip ?? '',
          syncedAt: now,
        },
      })
      .returning()
    return customer
  })
}

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

// ── Notion full sync ──────────────────────────────────────────────────────────

export async function syncAllCustomers(
  ctx: ScopedContext,
): Promise<DalReturn<{ upserted: number }>> {
  return dalDbOperation(async () => {
    const pages = await queryNotionDatabase('contacts') as PageObjectResponse[] | undefined
    if (!pages) {
      return { upserted: 0 }
    }
    let upserted = 0
    for (const page of pages) {
      try {
        const contact = pageToContact(page)
        const result = await upsertCustomerFromNotion(ctx, { contact })
        if (result.success) {
          upserted++
        }
      }
      catch {
        // Skip malformed Notion contacts — do not abort the full sync
      }
    }
    return { upserted }
  })
}
