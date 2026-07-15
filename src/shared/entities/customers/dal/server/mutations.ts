// Customer business mutations that don't fit generic CRUD. Services call these;
// never reach for db.insert/update from a service layer.
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { CustomerNote } from '@/shared/db/schema/customer-notes'
import type { CustomerProfilePatch, CustomerProfileRow } from '@/shared/db/schema/customer-profiles'
import type { EnrichmentRecord, LeadMeta } from '@/shared/entities/customers/schemas'

import { and, eq, sql } from 'drizzle-orm'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { upsertOneToOne } from '@/shared/dal/server/lib/upsert-one-to-one'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { customerEnrichment } from '@/shared/db/schema/customer-enrichment'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { customerProfilePatchSchema, customerProfiles } from '@/shared/db/schema/customer-profiles'
import { customers } from '@/shared/db/schema/customers'
import { splitLeadMeta } from '../../lib/split-lead-meta'

/**
 * Append a note to a customer. `authorId` null = system/webhook-originated note
 * (Bina ingest); an agent id when authored from the UI. The single write path
 * for customer notes — the intake service, the Bina ingest, and the agent
 * `addNote` procedure all route through here (no inline `db.insert`).
 */
export async function addCustomerNote(
  input: { customerId: string, content: string, authorId?: string | null },
): Promise<DalReturn<CustomerNote>> {
  return dalDbOperation(async () => {
    const [note] = await db
      .insert(customerNotes)
      .values({
        customerId: input.customerId,
        content: input.content,
        authorId: input.authorId ?? null,
      })
      .returning()
    return note!
  })
}

/**
 * Atomically merge funnel enrichment keys into `leadMetaJSON.source.enrichment`.
 *
 * ROOT-CAUSE FIX for the lost-update race: a single `jsonb_set` statement merges
 * the payload into the CURRENTLY-COMMITTED enrichment object under row-lock, so
 * concurrent or out-of-order progressive-enrichment writes only ever ADD keys —
 * they can never clobber a sibling (the old read-modify-write rebuilt and
 * overwrote the whole `source`, dropping whichever dimension was answered first).
 * The merge is monotonic: re-sending the full accumulated record is idempotent.
 *
 * The funnel-lead capability check is the WHERE predicate (`source.kind = 'funnel'`),
 * so no separate authorization read is needed — a non-funnel/absent lead simply
 * matches zero rows. `updatedAt` stays auto via the column's `$onUpdate`.
 *
 * Intentionally bypasses generic `customerCrud.update` (and thus its geocode +
 * GCal-propagation hooks): enrichment is funnel metadata that feeds neither, so
 * routing through CRUD would only fire spurious side-effects per dimension. If a
 * GCal-rendered field ever derives from enrichment, revisit this bypass — see
 * the `update.after` propagation hook in ../../lib/server-spec.ts.
 */
export async function mergeFunnelEnrichment(
  input: { leadId: string, enrichment: EnrichmentRecord },
): Promise<DalReturn<{ matched: boolean }>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .update(customers)
      .set({
        leadMetaJSON: sql`jsonb_set(
          coalesce(${customers.leadMetaJSON}, '{}'::jsonb),
          '{source,enrichment}',
          coalesce(${customers.leadMetaJSON} #> '{source,enrichment}', '{}'::jsonb) || ${JSON.stringify(input.enrichment)}::jsonb
        )`,
      })
      .where(and(
        eq(customers.id, input.leadId),
        sql`${customers.leadMetaJSON} #>> '{source,kind}' = 'funnel'`,
      ))
      .returning({ id: customers.id })
    return { matched: row != null }
  })
}

/**
 * Lazy upsert into the `customer_profiles` 1:1 child table (Addendum B,
 * 2026-07-14). Row-exists = discovery data has been collected — first write
 * inserts, every write after updates the same row via `upsertOneToOne`.
 *
 * `ctx.scope` filters against `customers`, not the child table (the child has
 * no visibility predicate of its own), so a scoped caller (agent) is probed
 * against the parent row before the write; SYSTEM/omni callers (`ctx.scope ===
 * null`) skip straight to the upsert.
 */
export async function upsertCustomerProfile(
  ctx: ScopedContext,
  input: { customerId: string, patch: CustomerProfilePatch },
): Promise<DalReturn<CustomerProfileRow>> {
  return dalDbOperation(async () => {
    const validated = customerProfilePatchSchema.parse(input.patch)

    if (ctx.scope) {
      const [parent] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, input.customerId), ctx.scope))
        .limit(1)
      if (!parent) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
    }

    return dalVerifySuccess(
      await upsertOneToOne(customerProfiles, customerProfiles.customerId, input.customerId, validated),
    )
  })
}

/**
 * Capture-time attribution write (SYSTEM-only — no client surface). Called by
 * customerIntakeService.ingestLead right after customerCrud.create. Upsert so
 * re-ingest of an existing lead refreshes the snapshot idempotently.
 */
export async function upsertLeadAttribution(
  input: { customerId: string, leadMeta: LeadMeta },
): Promise<DalReturn<{ ok: true }>> {
  return dalDbOperation(async () => {
    const { attribution, enrichment } = splitLeadMeta(input.leadMeta)
    dalVerifySuccess(await upsertOneToOne(
      customerLeadAttribution,
      customerLeadAttribution.customerId,
      input.customerId,
      attribution,
    ))
    const rows = Object.entries(enrichment).map(([stepId, e]) => ({
      customerId: input.customerId,
      stepId,
      label: e.label,
      value: e.value,
      order: e.order,
    }))
    for (const row of rows) {
      await db.insert(customerEnrichment).values(row).onConflictDoUpdate({
        target: [customerEnrichment.customerId, customerEnrichment.stepId],
        set: { label: row.label, value: row.value, order: row.order },
      })
    }
    return { ok: true as const }
  })
}

/**
 * Progressive funnel enrichment → rows. Replaces mergeFunnelEnrichment's
 * bespoke jsonb_set with plain INSERT … ON CONFLICT (customer_id, step_id)
 * DO UPDATE (spec §3 W2.1). Monotonic and idempotent like its predecessor:
 * out-of-order sends only ever ADD/refresh keys. The funnel-kind check is the
 * capability gate — a non-funnel/absent lead returns matched:false. Still
 * bypasses customerCrud.update on purpose (no geocode/GCal side effects).
 */
export async function upsertFunnelEnrichment(
  input: { leadId: string, enrichment: EnrichmentRecord },
): Promise<DalReturn<{ matched: boolean }>> {
  return dalDbOperation(async () => {
    const [attr] = await db
      .select({ kind: customerLeadAttribution.kind })
      .from(customerLeadAttribution)
      .where(eq(customerLeadAttribution.customerId, input.leadId))
    if (attr?.kind !== 'funnel') {
      return { matched: false }
    }
    for (const [stepId, e] of Object.entries(input.enrichment)) {
      await db.insert(customerEnrichment)
        .values({ customerId: input.leadId, stepId, label: e.label, value: e.value, order: e.order })
        .onConflictDoUpdate({
          target: [customerEnrichment.customerId, customerEnrichment.stepId],
          set: { label: e.label, value: e.value, order: e.order },
        })
    }
    return { matched: true }
  })
}
