import type z from 'zod'
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { user } from './auth'

// app_settings — generic per-feature config storage. Natural PK `feature`
// (examples: 'voip-in-house', 'voip-campaigns', 'compliance'). Each feature
// owns a Zod schema in its entity dir that validates `configJson` at write time.
//
// see docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS — app_settings
export const appSettings = pgTable('app_settings', {
  feature: text('feature').primaryKey(),
  configJson: jsonb('config_json').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  updatedByUserId: text('updated_by_user_id').references(() => user.id, { onDelete: 'set null' }),
})

export const selectAppSettingSchema = createSelectSchema(appSettings)
export type AppSetting = z.infer<typeof selectAppSettingSchema>

export const insertAppSettingSchema = createInsertSchema(appSettings).omit({
  updatedAt: true,
})
export type InsertAppSettingSchema = z.infer<typeof insertAppSettingSchema>
