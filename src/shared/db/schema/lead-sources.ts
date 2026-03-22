import type z from 'zod'
import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'
import { boolean, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

export const leadSourcesTable = pgTable('lead_sources', {
  id,
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  token: text('token').notNull().unique(),
  formConfigJSON: jsonb('form_config_json').$type<LeadSourceFormConfig>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt,
  updatedAt,
})

export const selectLeadSourceSchema = createSelectSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
})
export type LeadSourceRecord = z.infer<typeof selectLeadSourceSchema>

export const insertLeadSourceSchema = createInsertSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
}).omit({ id: true, createdAt: true, updatedAt: true })
export type InsertLeadSource = z.infer<typeof insertLeadSourceSchema>
