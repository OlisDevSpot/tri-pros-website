// Customer business mutations that don't fit generic CRUD. Services call these;
// never reach for db.insert/update from a service layer.
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { CustomerNote } from '@/shared/db/schema/customer-notes'
import type { EnrichmentRecord } from '@/shared/entities/customers/schemas'

import { and, eq, sql } from 'drizzle-orm'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { customers } from '@/shared/db/schema/customers'

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
