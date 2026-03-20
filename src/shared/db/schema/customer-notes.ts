import type z from 'zod'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'

export const customerNotes = pgTable('customer_notes', {
  id,
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
})

export const selectCustomerNoteSchema = createSelectSchema(customerNotes)
export type CustomerNote = z.infer<typeof selectCustomerNoteSchema>

export const insertCustomerNoteSchema = createInsertSchema(customerNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertCustomerNote = z.infer<typeof insertCustomerNoteSchema>
