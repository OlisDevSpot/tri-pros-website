import type z from 'zod'

import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { createdAt, id } from '../lib/schema-helpers'

export const binaWebhookLogs = pgTable('bina_webhook_logs', {
  id,
  ghlEventType: text('ghl_event_type').notNull(),
  ghlLocationId: text('ghl_location_id'),
  ghlResourceId: text('ghl_resource_id'),
  payload: jsonb('payload').notNull(),
  matchedTrades: jsonb('matched_trades'),
  processedAt: timestamp('processed_at', { mode: 'string', withTimezone: true }),
  createdAt,
})

export const selectBinaWebhookLogSchema = createSelectSchema(binaWebhookLogs)
export type BinaWebhookLog = z.infer<typeof selectBinaWebhookLogSchema>

export const insertBinaWebhookLogSchema = createInsertSchema(binaWebhookLogs).omit({
  id: true,
  createdAt: true,
})
export type InsertBinaWebhookLog = z.infer<typeof insertBinaWebhookLogSchema>
