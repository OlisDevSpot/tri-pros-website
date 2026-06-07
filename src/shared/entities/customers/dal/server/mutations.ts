// Customer business mutations that don't fit generic CRUD. Services call these;
// never reach for db.insert/update from a service layer.
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { CustomerNote } from '@/shared/db/schema/customer-notes'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customerNotes } from '@/shared/db/schema/customer-notes'

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
