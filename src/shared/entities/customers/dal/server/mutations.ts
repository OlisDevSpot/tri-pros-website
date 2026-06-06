// Customer business mutations that don't fit generic CRUD. Services call these;
// never reach for db.insert/update from a service layer.
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customerNotes } from '@/shared/db/schema/customer-notes'

/**
 * Append a note to a customer. `authorId` null = system/webhook-originated note.
 * Replaces the two inline `db.insert(customerNotes)` copies (Bina route +
 * createFromIntake) — both now flow through the intake service.
 */
export async function addCustomerNote(
  input: { customerId: string, content: string, authorId?: string | null },
): Promise<DalReturn<{ id: string }>> {
  return dalDbOperation(async () => {
    const [note] = await db
      .insert(customerNotes)
      .values({
        customerId: input.customerId,
        content: input.content,
        authorId: input.authorId ?? null,
      })
      .returning({ id: customerNotes.id })
    return note!
  })
}
