// Customer business mutations that don't fit generic CRUD. Services call these;
// never reach for db.insert/update from a service layer.
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { CustomerNote } from '@/shared/db/schema/customer-notes'
import type { CustomerProfilePatch, CustomerProfileRow } from '@/shared/db/schema/customer-profiles'
import type { EnrichmentRecord, LeadMeta } from '@/shared/entities/customers/schemas'

import { and, eq } from 'drizzle-orm'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { upsertOneToOne } from '@/shared/dal/server/lib/upsert-one-to-one'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { customerEnrichment } from '@/shared/db/schema/customer-enrichment'
import { customerLeadAttribution, leadAttributionCaptureSchema } from '@/shared/db/schema/customer-lead-attribution'
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
    // Parse at the write boundary (mirrors upsertCustomerProfile) — the
    // capture snapshot's internal shape is pinned by leadMetaSchema.
    const validated = leadAttributionCaptureSchema.parse(attribution)
    dalVerifySuccess(await upsertOneToOne(
      customerLeadAttribution,
      customerLeadAttribution.customerId,
      input.customerId,
      validated,
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
 * Progressive funnel enrichment → rows. Replaces the former bespoke jsonb_set
 * merge with plain INSERT … ON CONFLICT (customer_id, step_id)
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
