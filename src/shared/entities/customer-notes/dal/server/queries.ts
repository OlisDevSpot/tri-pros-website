import type { CustomerNoteEntityType } from '@/shared/constants/enums/customer-notes'
import type { CustomerNoteWithAuthor } from '@/shared/entities/customers/types'

import { and, desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customerNotes } from '@/shared/db/schema/customer-notes'

/** Notes linked to any of these things the customer owns, newest first. The customer id keeps a link to another customer's entity from showing. */
export async function listNotesForEntity(input: { customerId: string, entityType: CustomerNoteEntityType, entityIds: string[] }): Promise<CustomerNoteWithAuthor[]> {
  return db
    .select({
      id: customerNotes.id,
      customerId: customerNotes.customerId,
      content: customerNotes.content,
      authorId: customerNotes.authorId,
      entityType: customerNotes.entityType,
      entityId: customerNotes.entityId,
      createdAt: customerNotes.createdAt,
      updatedAt: customerNotes.updatedAt,
      authorName: user.name,
      authorImage: user.image,
    })
    .from(customerNotes)
    .leftJoin(user, eq(user.id, customerNotes.authorId))
    .where(and(
      eq(customerNotes.customerId, input.customerId),
      eq(customerNotes.entityType, input.entityType),
      inArray(customerNotes.entityId, input.entityIds),
    ))
    .orderBy(desc(customerNotes.createdAt))
}
