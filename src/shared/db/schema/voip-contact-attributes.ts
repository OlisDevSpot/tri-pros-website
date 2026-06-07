import type z from 'zod'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

// CT attribute-ID bridge — mirrors pre-defined `ContactAttribute` definitions
// from CT (GET /contacts/attributes.json) into our DB. Phase 1 uses 3 custom
// attributes: `Lead Source`, `Primary Trade`, `Trades Interested`. Built-in
// `name` + `city` use CT's first-class Contact fields and are NOT mirrored
// here.
//
// Why a separate table from `voip_campaigns`: attribute IDs are global to the
// CT account (one set of IDs for all campaigns), whereas campaign IDs are
// per-Campaign. Two concerns, two tables.
//
// see docs/plans/voip-campaigns/EPIC.md decisions log 2026-05-31
// see docs/plans/voip-campaigns/phase-1-implementation.md#w2

export const voipContactAttributes = pgTable('voip_contact_attributes', {
  id,
  // 'lead_source' | 'primary_trade' | 'trades_interested' — app-side key the
  // enrollment service writes against.
  appKey: text('app_key').notNull().unique(),
  // CT-assigned attribute ID — used in ContactAttribute writes via /contacts/edit
  // and /bulk/contacts.json payloads.
  ctAttributeId: text('ct_attribute_id').notNull().unique(),
  // 'Lead Source' / 'Primary Trade' / 'Trades Interested' — mirrored for
  // dashboard readability.
  ctTitle: text('ct_title').notNull(),
  lastSyncedAt: timestamp('last_synced_at', { mode: 'string', withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt,
  updatedAt,
})

export const selectVoipContactAttributeSchema = createSelectSchema(voipContactAttributes)
export type VoipContactAttribute = z.infer<typeof selectVoipContactAttributeSchema>

export const insertVoipContactAttributeSchema = createInsertSchema(voipContactAttributes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertVoipContactAttribute = z.infer<typeof insertVoipContactAttributeSchema>
