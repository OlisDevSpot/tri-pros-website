import type z from 'zod'
import { sql } from 'drizzle-orm'
import { check, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { customerNoteEntityTypes } from '@/shared/constants/enums/customer-notes'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'

export const customerNotes = pgTable('customer_notes', {
  id,
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  // A note whose entity was deleted stays on the customer; readers treat the entity as removed.
  entityType: text('entity_type', { enum: customerNoteEntityTypes }),
  entityId: uuid('entity_id'),
  createdAt,
  updatedAt,
}, table => ({
  entityLinkComplete: check('customer_notes_entity_link_complete', sql`(${table.entityType} IS NULL) = (${table.entityId} IS NULL)`),
}))

export const selectCustomerNoteSchema = createSelectSchema(customerNotes)
export type CustomerNote = z.infer<typeof selectCustomerNoteSchema>

export const insertCustomerNoteSchema = createInsertSchema(customerNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertCustomerNote = z.infer<typeof insertCustomerNoteSchema>
