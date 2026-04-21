import type z from 'zod'
import type { CustomerProfile, FinancialProfile, LeadMeta, PropertyProfile } from '@/shared/entities/customers/schemas'
import { doublePrecision, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { customerProfileSchema, financialProfileSchema, leadMetaSchema, propertyProfileSchema } from '@/shared/entities/customers/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { leadSourcesTable } from './lead-sources'
import { customerPipelineEnum, leadTypeEnum } from './meta'

export const customers = pgTable('customers', {
  id,
  notionContactId: text('notion_contact_id').unique(),
  qbCustomerId: text('qb_customer_id'),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  city: text('city').notNull(),
  state: varchar('state', { length: 2 }).default('CA'),
  zip: text('zip').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  geocodedAt: timestamp('geocoded_at', { mode: 'string', withTimezone: true }),
  customerProfileJSON: jsonb('customer_profile_json').$type<CustomerProfile>(),
  propertyProfileJSON: jsonb('property_profile_json').$type<PropertyProfile>(),
  financialProfileJSON: jsonb('financial_profile_json').$type<FinancialProfile>(),
  leadSourceId: uuid('lead_source_id').references(() => leadSourcesTable.id, { onDelete: 'set null' }),
  leadType: leadTypeEnum('lead_type'),
  leadMetaJSON: jsonb('lead_meta_json').$type<LeadMeta>(),
  /** @deprecated Pipeline now lives on meetings.pipeline. Will be removed after backfill migration. */
  pipeline: customerPipelineEnum('pipeline').notNull().default('active'),
  /** Lead stage for customers with no meetings (leads pipeline). Default: 'new'. */
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
  leadMetaJSON: leadMetaSchema.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertCustomerSchema = z.infer<typeof insertCustomerSchema>
