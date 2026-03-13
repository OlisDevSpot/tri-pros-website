import type z from 'zod'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

// No Drizzle relations defined here — avoids circular imports.
// The one() relations live on the FK-owning side (proposals, meetings).
export const customers = pgTable('customers', {
  id,
  notionContactId: text('notion_contact_id').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  city: text('city').notNull().default(''),
  state: text('state'),
  zip: text('zip').notNull().default(''),
  syncedAt: timestamp('synced_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  createdAt,
  updatedAt,
})

export const selectCustomerSchema = createSelectSchema(customers)
export type Customer = z.infer<typeof selectCustomerSchema>

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertCustomerSchema = z.infer<typeof insertCustomerSchema>
