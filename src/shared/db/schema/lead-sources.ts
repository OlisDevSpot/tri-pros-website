import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type z from 'zod'
import type { LeadSourceFormConfig, VoipConfig, VoipInHousePolicy } from '@/shared/entities/lead-sources/schemas'
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { voipCampaigns } from './voip-campaigns'

export const leadSourcesTable = pgTable('lead_sources', {
  id,
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  token: text('token').notNull().unique(),
  formConfigJSON: jsonb('form_config_json').$type<LeadSourceFormConfig>().notNull(),
  /**
   * @deprecated Wave-1 frozen (epic #256/#259). Zero writers. Read only by
   * scripts/backfill-wave1-columns.ts. Dropped next release.
   */
  voipConfigJSONDeprecated: jsonb('voip_config_json').$type<VoipConfig>(),
  // ── Wave-1 decomposition: voipConfigJSONDeprecated.campaigns → columns (epic #256 / #259) ──
  // Ownership semantics unchanged: policy is SOURCE-owned; campaigns stay pools.
  // Unset defaultCampaignId ⇒ auto-enroll inert (no guessing).
  // see src/shared/entities/lead-sources/DOCS.md
  voipCampaignsEnabled: boolean('voip_campaigns_enabled').notNull().default(true),
  voipAutoEnroll: boolean('voip_auto_enroll').notNull().default(false),
  defaultCampaignId: uuid('default_campaign_id').references((): AnyPgColumn => voipCampaigns.id, { onDelete: 'set null' }),
  dailyDialVolumeCap: integer('daily_dial_volume_cap'),
  messageTemplateOverridesJSON: jsonb('message_template_overrides_json').$type<Record<string, string>>(),
  // voip-in-house sub-object — dynamic template maps, correctly JSONB. Own column
  // so the two EPICs' writers never contend on one blob.
  voipInHouseConfigJSON: jsonb('voip_inhouse_config_json').$type<VoipInHousePolicy>(),
  isActive: boolean('is_active').notNull().default(true),
  archivedAt: timestamp('archived_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
})

// No override for the deprecated blob — uniform with how customers.ts
// handles its frozen profile trio (drizzle-zod infers from the column's
// `.$type<>()`). Frozen; select-side typing precision doesn't matter.
export const selectLeadSourceSchema = createSelectSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
})
export type LeadSourceRecord = z.infer<typeof selectLeadSourceSchema>

export const insertLeadSourceSchema = createInsertSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  // Wave-1 frozen — no caller may write the deprecated blob anymore.
  voipConfigJSONDeprecated: true,
})
export type InsertLeadSource = z.infer<typeof insertLeadSourceSchema>
