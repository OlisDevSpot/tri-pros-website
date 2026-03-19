import type z from 'zod'
import type { CustomerProfile, FinancialProfile, PropertyProfile } from '@/shared/entities/customers/schemas'
import { jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { customerPipelineEnum } from './meta'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { customerProfileSchema, financialProfileSchema, propertyProfileSchema } from '@/shared/entities/customers/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

export const customers = pgTable('customers', {
  id,
  notionContactId: text('notion_contact_id').unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  city: text('city').notNull(),
  state: varchar('state', { length: 2 }).default('CA'),
  zip: text('zip').notNull(),
  customerProfileJSON: jsonb('customer_profile_json').$type<CustomerProfile>(),
  propertyProfileJSON: jsonb('property_profile_json').$type<PropertyProfile>(),
  financialProfileJSON: jsonb('financial_profile_json').$type<FinancialProfile>(),
  pipeline: customerPipelineEnum('pipeline').notNull().default('active'),
  pipelineStage: text('pipeline_stage'),
  syncedAt: timestamp('synced_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  createdAt,
  updatedAt,
})

export const selectCustomerSchema = createSelectSchema(customers, {
  propertyProfileJSON: propertyProfileSchema.nullable(),
  financialProfileJSON: financialProfileSchema.nullable(),
})
export type Customer = z.infer<typeof selectCustomerSchema>

export const insertCustomerSchema = createInsertSchema(customers, {
  customerProfileJSON: customerProfileSchema.optional(),
  propertyProfileJSON: propertyProfileSchema.optional(),
  financialProfileJSON: financialProfileSchema.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertCustomerSchema = z.infer<typeof insertCustomerSchema>
