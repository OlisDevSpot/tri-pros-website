import type z from 'zod'
import { integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'

// Dynamic-key funnel enrichment map decomposed to rows (Addendum B: dynamic-key
// map → child table with UNIQUE(parent_id, key)). Replaces the former bespoke
// jsonb_set enrichment merge with plain INSERT … ON CONFLICT
// (customer_id, step_id) DO UPDATE. `value` is the resolved option LABEL
// (self-describing, no server-side label mirror); `order` drives display.
export const customerEnrichment = pgTable('customer_enrichment', {
  id,
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  stepId: text('step_id').notNull(),
  label: text('label').notNull(),
  value: text('value').notNull(),
  order: integer('order').notNull(),
  createdAt,
  updatedAt,
}, table => [
  unique('customer_enrichment_customer_step_uq').on(table.customerId, table.stepId),
])

export const selectCustomerEnrichmentSchema = createSelectSchema(customerEnrichment)
export type CustomerEnrichmentRow = z.infer<typeof selectCustomerEnrichmentSchema>

export const insertCustomerEnrichmentSchema = createInsertSchema(customerEnrichment)
  .omit({ id: true, createdAt: true, updatedAt: true })
export type InsertCustomerEnrichment = z.infer<typeof insertCustomerEnrichmentSchema>
