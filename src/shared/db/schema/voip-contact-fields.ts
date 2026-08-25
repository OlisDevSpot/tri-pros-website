import type z from 'zod'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

// Dialer custom-field bridge — mirrors the provider's (JustCall) pre-defined
// Sales Dialer custom-field definitions into our DB. Go-live uses 4 fields:
// `Lead Source`, `Primary Trade`, `Trades Interested`, `Lead Created At`.
// Built-in `name` uses the provider's first-class contact field and is NOT
// mirrored here.
//
// JustCall custom-field IDs are numeric and pre-created in the dashboard; the
// enrollment service resolves app_key → provider_field_id → numeric
// `custom_fields:[{id,value}]` at push time. Field IDs are global to the account
// (one set for all campaigns), whereas campaign IDs are per-campaign — two
// concerns, two tables.
//
// see docs/plans/voip-campaigns/EPIC.md
// see docs/superpowers/specs/2026-08-19-justcall-dialer-migration-design.md

export const voipContactFields = pgTable('voip_contact_fields', {
  id,
  // 'lead_source' | 'primary_trade' | 'trades_interested' | 'lead_created_at' —
  // app-side key the enrollment service writes against.
  appKey: text('app_key').notNull().unique(),
  // Provider-assigned custom-field ID (numeric, stored as text) — used in the
  // dialer `custom_fields:[{id,value}]` enroll payload.
  providerFieldId: text('provider_field_id').notNull().unique(),
  // 'Lead Source' / 'Primary Trade' / ... — mirrored for dashboard readability.
  providerFieldLabel: text('provider_field_label').notNull(),
  lastSyncedAt: timestamp('last_synced_at', { mode: 'string', withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt,
  updatedAt,
})

export const selectVoipContactFieldSchema = createSelectSchema(voipContactFields)
export type VoipContactField = z.infer<typeof selectVoipContactFieldSchema>

export const insertVoipContactFieldSchema = createInsertSchema(voipContactFields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertVoipContactField = z.infer<typeof insertVoipContactFieldSchema>
