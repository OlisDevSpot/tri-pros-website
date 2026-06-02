import type z from 'zod'
import type { LeadSourceFormConfig, VoipConfig } from '@/shared/entities/lead-sources/schemas'
import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { leadSourceFormConfigSchema, voipConfigSchema } from '@/shared/entities/lead-sources/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

export const leadSourcesTable = pgTable('lead_sources', {
  id,
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  token: text('token').notNull().unique(),
  formConfigJSON: jsonb('form_config_json').$type<LeadSourceFormConfig>().notNull(),
  // Per-source VoIP policy. Each EPIC owns a sub-object (`campaigns` for
  // voip-campaigns, `inHouse` for voip-in-house). APP-side policy only —
  // CT-runtime identity lives in voip_campaigns + voip_contact_attributes tables.
  // see docs/plans/voip/INTEGRATION-SEAM.md §9
  voipConfigJSON: jsonb('voip_config_json').$type<VoipConfig>(),
  isActive: boolean('is_active').notNull().default(true),
  archivedAt: timestamp('archived_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
})

export const selectLeadSourceSchema = createSelectSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
  voipConfigJSON: voipConfigSchema.nullable(),
})
export type LeadSourceRecord = z.infer<typeof selectLeadSourceSchema>

export const insertLeadSourceSchema = createInsertSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
  voipConfigJSON: voipConfigSchema.optional(),
}).omit({ id: true, createdAt: true, updatedAt: true })
export type InsertLeadSource = z.infer<typeof insertLeadSourceSchema>
